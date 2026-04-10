// Markdown Parser — full CommonMark + GFM parser, zero dependencies

import type { BlockNode, NodeRange } from './ast';
import { parseInline, slugify } from './parserInline';
import type { ParseContext } from './parserBlockHelpers';
import { parseBlockAnnotationLine } from './blockAnnotations';
import {
  peek, advance, isThematicBreak, isSetextHeading,
  parseFencedCode, parseMathBlock, isHtmlBlockTag, parseHtmlBlock,
  isTableStart, parseTable, parseIndentedCode, parseParagraph,
} from './parserBlockHelpers';
import {
  parseBlockquote, parseCallout, parseTaskList,
  parseUnorderedList, parseOrderedList, parseFootnoteDef,
} from './parserBlockNested';

export { parseInline } from './parserInline';

export function parse(markdown: string): BlockNode[] {
  const lines = markdown.split('\n');
  const ctx: ParseContext = { lines, pos: 0 };
  return parseBlocks(ctx, 0);
}

export interface ParseWithMetaResult {
  blocks: BlockNode[];
  /** Lines used for parsing (may exclude annotation lines) */
  lines: string[];
  /** Map from parsed line index -> original line index */
  lineMap: number[];
}

export interface ParseWithMetaOptions {
  /**
   * If true, block ids will be generated when missing. The ids are attached to
   * nodes as `blockId`, but this function does not rewrite the markdown.
   */
  assignMissingBlockIds?: boolean;
  /** Parse `<!-- @block ... -->` annotation lines and attach them to the next block */
  readBlockAnnotations?: boolean;
}

/**
 * Parse markdown while attaching source ranges and optional Notion-style block ids.
 * This keeps `parse()` backwards compatible.
 */
export function parseWithMeta(markdown: string, opts?: ParseWithMetaOptions): ParseWithMetaResult {
  const o = { assignMissingBlockIds: false, readBlockAnnotations: true, ...opts };
  const originalLines = markdown.split('\n');
  const lines: string[] = [];
  const lineMap: number[] = [];

  // Extract annotation lines and stash them onto the next real block line.
  // We do not include the annotation line in `lines` to avoid creating html_block nodes.
  const annotationsByVirtualLine = new Map<number, { id: string; meta?: Record<string, unknown> }>();
  let pending: { id: string; meta?: Record<string, unknown> } | null = null;

  for (let i = 0; i < originalLines.length; i++) {
    const line = originalLines[i];
    const ann = o.readBlockAnnotations ? parseBlockAnnotationLine(line) : null;
    if (ann) { pending = ann; continue; }
    const v = lines.length;
    lines.push(line);
    lineMap.push(i);
    if (pending) { annotationsByVirtualLine.set(v, pending); pending = null; }
  }

  const ctx: ParseContext = {
    lines,
    pos: 0,
    lineMap,
    pendingBlock: null,
    assignMissingBlockIds: o.assignMissingBlockIds,
  };

  const blocks = parseBlocks(ctx, 0, annotationsByVirtualLine);
  return { blocks, lines, lineMap };
}

function tryParseHeading(ctx: ParseContext, trimmed: string): BlockNode | null {
  const hm = /^(#{1,6})\s+(.*?)(?:\s+#+)?\s*$/.exec(trimmed);
  if (!hm) return null;
  advance(ctx);
  const level = hm[1].length as 1 | 2 | 3 | 4 | 5 | 6;
  return { type: 'heading', level, children: parseInline(hm[2]), id: slugify(hm[2]) };
}

function tryParseSetextHeading(ctx: ParseContext): BlockNode | null {
  if (!isSetextHeading(ctx)) return null;
  const textLine = advance(ctx);
  const ml = advance(ctx);
  const lv = ml.trim().startsWith('=') ? 1 : 2;
  return { type: 'heading', level: lv, children: parseInline(textLine.trim()), id: slugify(textLine.trim()) };
}

type ParseBlocksFn = (ctx: ParseContext, indent: number) => BlockNode[];

/** Try to parse a primary (non-nested) block from the current line. */
function tryParsePrimaryBlock(ctx: ParseContext, trimmed: string): BlockNode | null {
  if (trimmed.startsWith('```') || trimmed.startsWith('~~~')) return parseFencedCode(ctx);
  if (trimmed.startsWith('$$')) return parseMathBlock(ctx);
  if (/^<([a-zA-Z][a-zA-Z0-9-]*)[\s>/]/.test(trimmed) && isHtmlBlockTag(trimmed)) return parseHtmlBlock(ctx);
  if (isTableStart(ctx)) return parseTable(ctx);
  return null;
}

/** Try to parse a nested/list-type block from the current line. */
function tryParseNestedBlock(
  ctx: ParseContext, trimmed: string, lineIndent: number, indent: number, parseFn: ParseBlocksFn,
): BlockNode | null {
  if (/^>\s*\[!(\w+)\]/.test(trimmed)) return parseCallout(ctx, parseFn);
  if (trimmed.startsWith('> ') || trimmed === '>') return parseBlockquote(ctx, parseFn);
  if (/^[-*+]\s+\[([ xX])\]\s/.test(trimmed)) return parseTaskList(ctx, parseFn);
  if (/^[-*+]\s+/.test(trimmed) && !isThematicBreak(trimmed)) return parseUnorderedList(ctx, parseFn);
  if (/^\d{1,9}[.)]\s+/.test(trimmed)) return parseOrderedList(ctx, parseFn);
  if (/^\[\^([^\]]+)\]:\s/.test(trimmed)) return parseFootnoteDef(ctx, parseFn);
  if (lineIndent >= 4 && indent === 0) return parseIndentedCode(ctx);
  return null;
}

/** Parse a single block node from the current position. */
function parseNextBlock(
  ctx: ParseContext,
  indent: number,
  annotationsByVirtualLine?: Map<number, { id: string; meta?: Record<string, unknown> }>,
): BlockNode | null {
  const startPos = ctx.pos;
  const line = peek(ctx) ?? '';
  const trimmed = line.trimStart();
  const lineIndent = line.length - trimmed.length;

  if (trimmed === '') { advance(ctx); return null; }

  // Attach annotation to next block starting at this line (virtual index).
  if (annotationsByVirtualLine?.has(startPos)) {
    ctx.pendingBlock = annotationsByVirtualLine.get(startPos) ?? null;
  }

  if (isThematicBreak(trimmed)) {
    advance(ctx);
    const node: BlockNode = { type: 'thematic_break' };
    attachMeta(node, ctx, startPos, ctx.pos - 1);
    return node;
  }

  const heading = tryParseHeading(ctx, trimmed);
  if (heading) {
    attachMeta(heading, ctx, startPos, ctx.pos - 1);
    return heading;
  }

  const node = tryParsePrimaryBlock(ctx, trimmed)
    ?? tryParseNestedBlock(ctx, trimmed, lineIndent, indent, (c, i) => parseBlocks(c, i, annotationsByVirtualLine))
    ?? tryParseSetextHeading(ctx)
    ?? parseParagraph(ctx);

  attachMeta(node, ctx, startPos, ctx.pos - 1);
  return node;
}

function parseBlocks(
  ctx: ParseContext,
  indent: number,
  annotationsByVirtualLine?: Map<number, { id: string; meta?: Record<string, unknown> }>,
): BlockNode[] {
  const blocks: BlockNode[] = [];
  while (ctx.pos < ctx.lines.length) {
    const node = parseNextBlock(ctx, indent, annotationsByVirtualLine);
    if (node) blocks.push(node);
  }
  return blocks;
}

function attachMeta(node: BlockNode, ctx: ParseContext, startPos: number, endPos: number): void {
  const lineMap = ctx.lineMap;
  const startLine = lineMap ? lineMap[startPos] : startPos;
  const endLine = lineMap ? lineMap[endPos] : endPos;
  (node as BlockNode & { range?: NodeRange }).range = { startLine, endLine };

  const pending = ctx.pendingBlock;
  if (pending) {
    (node as BlockNode & { blockId?: string; meta?: Record<string, unknown> }).blockId = pending.id;
    if (pending.meta) (node as BlockNode & { meta?: Record<string, unknown> }).meta = pending.meta;
    ctx.pendingBlock = null;
    return;
  }

  if (ctx.assignMissingBlockIds) {
    (node as BlockNode & { blockId?: string }).blockId = crypto.randomUUID();
  }
}

