import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { Prisma, Status } from '@prisma/client';
import { promises as fs } from 'fs';
import { isAbsolute, join } from 'path';
import { PrismaService } from '../prisma/prisma.service';
import {
  ARTICLE_SUMMARY_FALLBACK,
  generateArticleSummary,
} from './helpers/article-summary.helper';

type ArticleForSummaryBackfill = Prisma.ArticleGetPayload<{
  select: {
    id: true;
    slug: true;
    summary: true;
    body: true;
    versions: {
      take: 1;
      orderBy: { version: 'desc' };
      select: {
        content: true;
      };
    };
  };
}>;

type SummaryBackfillStats = {
  processed: number;
  updated: number;
  skipped: number;
  failed: number;
};

const DEFAULT_BATCH_SIZE = 100;

@Injectable()
export class ArticleSummaryBackfillService {
  private readonly logger = new Logger(ArticleSummaryBackfillService.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron('30 2 * * *')
  async handleCron(): Promise<void> {
    const stats = await this.backfillArticleSummaries(this.readBatchSize());
    this.logger.log(
      `Article summary backfill complete: processed=${stats.processed}, updated=${stats.updated}, skipped=${stats.skipped}, failed=${stats.failed}`,
    );
  }

  async backfillArticleSummaries(
    batch_size = DEFAULT_BATCH_SIZE,
  ): Promise<SummaryBackfillStats> {
    const stats: SummaryBackfillStats = {
      processed: 0,
      updated: 0,
      skipped: 0,
      failed: 0,
    };
    let skip = 0;

    while (true) {
      const articles = await this.findArticlesForBackfill(batch_size, skip);
      if (!articles.length) break;

      for (const article of articles) {
        try {
          const updated = await this.backfillArticleSummary(article);
          stats.processed++;
          if (updated) stats.updated++;
          else stats.skipped++;
        } catch (error) {
          stats.failed++;
          this.logger.error(
            `Failed to backfill article summary for ${article.slug}`,
            error instanceof Error ? error.stack : String(error),
          );
        }
      }

      skip += batch_size;
    }

    return stats;
  }

  private readBatchSize(): number {
    const raw_batch_size = process.env.ARTICLE_SUMMARY_BACKFILL_BATCH_SIZE;
    if (!raw_batch_size) return DEFAULT_BATCH_SIZE;

    const batch_size = Number(raw_batch_size);
    if (!Number.isInteger(batch_size) || batch_size <= 0) {
      this.logger.warn(
        `Invalid ARTICLE_SUMMARY_BACKFILL_BATCH_SIZE=${raw_batch_size}; using ${DEFAULT_BATCH_SIZE}`,
      );
      return DEFAULT_BATCH_SIZE;
    }

    return batch_size;
  }

  private findArticlesForBackfill(batch_size: number, skip: number) {
    return this.prisma.article.findMany({
      where: {
        status: { not: Status.DELETED },
        OR: [{ body: { not: null } }, { versions: { some: {} } }],
      },
      orderBy: {
        id: 'asc',
      },
      skip,
      take: batch_size,
      select: {
        id: true,
        slug: true,
        summary: true,
        body: true,
        versions: {
          orderBy: {
            version: 'desc',
          },
          take: 1,
          select: {
            content: true,
          },
        },
      },
    });
  }

  private async backfillArticleSummary(
    article: ArticleForSummaryBackfill,
  ): Promise<boolean> {
    const markdown = await this.readArticleMarkdown(article);
    if (!markdown) return false;

    const summary = generateArticleSummary(markdown);
    if (summary === ARTICLE_SUMMARY_FALLBACK || summary === article.summary) {
      return false;
    }

    await this.prisma.article.update({
      where: {
        id: article.id,
      },
      data: {
        summary,
      },
    });

    return true;
  }

  private async readArticleMarkdown(
    article: ArticleForSummaryBackfill,
  ): Promise<string | null> {
    const version_markdown = this.readMarkdownFromLatestVersion(
      article.versions[0]?.content,
    );

    if (article.body) {
      try {
        return await fs.readFile(this.resolveMarkdownPath(article.body), 'utf8');
      } catch (error) {
        if (version_markdown) return version_markdown;

        this.logger.warn(
          `Unable to read markdown file or latest version content for ${article.slug}`,
        );
      }
    }

    return version_markdown;
  }

  private resolveMarkdownPath(body: string): string {
    if (isAbsolute(body)) return body;

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

  private readMarkdownFromLatestVersion(content: Prisma.JsonValue): string | null {
    if (typeof content === 'string') return content;
    if (!this.isRecord(content)) return null;

    return (
      this.readString(content.markdown) ??
      this.readString(content.content) ??
      this.readArticleBody(content.body)
    );
  }

  private readArticleBody(value: unknown): string | null {
    const body = this.readString(value);
    if (!body || /^articles\/.+\.md$/i.test(body)) return null;
    return body;
  }

  private readString(value: unknown): string | null {
    return typeof value === 'string' && value.trim() ? value : null;
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }
}
