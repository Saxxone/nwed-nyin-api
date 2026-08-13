import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { FileService } from '../file/file.service';
import { Prisma, Role, User, Word } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  prepareSearchQuery,
  searchTokenVariants,
  scoreSearchText,
  type PreparedSearchQuery,
  type SearchTextWeights,
} from '../search/search-relevance';
import { UserService } from '../user/user.service';
import { CreateDictionaryDto } from './dto/create-dictionary.dto';
import { UpdateDictionaryDto } from './dto/update-dictionary.dto';

export type DictionarySearchMatch = {
  field: 'term' | 'alt_spelling' | 'meaning';
  text: string;
};

export type DictionarySearchHit = Word & {
  definitions: Array<{
    id: string;
    meaning: string;
    [key: string]: unknown;
  }>;
  search_match: DictionarySearchMatch;
};

type DictionarySearchCandidate = Omit<DictionarySearchHit, 'search_match'>;

const DICTIONARY_SEARCH_MAX_CANDIDATES = 400;

const DICTIONARY_TERM_WEIGHTS: SearchTextWeights = {
  exact: 600,
  phrase: 260,
  prefix: 120,
  token: 52,
  substring: 24,
  coverage: 90,
};

const DICTIONARY_ALT_SPELLING_WEIGHTS: SearchTextWeights = {
  exact: 520,
  phrase: 230,
  prefix: 100,
  token: 46,
  substring: 20,
  coverage: 80,
};

const DICTIONARY_MEANING_WEIGHTS: SearchTextWeights = {
  exact: 320,
  phrase: 240,
  prefix: 35,
  token: 34,
  substring: 8,
  coverage: 180,
};

@Injectable()
export class DictionaryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly userService: UserService,
    private readonly fileService: FileService,
  ) {}

  private readonly alive_word_filter: Prisma.WordWhereInput = {
    deleted_at: null,
  };

  private readonly word_include = {
    pronunciation_audios: {
      select: {
        id: true,
        format: true,
        file: {
          select: {
            id: true,
            url: true,
          },
        },
      },
    },
    definitions: {
      include: {
        part_of_speech: true,
        examples: true,
        synonyms: true,
        antonyms: true,
      },
    },
  } satisfies Prisma.WordInclude;

  private denyDictionaryViewer(actor: Role) {
    if (actor === Role.VIEWER) {
      throw new ForbiddenException('Viewers cannot modify dictionary entries.');
    }
  }

  private assertWordContributorOrAdmin(
    actor: User,
    word: Word & {
      contributors: { id: string }[];
    },
  ) {
    if (actor.role === Role.ADMIN) {
      return;
    }
    if (word.contributors.some((c) => c.id === actor.id)) {
      return;
    }
    throw new ForbiddenException('You cannot modify this word');
  }

  private treatInvalidUndefinedNull(val: any) {
    if (val == null) return undefined;
    if (typeof val !== 'string') return undefined;
    const t = val.trim().toLocaleLowerCase();
    if (!t || t === 'undefined' || t === 'null' || t === 'nan') {
      return undefined;
    }
    return val.trim();
  }

  private async findSortedWordIds({
    alphabet,
    cursor,
    skip,
    take,
  }: {
    alphabet?: string;
    cursor?: string;
    skip?: number;
    take?: number;
  }): Promise<string[]> {
    const safeSkip =
      typeof skip === 'number' && Number.isFinite(skip) ? Math.max(0, skip) : 0;
    const safeTake =
      typeof take === 'number' && Number.isFinite(take)
        ? Math.max(0, take)
        : 50;
    const cursor_word = cursor
      ? await this.prisma.word.findFirst({
          where: { id: cursor, ...this.alive_word_filter },
          select: { id: true, term: true },
        })
      : null;
    const alphabet_filter = alphabet
      ? Prisma.sql`AND LOWER(\`term\`) >= LOWER(${alphabet})`
      : Prisma.empty;
    const cursor_filter = cursor_word
      ? Prisma.sql`
        AND (
          LOWER(\`term\`) > LOWER(${cursor_word.term})
          OR (
            LOWER(\`term\`) = LOWER(${cursor_word.term})
            AND \`term\` > ${cursor_word.term}
          )
          OR (
            LOWER(\`term\`) = LOWER(${cursor_word.term})
            AND \`term\` = ${cursor_word.term}
            AND \`id\` > ${cursor_word.id}
          )
        )
      `
      : Prisma.empty;
    const rows = await this.prisma.$queryRaw<{ id: string }[]>(Prisma.sql`
      SELECT \`id\`
      FROM \`Word\`
      WHERE \`deleted_at\` IS NULL
      ${alphabet_filter}
      ${cursor_filter}
      ORDER BY LOWER(\`term\`) ASC, \`term\` ASC, \`id\` ASC
      LIMIT ${safeTake}
      OFFSET ${safeSkip}
    `);
    return rows.map((row) => row.id);
  }

  private async findWordsBySortedIds(ids: string[]): Promise<Word[]> {
    if (ids.length === 0) return [];
    const order = new Map(ids.map((id, index) => [id, index]));
    const words = await this.prisma.word.findMany({
      where: {
        id: { in: ids },
        ...this.alive_word_filter,
      },
      include: this.word_include,
    });
    return words.sort(
      (left, right) => (order.get(left.id) ?? 0) - (order.get(right.id) ?? 0),
    );
  }

  async create(
    createDictionaryDto: CreateDictionaryDto,
    email: string,
  ): Promise<Word> {
    try {
      const { definitions, ...wordData } = createDictionaryDto;
      const user = await this.userService.findUser(email);
      this.denyDictionaryViewer(user.role);
      return await this.prisma.word.create({
        data: {
          ...wordData,
          contributors: {
            connect: { id: user.id },
          },
          definitions: {
            create: definitions.map((definition) => {
              return {
                meaning: definition.meaning,
                part_of_speech: {
                  connect: { id: definition.part_of_speech.id },
                },
                examples: {
                  create: definition.examples,
                },
                synonyms: {
                  create: definition.synonyms,
                },
                antonyms: {
                  create: definition.antonyms,
                },
              };
            }),
          },
        },
      });
    } catch (error) {
      if (error.code === 'P2002') {
        throw new BadRequestException(
          'Word with the same term or alternative spelling already exists.',
        );
      } else if (error.code === 'P2025') {
        throw new NotFoundException('Part of Speech not found');
      } else {
        throw new BadRequestException('Failed to create word.');
      }
    }
  }

  async findAll({
    take,
    skip,
    cursor,
  }: {
    take?: number;
    skip?: number;
    cursor?: string;
  }): Promise<{ words: Word[]; totalCount: number; audioCount: number }> {
    cursor = this.treatInvalidUndefinedNull(cursor);

    const safeSkip =
      typeof skip === 'number' && Number.isFinite(skip) ? Math.max(0, skip) : 0;

    const [ids, totalCount, audioCount] = await Promise.all([
      this.findSortedWordIds({ cursor, skip: safeSkip, take }),
      this.prisma.word.count({ where: this.alive_word_filter }),
      this.prisma.wordPronunciationAudio.count(),
    ]);
    const words = await this.findWordsBySortedIds(ids);
    return { words, totalCount, audioCount };
  }

  async findAllPartsOfSpeech() {
    return this.prisma.partOfSpeech.findMany();
  }

  async jump({
    alphabet,
    cursor,
    take,
  }: {
    alphabet: string;
    cursor?: string;
    take?: number;
  }): Promise<{ words: Word[]; totalCount: number; audioCount: number }> {
    cursor = this.treatInvalidUndefinedNull(cursor);

    const [ids, totalCount, audioCount] = await Promise.all([
      this.findSortedWordIds({
        alphabet: alphabet.toLowerCase(),
        cursor,
        take,
      }),
      this.prisma.word.count({ where: this.alive_word_filter }),
      this.prisma.wordPronunciationAudio.count(),
    ]);
    const words = await this.findWordsBySortedIds(ids);

    return { words, totalCount, audioCount };
  }

  async findWordById(id: string): Promise<Word | null> {
    const word = await this.prisma.word.findFirst({
      where: {
        id: id,
        ...this.alive_word_filter,
      },
      include: {
        pronunciation_audios: {
          select: {
            id: true,
            format: true,
            file: {
              select: {
                id: true,
                url: true,
              },
            },
          },
        },
        definitions: {
          include: {
            part_of_speech: true,
            examples: true,
            synonyms: true,
            antonyms: true,
          },
        },
      },
    });

    if (!word) {
      throw new NotFoundException(`Word with id "${id}" not found`);
    }

    return word;
  }

  async findOne(term: string): Promise<Word | null> {
    const word = await this.prisma.word.findFirst({
      where: {
        term: term,
        ...this.alive_word_filter,
      },
      include: {
        pronunciation_audios: {
          select: {
            id: true,
            format: true,
            file: {
              select: {
                id: true,
                url: true,
              },
            },
          },
        },
        definitions: {
          include: {
            part_of_speech: true,
            examples: true,
            synonyms: true,
            antonyms: true,
          },
        },
      },
    });

    if (!word) {
      throw new NotFoundException(`Word with term "${term}" not found`);
    }

    return word;
  }

  /**
   * Searches terms, alternative spellings, and definition meanings, then
   * returns the five strongest reverse-dictionary matches.
   * @param term - The search term.
   * @returns An array of ranked words with metadata describing the best match.
   */
  async search(term: string): Promise<DictionarySearchHit[]> {
    const query = prepareSearchQuery(term);
    if (!query.phrase || query.tokens.length === 0) return [];

    const token_filters: Prisma.WordWhereInput[] = searchTokenVariants(
      query.tokens,
    ).flatMap((token) => [
      { term: { contains: token } },
      { alt_spelling: { contains: token } },
      {
        definitions: {
          some: { meaning: { contains: token } },
        },
      },
    ]);

    const words = await this.prisma.word.findMany({
      where: {
        ...this.alive_word_filter,
        OR: token_filters,
      },
      include: this.word_include,
      orderBy: [{ updated_at: 'desc' }, { id: 'asc' }],
      take: DICTIONARY_SEARCH_MAX_CANDIDATES,
    });

    return words
      .map((word) => this.rankDictionarySearchHit(word, query))
      .filter((hit) => hit.score > 0)
      .sort((left, right) => {
        if (right.score !== left.score) return right.score - left.score;

        const normalized_term_order = left.word.term.localeCompare(
          right.word.term,
          undefined,
          { sensitivity: 'base' },
        );
        if (normalized_term_order !== 0) return normalized_term_order;

        const term_order = left.word.term.localeCompare(right.word.term);
        if (term_order !== 0) return term_order;
        return left.word.id.localeCompare(right.word.id);
      })
      .slice(0, 5)
      .map(({ word, match }) => ({
        ...word,
        search_match: match,
      })) as DictionarySearchHit[];
  }

  private rankDictionarySearchHit(
    word: DictionarySearchCandidate,
    query: PreparedSearchQuery,
  ): {
    word: typeof word;
    score: number;
    match: DictionarySearchMatch;
  } {
    const fallback_meaning = word.definitions[0]?.meaning ?? word.term;
    const term_score = scoreSearchText(
      word.term,
      query,
      DICTIONARY_TERM_WEIGHTS,
    );
    const alt_spelling_score = scoreSearchText(
      word.alt_spelling,
      query,
      DICTIONARY_ALT_SPELLING_WEIGHTS,
    );

    let best_score = term_score.score;
    let best_match: DictionarySearchMatch = {
      field: 'term',
      text: fallback_meaning,
    };

    if (alt_spelling_score.score > best_score) {
      best_score = alt_spelling_score.score;
      best_match = {
        field: 'alt_spelling',
        text: fallback_meaning,
      };
    }

    for (const definition of word.definitions) {
      const definition_score = scoreSearchText(
        definition.meaning,
        query,
        DICTIONARY_MEANING_WEIGHTS,
      );
      if (definition_score.score > best_score) {
        best_score = definition_score.score;
        best_match = {
          field: 'meaning',
          text: definition.meaning,
        };
      }
    }

    return { word, score: best_score, match: best_match };
  }

  async update(
    id: string,
    updateDictionaryDto: UpdateDictionaryDto,
    email: string,
  ): Promise<Word> {
    const {
      definitions,
      pronunciation_audios: _pronunciation_audios,
      ...wordData
    } = updateDictionaryDto;
    try {
      const user = await this.userService.findUser(email);

      const existing_word = await this.prisma.word.findUnique({
        where: { id },
        include: { contributors: { select: { id: true } } },
      });

      if (!existing_word || existing_word.deleted_at !== null) {
        throw new NotFoundException('Word not found');
      }

      this.denyDictionaryViewer(user.role);
      this.assertWordContributorOrAdmin(user, existing_word);

      if (definitions && definitions.length > 0) {
        return await this.prisma.$transaction(async (prisma) => {
          const updated_word = await prisma.word.update({
            where: { id },
            data: {
              ...wordData,
              contributors: {
                connect: { id: user.id },
              },
            },
          });

          if (definitions && definitions.length > 0) {
            await prisma.example.deleteMany({
              where: { definition: { word_id: id } },
            });
            await prisma.synonym.deleteMany({
              where: { definition: { word_id: id } },
            });
            await prisma.antonym.deleteMany({
              where: { definition: { word_id: id } },
            });

            await prisma.definition.deleteMany({ where: { word_id: id } });

            const created_definitions = await Promise.all(
              definitions.map(async (definition) => {
                const created_definition = await prisma.definition.create({
                  data: {
                    meaning: definition.meaning,
                    word_id: id,
                    part_of_speech_id: definition.part_of_speech.id,
                  },
                });
                return created_definition;
              }),
            );

            for (const [index, definition] of definitions.entries()) {
              const created_definition = created_definitions[index];

              if (definition.examples) {
                await prisma.example.createMany({
                  data: definition.examples.map((example) => ({
                    sentence: example.sentence,
                    definition_id: created_definition.id,
                  })),
                });
              }

              if (definition.synonyms) {
                await prisma.synonym.createMany({
                  data: definition.synonyms.map((synonym) => ({
                    synonym: synonym.synonym,
                    definition_id: created_definition.id,
                  })),
                });
              }

              if (definition.antonyms) {
                await prisma.antonym.createMany({
                  data: definition.antonyms.map((antonym) => ({
                    antonym: antonym.antonym,
                    definition_id: created_definition.id,
                  })),
                });
              }
            }
          }
          return updated_word;
        });
      } else {
        return await this.prisma.word.update({
          where: { id },
          data: { ...wordData, contributors: { connect: { id: user.id } } },
        });
      }
    } catch (error: any) {
      if (
        error instanceof ForbiddenException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new BadRequestException(
            'Word with the same term or alternative spelling already exists.',
          );
        } else if (error.code === 'P2025') {
          throw new NotFoundException('Related record not found.');
        }
      }
      console.error('Error updating word:', error);
      throw new BadRequestException('Failed to update word.');
    }
  }

  /**
   * Updates the pronunciation audio for a word.
   * @param id - The ID of the word.
   * @param updateSoundDto - The DTO containing the updated sound data.
   * @param email - The email of the user making the update.
   * @returns The updated word.
   * @throws NotFoundException if the word is not found.
   * @throws BadRequestException if the update fails.
   */
  async updateWordPronunciation(
    id: string,
    compressed_sound: Express.Multer.File[],
    email: string,
  ): Promise<Word> {
    try {
      const user = await this.userService.findUser(email);

      this.denyDictionaryViewer(user.role);

      const saved_sound_ids = await this.fileService.create(
        compressed_sound,
        email,
        'pronunciations',
      );

      const word_record = await this.prisma.word.findUnique({
        where: { id },
        include: { contributors: { select: { id: true } } },
      });

      if (!word_record || word_record.deleted_at !== null) {
        throw new NotFoundException(`Word with ID ${id} not found.`);
      }

      this.assertWordContributorOrAdmin(user, word_record);

      const updated_word = await this.prisma.word.update({
        where: { id },
        data: {
          pronunciation_audios: {
            upsert: {
              where: { word_id: id },
              create: {
                format: compressed_sound[0].mimetype,
                contributor: { connect: { id: user.id } },
                file: { connect: { id: saved_sound_ids[0] } },
              },
              update: {
                format: compressed_sound[0].mimetype,
                contributor: { connect: { id: user.id } },
                file: { connect: { id: saved_sound_ids[0] } },
              },
            },
          },
          updated_at: new Date(),
        },
      });

      return updated_word;
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }
      console.error('Error updating word pronunciation:', error);
      throw new BadRequestException('Failed to update word pronunciation.');
    }
  }

  async remove(id: string, actorEmail: string): Promise<Word> {
    const existing = await this.prisma.word.findUnique({
      where: { id },
      include: { contributors: { select: { id: true } } },
    });

    if (!existing) {
      throw new NotFoundException(`Word with ID ${id} not found`);
    }

    const actor = await this.userService.findUser(actorEmail);
    this.denyDictionaryViewer(actor.role);
    this.assertWordContributorOrAdmin(actor, existing);

    return await this.prisma.word.update({
      where: { id },
      data: { deleted_at: new Date() },
    });
  }
}
