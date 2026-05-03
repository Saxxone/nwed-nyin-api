import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { Prisma, ReferenceType, Status } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

type InferredReference = {
  type: ReferenceType;
  citation: string;
  url?: string | null;
  doi?: string | null;
  isbn?: string | null;
  authors?: string[] | null;
  publisher?: string | null;
  year?: number | null;
  access_date: Date;
};

type InferredArticleMetadata = {
  categories: string[];
  tags: string[];
  references: InferredReference[];
};

type ArticleForBackfill = Prisma.ArticleGetPayload<{
  select: {
    id: true;
    title: true;
    slug: true;
    categories: { select: { name: true } };
    tags: { select: { name: true } };
    references: {
      select: {
        citation: true;
        url: true;
        doi: true;
        isbn: true;
      };
    };
    versions: {
      take: 1;
      orderBy: { version: 'desc' };
      select: {
        content: true;
        version: true;
      };
    };
  };
}>;

type BackfillStats = {
  processed: number;
  updated: number;
  skipped: number;
  failed: number;
};

const DEFAULT_BATCH_SIZE = 100;
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  Culture: [
    'culture',
    'custom',
    'tradition',
    'festival',
    'community',
    'heritage',
    'family',
    'kinship',
  ],
  History: [
    'history',
    'historical',
    'oral history',
    'origin',
    'migration',
    'archive',
    'memory',
  ],
  Language: [
    'language',
    'dictionary',
    'word',
    'words',
    'pronunciation',
    'grammar',
    'dialect',
    'efik',
    'ibibio',
    'annang',
    'oron',
  ],
  Learning: [
    'learn',
    'learning',
    'study',
    'lesson',
    'practice',
    'reader',
    'writing',
  ],
};

@Injectable()
export class ArticleMetadataBackfillService {
  private readonly logger = new Logger(ArticleMetadataBackfillService.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron('0 2 * * *')
  async handleCron(): Promise<void> {
    const stats = await this.backfillArticleMetadata();
    this.logger.log(
      `Article metadata backfill complete: processed=${stats.processed}, updated=${stats.updated}, skipped=${stats.skipped}, failed=${stats.failed}`,
    );
  }

  async backfillArticleMetadata(
    batch_size = DEFAULT_BATCH_SIZE,
  ): Promise<BackfillStats> {
    const stats: BackfillStats = {
      processed: 0,
      updated: 0,
      skipped: 0,
      failed: 0,
    };
    let skip = 0;

    while (true) {
      const articles = await this.findArticlesWithLatestVersions(
        batch_size,
        skip,
      );
      if (!articles.length) break;

      for (const article of articles) {
        try {
          const updated = await this.backfillArticle(article);
          stats.processed++;
          if (updated) stats.updated++;
          else stats.skipped++;
        } catch (error) {
          stats.failed++;
          this.logger.error(
            `Failed to backfill article metadata for ${article.slug}`,
            error instanceof Error ? error.stack : String(error),
          );
        }
      }

      skip += batch_size;
    }

    return stats;
  }

  private findArticlesWithLatestVersions(batch_size: number, skip: number) {
    return this.prisma.article.findMany({
      where: {
        status: { not: Status.DELETED },
        versions: {
          some: {},
        },
      },
      orderBy: {
        id: 'asc',
      },
      skip,
      take: batch_size,
      select: {
        id: true,
        title: true,
        slug: true,
        categories: {
          select: {
            name: true,
          },
        },
        tags: {
          select: {
            name: true,
          },
        },
        references: {
          select: {
            citation: true,
            url: true,
            doi: true,
            isbn: true,
          },
        },
        versions: {
          orderBy: {
            version: 'desc',
          },
          take: 1,
          select: {
            content: true,
            version: true,
          },
        },
      },
    });
  }

  private async backfillArticle(article: ArticleForBackfill): Promise<boolean> {
    const latest_version = article.versions[0];
    if (!latest_version) return false;

    const metadata = this.inferMetadataFromLatestVersion(
      article.title,
      latest_version.content,
    );
    const categories = this.uniqueNewNames(
      metadata.categories,
      article.categories.map((category) => category.name),
    );
    const tags = this.uniqueNewNames(
      metadata.tags,
      article.tags.map((tag) => tag.name),
    );
    const references = this.uniqueNewReferences(
      metadata.references,
      article.references,
    );

    if (!categories.length && !tags.length && !references.length) {
      return false;
    }

    await this.prisma.article.update({
      where: {
        id: article.id,
      },
      data: {
        categories: categories.length
          ? {
              connectOrCreate: categories.map((category) => ({
                where: { name: category },
                create: { name: category },
              })),
            }
          : undefined,
        tags: tags.length
          ? {
              connectOrCreate: tags.map((tag) => ({
                where: { name: tag },
                create: { name: tag },
              })),
            }
          : undefined,
        references: references.length
          ? {
              create: references,
            }
          : undefined,
      },
    });

    return true;
  }

  inferMetadataFromLatestVersion(
    article_title: string,
    content: Prisma.JsonValue,
  ): InferredArticleMetadata {
    const structured = this.extractStructuredMetadata(content);
    const text = this.contentToText(article_title, content);

    return {
      categories: this.normalizeNames([
        ...structured.categories,
        ...this.inferCategories(text),
      ]),
      tags: this.normalizeNames([...structured.tags, ...this.inferTags(text)]),
      references: this.dedupeReferences([
        ...structured.references,
        ...this.extractExplicitReferences(text),
      ]),
    };
  }

  private extractStructuredMetadata(
    content: Prisma.JsonValue,
  ): InferredArticleMetadata {
    if (!this.isRecord(content)) {
      return { categories: [], tags: [], references: [] };
    }

    return {
      categories: this.normalizeNames(this.readStringArray(content.categories)),
      tags: this.normalizeNames(this.readStringArray(content.tags)),
      references: this.readReferenceArray(content.references),
    };
  }

  private contentToText(article_title: string, content: Prisma.JsonValue): string {
    if (typeof content === 'string') return [article_title, content].join('\n\n');
    if (!this.isRecord(content)) return article_title;

    const fragments = [
      article_title,
      this.readString(content.title),
      this.readString(content.summary),
      this.readString(content.markdown),
      this.readString(content.content),
      this.readArticleBody(content.body),
    ];

    return fragments.filter(Boolean).join('\n\n');
  }

  private readArticleBody(value: unknown): string | null {
    const body = this.readString(value);
    if (!body || /^articles\/.+\.md$/i.test(body)) return null;
    return body;
  }

  private inferCategories(text: string): string[] {
    const normalized_text = text.toLowerCase();

    return Object.entries(CATEGORY_KEYWORDS)
      .filter(([, keywords]) =>
        keywords.some((keyword) => normalized_text.includes(keyword)),
      )
      .map(([category]) => category);
  }

  private inferTags(text: string): string[] {
    const tokens = text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .match(/[a-z][a-z0-9-]{2,}/g);
    const ignored_words = new Set([
      'and',
      'are',
      'article',
      'from',
      'into',
      'the',
      'this',
      'that',
      'with',
      'within',
      'your',
    ]);

    return this.normalizeNames(
      Array.from(new Set(tokens ?? []))
        .filter((token) => !ignored_words.has(token))
        .slice(0, 12),
    );
  }

  private extractExplicitReferences(text: string): InferredReference[] {
    const references: InferredReference[] = [];
    const now = new Date();
    const reference_lines = this.extractReferenceSectionLines(text);
    const lines_to_scan = reference_lines.length ? reference_lines : text.split('\n');
    const url_regex = /\bhttps?:\/\/[^\s<>)"']+/gi;
    const doi_regex = /\b10\.\d{4,9}\/[-._;()/:A-Z0-9]+/gi;
    const isbn_regex =
      /\b(?:ISBN(?:-1[03])?:?\s*)?(97[89][-\s]?)?\d[-\s]?\d{2,5}[-\s]?\d{2,7}[-\s]?\d{1,7}[-\s]?[\dX]\b/gi;

    for (const line of lines_to_scan) {
      const citation = this.cleanReferenceCitation(line);
      if (!citation) continue;

      for (const match of line.matchAll(url_regex)) {
        references.push({
          type: ReferenceType.WEBSITE,
          citation,
          url: this.trimReferenceToken(match[0]),
          access_date: now,
        });
      }

      for (const match of line.matchAll(doi_regex)) {
        references.push({
          type: ReferenceType.JOURNAL,
          citation,
          doi: this.trimReferenceToken(match[0]),
          access_date: now,
        });
      }

      for (const match of line.matchAll(isbn_regex)) {
        const isbn = this.trimReferenceToken(match[0]).replace(/^ISBN(?:-1[03])?:?\s*/i, '');
        references.push({
          type: ReferenceType.BOOK,
          citation,
          isbn,
          access_date: now,
        });
      }
    }

    return this.dedupeReferences(references);
  }

  private extractReferenceSectionLines(text: string): string[] {
    const lines = text.split('\n');
    const reference_lines: string[] = [];
    let in_reference_section = false;

    for (const line of lines) {
      if (/^#{1,6}\s+(references|sources|bibliography)\s*$/i.test(line.trim())) {
        in_reference_section = true;
        continue;
      }

      if (in_reference_section && /^#{1,6}\s+\S/.test(line.trim())) {
        break;
      }

      if (in_reference_section) reference_lines.push(line);
    }

    return reference_lines.filter((line) => line.trim());
  }

  private cleanReferenceCitation(line: string): string {
    return line
      .replace(/^\s*[-*+]\s*/, '')
      .replace(/^\s*\d+[.)]\s*/, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private trimReferenceToken(value: string): string {
    return value.replace(/[),.;\]]+$/g, '').trim();
  }

  private uniqueNewNames(names: string[], existing_names: string[]): string[] {
    const existing = new Set(existing_names.map((name) => this.nameKey(name)));
    return this.normalizeNames(names).filter((name) => !existing.has(this.nameKey(name)));
  }

  private uniqueNewReferences(
    references: InferredReference[],
    existing_references: Array<{
      citation: string;
      url: string | null;
      doi: string | null;
      isbn: string | null;
    }>,
  ): InferredReference[] {
    const existing = new Set(
      existing_references.map((reference) => this.referenceKey(reference)),
    );

    return this.dedupeReferences(references).filter(
      (reference) => !existing.has(this.referenceKey(reference)),
    );
  }

  private dedupeReferences(references: InferredReference[]): InferredReference[] {
    const seen = new Set<string>();
    const deduped: InferredReference[] = [];

    for (const reference of references) {
      const key = this.referenceKey(reference);
      if (seen.has(key)) continue;
      seen.add(key);
      deduped.push(reference);
    }

    return deduped;
  }

  private referenceKey(reference: {
    citation: string;
    url?: string | null;
    doi?: string | null;
    isbn?: string | null;
  }): string {
    return (
      reference.url?.toLowerCase() ||
      reference.doi?.toLowerCase() ||
      reference.isbn?.replace(/[-\s]/g, '').toLowerCase() ||
      reference.citation.toLowerCase()
    );
  }

  private normalizeNames(names: Array<string | null | undefined>): string[] {
    const normalized = names
      .map((name) => name?.trim())
      .filter((name): name is string => Boolean(name))
      .map((name) => name.replace(/\s+/g, ' '));

    return Array.from(
      new Map(normalized.map((name) => [this.nameKey(name), name])).values(),
    );
  }

  private nameKey(name: string): string {
    return name.toLowerCase();
  }

  private readString(value: unknown): string | null {
    return typeof value === 'string' ? value : null;
  }

  private readStringArray(value: unknown): string[] {
    return Array.isArray(value)
      ? value.filter((item): item is string => typeof item === 'string')
      : [];
  }

  private readReferenceArray(value: unknown): InferredReference[] {
    if (!Array.isArray(value)) return [];

    return value
      .filter((item): item is Record<string, unknown> => this.isRecord(item))
      .map((reference) => ({
        type: this.readReferenceType(reference.type),
        citation: this.readString(reference.citation) ?? '',
        url: this.readString(reference.url),
        doi: this.readString(reference.doi),
        isbn: this.readString(reference.isbn),
        authors: this.readStringArray(reference.authors),
        publisher: this.readString(reference.publisher),
        year: typeof reference.year === 'number' ? reference.year : null,
        access_date: this.readAccessDate(reference.access_date),
      }))
      .filter((reference) => Boolean(reference.citation));
  }

  private readReferenceType(value: unknown): ReferenceType {
    return typeof value === 'string' && value in ReferenceType
      ? (value as ReferenceType)
      : ReferenceType.WEBSITE;
  }

  private readAccessDate(value: unknown): Date {
    if (typeof value === 'string' || value instanceof Date) {
      const date = new Date(value);
      if (!Number.isNaN(date.valueOf())) return date;
    }

    return new Date();
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  }
}
