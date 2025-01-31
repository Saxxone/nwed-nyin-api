import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Word } from '@prisma/client';
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

  async create(
    createDictionaryDto: CreateDictionaryDto,
    email: string,
  ): Promise<Word> {
    try {
      const { definitions, ...wordData } = createDictionaryDto;
      const user = await this.userService.findUser(email);
      return await this.prisma.word.create({
        data: {
          ...wordData,
          contributors: {
            connect: user,
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
    skip,
    take,
  }: {
    skip: number;
    take: number;
  }): Promise<{ words: Word[]; totalCount: number }> {
    const [words, totalCount] = await this.prisma.$transaction([
      this.prisma.word.findMany({
        skip,
        take,
        orderBy: { term: 'asc' },
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
      this.prisma.word.count(),
    ]);
    return { words, totalCount };
  }

  async findAllPartsOfSpeech() {
    return this.prisma.partOfSpeech.findMany();
  }

  async findWordById(id: string): Promise<Word | null> {
    const word = await this.prisma.word.findFirst({
      where: {
        id: id,
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
        OR: [
          { term: { contains: term } },
          { alt_spelling: { contains: term } },
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
    const { definitions, pronunciation_audios, ...wordData } =
      updateDictionaryDto;
    try {
      const user = await this.userService.findUser(email);

      if (definitions && definitions.length > 0) {
        return await this.prisma.$transaction(async (prisma) => {
          const updated_word = await prisma.word.update({
            where: { id },
            data: {
              ...wordData,
              contributors: {
                connect: user,
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
          data: { ...wordData, contributors: { connect: user } },
        });
      }
    } catch (error: any) {
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
      throw new BadRequestException('Failed to update word.' + error);
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

      const saved_sound_ids = await this.fileService.create(
        compressed_sound,
        email,
        'pronunciations',
      );

      const word = await this.prisma.word.findUnique({ where: { id } });

      if (!word) {
        throw new NotFoundException(`Word with ID ${id} not found.`);
      }

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
      if (error instanceof NotFoundException) {
        throw error;
      }
      console.error('Error updating word pronunciation:', error);
      throw new BadRequestException('Failed to update word pronunciation.');
    }
  }

  async remove(id: string): Promise<Word> {
    const word = await this.prisma.word.delete({
      where: { id },
    });
    if (!word) {
      throw new NotFoundException(`Word with ID ${id} not found`);
    }

    return word;
  }
}
