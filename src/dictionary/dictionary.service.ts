import { Injectable } from '@nestjs/common';
import { CreateDictionaryDto } from './dto/create-dictionary.dto';
import { UpdateDictionaryDto } from './dto/update-dictionary.dto';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class DictionaryService {
  constructor(private readonly prisma: PrismaService) {}

  create(createDictionaryDto: CreateDictionaryDto) {
    return `this.prisma.word.create({
      data: createDictionaryDto,
    })`;
  }

  findAll() {
    return this.prisma.word.findMany({
      include: {
        definitions: true,
        examples: true,
        synonyms: true,
      },
    });
  }

  findOne(id: number) {
    return `This action returns a #${id} dictionary`;
  }

  update(id: number, updateDictionaryDto: UpdateDictionaryDto) {
    return `This action updates a #${id} dictionary`;
  }

  remove(id: number) {
    return `This action removes a #${id} dictionary`;
  }
}
