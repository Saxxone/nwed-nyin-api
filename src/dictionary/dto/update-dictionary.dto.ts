import { PartialType } from '@nestjs/mapped-types';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { CreateDictionaryDto, PartOfSpeechDto } from './create-dictionary.dto';

export class UpdateDictionaryDto extends PartialType(CreateDictionaryDto) {
  @IsOptional()
  @IsString()
  term?: string;

  @IsOptional()
  pronunciation_audios?: File[];

  @IsOptional()
  @IsString()
  pronunciation?: string;

  @IsOptional()
  @IsString()
  etymology?: string;

  @IsOptional()
  @IsString()
  alt_spelling?: string;

  @IsOptional()
  @IsUUID()
  contributor_id?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DefinitionDto)
  definitions?: DefinitionDto[];
}

export class DefinitionDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  meaning: string;

  @IsOptional()
  part_of_speech: PartOfSpeechDto;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ExampleDto)
  examples: ExampleDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SynonymDto)
  synonyms: SynonymDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AntonymDto)
  antonyms: AntonymDto[];
}

class ExampleDto {
  @IsOptional()
  @IsString()
  sentence: string;
}

class SynonymDto {
  @IsOptional()
  @IsString()
  synonym: string;
}

class AntonymDto {
  @IsOptional()
  @IsString()
  antonym: string;
}
