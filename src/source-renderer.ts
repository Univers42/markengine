import { escapeHtml } from "./utils";

export interface SourceRenderOptions {
  showLineNumbers?: boolean;
}

function esc(value: string): string {
  return escapeHtml(value);
}

function renderDelimitedToken(
  token: string,
  delimiterLength: number,
  typeClass: string,
): string {
  const open = token.slice(0, delimiterLength);
  const close = token.slice(token.length - delimiterLength);
  const value = token.slice(delimiterLength, token.length - delimiterLength);
  return [
    `<span class="md-src-marker">${esc(open)}</span>`,
    `<span class="${typeClass}">${esc(value)}</span>`,
    `<span class="md-src-marker">${esc(close)}</span>`,
  ].join("");
}

function renderInlineToken(token: string): string {
  if (token.startsWith("`") && token.endsWith("`")) {
    return [
      `<span class="md-src-marker">${esc("`")}</span>`,
      `<span class="md-src-code">${esc(token.slice(1, -1))}</span>`,
      `<span class="md-src-marker">${esc("`")}</span>`,
    ].join("");
  }

  if (token.startsWith("**") && token.endsWith("**")) {
    return renderDelimitedToken(token, 2, "md-src-strong");
  }

  if (token.startsWith("*") && token.endsWith("*")) {
    return renderDelimitedToken(token, 1, "md-src-emphasis");
  }

  if (token.startsWith("~~") && token.endsWith("~~")) {
    return renderDelimitedToken(token, 2, "md-src-strike");
  }

  const imageMatch = /^!\[([^\]]*)\]\(([^)]+)\)$/.exec(token);
  if (imageMatch) {
    return [
      `<span class="md-src-marker">!</span>`,
      `<span class="md-src-marker">[</span>`,
      `<span class="md-src-link-text">${esc(imageMatch[1])}</span>`,
      `<span class="md-src-marker">]</span>`,
      `<span class="md-src-marker">(</span>`,
      `<span class="md-src-link-url">${esc(imageMatch[2])}</span>`,
      `<span class="md-src-marker">)</span>`,
    ].join("");
  }

  const linkMatch = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(token);
  if (linkMatch) {
    return [
      `<span class="md-src-marker">[</span>`,
      `<span class="md-src-link-text">${esc(linkMatch[1])}</span>`,
      `<span class="md-src-marker">]</span>`,
      `<span class="md-src-marker">(</span>`,
      `<span class="md-src-link-url">${esc(linkMatch[2])}</span>`,
      `<span class="md-src-marker">)</span>`,
    ].join("");
  }

  if (/^\[[ xX]\]$/.test(token)) {
    return `<span class="md-src-task">${esc(token)}</span>`;
  }

  return esc(token);
}

const INLINE_TOKEN_PATTERNS: RegExp[] = [
  /`[^`]*`/,
  /\*\*[^*]+\*\*/,
  /\*[^*]+\*/,
  /~~[^~]+~~/,
  /!\[[^\]]*\]\([^)]+\)/,
  /\[[^\]]+\]\([^)]+\)/,
  /\[[ xX]\]/,
];

function findNextInlineToken(
  line: string,
  fromIndex: number,
): { index: number; token: string } | null {
  let bestIndex = Number.POSITIVE_INFINITY;
  let bestToken = "";

  for (const pattern of INLINE_TOKEN_PATTERNS) {
    const search = new RegExp(pattern.source, "g");
    search.lastIndex = fromIndex;
    const match = search.exec(line);
    if (!match) continue;
    if (match.index < bestIndex) {
      bestIndex = match.index;
      bestToken = match[0];
    }
  }

  if (!Number.isFinite(bestIndex)) return null;
  return { index: bestIndex, token: bestToken };
}

function renderInline(line: string): string {
  let out = "";
  let cursor = 0;

  while (cursor < line.length) {
    const match = findNextInlineToken(line, cursor);
    if (!match) {
      out += esc(line.slice(cursor));
      break;
    }
    if (match.index > cursor) {
      out += esc(line.slice(cursor, match.index));
    }
    out += renderInlineToken(match.token);
    cursor = match.index + match.token.length;
  }

  return out;
}

function renderLine(line: string): string {
  const headingMatch = /^(\s{0,3})(#{1,6})(\s+)(.*)$/.exec(line);
  if (headingMatch) {
    return [
      esc(headingMatch[1]),
      `<span class="md-src-marker">${esc(headingMatch[2])}</span>`,
      esc(headingMatch[3]),
      renderInline(headingMatch[4]),
    ].join("");
  }

  const fenceMatch = /^(\s*)(```+|~~~+)(.*)$/.exec(line);
  if (fenceMatch) {
    return [
      esc(fenceMatch[1]),
      `<span class="md-src-marker">${esc(fenceMatch[2])}</span>`,
      `<span class="md-src-lang">${esc(fenceMatch[3])}</span>`,
    ].join("");
  }

  const quoteMatch = /^(\s*)(>+\s?)(.*)$/.exec(line);
  if (quoteMatch) {
    return [
      esc(quoteMatch[1]),
      `<span class="md-src-marker">${esc(quoteMatch[2])}</span>`,
      renderInline(quoteMatch[3]),
    ].join("");
  }

  const listMatch = /^(\s*)([-*+]\s+|\d+[.)]\s+)(\[[ xX]\]\s+)?(.*)$/.exec(
    line,
  );
  if (listMatch) {
    return [
      esc(listMatch[1]),
      `<span class="md-src-marker">${esc(listMatch[2])}</span>`,
      listMatch[3]
        ? `<span class="md-src-task">${esc(listMatch[3])}</span>`
        : "",
      renderInline(listMatch[4]),
    ].join("");
  }

  if (/^(\s*)([-*_]\s*){3,}$/.test(line)) {
    return `<span class="md-src-marker">${esc(line)}</span>`;
  }

  return renderInline(line);
}

export function renderMarkdownSource(
  source: string,
  options: SourceRenderOptions = {},
): string {
  const lines = source.replaceAll(/\r\n?/g, "\n").split("\n");
  const content = lines
    .map((line, index) => {
      const lineNumber = options.showLineNumbers
        ? `<span class="md-src-lineno">${index + 1}</span>`
        : "";
      return `<span class="md-src-line">${lineNumber}<span class="md-src-code-line">${renderLine(line)}</span></span>`;
    })
    .join("\n");

  return `<pre class="md-source-view"><code>${content}</code></pre>`;
}
