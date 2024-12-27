import { Module } from '@nestjs/common';
import { DictionaryService } from './dictionary.service';
import { DictionaryController } from './dictionary.controller';
import { PrismaService } from 'src/prisma/prisma.service';

@Module({
  controllers: [DictionaryController],
  providers: [DictionaryService, PrismaService],
})
export class DictionaryModule {}
