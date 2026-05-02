import { Module } from '@nestjs/common';
import { FileService } from '../file/file.service';
import { PrismaService } from '../prisma/prisma.service';
import { UserService } from '../user/user.service';
import { ArticleController } from './article.controller';
import { ArticleService } from './article.service';

@Module({
  controllers: [ArticleController],
  providers: [ArticleService, PrismaService, UserService, FileService],
})
export class ArticleModule {}
