import 'dotenv/config';
import { ArticleMetadataBackfillService } from '../src/article/article-metadata-backfill.service';
import { PrismaService } from '../src/prisma/prisma.service';

async function main() {
  const prisma = new PrismaService();
  const service = new ArticleMetadataBackfillService(prisma);

  await prisma.$connect();

  try {
    const stats = await service.backfillArticleMetadata();
    console.log('Article metadata backfill complete:', stats);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error('Article metadata backfill failed:', error);
  process.exitCode = 1;
});
