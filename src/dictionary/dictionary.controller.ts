import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseUUIDPipe,
  NotFoundException,
  Query,
} from '@nestjs/common';
import { DictionaryService } from './dictionary.service';
import { CreateDictionaryDto } from './dto/create-dictionary.dto';
import { UpdateDictionaryDto } from './dto/update-dictionary.dto';
import { Word } from '@prisma/client';

@Controller('dictionary')
export class DictionaryController {
  constructor(private readonly dictionaryService: DictionaryService) {}

  @Post('add')
  async create(
    @Body() createDictionaryDto: CreateDictionaryDto,
  ): Promise<Word> {
    return this.dictionaryService.create(createDictionaryDto);
  }

  @Get()
  findAll() {
    return this.dictionaryService.findAll();
  }

  @Get('parts-of-speech')
  findAllPS() {
    return this.dictionaryService.findAllPS();
  }

  @Get('search')
  async search(@Query('term') term: string): Promise<Word[]> {
    console.log('term: ', term);
    if (!term) {
      return [];
    }
    return this.dictionaryService.search(term.trim().toLowerCase());
  }

  @Get(':term')
  findOne(@Param('term') term: string) {
    return this.dictionaryService.findOne(term);
  }

  @Patch(':id')
  async update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() updateDictionaryDto: UpdateDictionaryDto,
  ): Promise<Word> {
    try {
      return await this.dictionaryService.update(id, updateDictionaryDto);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw error;
    }
  }

  @Delete(':id')
  async remove(@Param('id', new ParseUUIDPipe()) id: string): Promise<Word> {
    // Use ParseUUIDPipe
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
