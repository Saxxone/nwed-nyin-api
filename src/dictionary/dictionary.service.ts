import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateDictionaryDto } from './dto/create-dictionary.dto';
import { UpdateDictionaryDto } from './dto/update-dictionary.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { Word, Prisma } from '@prisma/client';

@Injectable()
export class DictionaryService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createDictionaryDto: CreateDictionaryDto): Promise<Word> {
    // Prisma expects an array of definition objects, each containing nested arrays for examples, synonyms, and antonyms
    const { definitions, ...wordData } = createDictionaryDto;
    return this.prisma.word.create({
      data: {
        ...wordData,
        definitions: {
          create: definitions.map((definition) => ({
            meaning: definition.meaning,
            part_of_speech_id: definition.part_of_speech_id,
            examples: {
              create: definition.examples,
            },
            synonyms: {
              create: definition.synonyms,
            },
            antonyms: {
              create: definition.antonyms,
            },
          })),
        },
      },
    });
  }

  async findAll(): Promise<Word[]> {
    return this.prisma.word.findMany({
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
        data: definitions.map((definition) => ({ ...definition, word_id: id })),
      });
    }

    return updatedWord; // Or fetch the fully updated word if needed.
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
