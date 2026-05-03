import {
  Injectable,
  NotFoundException,
  NotImplementedException,
  UnauthorizedException,
} from '@nestjs/common';
import { Article, File, FileType, Prisma, Status } from '@prisma/client';
import { existsSync } from 'fs';
import { promises as fs } from 'fs';
import { dirname, isAbsolute, join } from 'path';
import { FileService } from '../file/file.service';
import { PrismaService } from '../prisma/prisma.service';
import { UserService } from '../user/user.service';
import { CreateArticleDto } from './dto/create-article.dto';
import { UpdateArticleDto } from './dto/update-article.dto';
import { generateArticleSummary } from './helpers/article-summary.helper';
import { ArticleMetadataBackfillService } from './article-metadata-backfill.service';

const public_article_select = {
  id: true,
  title: true,
  slug: true,
  summary: true,
  body: true,
  created_at: true,
  updated_at: true,
  version: true,
  status: true,
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
      id: true,
      type: true,
      citation: true,
      url: true,
      doi: true,
      isbn: true,
      authors: true,
      publisher: true,
      year: true,
      access_date: true,
    },
  },
  file: {
    select: {
      id: true,
      type: true,
      url: true,
      path: true,
      mimetype: true,
      caption: true,
      credit: true,
      alt_text: true,
    },
  },
  metadata: {
    select: {
      keywords: true,
      language: true,
      read_time: true,
      complexity: true,
    },
  },
  contributors: {
    select: {
      id: true,
      name: true,
      img: true,
    },
  },
} satisfies Prisma.ArticleSelect;

type PublicArticlePayload = Prisma.ArticleGetPayload<{
  select: typeof public_article_select;
}>;

type PublicArticleMedia = Pick<
  File,
  | 'id'
  | 'type'
  | 'url'
  | 'path'
  | 'mimetype'
  | 'caption'
  | 'credit'
  | 'alt_text'
>;

type ArticleReferenceWrite = {
  type: Prisma.ReferenceCreateWithoutArticleInput['type'];
  citation: string;
  url?: string | null;
  doi?: string | null;
  isbn?: string | null;
  authors?: Prisma.InputJsonValue | null;
  publisher?: string | null;
  year?: number | null;
  access_date?: string | Date | null;
};
type ArticleMetadataWrite = NonNullable<CreateArticleDto['metadata']>;

type GeneratedArticleMetadata = {
  categories: string[];
  tags: string[];
  references: ArticleReferenceWrite[];
  metadata: Prisma.ArticleMetadataCreateWithoutArticleInput;
};

export type PublicArticle = {
  id: string;
  title: string;
  slug: string;
  summary: string;
  created_at: Date;
  updated_at: Date;
  version: number;
  status: Status;
  categories: string[];
  tags: string[];
  references: PublicArticlePayload['references'];
  file: PublicArticlePayload['file'];
  metadata: PublicArticlePayload['metadata'];
  contributors: PublicArticlePayload['contributors'];
};

type RelatedArticleSource = 'article' | 'word';

@Injectable()
export class ArticleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly userService: UserService,
    private readonly fileService: FileService,
    private readonly articleMetadataBackfillService: ArticleMetadataBackfillService,
  ) {}

  private toPublicArticle(article: PublicArticlePayload): PublicArticle {
    return {
      id: article.id,
      title: article.title,
      slug: article.slug,
      summary: article.summary,
      created_at: article.created_at,
      updated_at: article.updated_at,
      version: article.version,
      status: article.status,
      categories: article.categories.map((category) => category.name),
      tags: article.tags.map((tag) => tag.name),
      references: article.references,
      file: article.file.map((file) => ({
        id: file.id,
        type: file.type,
        url: file.url,
        path: file.path,
        mimetype: file.mimetype,
        caption: file.caption,
        credit: file.credit,
        alt_text: file.alt_text,
      })),
      metadata: article.metadata,
      contributors: article.contributors.map((contributor) => ({
        id: contributor.id,
        name: contributor.name,
        img: contributor.img,
      })),
    };
  }

  private getArticleMediaFileIds(files?: CreateArticleDto['file']): string[] {
    return Array.from(
      new Set(
        (files ?? [])
          .map((file) => file?.id)
          .filter((id): id is string => Boolean(id)),
      ),
    );
  }

  private hasImageFile(files?: PublicArticleMedia[]): boolean {
    return (
      files?.some((file) => {
        return (
          file.type === FileType.IMAGE || file.mimetype?.startsWith('image/')
        );
      }) ?? false
    );
  }

  private extractImageUrlsFromMarkdown(markdown: string): string[] {
    const image_urls = new Set<string>();
    const markdown_image_regex =
      /!\[[^\]]*]\(\s*<?([^)\s>]+)>?(?:\s+["'][^"']*["'])?\s*\)/g;
    const html_image_regex =
      /<img\b[^>]*\bsrc\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))/gi;

    for (const match of markdown.matchAll(markdown_image_regex)) {
      image_urls.add(match[1]);
    }

    for (const match of markdown.matchAll(html_image_regex)) {
      image_urls.add(match[1] || match[2] || match[3]);
    }

    return Array.from(image_urls);
  }

  private resolveMarkdownPath(body?: string | null): string | null {
    if (!body) return null;

    if (isAbsolute(body) && existsSync(body)) {
      return body;
    }

    const normalized_body = body
      .replace(/^\/+/, '')
      .replace(/^public\/+/, '')
      .replace(/^articles\/+/, '');

    return join(
      __dirname,
      '..',
      '..',
      '..',
      'public',
      'articles',
      normalized_body,
    );
  }

  private createFallbackImageFile(
    article: { id: string; slug: string },
    image_url: string,
    index: number,
  ): PublicArticleMedia {
    return {
      id: `markdown-image-${article.id}-${index}`,
      type: FileType.IMAGE,
      url: image_url,
      path: image_url,
      mimetype: 'image/*',
      caption: null,
      credit: null,
      alt_text: null,
    };
  }

  private async withMarkdownImageFallbacks<
    T extends {
      id: string;
      slug: string;
      body?: string | null;
      file?: PublicArticleMedia[];
    },
  >(articles: T[]): Promise<T[]> {
    return Promise.all(
      articles.map(async (article) => {
        if (this.hasImageFile(article.file)) return article;

        const markdown_path = this.resolveMarkdownPath(article.body);
        if (!markdown_path) return article;

        try {
          const markdown = await fs.readFile(markdown_path, 'utf8');
          const image_files = this.extractImageUrlsFromMarkdown(markdown).map(
            (image_url, index) =>
              this.createFallbackImageFile(article, image_url, index),
          );

          if (!image_files.length) return article;

          return {
            ...article,
            file: [...(article.file ?? []), ...image_files],
          } as T;
        } catch {
          return article;
        }
      }),
    );
  }

  private async toPublicArticlesWithFallbacks(
    articles: PublicArticlePayload[],
  ): Promise<PublicArticle[]> {
    const articles_with_fallbacks =
      await this.withMarkdownImageFallbacks<PublicArticlePayload>(articles);

    return articles_with_fallbacks.map((article) =>
      this.toPublicArticle(article),
    );
  }

  private normalizeSuggestionTerm(term?: unknown): string | null {
    if (typeof term !== 'string') return null;

    const normalized_term = term.trim().toLowerCase();
    return normalized_term.length >= 2 ? normalized_term : null;
  }

  private normalizeSuggestionTerms(terms: unknown[]): string[] {
    return Array.from(
      new Set(
        terms
          .flatMap((term) => {
            if (Array.isArray(term)) return term;
            return [term];
          })
          .map((term) => this.normalizeSuggestionTerm(term))
          .filter((term): term is string => Boolean(term)),
      ),
    ).slice(0, 20);
  }

  private readKeywordTerms(keywords?: unknown): string[] {
    if (!keywords) return [];

    if (Array.isArray(keywords)) {
      return keywords.filter(
        (keyword): keyword is string => typeof keyword === 'string',
      );
    }

    if (typeof keywords === 'object') {
      return Object.values(keywords as Record<string, unknown>).filter(
        (keyword): keyword is string => typeof keyword === 'string',
      );
    }

    return [];
  }

  private buildRelatedArticleWhere({
    terms,
    excludeSlug,
    excludeSlugs = [],
    includeContentFields = true,
  }: {
    terms: string[];
    excludeSlug?: string;
    excludeSlugs?: string[];
    includeContentFields?: boolean;
  }): Prisma.ArticleWhereInput {
    const excluded_slugs = Array.from(
      new Set([...(excludeSlug ? [excludeSlug] : []), ...excludeSlugs]),
    );
    const term_filters = terms.flatMap((term) => [
      ...(includeContentFields
        ? [
            { title: { contains: term } },
            { summary: { contains: term } },
            { slug: { contains: term } },
          ]
        : []),
      {
        tags: {
          some: {
            name: { contains: term },
          },
        },
      },
      {
        categories: {
          some: {
            name: { contains: term },
          },
        },
      },
      ...(includeContentFields
        ? [
            {
              sections: {
                some: {
                  OR: [
                    { title: { contains: term } },
                    { content: { contains: term } },
                  ],
                },
              },
            },
          ]
        : []),
    ]);

    return {
      status: Status.PUBLISHED,
      ...(excluded_slugs.length ? { slug: { notIn: excluded_slugs } } : {}),
      OR: term_filters,
    };
  }

  private scoreRelatedArticle(article: PublicArticlePayload, terms: string[]) {
    const searchable_text = [
      article.title,
      article.summary,
      article.slug,
      ...article.categories.map((category) => category.name),
      ...article.tags.map((tag) => tag.name),
      ...this.readKeywordTerms(article.metadata?.keywords),
    ]
      .join(' ')
      .toLowerCase();

    return terms.reduce((score, term) => {
      if (!searchable_text.includes(term)) return score;

      const tag_match = article.tags.some((tag) =>
        tag.name.toLowerCase().includes(term),
      );
      const category_match = article.categories.some((category) =>
        category.name.toLowerCase().includes(term),
      );

      return score + (tag_match ? 3 : 0) + (category_match ? 2 : 0) + 1;
    }, 0);
  }

  private async slugify(
    title: string,
    ignore_article_id?: string,
  ): Promise<string> {
    let slug = title
      .toLowerCase()
      .normalize('NFD')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
    let slugExists = await this.prisma.article.count({
      where: {
        slug,
        ...(ignore_article_id ? { id: { not: ignore_article_id } } : {}),
      },
    });
    let counter = 1;

    while (slugExists) {
      const newSlug = `${slug}-${counter}`;
      slugExists = await this.prisma.article.count({
        where: {
          slug: newSlug,
          ...(ignore_article_id ? { id: { not: ignore_article_id } } : {}),
        },
      });
      if (!slugExists) {
        slug = newSlug;
      }
      counter++;
    }
    return slug;
  }

  private extractSectionsFromMarkdown(
    markdown: string,
  ): { title: string; content: string }[] {
    const heading_regex = /^## (.*)$/gm; // Match start of line, capture title, multiline
    const sections = [];

    // Find all H2 headings
    const matches = Array.from(markdown.matchAll(heading_regex));

    if (matches.length === 0) {
      // Handle case with no H2 headings if necessary
      return [];
    }

    for (let i = 0; i < matches.length; i++) {
      const match = matches[i];
      const nextMatch = matches[i + 1];

      const title = match[1].trim();
      const startIndex = match.index + match[0].length; // Start content after the heading line
      const endIndex = nextMatch ? nextMatch.index : markdown.length; // End content before the next heading or at the end of the string

      const content = markdown.substring(startIndex, endIndex).trim();

      sections.push({
        title: title,
        content: content.substring(0, 50), // Still creating substring, but maybe fewer/smaller ones overall
      });
    }

    return sections;
  }

  private inferArticleWriteMetadata({
    title,
    markdown,
    categories,
    tags,
    references,
    metadata,
  }: {
    title: string;
    markdown: string;
    categories?: string[];
    tags?: string[];
    references?: ArticleReferenceWrite[];
    metadata?: ArticleMetadataWrite;
  }): GeneratedArticleMetadata {
    const inferred =
      this.articleMetadataBackfillService.inferMetadataFromLatestVersion(
        title,
        {
          title,
          markdown,
        },
      );
    const merged_categories = this.uniqueNames([
      ...(categories ?? []),
      ...inferred.categories,
    ]);
    const merged_tags = this.uniqueNames([...(tags ?? []), ...inferred.tags]);
    const merged_references = this.uniqueReferences([
      ...(references ?? []),
      ...inferred.references,
    ]);

    return {
      categories: merged_categories,
      tags: merged_tags,
      references: merged_references,
      metadata: this.buildArticleMetadata(
        markdown,
        merged_categories,
        merged_tags,
        metadata,
      ),
    };
  }

  private buildArticleMetadata(
    markdown: string,
    categories: string[],
    tags: string[],
    metadata?: ArticleMetadataWrite,
  ): Prisma.ArticleMetadataCreateWithoutArticleInput {
    return {
      keywords: this.uniqueNames([
        ...(metadata?.keywords ?? []),
        ...categories,
        ...tags,
      ]),
      language: metadata?.language ?? 'en',
      read_time: metadata?.read_time ?? this.estimateReadTime(markdown),
      complexity: metadata?.complexity ?? null,
    };
  }

  private estimateReadTime(markdown: string): number {
    const word_count = markdown
      .replace(/```[\s\S]*?```/g, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/[^\p{L}\p{N}'-]+/gu, ' ')
      .trim()
      .split(/\s+/)
      .filter(Boolean).length;

    return Math.max(1, Math.ceil(word_count / 200));
  }

  private uniqueNames(names: Array<string | null | undefined>): string[] {
    const normalized = names
      .map((name) => name?.trim())
      .filter((name): name is string => Boolean(name))
      .map((name) => name.replace(/\s+/g, ' '));

    return Array.from(
      new Map(normalized.map((name) => [name.toLowerCase(), name])).values(),
    );
  }

  private uniqueNewNames(
    names: string[],
    existing_names: Array<{ name: string }>,
  ): string[] {
    const existing = new Set(
      existing_names.map((name) => name.name.toLowerCase()),
    );

    return this.uniqueNames(names).filter(
      (name) => !existing.has(name.toLowerCase()),
    );
  }

  private uniqueReferences(
    references: ArticleReferenceWrite[],
  ): ArticleReferenceWrite[] {
    return Array.from(
      new Map(
        references.map((reference) => [
          this.referenceKey(reference),
          reference,
        ]),
      ).values(),
    );
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

  private uniqueNewReferences(
    references: ArticleReferenceWrite[],
    existing_references: Array<{
      citation: string;
      url: string | null;
      doi: string | null;
      isbn: string | null;
    }>,
  ): ArticleReferenceWrite[] {
    const existing = new Set(
      existing_references.map((reference) => this.referenceKey(reference)),
    );

    return this.uniqueReferences(references).filter(
      (reference) => !existing.has(this.referenceKey(reference)),
    );
  }

  private mapReferenceCreate(
    reference: ArticleReferenceWrite,
  ): Prisma.ReferenceCreateWithoutArticleInput {
    return {
      type: reference.type,
      citation: reference.citation,
      url: reference.url,
      doi: reference.doi,
      isbn: reference.isbn,
      authors: reference.authors ?? undefined,
      publisher: reference.publisher,
      year: reference.year,
      access_date: reference.access_date
        ? new Date(reference.access_date)
        : new Date(),
    };
  }

  private async writeMarkdownFile(
    slug: string,
    content: string,
  ): Promise<string> {
    try {
      const file_path = join(
        __dirname,
        '../../../',
        process.env.FILE_BASE_URL,
        'articles',
        `${slug}.md`,
      );

      const dir = dirname(file_path);

      try {
        await fs.access(dir);
      } catch (error) {
        const node_error = error as NodeJS.ErrnoException;

        if (node_error.code === 'ENOENT') {
          await fs.mkdir(dir, { recursive: true });
        } else {
          throw error;
        }
      }

      await fs.writeFile(file_path, content);

      return file_path;
    } catch (error) {
      console.error('Error writing markdown file:', error);
      return null;
    }
  }

  async create(
    create_article_dto: CreateArticleDto,
    email: string,
  ): Promise<PublicArticle> {
    const {
      content,
      file: article_media_contents,
      ...article_data
    } = create_article_dto;

    const slug = await this.slugify(article_data.title);

    const file_path = await this.writeMarkdownFile(slug, content);

    if (!file_path) {
      throw new NotImplementedException('Error creating markdown file');
    }

    const article = await this.prisma.$transaction(async (prisma) => {
      try {
        const user = await this.userService.findUser(email);

        if (!user) throw new UnauthorizedException('Login or create account');

        const sections = this.extractSectionsFromMarkdown(content);
        const generated_metadata = this.inferArticleWriteMetadata({
          title: article_data.title,
          markdown: content,
          categories: article_data.categories,
          tags: article_data.tags,
          references: article_data.references,
          metadata: article_data.metadata,
        });
        const media_file_ids = this.getArticleMediaFileIds(
          article_media_contents,
        );
        const owned_media_files = media_file_ids.length
          ? await prisma.file.findMany({
              where: {
                id: { in: media_file_ids },
                owner_id: user.id,
                type: { in: [FileType.IMAGE, FileType.VIDEO, FileType.AUDIO] },
              },
              select: { id: true },
            })
          : [];
        const owned_media_file_ids = owned_media_files.map((file) => file.id);

        const article = await prisma.article.create({
          data: {
            ...article_data,
            slug: slug,
            body: 'articles/' + slug + '.md',
            status: Status.PUBLISHED,
            summary: generateArticleSummary(content),
            sections: {
              create: sections,
            },
            contributors: {
              connect: user,
            },
            created_by: email,
            updated_by: email,
            file: {
              create: {
                originalname: slug + '.md',
                mimetype: 'text/markdown',
                size: content.length,
                type: FileType.DOCUMENT,
                url: 'articles/' + slug + '.md',
                owner: {
                  connect: user,
                },
                filename: slug,
                path: 'articles/' + slug + '.md',
              },
              connect: owned_media_file_ids.map((id) => ({ id })),
            },
            metadata: {
              create: generated_metadata.metadata,
            },
            categories: {
              connectOrCreate: generated_metadata.categories.map(
                (category) => ({
                  where: { name: category },
                  create: { name: category },
                }),
              ),
            },

            tags: {
              connectOrCreate: generated_metadata.tags.map((tag) => ({
                where: { name: tag },
                create: { name: tag },
              })),
            },

            versions: {
              create:
                article_data.versions?.map((version) => ({
                  version: version.version,
                  content: version.content,
                  created_by: email,
                  article_id_version: {
                    version: version.version,
                  },
                })) || [],
            },

            references: {
              create: generated_metadata.references.map((reference) =>
                this.mapReferenceCreate(reference),
              ),
            },
          },
        });

        if (owned_media_file_ids.length) {
          await prisma.file.updateMany({
            where: {
              id: { in: owned_media_file_ids },
              owner_id: user.id,
            },
            data: { status: Status.UPLOADED },
          });
        }

        return article;
      } catch (error) {
        throw new NotImplementedException(`error publishing post ${error}`);
      }
    });

    return this.findOne(article.slug);
  }

  async findAll({
    skip,
    take,
  }: {
    skip: number;
    take: number;
  }): Promise<PublicArticle[]> {
    const articles = await this.prisma.article.findMany({
      where: {
        status: Status.PUBLISHED,
      },
      skip,
      take,
      orderBy: {
        created_at: 'desc',
      },
      select: public_article_select,
    });

    return this.toPublicArticlesWithFallbacks(articles);
  }

  async search({
    term,
    skip,
    take,
  }: {
    term: string;
    skip: number;
    take: number;
  }): Promise<PublicArticle[]> {
    const search_term = term.trim();

    if (!search_term) return this.findAll({ skip, take });

    const articles = await this.prisma.article.findMany({
      where: {
        status: Status.PUBLISHED,
        OR: [
          { title: { contains: search_term } },
          { summary: { contains: search_term } },
          { slug: { contains: search_term } },
          {
            tags: {
              some: {
                name: { contains: search_term },
              },
            },
          },
          {
            categories: {
              some: {
                name: { contains: search_term },
              },
            },
          },
          {
            sections: {
              some: {
                OR: [
                  { title: { contains: search_term } },
                  { content: { contains: search_term } },
                ],
              },
            },
          },
        ],
      },
      skip,
      take,
      orderBy: {
        created_at: 'desc',
      },
      select: public_article_select,
    });

    return this.toPublicArticlesWithFallbacks(articles);
  }

  async findRelated({
    source,
    slug,
    terms = [],
    excludeSlugs = [],
    take,
  }: {
    source: RelatedArticleSource;
    slug?: string;
    terms?: string[];
    excludeSlugs?: string[];
    take: number;
  }): Promise<PublicArticle[]> {
    let exclude_slug = slug;
    let suggestion_terms = this.normalizeSuggestionTerms(terms);
    const excluded_slugs = this.normalizeSuggestionTerms(excludeSlugs);

    if (source === 'article' && slug) {
      const current_article = await this.prisma.article.findFirst({
        where: { slug, status: Status.PUBLISHED },
        select: public_article_select,
      });

      if (!current_article) {
        throw new NotFoundException(`Article with slug ${slug} not found`);
      }

      exclude_slug = current_article.slug;
      suggestion_terms = this.normalizeSuggestionTerms([
        ...suggestion_terms,
        ...current_article.categories.map((category) => category.name),
        ...current_article.tags.map((tag) => tag.name),
        ...this.readKeywordTerms(current_article.metadata?.keywords),
      ]);
    }

    const candidates = suggestion_terms.length
      ? await this.prisma.article.findMany({
          where: this.buildRelatedArticleWhere({
            terms: suggestion_terms,
            excludeSlug: exclude_slug,
            excludeSlugs: excluded_slugs,
            includeContentFields: source === 'word',
          }),
          take: Math.max(take * 4, take),
          orderBy: {
            created_at: 'desc',
          },
          select: public_article_select,
        })
      : [];

    const ranked_candidates = candidates
      .map((article) => ({
        article,
        score: this.scoreRelatedArticle(article, suggestion_terms),
      }))
      .sort((left, right) => {
        if (right.score !== left.score) return right.score - left.score;
        return (
          right.article.created_at.getTime() - left.article.created_at.getTime()
        );
      })
      .map(({ article }) => article);

    const selected = ranked_candidates.slice(0, take);
    const selected_slugs = new Set(selected.map((article) => article.slug));

    if (selected.length < take) {
      const fallback_excluded_slugs = [
        ...(exclude_slug ? [exclude_slug] : []),
        ...excluded_slugs,
        ...Array.from(selected_slugs),
      ];
      const fallback_articles = await this.prisma.article.findMany({
        where: {
          status: Status.PUBLISHED,
          ...(fallback_excluded_slugs.length
            ? {
                slug: {
                  notIn: fallback_excluded_slugs,
                },
              }
            : {}),
        },
        take: take - selected.length,
        orderBy: {
          created_at: 'desc',
        },
        select: public_article_select,
      });

      selected.push(...fallback_articles);
    }

    return this.toPublicArticlesWithFallbacks(selected);
  }

  async findOne(slug: string): Promise<PublicArticle> {
    const article = await this.prisma.article.findFirst({
      where: { slug, status: Status.PUBLISHED },
      select: public_article_select,
    });
    if (!article) {
      throw new NotFoundException(`Article with slug ${slug} not found`);
    }
    const [article_with_fallbacks] = await this.withMarkdownImageFallbacks([
      article,
    ]);
    return this.toPublicArticle(article_with_fallbacks);
  }

  // async getMarkdown(path: string): Promise<StreamableFile> {
  //   try {
  //     const file_path = join(
  //       __dirname,
  //       process.env.FILE_BASE_URL,
  //       'public',
  //       'articles',
  //       `${path}.md`,
  //     );

  //     const file = createReadStream(
  //       join(
  //         __dirname,
  //         process.env.FILE_BASE_URL,
  //         'public',
  //         'articles',
  //         `${path}.md`,
  //       ),
  //     );
  //     if (!existsSync(file_path)) {
  //       throw new NotFoundException('Markdown file not found');
  //     }
  //     return new StreamableFile(file);
  //   } catch (error) {
  //     throw new NotFoundException('Markdown file not found' + error);
  //   }
  // }

  async update(
    id: string,
    update_article_dto: UpdateArticleDto,
    email: string,
  ): Promise<PublicArticle> {
    const {
      content,
      file: article_media_contents,
      title,
      categories,
      tags,
      references,
      metadata,
      versions,
    } = update_article_dto;

    const existing_article = await this.prisma.article.findUnique({
      where: { id },
      include: {
        file: true,
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
      },
    });

    const user = await this.userService.findUser(email);

    if (!user) throw new UnauthorizedException('Login or create account');
    if (!existing_article) {
      throw new NotFoundException(`Article with id ${id} not found`);
    }

    const markdown = content ?? null;
    const sections = markdown ? this.extractSectionsFromMarkdown(markdown) : [];
    const media_file_ids = this.getArticleMediaFileIds(article_media_contents);
    const owned_media_files = media_file_ids.length
      ? await this.prisma.file.findMany({
          where: {
            id: { in: media_file_ids },
            owner_id: user.id,
            type: { in: [FileType.IMAGE, FileType.VIDEO, FileType.AUDIO] },
          },
          select: { id: true },
        })
      : [];
    const owned_media_file_ids = owned_media_files.map((file) => file.id);

    const next_title = title ?? existing_article.title;
    const new_slug = await this.slugify(next_title, id);
    const should_update_markdown = typeof markdown === 'string';
    const markdown_path = should_update_markdown
      ? await this.writeMarkdownFile(new_slug, markdown)
      : null;

    if (should_update_markdown && !markdown_path) {
      throw new NotImplementedException('Error updating markdown file');
    }

    const generated_metadata = should_update_markdown
      ? this.inferArticleWriteMetadata({
          title: next_title,
          markdown,
          categories,
          tags,
          references,
          metadata,
        })
      : null;

    const update_data: Prisma.ArticleUpdateInput = {
      title: next_title,
      slug: new_slug,
      updated_by: email,
      contributors: {
        connect: { id: user.id },
      },
    };

    if (should_update_markdown) {
      update_data.body = 'articles/' + new_slug + '.md';
      update_data.summary = generateArticleSummary(markdown);
      update_data.sections = {
        deleteMany: {},
        create: sections,
      };
      update_data.file = {
        create: {
          originalname: new_slug + '.md',
          mimetype: 'text/markdown',
          size: markdown.length,
          type: FileType.DOCUMENT,
          url: 'articles/' + new_slug + '.md',
          owner: {
            connect: { id: user.id },
          },
          filename: new_slug,
          path: 'articles/' + new_slug + '.md',
        },
        connect: owned_media_file_ids.map((file_id) => ({ id: file_id })),
      };
    } else if (owned_media_file_ids.length) {
      update_data.file = {
        connect: owned_media_file_ids.map((file_id) => ({ id: file_id })),
      };
    }

    if (categories) {
      update_data.categories = {
        set: [],
        connectOrCreate: (generated_metadata?.categories ?? categories).map(
          (category) => ({
            where: { name: category },
            create: { name: category },
          }),
        ),
      };
    } else if (generated_metadata?.categories.length) {
      const new_categories = this.uniqueNewNames(
        generated_metadata.categories,
        existing_article.categories,
      );

      if (new_categories.length) {
        update_data.categories = {
          connectOrCreate: new_categories.map((category) => ({
            where: { name: category },
            create: { name: category },
          })),
        };
      }
    }

    if (tags) {
      update_data.tags = {
        set: [],
        connectOrCreate: (generated_metadata?.tags ?? tags).map((tag) => ({
          where: { name: tag },
          create: { name: tag },
        })),
      };
    } else if (generated_metadata?.tags.length) {
      const new_tags = this.uniqueNewNames(
        generated_metadata.tags,
        existing_article.tags,
      );

      if (new_tags.length) {
        update_data.tags = {
          connectOrCreate: new_tags.map((tag) => ({
            where: { name: tag },
            create: { name: tag },
          })),
        };
      }
    }

    if (references) {
      update_data.references = {
        deleteMany: {},
        create: (generated_metadata?.references ?? references).map(
          (reference) => this.mapReferenceCreate(reference),
        ),
      };
    } else if (generated_metadata?.references.length) {
      const new_references = this.uniqueNewReferences(
        generated_metadata.references,
        existing_article.references,
      );

      if (new_references.length) {
        update_data.references = {
          create: new_references.map((reference) =>
            this.mapReferenceCreate(reference),
          ),
        };
      }
    }

    if (metadata || generated_metadata) {
      const next_metadata = generated_metadata?.metadata ?? metadata;

      update_data.metadata = {
        upsert: {
          create: next_metadata,
          update: next_metadata,
        },
      };
    }

    if (versions?.length) {
      update_data.versions = {
        create: versions.map((version) => ({
          version: version.version,
          content: version.content,
          created_by: email,
        })),
      };
    }

    const article = await this.prisma.article.update({
      where: { id },
      data: update_data,
      select: {
        slug: true,
      },
    });

    if (owned_media_file_ids.length) {
      await this.prisma.file.updateMany({
        where: {
          id: { in: owned_media_file_ids },
          owner_id: user.id,
        },
        data: { status: Status.UPLOADED },
      });
    }

    return this.findOne(article.slug);
  }

  async remove(id: string): Promise<Article> {
    const existingArticle = await this.prisma.article.findUnique({
      where: { id },
    });

    if (!existingArticle) {
      throw new NotFoundException(`Article with ID ${id} not found`);
    }

    return this.prisma.article.delete({
      where: { id },
    });
  }
}
