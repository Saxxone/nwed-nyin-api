import { describe, expect, it } from '@jest/globals';
import {
  SEARCH_MAX_QUERY_TOKENS,
  normalizeSearchText,
  prepareSearchQuery,
  searchTokenVariants,
  scoreSearchText,
  tokenAppearsDelimited,
  tokenCoverage,
} from './search-relevance';

describe('search relevance utilities', () => {
  it('normalizes Unicode case, punctuation, and whitespace', () => {
    expect(normalizeSearchText('  ỤLỌ—NYỊN!  ')).toBe('ụlọ nyịn');
  });

  it('deduplicates tokens and removes English filler words', () => {
    expect(prepareSearchQuery('the place where the people live')).toEqual({
      phrase: 'the place where the people live',
      tokens: ['place', 'people', 'live'],
    });
  });

  it('preserves a meaningful single-character query', () => {
    expect(prepareSearchQuery('I')).toEqual({ phrase: 'i', tokens: ['i'] });
  });

  it('falls back to original tokens when every token is filler', () => {
    expect(prepareSearchQuery('where is it').tokens).toEqual([
      'where',
      'is',
      'it',
    ]);
  });

  it('limits significant query tokens', () => {
    const query = Array.from(
      { length: 20 },
      (_, index) => `token${index}`,
    ).join(' ');
    expect(prepareSearchQuery(query).tokens).toHaveLength(
      SEARCH_MAX_QUERY_TOKENS,
    );
  });

  it('uses Unicode-aware token boundaries and coverage', () => {
    expect(tokenAppearsDelimited('A place where people live.', 'live')).toBe(
      true,
    );
    expect(tokenAppearsDelimited('A lively place.', 'live')).toBe(false);
    expect(tokenCoverage('A place where people live.', ['place', 'live'])).toBe(
      1,
    );
  });

  it('provides canonical Unicode variants for database candidate lookup', () => {
    expect(searchTokenVariants(['nyịn'])).toEqual(['nyịn', 'nyịn']);
  });

  it('does not treat short tokens as arbitrary substrings', () => {
    expect(
      scoreSearchText('This is lively.', prepareSearchQuery('I')).score,
    ).toBe(0);
    expect(
      scoreSearchText('Something unrelated.', prepareSearchQuery('me')).score,
    ).toBe(0);
    expect(
      scoreSearchText('I or me.', prepareSearchQuery('I')).score,
    ).toBeGreaterThan(0);
  });

  it('scores exact and phrase matches above token-only matches', () => {
    const query = prepareSearchQuery('place people live');
    const exact = scoreSearchText('place people live', query);
    const phrase = scoreSearchText('A place people live safely', query);
    const tokens = scoreSearchText(
      'People call this place a home to live in',
      query,
    );

    expect(exact.score).toBeGreaterThan(phrase.score);
    expect(phrase.score).toBeGreaterThan(tokens.score);
    expect(tokens.coverage).toBe(1);
  });
});
