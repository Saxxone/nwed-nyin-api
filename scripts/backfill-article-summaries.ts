import 'dotenv/config';
import { ArticleSummaryBackfillService } from '../src/article/article-summary-backfill.service';
import { PrismaService } from '../src/prisma/prisma.service';

function readBatchSize(): number | undefined {
  const batch_size_arg = process.argv.find((arg) =>
    arg.startsWith('--batch-size='),
  );
  const value =
    batch_size_arg?.split('=')[1] ??
    process.env.ARTICLE_SUMMARY_BACKFILL_BATCH_SIZE;

  if (!value) return undefined;

  const batch_size = Number(value);
  if (!Number.isInteger(batch_size) || batch_size <= 0) {
    throw new Error(`Invalid batch size: ${value}`);
  }

  return batch_size;
}

async function main() {
  const prisma = new PrismaService();
  const service = new ArticleSummaryBackfillService(prisma);

  await prisma.$connect();

  try {
    const stats = await service.backfillArticleSummaries(readBatchSize());
    console.log('Article summary backfill complete:', stats);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error('Article summary backfill failed:', error);
  process.exitCode = 1;
});
