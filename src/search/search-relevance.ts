export const SEARCH_MAX_QUERY_TOKENS = 12;

const ENGLISH_SEARCH_FILLER_WORDS = new Set([
  'a',
  'an',
  'and',
  'are',
  'as',
  'at',
  'be',
  'been',
  'by',
  'for',
  'from',
  'how',
  'i',
  'in',
  'into',
  'is',
  'it',
  'of',
  'on',
  'or',
  'that',
  'the',
  'their',
  'this',
  'to',
  'was',
  'what',
  'when',
  'where',
  'which',
  'who',
  'with',
  'you',
  'your',
]);

export type PreparedSearchQuery = {
  /** Lower-cased, punctuation-normalized full query used for phrase matching. */
  phrase: string;
  /** Significant, unique query tokens used for candidate matching and coverage. */
  tokens: string[];
};

export type SearchTextWeights = {
  exact: number;
  phrase: number;
  prefix: number;
  token: number;
  substring: number;
  coverage: number;
};

export type SearchTextScore = {
  score: number;
  coverage: number;
  exact: boolean;
  phrase: boolean;
  matchedTokens: string[];
};

export const DEFAULT_SEARCH_TEXT_WEIGHTS: SearchTextWeights = {
  exact: 120,
  phrase: 60,
  prefix: 20,
  token: 12,
  substring: 4,
  coverage: 30,
};

/** Makes Unicode text comparable without stripping meaningful diacritics. */
export function normalizeSearchText(value: unknown): string {
  if (typeof value !== 'string') return '';

  return value
    .normalize('NFC')
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function prepareSearchQuery(value: unknown): PreparedSearchQuery {
  const phrase = normalizeSearchText(value);
  if (!phrase) return { phrase: '', tokens: [] };

  const unique_tokens = Array.from(new Set(phrase.split(' ').filter(Boolean)));
  const significant_tokens = unique_tokens.filter(
    (token) => token.length >= 2 && !ENGLISH_SEARCH_FILLER_WORDS.has(token),
  );

  // A single meaningful short word (notably "I") must remain searchable. If a
  // phrase contains only filler words, retaining them is more useful than
  // silently turning the query into an empty search.
  const tokens =
    significant_tokens.length > 0 ? significant_tokens : unique_tokens;

  return {
    phrase,
    tokens: tokens.slice(0, SEARCH_MAX_QUERY_TOKENS),
  };
}

/** NFC/NFD forms used when the database collation does not canonicalize Unicode. */
export function searchTokenVariants(tokens: string[]): string[] {
  return Array.from(
    new Set(
      tokens.flatMap((token) => [
        token.normalize('NFC'),
        token.normalize('NFD'),
      ]),
    ),
  );
}

export function tokenAppearsDelimited(text: string, token: string): boolean {
  const normalized_text = normalizeSearchText(text);
  const normalized_token = normalizeSearchText(token);
  if (!normalized_text || !normalized_token) return false;

  return ` ${normalized_text} `.includes(` ${normalized_token} `);
}

export function tokenCoverage(text: string, tokens: string[]): number {
  if (tokens.length === 0) return 0;
  const normalized_text = normalizeSearchText(text);
  if (!normalized_text) return 0;

  const matched = tokens.filter((token) =>
    tokenAppearsDelimited(normalized_text, token),
  ).length;
  return matched / tokens.length;
}

/**
 * Scores one text field. Services combine these scores with field-specific
 * weights, while normalization and coverage semantics stay consistent.
 */
export function scoreSearchText(
  text: unknown,
  query: PreparedSearchQuery,
  weights: SearchTextWeights = DEFAULT_SEARCH_TEXT_WEIGHTS,
): SearchTextScore {
  const normalized_text = normalizeSearchText(text);
  if (!normalized_text || !query.phrase || query.tokens.length === 0) {
    return {
      score: 0,
      coverage: 0,
      exact: false,
      phrase: false,
      matchedTokens: [],
    };
  }

  const exact = normalized_text === query.phrase;
  const phrase = query.phrase.includes(' ')
    ? ` ${normalized_text} `.includes(` ${query.phrase} `)
    : tokenAppearsDelimited(normalized_text, query.phrase);
  const prefix =
    !exact &&
    query.phrase.length >= 3 &&
    (normalized_text.startsWith(`${query.phrase} `) ||
      normalized_text.startsWith(query.phrase));
  const matchedTokens: string[] = [];
  let token_score = 0;

  for (const token of query.tokens) {
    if (tokenAppearsDelimited(normalized_text, token)) {
      matchedTokens.push(token);
      token_score += weights.token;
    } else if (token.length >= 3 && normalized_text.includes(token)) {
      matchedTokens.push(token);
      token_score += weights.substring;
    }
  }

  const coverage = matchedTokens.length / query.tokens.length;
  const score =
    (exact ? weights.exact : 0) +
    (!exact && phrase ? weights.phrase : 0) +
    (prefix ? weights.prefix : 0) +
    token_score +
    coverage * weights.coverage;

  return { score, coverage, exact, phrase, matchedTokens };
}
