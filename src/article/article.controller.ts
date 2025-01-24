import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  Res,
  Request,
  ParseUUIDPipe,
  NotFoundException,
  StreamableFile,
} from '@nestjs/common';
import { Response } from 'express';
import { ArticleService } from './article.service';
import { CreateArticleDto } from './dto/create-article.dto';
import { UpdateArticleDto } from './dto/update-article.dto';
import { Article } from '@prisma/client';
import { Public } from 'src/auth/auth.guard';
import { FileService } from 'src/file/file.service';

@Controller('article')
export class ArticleController {
  constructor(
    private readonly articleService: ArticleService,
    private readonly fileService: FileService,
  ) {}

  @Post('publish')
  create(
    @Body() createArticleDto: CreateArticleDto,
    @Request() req: any,
  ): Promise<Article> {
    return this.articleService.create(createArticleDto, req.user.sub);
  }

  @Public()
  @Get()
  findAll(
    @Query('skip') skip?: number,
    @Query('take') take?: number,
  ): Promise<Article[]> {
    return this.articleService.findAll({
      skip: Number(skip) || 0,
      take: Number(take) || 10,
    });
  }

  @Public()
  @Get(':slug')
  findOne(@Param('slug') slug: string): Promise<Article> {
    return this.articleService.findOne(slug);
  }

  @Public()
  @Get('markdown/:path')
  getArticleContent(
    @Query('path') path: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    res.set({
      'Content-Type': 'text/markdown',
      'Content-Disposition': `inline; filename="${path}.md"`,
    });
    return this.fileService.streamStaticFile(path);
  }

  @Patch(':id')
  async update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() updateArticleDto: UpdateArticleDto,
    @Request() req: any,
  ): Promise<Article> {
    try {
      return await this.articleService.update(
        id,
        updateArticleDto,
        req.user.sub,
      );
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw error;
    }
  }

  @Delete(':id')
  async remove(@Param('id', new ParseUUIDPipe()) id: string): Promise<Article> {
    try {
      return await this.articleService.remove(id);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw error;
    }
  }
}
