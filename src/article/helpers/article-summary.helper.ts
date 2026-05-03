export const ARTICLE_SUMMARY_FALLBACK = 'No summary available.';
const DEFAULT_SUMMARY_MAX_LENGTH = 180;

export function generateArticleSummary(
  markdown: string,
  max_length = DEFAULT_SUMMARY_MAX_LENGTH,
): string {
  const summary_text = markdownToSummaryText(markdown);

  if (!summary_text) return ARTICLE_SUMMARY_FALLBACK;
  if (summary_text.length <= max_length) return summary_text;

  const clipped_text = summary_text.slice(0, max_length + 1);
  const last_space_index = clipped_text.lastIndexOf(' ');
  const end_index =
    last_space_index >= Math.floor(max_length * 0.6)
      ? last_space_index
      : max_length;

  return `${summary_text.slice(0, end_index).replace(/[\s,;:]+$/g, '')}...`;
}

function markdownToSummaryText(markdown: string): string {
  const markdown_without_metadata = markdown
    .replace(/^---\s*[\s\S]*?\s*---/, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/^\s*\[[^\]]+]:\s+\S+.*$/gm, '');

  const lines: string[] = [];
  let is_code_block = false;
  let skip_next_line = false;

  const markdown_lines = markdown_without_metadata.split(/\r?\n/);

  for (let index = 0; index < markdown_lines.length; index++) {
    const line = markdown_lines[index];
    const trimmed_line = line.trim();

    if (skip_next_line) {
      skip_next_line = false;
      continue;
    }

    if (/^```|^~~~/.test(trimmed_line)) {
      is_code_block = !is_code_block;
      continue;
    }

    if (is_code_block) continue;
    if (
      /^#{1,6}\s+(references|bibliography|sources|notes)\b/i.test(trimmed_line)
    ) {
      break;
    }
    if (isSetextHeading(trimmed_line, markdown_lines[index + 1])) {
      skip_next_line = true;
      continue;
    }
    if (isSkippableSummaryLine(trimmed_line)) {
      continue;
    }

    const summary_line = stripLeadingFormattedHeading(line);
    if (summary_line.trim()) {
      lines.push(summary_line);
    }
  }

  const paragraphs = stripMarkdownSyntax(lines.join('\n'))
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.replace(/\s+/g, ' ').trim())
    .filter(Boolean);

  return (
    paragraphs.find((paragraph) => paragraph.length >= 20) ??
    paragraphs[0] ??
    ''
  );
}

function isSetextHeading(line: string, next_line?: string): boolean {
  if (!line || !next_line?.trim()) return false;
  return /^(=+|-+)\s*$/.test(next_line.trim());
}

function isSkippableSummaryLine(line: string): boolean {
  return (
    /^#{1,6}\s*/.test(line) ||
    /^<h[1-6]\b[^>]*>.*<\/h[1-6]>\s*$/i.test(line) ||
    isStandaloneFormattedHeading(line) ||
    /^!\[[^\]]*]\([^)]*\)\s*$/.test(line) ||
    /^\[?\s*!\[[^\]]*]\([^)]*\)/.test(line) ||
    /^<(figure|picture)\b/i.test(line) ||
    /<img\b/i.test(line) ||
    /^\|/.test(line) ||
    /^:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+$/.test(line)
  );
}

function isStandaloneFormattedHeading(line: string): boolean {
  const formatted_heading = line.match(
    /^(?:\*\*|__|<strong>|<b>)\s*(.+?)\s*(?:\*\*|__|<\/strong>|<\/b>)\s*:?$/i,
  );
  if (!formatted_heading) return false;

  const heading_text = formatted_heading[1].trim();
  return heading_text.length <= 120;
}

function stripLeadingFormattedHeading(line: string): string {
  return line.replace(
    /^(?:\*\*|__|<strong>|<b>)\s*(introduction|overview|summary|background)\s*:?\s*(?:\*\*|__|<\/strong>|<\/b>)\s*:?\s*/i,
    '',
  );
}

function stripMarkdownSyntax(markdown: string): string {
  return markdown
    .replace(/\[!\[[^\]]*]\([^)]*\)]\([^)]*\)/g, ' ')
    .replace(/!\[[^\]]*]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)]\([^)]*\)/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/^[\s>]*[-*+]\s+/gm, '')
    .replace(/^[\s>]*\d+[.)]\s+/gm, '')
    .replace(/^[\s>]+/gm, '')
    .replace(/[*_~]+/g, '')
    .trim();
}
