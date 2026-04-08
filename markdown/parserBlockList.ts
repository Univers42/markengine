// Markdown parser — list block parsers (task, ordered, unordered)
import type { BlockNode, ListItemNode, TaskItemNode } from './ast';
import type { ParseContext } from './parserBlockHelpers';
import { advance, listStartPattern } from './parserBlockHelpers';
import type { ParseBlocksFn } from './parserBlockQuote';

/** Check if a blank line should continue the current list item (next line indented enough). */
function shouldContinueAfterBlank(
  ctx: ParseContext,
  minIndent: number,
  extraTest?: (trimmed: string) => boolean,
): boolean {
  if (ctx.pos + 1 >= ctx.lines.length) return false;
  const afterBlank = ctx.lines[ctx.pos + 1];
  const afterTrimmed = afterBlank.trimStart();
  const afterIndent = afterBlank.length - afterTrimmed.length;
  if (afterIndent < minIndent) return false;
  if (extraTest && !extraTest(afterTrimmed)) return false;
  return true;
}

function collectOrderedContinuation(
  ctx: ParseContext, contLines: string[], markerLen: number,
): void {
  while (ctx.pos < ctx.lines.length) {
    const next = ctx.lines[ctx.pos];
    const nextTrimmed = next.trimStart();
    const nextIndent = next.length - nextTrimmed.length;
    if (nextTrimmed === '') {
      if (shouldContinueAfterBlank(ctx, 2)) {
        contLines.push('');
        advance(ctx);
        continue;
      }
      break;
    } else if (nextIndent >= markerLen && !/^\d{1,9}[.)]\s/.test(nextTrimmed)) {
      contLines.push(nextTrimmed);
      advance(ctx);
    } else {
      break;
    }
  }
}

function collectUnorderedContinuation(
  ctx: ParseContext, contLines: string[],
): void {
  while (ctx.pos < ctx.lines.length) {
    const next = ctx.lines[ctx.pos];
    const nextTrimmed = next.trimStart();
    const nextIndent = next.length - nextTrimmed.length;
    if (nextTrimmed === '') {
      if (shouldContinueAfterBlank(ctx, 2, t => !listStartPattern.test(t))) {
        contLines.push('');
        advance(ctx);
        continue;
      }
      break;
    } else if (nextIndent >= 2 && !(/^[-*+]\s/.test(nextTrimmed) && nextIndent < 4)) {
      contLines.push(nextTrimmed);
      advance(ctx);
    } else {
      break;
    }
  }
}

export function parseTaskList(ctx: ParseContext, parseBlocks: ParseBlocksFn): BlockNode {
  const items: TaskItemNode[] = [];
  while (ctx.pos < ctx.lines.length) {
    const line = ctx.lines[ctx.pos].trimStart();
    const match = /^[-*+]\s+\[([ xX])\]\s+(.*)/.exec(line);
    if (!match) break;
    advance(ctx);
    const checked = match[1] !== ' ';
    const content = match[2];
    const contLines = [content];
    while (ctx.pos < ctx.lines.length) {
      const next = ctx.lines[ctx.pos];
      const nextTrimmed = next.trimStart();
      const nextIndent = next.length - nextTrimmed.length;
      if (nextTrimmed === '' || nextIndent >= 2 && !listStartPattern.test(nextTrimmed)) {
        contLines.push(nextTrimmed);
        advance(ctx);
      } else {
        break;
      }
    }

    const innerCtx: ParseContext = { lines: contLines, pos: 0 };
    items.push({ type: 'task_item', checked, children: parseBlocks(innerCtx, 1) });
  }

  return { type: 'task_list', children: items };
}

export function parseOrderedList(ctx: ParseContext, parseBlocks: ParseBlocksFn): BlockNode {
  const items: ListItemNode[] = [];
  let start = 1;
  let first = true;
  while (ctx.pos < ctx.lines.length) {
    const line = ctx.lines[ctx.pos].trimStart();
    const match = /^(\d{1,9})([.)]\s+)(.*)/.exec(line);
    if (!match) break;
    advance(ctx);
    if (first) { start = Number.parseInt(match[1], 10); first = false; }
    const markerLen = match[1].length + match[2].length;
    const contLines = [match[3]];
    collectOrderedContinuation(ctx, contLines, markerLen);

    const innerCtx: ParseContext = { lines: contLines, pos: 0 };
    items.push({ type: 'list_item', children: parseBlocks(innerCtx, 1) });
  }

  return { type: 'ordered_list', start, children: items };
}

export function parseUnorderedList(ctx: ParseContext, parseBlocks: ParseBlocksFn): BlockNode {
  const items: ListItemNode[] = [];
  while (ctx.pos < ctx.lines.length) {
    const line = ctx.lines[ctx.pos].trimStart();
    if (!/^[-*+]\s+/.test(line)) break;
    advance(ctx);
    const content = line.replace(/^[-*+]\s+/, '');
    const contLines = [content];
    collectUnorderedContinuation(ctx, contLines);

    const innerCtx: ParseContext = { lines: contLines, pos: 0 };
    items.push({ type: 'list_item', children: parseBlocks(innerCtx, 1) });
  }

  return { type: 'unordered_list', children: items };
}
