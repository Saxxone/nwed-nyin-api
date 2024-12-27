import { Article, MediaType, ReferenceType, Status } from '@prisma/client';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  IsArray,
  ValidateNested,
  IsInt,
  IsUrl,
  IsDateString,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ArticleVersion {
  version: number;
  created_by: string;
  content: any; // Replace 'any' with appropriate type if known
}

export interface ArticleSection {
  title: string;

  id: string;
  content: string;
  article: Article;
  article_id: string;
}

export class ArticleMetadata {
  keywords: string[];
  language: string;
  read_time: number | null;
  complexity: string | null;
}

export class CreateArticleDto {
  @IsNotEmpty()
  @IsString()
  title: string;

  @IsNotEmpty()
  @IsString()
  slug: string;

  @IsNotEmpty()
  @IsString()
  summary: string;

  @IsNotEmpty()
  @IsString()
  body: string;

  @IsNotEmpty()
  @IsUUID() // Assuming user IDs are UUIDs
  created_by: string;

  @IsOptional()
  @IsUUID() // Assuming user IDs are UUIDs
  updated_by?: string;

  @IsNotEmpty()
  @IsEnum(Status)
  status: Status;

  @IsNotEmpty()
  @IsArray()
  @ValidateNested({ each: true })
  sections: ArticleSection[];

  @IsArray()
  @IsUUID('all', { each: true }) // Validate each element as a UUID
  contributors: string[];

  @IsArray()
  @IsUUID('all', { each: true })
  categories: string[];

  @IsArray()
  @IsUUID('all', { each: true })
  tags: string[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReferenceDto) // Use a nested DTO for references
  references: ReferenceDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MediaDto) // Use a nested DTO for media
  media: MediaDto[];

  @IsNotEmpty()
  @ValidateNested()
  metadata: ArticleMetadata;

  @IsArray()
  @ValidateNested({ each: true })
  versions: ArticleVersion[];
}

// Separate DTO for References to make validation cleaner
export class ReferenceDto {
  @IsEnum(ReferenceType)
  type: ReferenceType;

  @IsString()
  @IsNotEmpty()
  citation: string;

  @IsOptional()
  @IsUrl()
  url: string | null;

  @IsOptional()
  @IsString()
  doi: string | null;

  @IsOptional()
  @IsString()
  isbn: string | null;

  @IsArray()
  @IsString({ each: true }) // Each author should be a string
  authors: string[];

  @IsOptional()
  @IsString()
  publisher: string | null;

  @IsOptional()
  @IsInt()
  year: number | null;

  @IsOptional()
  @IsDateString()
  access_date: Date | null;
}

export class MediaDto {
  @IsEnum(MediaType)
  type: MediaType;

  @IsUrl()
  url: string;

  @IsString()
  caption: string;

  @IsString()
  credit: string;

  @IsOptional()
  @IsString()
  alt_text: string | null;

  @IsOptional()
  @IsString()
  mime_type: string | null;

  @IsOptional()
  @IsInt()
  @Min(0) // Assuming size can't be negative
  size: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  width: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  height: number | null;
}
