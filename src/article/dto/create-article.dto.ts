import { Article, FileType, ReferenceType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
    IsArray,
    IsDateString,
    IsEnum,
    IsInt,
    IsNotEmpty,
    IsOptional,
    IsString,
    IsUrl,
    Min,
    ValidateNested,
} from 'class-validator';

/** Ignored by the API — revision snapshots are persisted server-side. */
export class ArticleVersion {
  version: number;
  created_by: string;
  content: unknown;
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
  content: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MediaDto)
  file: MediaDto[] | null;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  categories?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReferenceDto)
  references?: ReferenceDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => ArticleMetadata)
  metadata?: ArticleMetadata;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ArticleVersion)
  versions?: ArticleVersion[];
}

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
  @IsOptional()
  @IsString()
  id?: string;

  @IsEnum(FileType)
  type: FileType;

  @IsString()
  url: string;

  @IsOptional()
  @IsString()
  path?: string;

  @IsOptional()
  @IsString()
  caption: string;

  @IsOptional()
  @IsString()
  credit: string;

  @IsOptional()
  @IsString()
  alt_text: string | null;

  @IsOptional()
  @IsString()
  mime_type: string | null;

  @IsOptional()
  @IsString()
  mimetype?: string | null;

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
