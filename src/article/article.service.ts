import {
  Injectable,
  UnauthorizedException,
  NotFoundException,
  NotImplementedException,
} from '@nestjs/common';
import { CreateArticleDto } from './dto/create-article.dto';
import { UpdateArticleDto } from './dto/update-article.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { UserService } from 'src/user/user.service';
import { Article, Status } from '@prisma/client';
import { promises as fs } from 'fs';

@Injectable()
export class ArticleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly userService: UserService,
  ) {}

  private async slugify(title: string): Promise<string> {
    let slug = title.toLowerCase().replace(/\s+/g, '-');
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
      // Push existing section content
      if (current_section) {
        sections.push({
          title: sections[sections.length - 1]?.title,
          content: current_section.trim(),
        });
      }

      sections.push({ title: match[1], content: '' });
      current_section = '';

      const next_heading_index = heading_regex.lastIndex; // start of next section
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
      content: current_section.trim(),
    });
    return sections.slice(1);
  }

  async create(
    create_article_dto: CreateArticleDto,
    email: string,
  ): Promise<Article> {
    const { media, content, ...article_data } = create_article_dto;

    return await this.prisma.$transaction(async (prisma) => {
      try {
        const user = await this.userService.findUser(email);

        if (!user) throw new UnauthorizedException('Login or create account');

        const slug = await this.slugify(article_data.title);

        const markdown = content;
        const sections = this.extractSectionsFromMarkdown(markdown);
        const file_path = `articles/${slug}.md`;
        await fs.writeFile(file_path, content);

        return prisma.article.create({
          data: {
            ...article_data,
            slug: slug,
            status: Status.PUBLISHED,
            body: file_path,
            summary: article_data.title,
            media: {
              create: media,
            },
            sections: {
              create: sections,
            },
            contributors: {
              connect: user,
            },
            created_by: email,
            updated_by: email,
          },
        });
      } catch (error) {
        throw new NotImplementedException(`error publishing post ${error}`);
      }
    });
  }

  findAll(): Promise<Article[]> {
    return this.prisma.article.findMany({
      include: {
        categories: true,
        tags: true,
        references: true,
        media: true,
        metadata: true,
        versions: true,
        contributors: true,
      },
    });
  }

  async findOne(id: string): Promise<Article> {
    const article = await this.prisma.article.findUnique({
      where: { id },
      include: {
        categories: true,
        tags: true,
        references: true,
        media: true,
        metadata: true,
        versions: true,
        contributors: true,
      },
    });
    if (!article) {
      throw new NotFoundException(`Article with ID ${id} not found`);
    }
    return article;
  }

  async update(
    slug: string,
    update_article_dto: UpdateArticleDto,
    email: string,
  ): Promise<Article> {
    const { ...article_data } = update_article_dto;

    const existingArticle = await this.prisma.article.findUnique({
      where: { slug },
    });

    const user = await this.userService.findUser(email);

    if (!user) throw new UnauthorizedException('Login or create account');
    if (!existingArticle) {
      throw new NotFoundException(`Article with slug ${slug} not found`);
    }

    const markdown = article_data.content;
    const sections = this.extractSectionsFromMarkdown(markdown);

    const new_slug = await this.slugify(article_data.title);

    return this.prisma.article.update({
      where: { slug },
      data: {
        ...article_data,
        slug: new_slug,
        updated_by: email,
        media: {
          create: article_data.media,
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
        media: true,
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
