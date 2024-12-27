import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
} from '@nestjs/common';
import { DictionaryService } from './dictionary.service';
import { CreateDictionaryDto } from './dto/create-dictionary.dto';
import { UpdateDictionaryDto } from './dto/update-dictionary.dto';

@Controller('dictionary')
export class DictionaryController {
  constructor(private readonly dictionaryService: DictionaryService) {}

  @Post()
  create(@Body() createDictionaryDto: CreateDictionaryDto) {
    return this.dictionaryService.create(createDictionaryDto);
  }

  @Get()
  findAll() {
    return this.dictionaryService.findAll();
  }

  @Get(':word')
  findOne(@Param('word') word: string) {
    return this.dictionaryService.findOne(word);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateDictionaryDto: UpdateDictionaryDto,
  ) {
    return this.dictionaryService.update(+id, updateDictionaryDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.dictionaryService.remove(+id);
  }
}
