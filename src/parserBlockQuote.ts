// Markdown parser — blockquote & callout block parsers
import type { BlockNode } from './ast';
import type { ParseContext } from './parserBlockHelpers';
import { advance } from './parserBlockHelpers';
import { parseInline } from './parserInline';

export type ParseBlocksFn = (ctx: ParseContext, indent: number) => BlockNode[];

export function parseBlockquote(ctx: ParseContext, parseBlocks: ParseBlocksFn): BlockNode {
  const innerLines: string[] = [];
  while (ctx.pos < ctx.lines.length) {
    const line = ctx.lines[ctx.pos];
    const trimmed = line.trimStart();
    if (trimmed.startsWith('> ')) {
      innerLines.push(trimmed.slice(2));
      advance(ctx);
    } else if (trimmed === '>') {
      innerLines.push('');
      advance(ctx);
    } else if (trimmed === '' || !trimmed.startsWith('>')) {
      break;
    } else {
      break;
    }
  }

  const innerCtx: ParseContext = { lines: innerLines, pos: 0 };
  return { type: 'blockquote', children: parseBlocks(innerCtx, 0) };
}

export function parseCallout(ctx: ParseContext, parseBlocks: ParseBlocksFn): BlockNode {
  const firstLine = advance(ctx).trimStart();
  const calloutMatch = /^>\s*\[!(\w+)\]\s*(.*)/.exec(firstLine);
  const kind = calloutMatch?.[1] || 'note';
  const titleText = calloutMatch?.[2] || '';
  const innerLines: string[] = [];
  while (ctx.pos < ctx.lines.length) {
    const line = ctx.lines[ctx.pos].trimStart();
    if (line.startsWith('> ')) {
      innerLines.push(line.slice(2));
      advance(ctx);
    } else if (line === '>') {
      innerLines.push('');
      advance(ctx);
    } else {
      break;
    }
  }

  const innerCtx: ParseContext = { lines: innerLines, pos: 0 };
  return {
    type: 'callout',
    kind: kind.toLowerCase(),
    title: parseInline(titleText),
    children: parseBlocks(innerCtx, 0),
  };
}
