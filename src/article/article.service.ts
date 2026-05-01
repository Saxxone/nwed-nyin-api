import {
  Injectable,
  NotFoundException,
  NotImplementedException,
  UnauthorizedException,
} from '@nestjs/common';
import { Article, FileType, Status } from '@prisma/client';
import { promises as fs } from 'fs';
import { dirname, join } from 'path';
import { FileService } from 'src/file/file.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { UserService } from 'src/user/user.service';
import { CreateArticleDto } from './dto/create-article.dto';
import { UpdateArticleDto } from './dto/update-article.dto';

@Injectable()
export class ArticleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly userService: UserService,
    private readonly fileService: FileService,
  ) {}

  private async slugify(title: string): Promise<string> {
    let slug = title
      .toLowerCase()
      .normalize('NFD')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
    let slugExists = await this.prisma.article.count({ where: { slug } });
    let counter = 1;

    while (slugExists) {
      const newSlug = `${slug}-${counter}`;
      slugExists = await this.prisma.article.count({
        where: { slug: newSlug },
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
        if (error.code === 'ENOENT') {
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
  ): Promise<Article> {
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

    return this.prisma.$transaction(async (prisma) => {
      try {
        const user = await this.userService.findUser(email);

        if (!user) throw new UnauthorizedException('Login or create account');

        const sections = this.extractSectionsFromMarkdown(content);

        return await prisma.article.create({
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
      } catch (error) {
        throw new NotImplementedException(`error publishing post ${error}`);
      }
    });
  }

  findAll({ skip, take }: { skip: number; take: number }): Promise<Article[]> {
    return this.prisma.article.findMany({
      where: {
        status: Status.PUBLISHED,
      },
      skip,
      take,
      orderBy: {
        created_at: 'desc',
      },
      include: {
        categories: true,
        tags: true,
        references: true,
        file: true,
        metadata: true,
        versions: true,
        contributors: true,
      },
    });
  }

  search({
    term,
    skip,
    take,
  }: {
    term: string;
    skip: number;
    take: number;
  }): Promise<Article[]> {
    const search_term = term.trim();

    if (!search_term) return this.findAll({ skip, take });

    return this.prisma.article.findMany({
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
      include: {
        categories: true,
        tags: true,
        references: true,
        file: true,
        metadata: true,
        versions: true,
        contributors: true,
      },
    });
  }

  async findOne(slug: string): Promise<Article> {
    const article = await this.prisma.article.findUnique({
      where: { slug },
      include: {
        categories: true,
        tags: true,
        references: true,
        file: true,
        metadata: true,
        versions: true,
        contributors: true,
      },
    });
    if (!article) {
      throw new NotFoundException(`Article with slug ${slug} not found`);
    }
    return article;
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
  ): Promise<Article> {
    const { content, ...article_data } = update_article_dto;

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

    const markdown = content;

    const sections = this.extractSectionsFromMarkdown(markdown);

    const new_slug = await this.slugify(article_data.title);

    const file_path = await this.writeMarkdownFile(new_slug, content);

    return this.prisma.article.update({
      where: { id },
      data: {
        ...article_data,
        slug: new_slug,
        updated_by: email,
        body: file_path,
        summary: markdown.substring(0, 50),
        file: {
          create: {
            originalname: new_slug + '.md',
            mimetype: 'text/markdown',
            size: markdown.length,
            type: FileType.DOCUMENT,
            url: file_path,
            owner: {
              connect: user,
            },
            filename: new_slug,
            path: file_path,
          },
        },

        sections: {
          create: sections,
        },

        categories: {
          connectOrCreate:
            article_data.categories?.map((category) => ({
              where: { name: category },
              create: { name: category },
            })) || [],
        },

        tags: {
          set: article_data.tags?.map((tag) => ({ name: tag })) || [],
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

        versions: {
          set:
            article_data.versions?.map((version) => ({
              version: version.version,
              article_id_version: {
                article_id: id,
                version: version.version,
              },
            })) || [],
        },

        metadata: article_data.metadata
          ? { create: article_data.metadata }
          : undefined,

        contributors: {
          connect: user,
        },
      },
      include: {
        categories: true,
        tags: true,
        references: true,
        file: true,
        metadata: true,
        versions: true,
        contributors: true,
      },
    });
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
