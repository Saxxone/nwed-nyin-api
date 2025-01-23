import { Module } from '@nestjs/common';
import { DictionaryService } from 'src/dictionary/dictionary.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { UserService } from 'src/user/user.service';
import { FileController } from './file.controller';
import { FileService } from './file.service';

@Module({
  controllers: [FileController],
  providers: [FileService, UserService, PrismaService, DictionaryService],
})
export class FileModule {}
