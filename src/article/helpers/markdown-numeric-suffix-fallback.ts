import { basename, dirname } from 'path';

/**
 * If `fileName` matches `*-<digits>.md`, returns the name with the `-<digits>`
 * segment removed (e.g. `article-1.md` → `article.md`). Otherwise `null`.
 */
export function markdownBasenameStripNumericSuffix(
  fileName: string,
): string | null {
  const m = fileName.match(/^(.+)-(\d+)\.md$/i);
  if (!m?.[1]) return null;
  return `${m[1]}.md`;
}

/**
 * Paths under `public/articles/` (relative to that folder), preferring the
 * exact name then the numeric-suffix-stripped variant when applicable.
 */
export function markdownRelativePathsWithNumericSuffixFallback(
  normalizedUnderArticles: string,
): string[] {
  const trimmed = normalizedUnderArticles
    .replace(/^\/+/, '')
    .replace(/\\/g, '/');
  const base = basename(trimmed);
  const parent = dirname(trimmed);
  const strippedBase = markdownBasenameStripNumericSuffix(base);
  if (!strippedBase || strippedBase.toLowerCase() === base.toLowerCase()) {
    return [trimmed];
  }
  const dirPrefix = parent && parent !== '.' ? `${parent}/` : '';
  return [trimmed, `${dirPrefix}${strippedBase}`];
}

/**
 * When `storedBody` points at `foo-1.md` but content was read from `foo.md`
 * (relative path under `public/articles/`), returns the canonical `articles/...`
 * body value to persist.
 */
export function resolveMarkdownSuffixFallbackRepairFromRelative(
  storedBody: string | null | undefined,
  resolvedRelativePosix: string,
): { newBody: string; newRelativePosix: string; obsoleteRelativePosix: string } | null {
  if (!storedBody?.trim()) return null;

  const normalized = storedBody
    .trim()
    .replace(/^\/+/, '')
    .replace(/^public\/+/, '')
    .replace(/^articles\/+/, '');

  const variants = markdownRelativePathsWithNumericSuffixFallback(normalized);
  if (variants.length < 2) return null;

  const primaryPosix = variants[0].replace(/\\/g, '/');
  const rel = resolvedRelativePosix.trim().replace(/\\/g, '/');
  if (!rel || rel === primaryPosix) return null;
  if (!variants.some((v) => v.replace(/\\/g, '/') === rel)) return null;

  return {
    newBody: `articles/${rel}`,
    newRelativePosix: rel,
    obsoleteRelativePosix: primaryPosix,
  };
}

/**
 * True if this document row points at the obsolete markdown path (relative
 * under {@code public/articles/}), e.g. absolute server paths ending in
 * {@code topic-1.md} when {@param obsoleteRelativePosix} is {@code topic-1.md}.
 */
export function markdownDocumentMatchesObsoleteArticlesPath(
  file: { path: string; url: string },
  obsoleteRelativePosix: string,
): boolean {
  const needle = obsoleteRelativePosix.replace(/\\/g, '/').toLowerCase();
  if (!needle) return false;
  const hay = `${file.path}\0${file.url}`.toLowerCase();
  if (hay.includes(needle)) return true;
  const obsBase = basename(needle).toLowerCase();
  return (
    basename(file.path.replace(/\\/g, '/')).toLowerCase() === obsBase ||
    basename(file.url.replace(/\\/g, '/')).toLowerCase() === obsBase
  );
}
