import 'dotenv/config';
import { ArticleMetadataBackfillService } from '../src/article/article-metadata-backfill.service';
import { PrismaService } from '../src/prisma/prisma.service';

function readBatchSize(): number | undefined {
  const batch_size_arg = process.argv.find((arg) =>
    arg.startsWith('--batch-size='),
  );
  const value =
    batch_size_arg?.split('=')[1] ??
    process.env.ARTICLE_METADATA_BACKFILL_BATCH_SIZE;

  if (!value) return undefined;

  const batch_size = Number(value);
  if (!Number.isInteger(batch_size) || batch_size <= 0) {
    throw new Error(`Invalid batch size: ${value}`);
  }

  return batch_size;
}

async function main() {
  const prisma = new PrismaService();
  const service = new ArticleMetadataBackfillService(prisma);

  await prisma.$connect();

  try {
    const stats = await service.backfillArticleMetadata(readBatchSize());
    console.log('Article metadata backfill complete:', stats);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error('Article metadata backfill failed:', error);
  process.exitCode = 1;
});
