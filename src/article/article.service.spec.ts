import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import type { Mock } from 'jest-mock';
import { FileService } from '../file/file.service';
import { PrismaService } from '../prisma/prisma.service';
import { UserService } from '../user/user.service';
import { ArticleMetadataBackfillService } from './article-metadata-backfill.service';
import { ArticleService } from './article.service';

type AsyncPrismaMock = Mock<() => Promise<unknown>>;
type AnyMock = Mock<(...args: any[]) => any>;

describe('ArticleService', () => {
  let service: ArticleService;
  let prisma: {
    $transaction: AnyMock;
    article: {
      findMany: AsyncPrismaMock;
      findFirst: AsyncPrismaMock;
      findUnique: AsyncPrismaMock;
      count: AsyncPrismaMock;
      update: AsyncPrismaMock;
    };
    articleVersion: {
      aggregate: AsyncPrismaMock;
      findFirst: AsyncPrismaMock;
    };
    file: {
      findMany: AsyncPrismaMock;
      updateMany: AsyncPrismaMock;
    };
  };
  let userService: {
    findUser: AnyMock;
  };
  let articleMetadataBackfillService: {
    inferMetadataFromLatestVersion: AnyMock;
  };

  const makeArticle = (overrides: Record<string, unknown> = {}) => ({
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
    sections: [],
    ...overrides,
  });

  beforeEach(async () => {
    prisma = {
      article: {
        findMany: jest.fn<() => Promise<unknown>>(),
        findFirst: jest.fn<() => Promise<unknown>>(),
        findUnique: jest.fn<() => Promise<unknown>>(),
        count: jest.fn<() => Promise<unknown>>(),
        update: jest.fn<() => Promise<unknown>>(),
      },
      articleVersion: {
        aggregate:
          jest.fn<() => Promise<{ _max: { version: number | null } }>>(),
        findFirst: jest.fn<() => Promise<unknown>>(),
      },
      file: {
        findMany: jest.fn<() => Promise<unknown>>(),
        updateMany: jest.fn<() => Promise<unknown>>(),
      },
      $transaction: jest.fn(),
    };
    prisma.$transaction.mockImplementation(
      async (
        fn: (tx: {
          article: typeof prisma.article;
          file: typeof prisma.file;
        }) => Promise<unknown>,
      ) => fn({ article: prisma.article, file: prisma.file }),
    );
    prisma.articleVersion.findFirst.mockResolvedValue(null);
    userService = {
      findUser: jest.fn<(...args: any[]) => any>(),
    };
    articleMetadataBackfillService = {
      inferMetadataFromLatestVersion: jest.fn<(...args: any[]) => any>(() => ({
        categories: [],
        tags: [],
        references: [],
      })),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ArticleService,
        { provide: PrismaService, useValue: prisma },
        { provide: UserService, useValue: userService },
        { provide: FileService, useValue: {} },
        {
          provide: ArticleMetadataBackfillService,
          useValue: articleMetadataBackfillService,
        },
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

    await expect(service.findAll({ skip: 5, take: 10 })).resolves.toEqual([
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
    ]);

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

    const find_many_mock = prisma.article.findMany as jest.Mock;
    const search_call = find_many_mock.mock.calls[0];
    expect(search_call).toBeDefined();

    const find_many_args = search_call[0] as Record<string, unknown>;

    expect(find_many_args.where).toEqual(
      expect.objectContaining({
        status: 'PUBLISHED',
        OR: [
          expect.objectContaining({
            OR: expect.arrayContaining([
              { title: { contains: 'title' } },
              { summary: { contains: 'title' } },
              { slug: { contains: 'title' } },
            ]),
          }),
        ],
      }),
    );

    expect(find_many_args.take).toBeGreaterThanOrEqual(480);
    expect(find_many_args.take).toBeLessThanOrEqual(900);
    expect(find_many_args.skip).toBeUndefined();
    expect(find_many_args.orderBy).toEqual({ updated_at: 'desc' });
  });

  it('orders search hits by relevance, not insertion order', async () => {
    const weak_hit = makeArticle({
      id: 'weak-hit',
      title: 'Weekly notes',
      slug: 'weekly-notes',
      summary: 'A casual mention of typography in passing.',
      sections: [{ title: 'Appendix', content: 'Typography as art.' }],
      updated_at: new Date('2026-03-01T00:00:00.000Z'),
    });
    const strong_hit = makeArticle({
      id: 'strong-hit',
      title: 'Typography in community publishing',
      slug: 'typography-publishing',
      summary: 'How type choices affect legibility.',
      sections: [],
      updated_at: new Date('2026-02-01T00:00:00.000Z'),
    });
    prisma.article.findMany.mockResolvedValue([weak_hit, strong_hit]);

    const ranked = await service.search({
      term: 'typography',
      skip: 0,
      take: 5,
    });

    expect(ranked.map((article) => article.slug)).toEqual([
      'typography-publishing',
      'weekly-notes',
    ]);
    expect(ranked[0]?.search_match).toEqual({
      field: 'title',
      text: 'How type choices affect legibility.',
    });
  });

  it('allows partial natural-language candidates and rewards coverage across fields', async () => {
    const partial_hit = makeArticle({
      id: 'partial-hit',
      title: 'Typography notes',
      slug: 'typography-notes',
      summary: 'A short reference.',
      sections: [],
      updated_at: new Date('2026-03-01T00:00:00.000Z'),
    });
    const broad_hit = makeArticle({
      id: 'broad-hit',
      title: 'Community publishing',
      slug: 'community-publishing',
      summary: 'A practical typography guide.',
      sections: [],
      updated_at: new Date('2026-02-01T00:00:00.000Z'),
    });
    prisma.article.findMany.mockResolvedValue([partial_hit, broad_hit]);

    const ranked = await service.search({
      term: 'a guide to community typography',
      skip: 0,
      take: 5,
    });

    const search_call = (prisma.article.findMany as AnyMock).mock.calls[0][0];
    expect(search_call.where).toEqual(
      expect.objectContaining({
        status: 'PUBLISHED',
        OR: expect.arrayContaining([
          expect.objectContaining({
            OR: expect.arrayContaining([
              { title: { contains: 'guide' } },
              { summary: { contains: 'guide' } },
            ]),
          }),
          expect.objectContaining({
            OR: expect.arrayContaining([{ title: { contains: 'community' } }]),
          }),
        ]),
      }),
    );
    expect(ranked.map((article) => article.slug)).toEqual([
      'community-publishing',
      'typography-notes',
    ]);
  });

  it('returns a matching section excerpt when section content is strongest', async () => {
    prisma.article.findMany.mockResolvedValue([
      makeArticle({
        title: 'General language notes',
        slug: 'general-language-notes',
        summary: 'A broad overview.',
        sections: [
          {
            title: 'Reading practice',
            content:
              'Community learners use pronunciation exercises to improve fluent reading.',
          },
        ],
      }),
    ]);

    const [result] = await service.search({
      term: 'pronunciation exercises fluent reading',
      skip: 0,
      take: 5,
    });

    expect(result?.search_match.field).toBe('section');
    expect(result?.search_match.text).toContain('pronunciation exercises');
  });

  it('applies pagination after relevance ranking', async () => {
    prisma.article.findMany.mockResolvedValue([
      makeArticle({ id: 'third', title: 'Guide notes', slug: 'guide-notes' }),
      makeArticle({ id: 'first', title: 'Guide', slug: 'guide' }),
      makeArticle({
        id: 'second',
        title: 'A guide for readers',
        slug: 'reader-guide',
      }),
    ]);

    const results = await service.search({ term: 'guide', skip: 1, take: 1 });

    expect(results).toHaveLength(1);
    expect(results[0]?.slug).toBe('guide-notes');
  });

  it('suggests related articles from the current article title and summary only', async () => {
    const currentArticle = makeArticle({
      id: 'current-article',
      title: 'Ibibio Language',
      slug: 'ibibio-language',
      summary:
        'Orthography and reading lessons for ibibio learners in Nigeria.',
      categories: [{ name: 'Language' }],
      tags: [{ name: 'ibibio' }],
      metadata: {
        keywords: ['ignored-for-related'],
        language: 'en',
        read_time: 3,
        complexity: null,
      },
    });
    const lessRelevantArticle = makeArticle({
      id: 'article-2',
      title: 'Recent Culture',
      slug: 'recent-culture',
      created_at: new Date('2026-02-01T00:00:00.000Z'),
      summary: 'Daily culture headlines.',
      categories: [{ name: 'Culture' }],
      tags: [],
    });
    const summaryOverlapArticle = makeArticle({
      id: 'article-3',
      title: 'Writing systems overview',
      slug: 'writing-systems',
      created_at: new Date('2026-01-15T00:00:00.000Z'),
      summary: 'Orthography across languages.',
      categories: [{ name: 'Reference' }],
      tags: [{ name: 'alphabet' }],
    });

    prisma.article.findFirst.mockResolvedValue(currentArticle);
    prisma.article.findMany.mockResolvedValue([
      lessRelevantArticle,
      summaryOverlapArticle,
    ]);

    await expect(
      service.findRelated({
        source: 'article',
        slug: 'ibibio-language',
        excludeSlugs: ['already-seen'],
        take: 2,
      }),
    ).resolves.toEqual([
      expect.objectContaining({ slug: 'writing-systems' }),
      expect.objectContaining({ slug: 'recent-culture' }),
    ]);

    expect(prisma.article.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { slug: 'ibibio-language', status: 'PUBLISHED' },
      }),
    );
    expect(prisma.article.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: 'PUBLISHED',
          slug: { notIn: ['ibibio-language', 'already-seen'] },
          OR: expect.arrayContaining([
            { title: { contains: 'ibibio language' } },
            { summary: { contains: 'orthography' } },
          ]),
        }),
        take: 8,
      }),
    );
  });

  it('falls back to recent articles when word suggestions have sparse matches', async () => {
    const fallbackArticle = makeArticle({
      id: 'article-2',
      title: 'Recent Article',
      slug: 'recent-article',
    });

    prisma.article.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([fallbackArticle]);

    await expect(
      service.findRelated({
        source: 'word',
        terms: ['ụlọ', 'house'],
        excludeSlugs: ['seen-article'],
        take: 2,
      }),
    ).resolves.toEqual([expect.objectContaining({ slug: 'recent-article' })]);

    expect(prisma.article.findMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: expect.objectContaining({
          status: 'PUBLISHED',
          OR: expect.arrayContaining([{ title: { contains: 'house' } }]),
        }),
      }),
    );
    expect(prisma.article.findMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: {
          status: 'PUBLISHED',
          slug: { notIn: ['seen-article'] },
        },
        take: 2,
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

  it('updates article content, appends a revision row, and merges metadata', async () => {
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
      version: 1,
      file: [],
      categories: [],
      tags: [],
      references: [],
      created_by: 'editor@example.com',
      contributors: [{ id: 'user-1' }],
    });
    prisma.articleVersion.aggregate.mockResolvedValue({
      _max: { version: null },
    });
    prisma.article.count.mockResolvedValue(0);
    prisma.file.findMany.mockResolvedValue([]);
    prisma.article.update.mockResolvedValue({ slug: 'updated-title' });
    prisma.article.findFirst.mockResolvedValue(publicArticle);
    userService.findUser.mockResolvedValue({
      id: 'user-1',
      email: 'editor@example.com',
      role: 'EDITOR',
    });
    articleMetadataBackfillService.inferMetadataFromLatestVersion.mockReturnValue(
      {
        categories: ['Language'],
        tags: ['dictionary'],
        references: [],
      },
    );
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
          version: 1,
          body: 'articles/updated-title.md',
          summary: 'Updated content',
          versions: {
            create: {
              version: 1,
              content: expect.objectContaining({
                title: 'Updated Title',
                markdown: '## Intro\nUpdated content',
                body: 'articles/updated-title.md',
              }),
              created_by: 'editor@example.com',
            },
          },
          metadata: {
            upsert: {
              create: {
                keywords: ['ibibio', 'Culture', 'Language', 'dictionary'],
                language: 'en',
                read_time: 1,
                complexity: null,
              },
              update: {
                keywords: ['ibibio', 'Culture', 'Language', 'dictionary'],
                language: 'en',
                read_time: 1,
                complexity: null,
              },
            },
          },
          categories: {
            set: [],
            connectOrCreate: [
              {
                where: { name: 'Culture' },
                create: { name: 'Culture' },
              },
              {
                where: { name: 'Language' },
                create: { name: 'Language' },
              },
            ],
          },
          tags: {
            set: [],
            connectOrCreate: [
              {
                where: { name: 'ibibio' },
                create: { name: 'ibibio' },
              },
              {
                where: { name: 'dictionary' },
                create: { name: 'dictionary' },
              },
            ],
          },
        }),
      }),
    );
  });

  it('increments article version after a revision row already exists', async () => {
    const publicArticle = {
      id: 'article-1',
      title: 'Second',
      slug: 'second',
      summary: 'S',
      body: 'articles/second.md',
      created_at: new Date('2026-01-01T00:00:00.000Z'),
      updated_at: new Date('2026-01-02T00:00:00.000Z'),
      version: 1,
      status: 'PUBLISHED',
      categories: [],
      tags: [],
      references: [],
      file: [],
      metadata: null,
      contributors: [{ id: 'user-1', name: 'E', img: '/a.png' }],
    };

    prisma.article.findUnique.mockResolvedValue({
      id: 'article-1',
      title: 'First',
      slug: 'second',
      version: 1,
      file: [],
      categories: [],
      tags: [],
      references: [],
      created_by: 'editor@example.com',
      contributors: [{ id: 'user-1' }],
    });
    prisma.articleVersion.aggregate.mockResolvedValue({
      _max: { version: 1 },
    });
    prisma.article.count.mockResolvedValue(0);
    prisma.file.findMany.mockResolvedValue([]);
    prisma.article.update.mockResolvedValue({ slug: 'second' });
    prisma.article.findFirst.mockResolvedValue(publicArticle);
    userService.findUser.mockResolvedValue({
      id: 'user-1',
      email: 'editor@example.com',
      role: 'EDITOR',
    });
    jest
      .spyOn(service as any, 'writeMarkdownFile')
      .mockResolvedValue('/tmp/second.md');

    await service.update(
      'article-1',
      { title: 'Second', content: '# Next' } as any,
      'editor@example.com',
    );

    const updateCall = (prisma.article.update as AnyMock).mock.calls[0][0];
    expect(updateCall.data.version).toBe(2);
    expect(updateCall.data.versions?.create.version).toBe(2);
  });

  it('syncs markdown path on disk when title changes slug without content', async () => {
    const publicArticle = makeArticle({
      title: 'Renamed',
      slug: 'renamed',
      body: 'articles/renamed.md',
    });

    prisma.article.findUnique.mockResolvedValue({
      id: 'article-1',
      title: 'Original',
      slug: 'original-slug',
      body: 'articles/original-slug.md',
      version: 1,
      file: [],
      categories: [],
      tags: [],
      references: [],
      created_by: 'editor@example.com',
      contributors: [{ id: 'user-1' }],
    });
    prisma.article.count.mockResolvedValue(0);
    prisma.article.update.mockResolvedValue({ slug: 'renamed' });
    prisma.file.updateMany.mockResolvedValue({ count: 1 });
    prisma.article.findFirst.mockResolvedValue(publicArticle);
    userService.findUser.mockResolvedValue({
      id: 'user-1',
      email: 'editor@example.com',
      role: 'EDITOR',
    });

    const syncSpy = jest
      .spyOn(service as any, 'syncMarkdownFilesystemForSlugChange')
      .mockResolvedValue(null);

    await service.update(
      'article-1',
      { title: 'Renamed' } as any,
      'editor@example.com',
    );

    expect(syncSpy).toHaveBeenCalledWith({
      articleId: 'article-1',
      existingBody: 'articles/original-slug.md',
      prevSlug: 'original-slug',
      newSlug: 'renamed',
    });

    const updateCall = (prisma.article.update as AnyMock).mock.calls[0][0];
    expect(updateCall.data.slug).toBe('renamed');
    expect(updateCall.data.body).toBe('articles/renamed.md');

    expect(prisma.file.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          article_id: 'article-1',
          type: 'DOCUMENT',
          mimetype: 'text/markdown',
          path: 'articles/original-slug.md',
        }),
        data: expect.objectContaining({
          path: 'articles/renamed.md',
          filename: 'renamed',
        }),
      }),
    );

    syncSpy.mockRestore();
  });

  it('findRevisionAtVersion returns exact row when present', async () => {
    prisma.article.findUnique.mockResolvedValue({
      id: 'article-1',
      created_by: 'editor@example.com',
      contributors: [{ id: 'user-1' }],
    });
    userService.findUser.mockResolvedValue({
      id: 'user-1',
      email: 'editor@example.com',
      role: 'EDITOR',
    });
    prisma.articleVersion.findFirst.mockResolvedValue({
      id: 'ver-3',
      article_id: 'article-1',
      version: 3,
      created_at: new Date('2026-01-01T00:00:00.000Z'),
      created_by: 'editor@example.com',
      content: { marathon: 'snap' },
    });

    await expect(
      service.findRevisionAtVersion('article-1', 3, 'editor@example.com'),
    ).resolves.toEqual({
      id: 'ver-3',
      article_id: 'article-1',
      version: 3,
      created_at: new Date('2026-01-01T00:00:00.000Z'),
      created_by: 'editor@example.com',
      content: { marathon: 'snap' },
    });
  });

  it('findRevisionAtVersion falls back to latest stored revision <= requested', async () => {
    prisma.article.findUnique.mockResolvedValue({
      id: 'article-1',
      created_by: 'editor@example.com',
      contributors: [{ id: 'user-1' }],
    });
    userService.findUser.mockResolvedValue({
      id: 'user-1',
      email: 'editor@example.com',
      role: 'EDITOR',
    });
    prisma.articleVersion.findFirst.mockResolvedValue({
      id: 'ver-2',
      article_id: 'article-1',
      version: 2,
      created_at: new Date('2026-01-01T00:00:00.000Z'),
      created_by: 'editor@example.com',
      content: { markdown: 'older' },
    });

    await expect(
      service.findRevisionAtVersion('article-1', 5, 'editor@example.com'),
    ).resolves.toEqual({
      id: 'ver-2',
      article_id: 'article-1',
      version: 2,
      created_at: new Date('2026-01-01T00:00:00.000Z'),
      created_by: 'editor@example.com',
      content: { markdown: 'older' },
      requested_version: 5,
    });
  });
});
