export { parseMarkdown } from "./src/block-parser";
export { parseInlines } from "./src/inline-parser";
export { renderHtml } from "./src/renderer";
export { incrementalParse } from "./src/incremental";

export type {
  BlockNode,
  BlockRange,
  DocumentNode,
  IncrementalParseResult,
  IncrementalPatch,
  InlineNode,
  ParseOptions,
  ParseResult,
} from "./src/types";

import { parseMarkdown } from "./src/block-parser";
import { renderHtml } from "./src/renderer";
import { ParseOptions } from "./src/types";

export function compileMarkdownToHtml(
  source: string,
  options: ParseOptions = {},
): { html: string; ast: ReturnType<typeof parseMarkdown>["ast"] } {
  const result = parseMarkdown(source, options);
  return {
    html: renderHtml(result.ast),
    ast: result.ast,
  };
}
