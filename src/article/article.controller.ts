import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Request,
  Res,
  StreamableFile,
} from '@nestjs/common';
import { Article } from '@prisma/client';
import { Response } from 'express';
import { Public } from '../auth/auth.guard';
import { FileService } from '../file/file.service';
import { ArticleService, PublicArticle } from './article.service';
import { CreateArticleDto } from './dto/create-article.dto';
import { UpdateArticleDto } from './dto/update-article.dto';

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
  ): Promise<PublicArticle> {
    return this.articleService.create(createArticleDto, req.user.sub);
  }

  @Public()
  @Get()
  findAll(
    @Query('skip') skip?: number,
    @Query('take') take?: number,
  ): Promise<PublicArticle[]> {
    return this.articleService.findAll({
      skip: Number(skip) || 0,
      take: Number(take) || 10,
    });
  }

  @Public()
  @Get('search')
  search(
    @Query('term') term: string,
    @Query('skip') skip?: number,
    @Query('take') take?: number,
  ): Promise<PublicArticle[]> {
    return this.articleService.search({
      term: term?.trim() || '',
      skip: Number(skip) || 0,
      take: Number(take) || 10,
    });
  }

  @Public()
  @Get('article/:slug')
  findOne(@Param('slug') slug: string): Promise<PublicArticle> {
    return this.articleService.findOne(slug);
  }

  @Public()
  @Get('markdown')
  getArticleContent(
    @Query('path') path: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    res.set({
      'Content-Type': 'text/markdown',
      'Accept-Ranges': 'bytes',
      'Content-Disposition': `inline; filename="${path}.md"`,
    });
    return this.fileService.streamStaticFile(path, 'articles');
  }

  @Patch('update/:id')
  async update(
    @Param('id') id: string,
    @Body() updateArticleDto: UpdateArticleDto,
    @Request() req: any,
  ): Promise<PublicArticle> {
    console.log(req.user.sub, id);
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

  @Delete('delete/:id')
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
