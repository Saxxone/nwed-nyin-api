import { Test, TestingModule } from '@nestjs/testing';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { Mock } from 'jest-mock';
import { ArticleService } from './article.service';
import { PrismaService } from '../prisma/prisma.service';
import { UserService } from '../user/user.service';
import { FileService } from '../file/file.service';

type AsyncPrismaMock = Mock<() => Promise<unknown>>;
type AnyMock = Mock<(...args: any[]) => any>;

describe('ArticleService', () => {
  let service: ArticleService;
  let prisma: {
    article: {
      findMany: AsyncPrismaMock;
      findFirst: AsyncPrismaMock;
      findUnique: AsyncPrismaMock;
      count: AsyncPrismaMock;
      update: AsyncPrismaMock;
    };
    file: {
      findMany: AsyncPrismaMock;
      updateMany: AsyncPrismaMock;
    };
  };
  let userService: {
    findUser: AnyMock;
  };

  beforeEach(async () => {
    prisma = {
      article: {
        findMany: jest.fn<() => Promise<unknown>>(),
        findFirst: jest.fn<() => Promise<unknown>>(),
        findUnique: jest.fn<() => Promise<unknown>>(),
        count: jest.fn<() => Promise<unknown>>(),
        update: jest.fn<() => Promise<unknown>>(),
      },
      file: {
        findMany: jest.fn<() => Promise<unknown>>(),
        updateMany: jest.fn<() => Promise<unknown>>(),
      },
    };
    userService = {
      findUser: jest.fn<(...args: any[]) => any>(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ArticleService,
        { provide: PrismaService, useValue: prisma },
        { provide: UserService, useValue: userService },
        { provide: FileService, useValue: {} },
      ],
    }).compile();

    service = module.get<ArticleService>(ArticleService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('finds published articles with pagination', async () => {
    const articles = [
      {
        id: 'article-1',
        title: 'Title',
        slug: 'title',
        summary: 'Summary',
        body: null,
        created_at: new Date('2026-01-01T00:00:00.000Z'),
        updated_at: new Date('2026-01-02T00:00:00.000Z'),
        version: 1,
        status: 'PUBLISHED',
        categories: [{ name: 'Language' }],
        tags: [{ name: 'ibibio' }],
        references: [],
        file: [],
        metadata: null,
        contributors: [
          {
            id: 'user-1',
            name: 'Editor',
            img: '/avatar.png',
          },
        ],
      },
    ];
    prisma.article.findMany.mockResolvedValue(articles);

    await expect(service.findAll({ skip: 5, take: 10 })).resolves.toEqual(
      [
        expect.objectContaining({
          id: 'article-1',
          categories: ['Language'],
          tags: ['ibibio'],
          contributors: [
            {
              id: 'user-1',
              name: 'Editor',
              img: '/avatar.png',
            },
          ],
        }),
      ],
    );

    expect(prisma.article.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: 'PUBLISHED' },
        skip: 5,
        take: 10,
        orderBy: { created_at: 'desc' },
        select: expect.objectContaining({
          contributors: {
            select: {
              id: true,
              name: true,
              img: true,
            },
          },
        }),
      }),
    );
  });

  it('falls back to findAll for blank searches', async () => {
    const findAllSpy = jest.spyOn(service, 'findAll').mockResolvedValue([]);

    await expect(
      service.search({ term: '   ', skip: 0, take: 10 }),
    ).resolves.toEqual([]);

    expect(findAllSpy).toHaveBeenCalledWith({ skip: 0, take: 10 });
    expect(prisma.article.findMany).not.toHaveBeenCalled();
  });

  it('searches article fields for non-empty terms', async () => {
    prisma.article.findMany.mockResolvedValue([]);

    await expect(
      service.search({ term: ' title ', skip: 0, take: 10 }),
    ).resolves.toEqual([]);

    expect(prisma.article.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: 'PUBLISHED',
          OR: expect.arrayContaining([
            { title: { contains: 'title' } },
            { summary: { contains: 'title' } },
            { slug: { contains: 'title' } },
          ]),
        }),
        skip: 0,
        take: 10,
      }),
    );
  });

  it('returns public contributor fields for a single article', async () => {
    const article = {
      id: 'article-1',
      title: 'Title',
      slug: 'title',
      summary: 'Summary',
      body: null,
      created_at: new Date('2026-01-01T00:00:00.000Z'),
      updated_at: new Date('2026-01-02T00:00:00.000Z'),
      version: 1,
      status: 'PUBLISHED',
      categories: [{ name: 'Language' }],
      tags: [{ name: 'ibibio' }],
      references: [],
      file: [],
      metadata: null,
      contributors: [
        {
          id: 'user-1',
          name: 'Editor',
          img: '/avatar.png',
        },
      ],
    };
    prisma.article.findFirst.mockResolvedValue(article);

    const result = await service.findOne('title');

    expect(result).not.toHaveProperty('body');
    expect(result).not.toHaveProperty('created_by');
    expect(result).toEqual(
      expect.objectContaining({
        contributors: [
          {
            id: 'user-1',
            name: 'Editor',
            img: '/avatar.png',
          },
        ],
      }),
    );

    expect(prisma.article.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { slug: 'title', status: 'PUBLISHED' },
      }),
    );
  });

  it('updates article content without resetting required versions or duplicating metadata', async () => {
    const publicArticle = {
      id: 'article-1',
      title: 'Updated Title',
      slug: 'updated-title',
      summary: 'Summary',
      body: 'articles/updated-title.md',
      created_at: new Date('2026-01-01T00:00:00.000Z'),
      updated_at: new Date('2026-01-02T00:00:00.000Z'),
      version: 1,
      status: 'PUBLISHED',
      categories: [{ name: 'Culture' }],
      tags: [{ name: 'ibibio' }],
      references: [],
      file: [],
      metadata: {
        keywords: ['ibibio'],
        language: 'en',
        read_time: 1,
        complexity: null,
      },
      contributors: [
        {
          id: 'user-1',
          name: 'Editor',
          img: '/avatar.png',
        },
      ],
    };

    prisma.article.findUnique.mockResolvedValue({
      id: 'article-1',
      title: 'Original Title',
      slug: 'original-title',
      file: [],
    });
    prisma.article.count.mockResolvedValue(0);
    prisma.file.findMany.mockResolvedValue([]);
    prisma.article.update.mockResolvedValue({ slug: 'updated-title' });
    prisma.article.findFirst.mockResolvedValue(publicArticle);
    userService.findUser.mockResolvedValue({
      id: 'user-1',
      email: 'editor@example.com',
    });
    jest
      .spyOn(service as any, 'writeMarkdownFile')
      .mockResolvedValue('/tmp/updated-title.md');

    await expect(
      service.update(
        'article-1',
        {
          title: 'Updated Title',
          content: '## Intro\nUpdated content',
          tags: ['ibibio'],
          categories: ['Culture'],
          metadata: {
            keywords: ['ibibio'],
            language: 'en',
            read_time: 1,
            complexity: null,
          },
        } as any,
        'editor@example.com',
      ),
    ).resolves.toEqual(
      expect.objectContaining({
        id: 'article-1',
        slug: 'updated-title',
      }),
    );

    expect(prisma.article.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'article-1' },
        data: expect.objectContaining({
          slug: 'updated-title',
          body: 'articles/updated-title.md',
          metadata: {
            upsert: {
              create: {
                keywords: ['ibibio'],
                language: 'en',
                read_time: 1,
                complexity: null,
              },
              update: {
                keywords: ['ibibio'],
                language: 'en',
                read_time: 1,
                complexity: null,
              },
            },
          },
        }),
      }),
    );
    const updateCall = (prisma.article.update as AnyMock).mock.calls[0][0];
    expect(updateCall.data.versions).toBeUndefined();
  });
});
