import {
  CodeSpanNode,
  EmphasisNode,
  InlineNode,
  LinkNode,
  SourceSpan,
  StrongNode,
  TextNode,
} from "./types";
import { stableId } from "./utils";

interface Cursor {
  source: string;
  index: number;
}

function makeSpan(
  line: number,
  startOffset: number,
  endOffset: number,
): SourceSpan {
  return {
    startLine: line,
    endLine: line,
    startOffset,
    endOffset,
  };
}

function textNode(
  value: string,
  line: number,
  start: number,
  end: number,
): TextNode {
  return {
    id: stableId(`txt:${line}:${start}:${value}`),
    kind: "text",
    value,
    span: makeSpan(line, start, end),
  };
}

function parseBracketLabel(cursor: Cursor): string | null {
  if (cursor.source[cursor.index] !== "[") return null;
  let i = cursor.index + 1;
  while (i < cursor.source.length && cursor.source[i] !== "]") i++;
  if (i >= cursor.source.length) return null;
  const label = cursor.source.slice(cursor.index + 1, i);
  cursor.index = i + 1;
  return label;
}

function parseParenHref(cursor: Cursor): string | null {
  if (cursor.source[cursor.index] !== "(") return null;
  let i = cursor.index + 1;
  while (i < cursor.source.length && cursor.source[i] !== ")") i++;
  if (i >= cursor.source.length) return null;
  const href = cursor.source.slice(cursor.index + 1, i).trim();
  cursor.index = i + 1;
  return href || null;
}

export function parseInlines(source: string, line: number): InlineNode[] {
  const cursor: Cursor = {
    source,
    index: 0,
  };

  const nodes: InlineNode[] = [];
  const parserChain = [
    tryParseCodeSpan,
    tryParseStrong,
    tryParseEmphasis,
    tryParseLink,
  ];

  while (cursor.index < cursor.source.length) {
    const start = cursor.index;

    let parsed: InlineNode | null = null;
    for (const parser of parserChain) {
      parsed = parser(cursor, line, start);
      if (parsed) {
        nodes.push(parsed);
        break;
      }
    }

    if (parsed) {
      continue;
    }

    nodes.push(readPlainText(cursor, line));
  }

  return mergeTextNodes(nodes);
}

function tryParseCodeSpan(
  cursor: Cursor,
  line: number,
  start: number,
): CodeSpanNode | null {
  if (cursor.source[cursor.index] !== "`") return null;

  const close = cursor.source.indexOf("`", cursor.index + 1);
  if (close === -1) return null;

  const value = cursor.source.slice(cursor.index + 1, close);
  cursor.index = close + 1;

  return {
    id: stableId(`code:${line}:${start}:${value}`),
    kind: "code_span",
    value,
    span: makeSpan(line, start, close + 1),
  };
}

function tryParseStrong(
  cursor: Cursor,
  line: number,
  start: number,
): StrongNode | null {
  if (
    cursor.source[cursor.index] !== "*" ||
    cursor.source[cursor.index + 1] !== "*"
  ) {
    return null;
  }

  const close = cursor.source.indexOf("**", cursor.index + 2);
  if (close === -1) return null;

  const content = cursor.source.slice(cursor.index + 2, close);
  cursor.index = close + 2;

  return {
    id: stableId(`strong:${line}:${start}:${content}`),
    kind: "strong",
    children: parseInlines(content, line),
    span: makeSpan(line, start, close + 2),
  };
}

function tryParseEmphasis(
  cursor: Cursor,
  line: number,
  start: number,
): EmphasisNode | null {
  if (cursor.source[cursor.index] !== "*") return null;

  const close = cursor.source.indexOf("*", cursor.index + 1);
  if (close === -1) return null;

  const content = cursor.source.slice(cursor.index + 1, close);
  cursor.index = close + 1;

  return {
    id: stableId(`em:${line}:${start}:${content}`),
    kind: "emphasis",
    children: parseInlines(content, line),
    span: makeSpan(line, start, close + 1),
  };
}

function tryParseLink(
  cursor: Cursor,
  line: number,
  _start: number,
): LinkNode | null {
  if (cursor.source[cursor.index] !== "[") return null;

  const startIndex = cursor.index;
  const label = parseBracketLabel(cursor);
  if (label === null || cursor.source[cursor.index] !== "(") {
    cursor.index = startIndex;
    return null;
  }

  const href = parseParenHref(cursor);
  if (href === null) {
    cursor.index = startIndex;
    return null;
  }

  return {
    id: stableId(`link:${line}:${startIndex}:${href}:${label}`),
    kind: "link",
    href,
    children: parseInlines(label, line),
    span: makeSpan(line, startIndex, cursor.index),
  };
}

function readPlainText(cursor: Cursor, line: number): TextNode {
  let end = cursor.index + 1;
  while (end < cursor.source.length) {
    const c = cursor.source[end];
    if (c === "`" || c === "[" || c === "*") {
      break;
    }
    end++;
  }

  const start = cursor.index;
  const value = cursor.source.slice(start, end);
  cursor.index = end;
  return textNode(value, line, start, end);
}

function mergeTextNodes(nodes: InlineNode[]): InlineNode[] {
  if (nodes.length <= 1) return nodes;
  const merged: InlineNode[] = [];
  for (const node of nodes) {
    const prev = merged[merged.length - 1];
    if (prev && prev?.kind === "text" && node.kind === "text") {
      const textPrev = prev;
      const textNodeCurrent = node;
      merged[merged.length - 1] = {
        ...textPrev,
        value: textPrev.value + textNodeCurrent.value,
        span: {
          ...textPrev.span,
          endOffset: textNodeCurrent.span.endOffset,
        },
      };
      continue;
    }
    merged.push(node);
  }
  return merged;
}
