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
    let slug = title.toLowerCase().normalize('NFD').replace(/\s+/g, '-');
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

  private extractSectionsFromMarkdown(markdown: string) {
    const heading_regex = /## (.+)\n/g; // Matches lines starting with "## " only H2 headings are sections
    let match: RegExpExecArray;
    let current_section = '';
    const sections = [];

    while ((match = heading_regex.exec(markdown)) !== null) {
      if (current_section) {
        sections.push({
          title: sections[sections.length - 1]?.title,
          content: current_section.substring(0, 50),
        });
      }

      sections.push({ title: match[1], content: '' });
      current_section = '';

      const next_heading_index = heading_regex.lastIndex;
      const next_match = heading_regex.exec(markdown);
      const end_of_current_section = next_match
        ? next_match.index
        : markdown.length;
      current_section = markdown.substring(
        next_heading_index,
        end_of_current_section,
      );
    }

    sections.push({
      title: sections[sections.length - 1]?.title,
      content: current_section.substring(0, 50),
    });
    return sections.slice(1);
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

    return await this.prisma.$transaction(async (prisma) => {
      try {
        const user = await this.userService.findUser(email);

        if (!user) throw new UnauthorizedException('Login or create account');

        const sections = this.extractSectionsFromMarkdown(content);

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
            },
          },
        });

        return article;
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
    slug: string,
    update_article_dto: UpdateArticleDto,
    email: string,
  ): Promise<Article> {
    const { ...article_data } = update_article_dto;

    const existing_article = await this.prisma.article.findUnique({
      where: { slug },
      include: {
        file: true,
      },
    });

    const user = await this.userService.findUser(email);

    if (!user) throw new UnauthorizedException('Login or create account');
    if (!existing_article) {
      throw new NotFoundException(`Article with slug ${slug} not found`);
    }

    const markdown = article_data.content;
    const sections = this.extractSectionsFromMarkdown(markdown);

    const new_slug = await this.slugify(article_data.title);

    const file_path = await this.writeMarkdownFile(slug, article_data.content);

    return this.prisma.article.update({
      where: { slug },
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
