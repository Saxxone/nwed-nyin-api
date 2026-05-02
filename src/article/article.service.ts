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

@Injectable()
export class ArticleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly userService: UserService,
    private readonly fileService: FileService,
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

  private async slugify(title: string, ignore_article_id?: string): Promise<string> {
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
            summary: content.substring(0, 50),
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
            metadata: article_data.metadata
              ? { create: article_data.metadata }
              : undefined,
            categories: {
              connectOrCreate:
                article_data.categories?.map((category) => ({
                  where: { name: category },
                  create: { name: category },
                })) || [],
            },

            tags: {
              connectOrCreate:
                article_data.tags?.map((tag) => ({
                  where: { name: tag },
                  create: { name: tag },
                })) || [],
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
              create:
                article_data.references?.map((reference) => ({
                  type: reference.type,
                  citation: reference.citation,
                  url: reference.url,
                  doi: reference.doi,
                  isbn: reference.isbn,
                  authors: reference.authors,
                  publisher: reference.publisher,
                  year: reference.year,
                  access_date: reference.access_date,
                })) || [],
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

    const articles_with_fallbacks =
      await this.withMarkdownImageFallbacks<PublicArticlePayload>(articles);

    return articles_with_fallbacks.map((article) =>
      this.toPublicArticle(article),
    );
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

    const articles_with_fallbacks =
      await this.withMarkdownImageFallbacks<PublicArticlePayload>(articles);

    return articles_with_fallbacks.map((article) =>
      this.toPublicArticle(article),
    );
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
      update_data.summary = markdown.substring(0, 50);
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
        connectOrCreate: categories.map((category) => ({
          where: { name: category },
          create: { name: category },
        })),
      };
    }

    if (tags) {
      update_data.tags = {
        set: [],
        connectOrCreate: tags.map((tag) => ({
          where: { name: tag },
          create: { name: tag },
        })),
      };
    }

    if (references) {
      update_data.references = {
        deleteMany: {},
        create: references.map((reference) => ({
          type: reference.type,
          citation: reference.citation,
          url: reference.url,
          doi: reference.doi,
          isbn: reference.isbn,
          authors: reference.authors,
          publisher: reference.publisher,
          year: reference.year,
          access_date: reference.access_date,
        })),
      };
    }

    if (metadata) {
      update_data.metadata = {
        upsert: {
          create: metadata,
          update: metadata,
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
