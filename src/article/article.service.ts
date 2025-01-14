import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateArticleDto } from './dto/create-article.dto';
import { UpdateArticleDto } from './dto/update-article.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { Article } from '@prisma/client';

@Injectable()
export class ArticleService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createArticleDto: CreateArticleDto): Promise<Article> {
    const {
      categories,
      tags,
      references,
      media,
      metadata,
      versions,
      contributors,
      ...articleData
    } = createArticleDto;

    console.log(createArticleDto);

    return this.prisma.article.create({
      data: {
        ...articleData,
        categories: {
          connect: categories.map((categoryId) => ({ id: categoryId })),
        },
        tags: {
          connect: tags.map((tagId) => ({ id: tagId })),
        },
        references: {
          create: references,
        },
        media: {
          create: media,
        },
        sections: {
          create: articleData.sections,
        },
        metadata: {
          create: metadata,
        },
        versions: {
          create: versions,
        },
        contributors: {
          connect: contributors.map((userId) => ({ id: userId })),
        },
      },
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
    id: string,
    updateArticleDto: UpdateArticleDto,
  ): Promise<Article> {
    // Assuming a full update/replace of related data.  For partial updates,
    // adjust logic accordingly (e.g., using disconnect, updateMany, etc.)
    const {
      categories,
      tags,
      sections,
      references,
      media,
      metadata,
      versions,
      contributors,
      ...articleData
    } = updateArticleDto;

    // Fetch existing article to check if it exists.
    const existingArticle = await this.prisma.article.findUnique({
      where: { id },
    });

    if (!existingArticle) {
      throw new NotFoundException(`Article with ID ${id} not found`);
    }

    return this.prisma.article.update({
      where: { id },
      data: {
        ...articleData,

        categories: {
          set: categories?.map((id) => ({ id })) || [],
        },
        tags: { set: tags.map((id) => ({ id })) },
        references: {
          create: references,
        },
        media: { create: media },
        metadata: { create: metadata },
        sections: {
          create: sections,
        },
        versions: { create: versions },

        contributors: {
          set: contributors?.map((id) => ({ id })) || [],
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
