import { Article, FileType, ReferenceType } from 'src/generated/prisma/client';
import { Transform, Type } from 'class-transformer';
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

/** Coerce common client/DB shapes into `string[]` before validation. */
export function transformReferenceAuthors(value: unknown): string[] {
  if (value == null) return [];
  if (typeof value === 'string') {
    const t = value.trim();
    if (!t) return [];
    return t.includes(',')
      ? t.split(',').map((s) => s.trim()).filter(Boolean)
      : [t];
  }
  if (Array.isArray(value)) {
    const out: string[] = [];
    for (const item of value) {
      if (typeof item === 'string') {
        const s = item.trim();
        if (s) out.push(s);
      } else if (
        item != null &&
        typeof item === 'object' &&
        'name' in item &&
        typeof (item as { name: unknown }).name === 'string'
      ) {
        const s = (item as { name: string }).name.trim();
        if (s) out.push(s);
      }
    }
    return out;
  }
  return [];
}

/** Normalize empty and date-only values for `@IsDateString()`. */
export function transformReferenceAccessDate(
  value: unknown,
): string | undefined {
  if (value == null || value === '') return undefined;
  if (typeof value === 'string') {
    const d = value.trim();
    if (!d) return undefined;
    if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return `${d}T00:00:00.000Z`;
    return d;
  }
  if (value instanceof Date) return value.toISOString();
  return undefined;
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

  @Transform(({ value }) => transformReferenceAuthors(value))
  @IsArray()
  @IsString({ each: true })
  authors: string[];

  @IsOptional()
  @IsString()
  publisher: string | null;

  @IsOptional()
  @IsInt()
  year: number | null;

  @IsOptional()
  @Transform(({ value }) => transformReferenceAccessDate(value))
  @IsDateString()
  access_date?: string | null;
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
