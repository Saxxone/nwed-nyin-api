import { Test, TestingModule } from '@nestjs/testing';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { Mock } from 'jest-mock';
import { PrismaService } from '../prisma/prisma.service';
import { ArticleSummaryBackfillService } from './article-summary-backfill.service';

type AsyncPrismaMock = Mock<() => Promise<unknown>>;

describe('ArticleSummaryBackfillService', () => {
  let service: ArticleSummaryBackfillService;
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
        ArticleSummaryBackfillService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<ArticleSummaryBackfillService>(
      ArticleSummaryBackfillService,
    );
  });

  it('updates stale summaries from latest version markdown', async () => {
    prisma.article.findMany
      .mockResolvedValueOnce([
        {
          id: 'article-1',
          slug: 'article-one',
          summary: '# Article One',
          body: null,
          versions: [
            {
              content: {
                markdown: [
                  '# Article One',
                  '',
                  '![Hero image](/uploads/hero.png)',
                  '',
                  'This article has a real introductory paragraph for readers.',
                ].join('\n'),
              },
            },
          ],
        },
      ])
      .mockResolvedValueOnce([]);
    prisma.article.update.mockResolvedValue({});

    await expect(service.backfillArticleSummaries(10)).resolves.toEqual({
      processed: 1,
      updated: 1,
      skipped: 0,
      failed: 0,
    });

    expect(prisma.article.update).toHaveBeenCalledWith({
      where: { id: 'article-1' },
      data: {
        summary: 'This article has a real introductory paragraph for readers.',
      },
    });
  });

  it('skips articles when the generated summary is unchanged', async () => {
    prisma.article.findMany
      .mockResolvedValueOnce([
        {
          id: 'article-1',
          slug: 'article-one',
          summary: 'This summary already matches the article introduction.',
          body: null,
          versions: [
            {
              content: {
                markdown: 'This summary already matches the article introduction.',
              },
            },
          ],
        },
      ])
      .mockResolvedValueOnce([]);

    await expect(service.backfillArticleSummaries(10)).resolves.toEqual({
      processed: 1,
      updated: 0,
      skipped: 1,
      failed: 0,
    });

    expect(prisma.article.update).not.toHaveBeenCalled();
  });

  it('falls back to latest version markdown without warning when article file is missing', async () => {
    const warn = jest.fn();
    (service as any).logger.warn = warn;
    prisma.article.findMany
      .mockResolvedValueOnce([
        {
          id: 'article-1',
          slug: 'article-one',
          summary: '# Article One',
          body: 'articles/missing-article-one.md',
          versions: [
            {
              content: {
                markdown: 'This version content can still produce a useful summary.',
              },
            },
          ],
        },
      ])
      .mockResolvedValueOnce([]);
    prisma.article.update.mockResolvedValue({});

    await expect(service.backfillArticleSummaries(10)).resolves.toEqual({
      processed: 1,
      updated: 1,
      skipped: 0,
      failed: 0,
    });

    expect(warn).not.toHaveBeenCalled();
    expect(prisma.article.update).toHaveBeenCalledWith({
      where: { id: 'article-1' },
      data: {
        summary: 'This version content can still produce a useful summary.',
      },
    });
  });

  it('does not overwrite summaries when no article text is available', async () => {
    prisma.article.findMany
      .mockResolvedValueOnce([
        {
          id: 'article-1',
          slug: 'article-one',
          summary: 'Existing useful summary.',
          body: null,
          versions: [
            {
              content: {
                body: 'articles/article-one.md',
              },
            },
          ],
        },
      ])
      .mockResolvedValueOnce([]);

    await expect(service.backfillArticleSummaries(10)).resolves.toEqual({
      processed: 1,
      updated: 0,
      skipped: 1,
      failed: 0,
    });

    expect(prisma.article.update).not.toHaveBeenCalled();
  });
});
