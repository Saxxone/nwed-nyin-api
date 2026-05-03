import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Request,
  Res,
  StreamableFile,
} from '@nestjs/common';
import { Word } from '@prisma/client';
import { basename } from 'path';
import { Response } from 'express';
import { Public } from 'src/auth/auth.guard';
import { FileService } from 'src/file/file.service';
import { DictionaryService } from './dictionary.service';
import { CreateDictionaryDto } from './dto/create-dictionary.dto';
import { UpdateDictionaryDto } from './dto/update-dictionary.dto';

@Controller('dictionary')
export class DictionaryController {
  constructor(
    private readonly dictionaryService: DictionaryService,
    private readonly fileService: FileService,
  ) {}

  @Post('add')
  async create(
    @Body() createDictionaryDto: CreateDictionaryDto,
    @Request() req: any,
  ): Promise<Word> {
    return this.dictionaryService.create(createDictionaryDto, req.user.sub);
  }

  @Public()
  @Get()
  findAll(
    @Query('take') take?: number,
    @Query('skip') skip?: number,
    @Query('cursor') cursor?: string,
  ): Promise<{
    words: Word[];
    totalCount: number;
  }> {
    return this.dictionaryService.findAll({
      take: Number(take) || 50,
      skip: Number(skip),
      cursor: cursor,
    });
  }

  @Public()
  @Get('sound')
  async getWordPronunctiation(
    @Query('path') path: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    try {
      const segments = path?.trim().split('/')?.filter(Boolean) ?? [];
      const tail = segments.length >= 2 ? segments[1].trim().normalize('NFD') : 'pronunciation';

      const stream = await this.fileService.streamLegacyPublicPath(
        path,
        'pronunciations',
      );

      res.set({
        'Content-Type': 'audio/webm',
        'Content-Disposition': `inline; filename="${basename(`${tail}.webm`).replace(/\r?\n/g, '')}"`,
        'Accept-Ranges': 'bytes',
      });

      return stream;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(
        error instanceof BadRequestException
          ? error.message
          : 'Unable to retrieve audio.',
      );
    }
  }

  @Get('parts-of-speech')
  findAllPS() {
    return this.dictionaryService.findAllPartsOfSpeech();
  }

  @Public()
  @Get('jump')
  async jump(
    @Query('alphabet') alphabet: string,
    @Query('cursor') cursor?: string,
    @Query('take') take?: number,
  ): Promise<{
    words: Word[];
    totalCount: number;
  }> {
    if (!alphabet) {
      return this.findAll();
    }
    return this.dictionaryService.jump({
      cursor,
      alphabet: alphabet.trim().toLowerCase(),
      take: Number(take) || 50,
    });
  }

  @Public()
  @Get('search')
  async search(@Query('term') term: string): Promise<Word[]> {
    if (!term) {
      return [];
    }
    return this.dictionaryService.search(term.trim().toLowerCase());
  }

  @Public()
  @Get('id/:id')
  findWordById(@Param('id') id: string) {
    return this.dictionaryService.findWordById(id);
  }

  @Public()
  @Get(':term')
  findOne(@Param('term') term: string) {
    return this.dictionaryService.findOne(term);
  }

  @Patch('update/:id')
  async update(
    @Param('id') id: string,
    @Body() updateDictionaryDto: UpdateDictionaryDto,
    @Request() req: any,
  ): Promise<Word> {
    try {
      return await this.dictionaryService.update(
        id,
        updateDictionaryDto,
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
  async remove(@Param('id') id: string, @Request() req: any): Promise<Word> {
    try {
      return await this.dictionaryService.remove(id, req.user.sub);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw error;
    }
  }
}
