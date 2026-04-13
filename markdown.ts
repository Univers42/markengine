import { parseMarkdown as parseDocument } from "./src/block-parser";
import { parseInlines as parseInlineNodes } from "./src/inline-parser";
import { renderHtml as renderDocumentHtml } from "./src/renderer";
import {
  renderMarkdownSource,
  type SourceRenderOptions,
} from "./src/source-renderer";
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
export type { SourceRenderOptions } from "./src/source-renderer";

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

export function renderSource(
  source: string,
  options: SourceRenderOptions = {},
): string {
  return renderMarkdownSource(source, options);
}

export function compileMarkdownToSourceView(
  source: string,
  options: ParseOptions = {},
  sourceOptions: SourceRenderOptions = {},
): {
  html: string;
  ast: DocumentNode;
} {
  const result = parseMarkdown(source, options);
  return {
    html: renderSource(source, sourceOptions),
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
