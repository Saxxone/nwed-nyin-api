import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateDictionaryDto } from './dto/create-dictionary.dto';
import { UpdateDictionaryDto } from './dto/update-dictionary.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { Word } from '@prisma/client';

@Injectable()
export class DictionaryService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createDictionaryDto: CreateDictionaryDto): Promise<Word> {
    const { definitions, ...wordData } = createDictionaryDto;
    return this.prisma.word.create({
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
  }

  async findAll(): Promise<{ words: Word[]; totalCount: number }> {
    const [words, totalCount] = await this.prisma.$transaction([
      this.prisma.word.findMany({
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
    const word = await this.prisma.word.findUnique({
      where: { term },
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

  async update(
    id: string,
    updateDictionaryDto: UpdateDictionaryDto,
  ): Promise<Word> {
    const { definitions, ...wordData } = updateDictionaryDto;
    const updatedWord = await this.prisma.word.update({
      where: { id },
      data: wordData,
    });

    if (definitions && definitions.length > 0) {
      // Delete existing definitions and their related data.
      await this.prisma.definition.deleteMany({ where: { word_id: id } });
      await this.prisma.example.deleteMany({
        where: { definition: { word_id: id } },
      });
      await this.prisma.synonym.deleteMany({
        where: { definition: { word_id: id } },
      });
      await this.prisma.antonym.deleteMany({
        where: { definition: { word_id: id } },
      });

      await this.prisma.definition.createMany({
        data: definitions.map((definition) => ({
          ...definition,
          word_id: id,
          part_of_speech_id: definition.part_of_speech.id,
        })),
      });
    }

    return updatedWord;
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
