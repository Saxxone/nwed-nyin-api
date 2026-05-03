import { Test, TestingModule } from '@nestjs/testing';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { Mock } from 'jest-mock';
import { ReferenceType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ArticleMetadataBackfillService } from './article-metadata-backfill.service';

type AsyncPrismaMock = Mock<() => Promise<unknown>>;

describe('ArticleMetadataBackfillService', () => {
  let service: ArticleMetadataBackfillService;
  let prisma: {
    article: {
      findMany: AsyncPrismaMock;
      update: AsyncPrismaMock;
    };
  };

  beforeEach(async () => {
    prisma = {
      article: {
        findMany: jest.fn<() => Promise<unknown>>(),
        update: jest.fn<() => Promise<unknown>>(),
      },
    };

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
      expect.arrayContaining(['ibibio', 'words', 'language', 'learning']),
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

  it('merges inferred metadata and skips existing relations', async () => {
    prisma.article.findMany
      .mockResolvedValueOnce([
        {
          id: 'article-1',
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
        select: expect.objectContaining({
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
              where: { name: 'learning' },
              create: { name: 'learning' },
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

  it('skips articles when inferred metadata already exists', async () => {
    prisma.article.findMany
      .mockResolvedValueOnce([
        {
          id: 'article-1',
          title: 'Ibibio Learning',
          slug: 'ibibio-learning',
          categories: [{ name: 'Language' }, { name: 'Learning' }],
          tags: [{ name: 'ibibio' }, { name: 'language' }, { name: 'learning' }],
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
