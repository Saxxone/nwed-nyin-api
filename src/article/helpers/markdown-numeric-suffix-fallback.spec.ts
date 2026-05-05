import { describe, expect, it } from '@jest/globals';
import {
  markdownBasenameStripNumericSuffix,
  markdownDocumentMatchesObsoleteArticlesPath,
  markdownRelativePathsWithNumericSuffixFallback,
  resolveMarkdownSuffixFallbackRepairFromRelative,
} from './markdown-numeric-suffix-fallback';

describe('markdown-numeric-suffix-fallback', () => {
  it('strips trailing -digits before .md', () => {
    expect(markdownBasenameStripNumericSuffix('article-1.md')).toBe(
      'article.md',
    );
    expect(markdownBasenameStripNumericSuffix('my-topic-12.md')).toBe(
      'my-topic.md',
    );
  });

  it('returns null when there is no numeric suffix', () => {
    expect(markdownBasenameStripNumericSuffix('article.md')).toBeNull();
    expect(markdownBasenameStripNumericSuffix('file.txt')).toBeNull();
  });

  it('appends fallback relative path when suffix is present', () => {
    expect(
      markdownRelativePathsWithNumericSuffixFallback('article-1.md'),
    ).toEqual(['article-1.md', 'article.md']);
  });

  it('leaves a single path when no suffix', () => {
    expect(
      markdownRelativePathsWithNumericSuffixFallback('article.md'),
    ).toEqual(['article.md']);
  });

  it('detects repair when stored body used suffix but file read was stripped', () => {
    expect(
      resolveMarkdownSuffixFallbackRepairFromRelative(
        'articles/article-1.md',
        'article.md',
      ),
    ).toEqual({
      newBody: 'articles/article.md',
      newRelativePosix: 'article.md',
      obsoleteRelativePosix: 'article-1.md',
    });
    expect(
      resolveMarkdownSuffixFallbackRepairFromRelative(
        'articles/article-1.md',
        'article-1.md',
      ),
    ).toBeNull();
  });

  it('matches obsolete markdown file rows by basename or path substring', () => {
    expect(
      markdownDocumentMatchesObsoleteArticlesPath(
        {
          path: '/home/app/public/articles/bricksfield-prison-wall-calabar-1.md',
          url: 'http://x/y',
        },
        'bricksfield-prison-wall-calabar-1.md',
      ),
    ).toBe(true);
    expect(
      markdownDocumentMatchesObsoleteArticlesPath(
        {
          path: 'articles/bricksfield-prison-wall-calabar.md',
          url: 'articles/bricksfield-prison-wall-calabar.md',
        },
        'bricksfield-prison-wall-calabar-1.md',
      ),
    ).toBe(false);
  });
});
