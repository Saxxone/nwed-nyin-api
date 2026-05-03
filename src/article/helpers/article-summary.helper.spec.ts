import { describe, expect, it } from '@jest/globals';
import { generateArticleSummary } from './article-summary.helper';

describe('generateArticleSummary', () => {
  it('generates clean article summaries from markdown content', () => {
    const summary = generateArticleSummary(
      [
        '# Article Title',
        '',
        '![Map of place](/uploads/map.png)',
        '',
        'This **introductory** paragraph links to [Ibibio culture](https://example.com) and explains the article clearly.',
        '',
        '## References',
        '- Source that should not become the summary.',
      ].join('\n'),
    );

    expect(summary).toBe(
      'This introductory paragraph links to Ibibio culture and explains the article clearly.',
    );
  });

  it('skips heading variants and image-first blocks', () => {
    const summary = generateArticleSummary(
      [
        'Article Title',
        '=============',
        '',
        '<h2>Overview</h2>',
        '',
        '[![First image alt text](/uploads/hero.png)](/articles/hero)',
        '',
        '<figure><img src="/uploads/map.png" alt="Map caption"></figure>',
        '',
        'The first real paragraph describes the article without using media captions or headings.',
      ].join('\n'),
    );

    expect(summary).toBe(
      'The first real paragraph describes the article without using media captions or headings.',
    );
  });

  it('skips standalone formatted headings before selecting summary text', () => {
    const summary = generateArticleSummary(
      [
        '**Introduction to this article**',
        '',
        'This article explains the topic without repeating the formatted heading.',
      ].join('\n'),
    );

    expect(summary).toBe(
      'This article explains the topic without repeating the formatted heading.',
    );
  });

  it('skips hash headings even when the marker is missing a space', () => {
    const summary = generateArticleSummary(
      [
        '##Introduction to this article',
        '',
        'This article explains the topic without using the malformed heading.',
      ].join('\n'),
    );

    expect(summary).toBe(
      'This article explains the topic without using the malformed heading.',
    );
  });

  it('removes leading formatted section labels from summary text', () => {
    const summary = generateArticleSummary(
      '**Introduction** This article explains the topic without duplicating the section label.',
    );

    expect(summary).toBe(
      'This article explains the topic without duplicating the section label.',
    );
  });

  it('truncates generated summaries without cutting through words', () => {
    const summary = generateArticleSummary(
      'This article explains how community-led language documentation helps speakers preserve stories, pronunciation, and everyday vocabulary for future learners.',
      90,
    );

    expect(summary).toBe(
      'This article explains how community-led language documentation helps speakers preserve...',
    );
  });
});
