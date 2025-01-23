import {
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
} from '@nestjs/common';
import { Word } from '@prisma/client';
import { Public } from 'src/auth/auth.guard';
import { DictionaryService } from './dictionary.service';
import { CreateDictionaryDto } from './dto/create-dictionary.dto';
import { UpdateDictionaryDto } from './dto/update-dictionary.dto';

@Controller('dictionary')
export class DictionaryController {
  constructor(private readonly dictionaryService: DictionaryService) {}

  @Post('add')
  async create(
    @Body() createDictionaryDto: CreateDictionaryDto,
    @Request() req: any,
  ): Promise<Word> {
    return this.dictionaryService.create(createDictionaryDto, req.user.sub);
  }

  @Public()
  @Get()
  findAll(@Query('skip') skip?: number, @Query('take') take?: number) {
    return this.dictionaryService.findAll({
      skip: Number(skip) || 0,
      take: Number(take) || 10,
    });
  }

  @Get('parts-of-speech')
  findAllPS() {
    return this.dictionaryService.findAllPartsOfSpeech();
  }

  @Public()
  @Get('search')
  async search(@Query('term') term: string): Promise<Word[]> {
    console.log('term: ', term);
    if (!term) {
      return [];
    }
    return this.dictionaryService.search(term.trim().toLowerCase());
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
  async remove(@Param('id') id: string): Promise<Word> {
    try {
      return await this.dictionaryService.remove(id);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw error;
    }
  }
}
