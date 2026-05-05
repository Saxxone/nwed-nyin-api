import { basename } from 'path';
import { FileType, Prisma } from 'src/generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  markdownDocumentMatchesObsoleteArticlesPath,
  resolveMarkdownSuffixFallbackRepairFromRelative,
} from './helpers/markdown-numeric-suffix-fallback';

export async function persistArticleMarkdownSuffixFallbackFromRelative(
  prisma: PrismaService,
  params: {
    articleId: string;
    slug: string;
    body: string | null | undefined;
    resolvedRelativePosix: string;
  },
): Promise<void> {
  const { articleId, slug, body, resolvedRelativePosix } = params;
  const repair = resolveMarkdownSuffixFallbackRepairFromRelative(
    body,
    resolvedRelativePosix,
  );
  if (!repair) return;

  const { obsoleteRelativePosix, newBody, newRelativePosix } = repair;

  const stemFromOldBody = basename(body ?? '').replace(/\.md$/i, '');
  const newSlugCandidate = basename(
    newRelativePosix.replace(/\/$/, ''),
  ).replace(/\.md$/i, '');

  const data: Prisma.ArticleUpdateInput = { body: newBody };
  if (slug === stemFromOldBody && newSlugCandidate.length > 0) {
    const taken = await prisma.article.count({
      where: { slug: newSlugCandidate, id: { not: articleId } },
    });
    if (taken === 0) {
      data.slug = newSlugCandidate;
    }
  }

  await prisma.$transaction(async (tx) => {
    const docs = await tx.file.findMany({
      where: {
        article_id: articleId,
        type: FileType.DOCUMENT,
      },
      select: { id: true, path: true, url: true },
    });
    const remove_ids = docs
      .filter((f) =>
        markdownDocumentMatchesObsoleteArticlesPath(
          f,
          obsoleteRelativePosix,
        ),
      )
      .map((f) => f.id);
    if (remove_ids.length) {
      await tx.file.deleteMany({ where: { id: { in: remove_ids } } });
    }

    await tx.article.update({
      where: { id: articleId },
      data,
    });
  });
}

/** Match flat markdown names from {@link FileService.streamStaticFile}. */
export async function persistArticleMarkdownSuffixFallbackForFilename(
  prisma: PrismaService,
  params: {
    requestedBasename: string;
    resolvedRelativePosix: string;
  },
): Promise<void> {
  const { requestedBasename, resolvedRelativePosix } = params;
  const safeName = basename(requestedBasename.trim().replace(/\\/g, '/'));
  const storedBody = `articles/${safeName}`;

  const articles = await prisma.article.findMany({
    where: { body: storedBody },
    select: { id: true, slug: true, body: true },
  });

  for (const a of articles) {
    await persistArticleMarkdownSuffixFallbackFromRelative(prisma, {
      articleId: a.id,
      slug: a.slug,
      body: a.body,
      resolvedRelativePosix,
    });
  }
}
