import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateDictionaryDto } from './dto/create-dictionary.dto';
import { UpdateDictionaryDto } from './dto/update-dictionary.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { Prisma, Word } from '@prisma/client';

@Injectable()
export class DictionaryService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createDictionaryDto: CreateDictionaryDto): Promise<Word> {
    try {
      const { definitions, ...wordData } = createDictionaryDto;
      return await this.prisma.word.create({
        data: {
          ...wordData,
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

  async findAllPS() {
    return this.prisma.partOfSpeech.findMany();
  }

  async findOne(term: string): Promise<Word | null> {
    const word = await this.prisma.word.findFirst({
      where: {
        term: term,
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
    });

    if (!word) {
      throw new NotFoundException(`Word with term "${term}" not found`);
    }

    return word;
  }

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
  ): Promise<Word> {
    const { definitions, ...wordData } = updateDictionaryDto;
    try {
      return await this.prisma.$transaction(async (prisma) => {
        const updated_word = await prisma.word.update({
          where: { id },
          data: wordData,
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
      throw new BadRequestException('Failed to update word.');
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
