import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Role, User, Word } from 'src/generated/prisma/client';
import { FileService } from 'src/file/file.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { UserService } from '../user/user.service';
import { CreateDictionaryDto } from './dto/create-dictionary.dto';
import { UpdateDictionaryDto } from './dto/update-dictionary.dto';

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

    const [words, totalCount, audioCount] = await this.prisma.$transaction([
      this.prisma.word.findMany({
        take,
        skip: cursor ? 1 + safeSkip : safeSkip,
        where: this.alive_word_filter,
        ...(cursor ? { cursor: { id: cursor } } : {}),
        orderBy: [{ term: 'asc' }, { id: 'asc' }],
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
      }),
      this.prisma.word.count({ where: this.alive_word_filter }),
      this.prisma.wordPronunciationAudio.count(),
    ]);
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

    const [words, totalCount, audioCount] = await this.prisma.$transaction([
      this.prisma.word.findMany({
        ...(cursor ? { cursor: { id: cursor } } : {}),
        skip: cursor ? 1 : 0,
        take,
        where: {
          term: {
            gte: alphabet.toLowerCase(),
          },
          ...this.alive_word_filter,
        },
        orderBy: [{ term: 'asc' }, { id: 'asc' }],
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
      }),
      this.prisma.word.count({ where: this.alive_word_filter }),
      this.prisma.wordPronunciationAudio.count(),
    ]);

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
   * Searches for words matching a given term.
   * @param term - The search term.
   * @returns An array of words matching the search term.  Returns a maximum of 5 words.
   * @throws NotFoundException if no words are found.
   */
  async search(term: string): Promise<Word[]> {
    return this.prisma.word.findMany({
      where: {
        AND: [
          {
            OR: [
              { term: { contains: term } },
              { alt_spelling: { contains: term } },
            ],
          },
          this.alive_word_filter,
        ],
      },
      include: {
        definitions: {
          include: {
            part_of_speech: true,
            examples: true,
            synonyms: true,
            antonyms: true,
          },
        },
      },
      take: 5,
    });
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
