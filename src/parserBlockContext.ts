// Markdown parser — parse context and cursor utilities
export interface ParseContext {
  lines: string[];
  pos: number;
  /** Map from ctx.pos (virtual line index) to original markdown line index */
  lineMap?: number[];
  /** Pending block annotation to attach to the next parsed block */
  pendingBlock?: { id: string; meta?: Record<string, unknown> } | null;
  /** If true, assign stable block ids when missing */
  assignMissingBlockIds?: boolean;
}

export function peek(ctx: ParseContext): string | null {
  return ctx.pos < ctx.lines.length ? ctx.lines[ctx.pos] : null;
}

export function advance(ctx: ParseContext): string {
  return ctx.lines[ctx.pos++];
}
