import { parseMarkdown as parseDocument } from "./src/block-parser";
import { parseInlines as parseInlineNodes } from "./src/inline-parser";
import { renderHtml as renderDocumentHtml } from "./src/renderer";
import { incrementalParse as incrementalParseFromSource } from "./src/incremental";
import type {
  DocumentNode,
  IncrementalParseResult,
  IncrementalPatch,
  InlineNode,
  ParseOptions,
  ParseResult,
} from "./src/types";

export type {
  BlockNode,
  DocumentNode,
  IncrementalParseResult,
  IncrementalPatch,
  InlineNode,
  ParseOptions,
  ParseResult,
} from "./src/types";

export function parseMarkdown(
  source: string,
  options: ParseOptions = {},
): ParseResult {
  return parseDocument(source, options);
}

export function parseInlines(source: string, line = 0): InlineNode[] {
  return parseInlineNodes(source, line);
}

export function renderHtml(ast: DocumentNode): string {
  return renderDocumentHtml(ast);
}

export function compileMarkdownToHtml(
  source: string,
  options: ParseOptions = {},
): {
  html: string;
  ast: DocumentNode;
} {
  const result = parseMarkdown(source, options);
  return {
    html: renderHtml(result.ast),
    ast: result.ast,
  };
}

export function incrementalParse(
  previousText: string,
  previousResult: ParseResult,
  patch: IncrementalPatch,
): IncrementalParseResult {
  return incrementalParseFromSource(previousText, previousResult, patch);
}
