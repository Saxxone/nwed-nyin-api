import { Injectable, Logger } from '@nestjs/common';
import { Prisma, ReferenceType, Status } from '@prisma/client';
import { promises as fs } from 'fs';
import { isAbsolute, join } from 'path';
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
    body: true;
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

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  Culture: [
    'culture',
    'custom',
    'tradition',
    'festival',
    'ceremony',
    'community',
    'heritage',
    'family',
    'kinship',
    'marriage',
    'funeral',
    'masquerade',
    'attire',
  ],
  History: [
    'history',
    'historical',
    'oral history',
    'origin',
    'migration',
    'archive',
    'memory',
    'ancestor',
    'precolonial',
    'colonial',
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
    'proverb',
    'idiom',
    'translation',
    'vocabulary',
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
  Food: [
    'food',
    'cuisine',
    'recipe',
    'dish',
    'soup',
    'afang',
    'edikang',
    'ekpang',
  ],
  Music: ['music', 'song', 'drum', 'dance', 'instrument', 'performance'],
  Places: [
    'place',
    'village',
    'town',
    'city',
    'region',
    'river',
    'akwa ibom',
    'cross river',
    'calabar',
    'uyo',
    'oron',
  ],
  People: [
    'person',
    'people',
    'biography',
    'leader',
    'elder',
    'chief',
    'king',
    'queen',
  ],
  Religion: [
    'religion',
    'belief',
    'spiritual',
    'shrine',
    'ritual',
    'ancestor',
    'deity',
  ],
};
const TAG_KEYWORDS: Record<string, string[]> = {
  ibibio: ['ibibio'],
  efik: ['efik'],
  annang: ['annang'],
  oron: ['oron'],
  'akwa-ibom': ['akwa ibom'],
  'cross-river': ['cross river'],
  calabar: ['calabar'],
  uyo: ['uyo'],
  'oral-history': [
    'oral history',
    'community memory',
    'elder testimony',
    'storytelling',
  ],
  'language-learning': [
    'language learning',
    'learning guide',
    'learn ibibio',
    'learn efik',
    'practice pronunciation',
  ],
  dictionary: ['dictionary', 'glossary', 'vocabulary', 'word list'],
  pronunciation: ['pronunciation', 'phonetics', 'accent', 'spoken sound'],
  grammar: ['grammar', 'sentence', 'syntax'],
  translation: ['translation', 'translate', 'meaning in english'],
  proverbs: ['proverb', 'proverbs', 'idiom', 'saying'],
  folktales: ['folktale', 'folk tale', 'folklore', 'myth'],
  festivals: ['festival', 'celebration'],
  'traditional-attire': ['attire', 'cloth', 'wrapper', 'beads'],
  'traditional-marriage': [
    'traditional marriage',
    'marriage rite',
    'bride price',
  ],
  kinship: ['kinship', 'lineage', 'clan', 'family structure'],
  'food-culture': ['food', 'cuisine', 'recipe', 'dish'],
  'traditional-soups': ['soup', 'afang', 'edikang', 'ekpang'],
  music: ['music', 'song', 'drum', 'instrument'],
  dance: ['dance', 'masquerade performance'],
  religion: ['religion', 'belief', 'spiritual', 'ritual', 'deity'],
  'place-history': ['place history', 'village history', 'town history'],
  migration: ['migration', 'settlement', 'origin story'],
};

@Injectable()
export class ArticleMetadataBackfillService {
  private readonly logger = new Logger(ArticleMetadataBackfillService.name);

  constructor(private readonly prisma: PrismaService) {}

  async backfillArticleMetadata(batch_size?: number): Promise<BackfillStats> {
    const stats: BackfillStats = {
      processed: 0,
      updated: 0,
      skipped: 0,
      failed: 0,
    };
    let skip = 0;

    while (true) {
      const articles = await this.findArticlesForBackfill(batch_size, skip);
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

      if (!batch_size) break;
      skip += batch_size;
    }

    return stats;
  }

  private findArticlesForBackfill(batch_size?: number, skip = 0) {
    return this.prisma.article.findMany({
      where: {
        status: { not: Status.DELETED },
        OR: [{ body: { not: null } }, { versions: { some: {} } }],
      },
      orderBy: {
        id: 'asc',
      },
      skip: batch_size ? skip : undefined,
      take: batch_size,
      select: {
        id: true,
        title: true,
        slug: true,
        body: true,
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
    const content = await this.readArticleContent(article);
    if (!content) return false;

    const metadata = this.inferMetadataFromLatestVersion(
      article.title,
      content,
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

  private async readArticleContent(
    article: ArticleForBackfill,
  ): Promise<Prisma.JsonValue | string | null> {
    const latest_version_content = article.versions[0]?.content;
    if (latest_version_content) return latest_version_content;
    if (!article.body) return null;

    const markdown = await this.readFirstExistingMarkdown(article.body);
    if (markdown) return markdown;

    const inline_body = this.readArticleBody(article.body);
    if (inline_body) return inline_body;

    this.logger.warn(`Unable to read markdown file for ${article.slug}`);
    return null;
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

  private contentToText(
    article_title: string,
    content: Prisma.JsonValue,
  ): string {
    if (typeof content === 'string')
      return [article_title, content].join('\n\n');
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

  private async readFirstExistingMarkdown(
    body: string,
  ): Promise<string | null> {
    for (const path of this.resolveMarkdownPaths(body)) {
      try {
        return await fs.readFile(path, 'utf8');
      } catch {
        continue;
      }
    }

    return null;
  }

  private resolveMarkdownPaths(body: string): string[] {
    if (isAbsolute(body)) return [body];

    const normalized_body = body
      .replace(/^\/+/, '')
      .replace(/^public\/+/, '')
      .replace(/^articles\/+/, '');

    return Array.from(
      new Set([
        join(__dirname, '..', '..', 'public', 'articles', normalized_body),
        join(
          __dirname,
          '..',
          '..',
          '..',
          'public',
          'articles',
          normalized_body,
        ),
        join(process.cwd(), 'public', 'articles', normalized_body),
        join(
          process.cwd(),
          'nwed-nyin-api',
          'public',
          'articles',
          normalized_body,
        ),
      ]),
    );
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
    const normalized_text = this.normalizeTextForMatching(text);

    return this.normalizeNames(
      Object.entries(TAG_KEYWORDS)
        .filter(([, keywords]) =>
          keywords.some((keyword) =>
            normalized_text.includes(this.normalizeTextForMatching(keyword)),
          ),
        )
        .map(([tag]) => tag),
    );
  }

  private normalizeTextForMatching(text: string): string {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private extractExplicitReferences(text: string): InferredReference[] {
    const references: InferredReference[] = [];
    const now = new Date();
    const reference_lines = this.extractReferenceSectionLines(text);
    const lines_to_scan = reference_lines.length
      ? reference_lines
      : text.split('\n');
    const url_regex = /\bhttps?:\/\/[^\s<>)"']+/gi;
    const doi_regex = /\b10\.\d{4,9}\/[-._;()/:A-Z0-9]+/gi;
    const isbn_regex =
      /\b(?:ISBN(?:-1[03])?:?\s*)?(97[89][-\s]?)?\d[-\s]?\d{2,5}[-\s]?\d{2,7}[-\s]?\d{1,7}[-\s]?[\dX]\b/gi;

    for (const line of lines_to_scan) {
      const image_urls = this.extractImageUrls(line);
      const citation = this.cleanReferenceCitation(line);
      if (!citation) continue;

      for (const match of line.matchAll(url_regex)) {
        const url = this.trimReferenceToken(match[0]);
        if (image_urls.has(url)) continue;

        references.push({
          type: ReferenceType.WEBSITE,
          citation,
          url,
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
        const isbn = this.trimReferenceToken(match[0]).replace(
          /^ISBN(?:-1[03])?:?\s*/i,
          '',
        );
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

  private extractImageUrls(line: string): Set<string> {
    const image_urls = new Set<string>();
    const markdown_image_regex =
      /!\[[^\]]*]\(([^)\s]+)(?:\s+["'][^"']*["'])?\)/g;
    const html_image_regex = /<img\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi;

    for (const match of line.matchAll(markdown_image_regex)) {
      image_urls.add(this.trimReferenceToken(match[1]));
    }

    for (const match of line.matchAll(html_image_regex)) {
      image_urls.add(this.trimReferenceToken(match[1]));
    }

    return image_urls;
  }

  private extractReferenceSectionLines(text: string): string[] {
    const lines = text.split('\n');
    const reference_lines: string[] = [];
    let in_reference_section = false;

    for (const line of lines) {
      if (
        /^#{1,6}\s+(references|sources|bibliography)\s*$/i.test(line.trim())
      ) {
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
    return this.normalizeNames(names).filter(
      (name) => !existing.has(this.nameKey(name)),
    );
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

  private dedupeReferences(
    references: InferredReference[],
  ): InferredReference[] {
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
