import { Test, TestingModule } from '@nestjs/testing';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { promises as fs } from 'fs';
import type { Mock } from 'jest-mock';
import { ReferenceType } from 'src/generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ArticleMetadataBackfillService } from './article-metadata-backfill.service';

jest.mock('fs', () => ({
  ...jest.requireActual<typeof import('fs')>('fs'),
  promises: {
    ...jest.requireActual<typeof import('fs')>('fs').promises,
    readFile: jest.fn(),
  },
}));

type AsyncPrismaMock = Mock<() => Promise<unknown>>;

describe('ArticleMetadataBackfillService', () => {
  let service: ArticleMetadataBackfillService;
  let readFileMock: Mock<() => Promise<string>>;
  let prisma: {
    article: {
      findMany: AsyncPrismaMock;
      update: AsyncPrismaMock;
    };
    articleVersion: {
      findFirst: AsyncPrismaMock;
    };
  };

  beforeEach(async () => {
    prisma = {
      article: {
        findMany: jest.fn<() => Promise<unknown>>(),
        update: jest.fn<() => Promise<unknown>>(),
      },
      articleVersion: {
        findFirst: jest.fn<() => Promise<unknown>>(),
      },
    };
    readFileMock = fs.readFile as unknown as Mock<() => Promise<string>>;
    readFileMock.mockReset();
    prisma.articleVersion.findFirst.mockResolvedValue(null);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ArticleMetadataBackfillService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<ArticleMetadataBackfillService>(
      ArticleMetadataBackfillService,
    );
  });

  it('infers categories and tags from latest version text', () => {
    const metadata = service.inferMetadataFromLatestVersion('Ibibio Words', {
      title: 'Ibibio Words',
      summary: 'A language learning guide',
      markdown: 'Practice pronunciation and dictionary writing every day.',
    });

    expect(metadata.categories).toEqual(
      expect.arrayContaining(['Language', 'Learning']),
    );
    expect(metadata.tags).toEqual(
      expect.arrayContaining([
        'ibibio',
        'language-learning',
        'dictionary',
        'pronunciation',
      ]),
    );
  });

  it('infers curated domain tags and categories from cultural articles', () => {
    const metadata = service.inferMetadataFromLatestVersion(
      'Traditional Marriage In Akwa Ibom',
      {
        markdown: [
          'This oral history describes traditional marriage rites in Akwa Ibom.',
          'Elders explain bride price, kinship, family lineage, and community memory.',
        ].join('\n'),
      },
    );

    expect(metadata.categories).toEqual(
      expect.arrayContaining(['Culture', 'History', 'Places']),
    );
    expect(metadata.tags).toEqual(
      expect.arrayContaining([
        'akwa-ibom',
        'oral-history',
        'traditional-marriage',
        'kinship',
      ]),
    );
  });

  it('extracts explicit references without inventing missing sources', () => {
    const metadata = service.inferMetadataFromLatestVersion('History', {
      markdown: [
        '## Background',
        'This oral history article mentions a useful claim without a citation.',
        '## References',
        '- Example Source. https://example.com/history.',
        '- Journal Article. doi:10.1234/ABC.DEF',
      ].join('\n'),
    });

    expect(metadata.references).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: ReferenceType.WEBSITE,
          citation: 'Example Source. https://example.com/history.',
          url: 'https://example.com/history',
        }),
        expect.objectContaining({
          type: ReferenceType.JOURNAL,
          citation: 'Journal Article. doi:10.1234/ABC.DEF',
          doi: '10.1234/ABC.DEF',
        }),
      ]),
    );
    expect(metadata.references).toHaveLength(2);
  });

  it('does not treat article images as references', () => {
    const metadata = service.inferMetadataFromLatestVersion('Festival Attire', {
      markdown: [
        'Ibibio culture uses cloth, symbols, and community memory.',
        '![Festival attire](https://cdn.example.com/articles/festival-attire.jpg)',
        '<img src="https://cdn.example.com/articles/archive-photo.png" alt="Archive photo">',
      ].join('\n'),
    });

    expect(metadata.references).toHaveLength(0);
  });

  it('merges inferred metadata and skips existing relations', async () => {
    prisma.article.findMany
      .mockResolvedValueOnce([
        {
          id: 'article-1',
          version: 2,
          title: 'Ibibio Learning',
          slug: 'ibibio-learning',
          categories: [{ name: 'Language' }],
          tags: [{ name: 'ibibio' }],
          references: [
            {
              citation: 'Existing Source. https://example.com/existing',
              url: 'https://example.com/existing',
              doi: null,
              isbn: null,
            },
          ],
          versions: [
            {
              version: 2,
              content: {
                markdown: [
                  'Ibibio dictionary learning practice.',
                  '## References',
                  '- Existing Source. https://example.com/existing',
                  '- New Source. https://example.com/new',
                ].join('\n'),
              },
            },
          ],
        },
      ])
      .mockResolvedValueOnce([]);
    prisma.article.update.mockResolvedValue({});

    await expect(service.backfillArticleMetadata(10)).resolves.toEqual({
      processed: 1,
      updated: 1,
      skipped: 0,
      failed: 0,
    });

    expect(prisma.article.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 10,
        skip: 0,
        where: expect.objectContaining({
          OR: [{ body: { not: null } }, { versions: { some: {} } }],
        }),
        select: expect.objectContaining({
          body: true,
          version: true,
          versions: expect.objectContaining({
            orderBy: { version: 'desc' },
            take: 1,
          }),
        }),
      }),
    );
    expect(prisma.article.update).toHaveBeenCalledWith({
      where: { id: 'article-1' },
      data: {
        categories: expect.objectContaining({
          connectOrCreate: [
            {
              where: { name: 'Learning' },
              create: { name: 'Learning' },
            },
          ],
        }),
        tags: expect.objectContaining({
          connectOrCreate: expect.arrayContaining([
            {
              where: { name: 'dictionary' },
              create: { name: 'dictionary' },
            },
          ]),
        }),
        references: {
          create: [
            expect.objectContaining({
              citation: 'New Source. https://example.com/new',
              url: 'https://example.com/new',
            }),
          ],
        },
      },
    });
  });

  it('infers metadata from article body markdown when no versions exist', async () => {
    readFileMock.mockResolvedValueOnce(
      [
        '# Why Oral History Matters',
        'Oral history preserves community memory, family tradition, and heritage.',
        '## References',
        '- Archive Source. https://example.com/archive',
      ].join('\n'),
    );
    prisma.article.findMany
      .mockResolvedValueOnce([
        {
          id: 'article-1',
          version: 1,
          title: 'Why Oral History Matters',
          slug: 'why-oral-history-matters',
          body: 'articles/why-oral-history-matters.md',
          categories: [],
          tags: [],
          references: [],
          versions: [],
        },
      ])
      .mockResolvedValueOnce([]);
    prisma.article.update.mockResolvedValue({});

    await expect(service.backfillArticleMetadata(10)).resolves.toEqual({
      processed: 1,
      updated: 1,
      skipped: 0,
      failed: 0,
    });

    expect(readFileMock).toHaveBeenCalledWith(
      expect.stringContaining('why-oral-history-matters.md'),
      'utf8',
    );
    expect(prisma.article.update).toHaveBeenCalledWith({
      where: { id: 'article-1' },
      data: expect.objectContaining({
        categories: expect.objectContaining({
          connectOrCreate: expect.arrayContaining([
            {
              where: { name: 'Culture' },
              create: { name: 'Culture' },
            },
            {
              where: { name: 'History' },
              create: { name: 'History' },
            },
          ]),
        }),
        references: {
          create: [
            expect.objectContaining({
              citation: 'Archive Source. https://example.com/archive',
              url: 'https://example.com/archive',
            }),
          ],
        },
      }),
    });
  });

  it('skips articles when inferred metadata already exists', async () => {
    prisma.article.findMany
      .mockResolvedValueOnce([
        {
          id: 'article-1',
          version: 1,
          title: 'Ibibio Learning',
          slug: 'ibibio-learning',
          categories: [{ name: 'Language' }, { name: 'Learning' }],
          tags: [{ name: 'ibibio' }, { name: 'language-learning' }],
          references: [],
          versions: [
            {
              version: 1,
              content: {
                markdown: 'Ibibio language learning.',
              },
            },
          ],
        },
      ])
      .mockResolvedValueOnce([]);

    await expect(service.backfillArticleMetadata(10)).resolves.toEqual({
      processed: 1,
      updated: 0,
      skipped: 1,
      failed: 0,
    });

    expect(prisma.article.update).not.toHaveBeenCalled();
  });
});
