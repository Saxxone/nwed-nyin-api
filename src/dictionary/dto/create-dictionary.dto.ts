import {
  IsNotEmpty,
  IsString,
  IsUUID,
  IsArray,
  ValidateNested,
  IsOptional,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateDictionaryDto {
  @IsNotEmpty()
  @IsString()
  term: string;

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

  @IsNotEmpty()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DefinitionDto)
  definitions: DefinitionDto[];
}

export class PartOfSpeechDto {
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsNotEmpty()
  @IsUUID()
  id: string;
}

export class DefinitionDto {
  @IsNotEmpty()
  @IsString()
  meaning: string;

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
