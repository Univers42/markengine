/* ************************************************************************** */
/*                                                                            */
/*                                                        :::      ::::::::   */
/*   index.ts                                           :+:      :+:    :+:   */
/*                                                    +:+ +:+         +:+     */
/*   By: dlesieur <dlesieur@student.42.fr>          +#+  +:+       +#+        */
/*                                                +#+#+#+#+#+   +#+           */
/*   Created: 2026/04/01 16:40:48 by dlesieur          #+#    #+#             */
/*   Updated: 2026/04/01 16:40:49 by dlesieur         ###   ########.fr       */
/*                                                                            */
/* ************************************************************************** */

// ═══════════════════════════════════════════════════════════════════════════════
// @notion/markdown — standalone markdown library
// ═══════════════════════════════════════════════════════════════════════════════
//
// Architecture:
//   1. Parser: markdown string → AST (BlockNode[])
//   2. Renderers: AST → HTML string | React elements | ANSI terminal string
//   3. Shortcuts: block detection for the Notion-style block editor
//
// This library is framework-agnostic at its core. Only the React renderer
// depends on React. The parser, AST types, HTML renderer, and terminal
// renderer are fully standalone with zero external dependencies.
//
// Usage:
//   import { parse, renderHtml, renderTerminal } from './lib/markdown';
//   import { MarkdownView } from './lib/markdown/renderers/react';
//
//   // Parse
//   const ast = parse('# Hello\n\nSome **bold** text.');
//
//   // Render to HTML
//   const html = renderHtml(ast);
//
//   // Render to terminal
//   const ansi = renderTerminal(ast);
//
//   // Render in React
//   <MarkdownView markdown="# Hello" />
// ═══════════════════════════════════════════════════════════════════════════════

// ─── AST Types ───────────────────────────────────────────────────────────────
export type {
  BlockNode,
  InlineNode,
  ListItemNode,
  TaskItemNode,
  TableRowNode,
  TableCellNode,
  TableAlign,
  DefinitionItem,
} from "./ast";
export { isInlineNode, isBlockNode } from "./ast";

// ─── Parser ──────────────────────────────────────────────────────────────────
export { parse, parseInline } from "./parser";
export { parseWithMeta } from "./parser";
export type { ParseWithMetaOptions, ParseWithMetaResult } from "./parser";

// ─── Block editor bridge (Notion + Obsidian) ─────────────────────────────────
export { parseEditorBlocks, stringifyEditorBlocks } from "./blocks";
export type { EditorBlock, ParseEditorBlocksOptions, StringifyEditorBlocksOptions } from "./blocks";

export { reconcileBlocks, setActiveBlock } from "./reconciler";
export type { ReconcileOptions } from "./reconciler";

// ─── Renderers ───────────────────────────────────────────────────────────────
export { renderHtml } from "./renderers/html";
export type { HtmlRenderOptions } from "./renderers/html";

export { renderReact, MarkdownView } from "./renderers/react";
export type { ReactRenderOptions } from "./renderers/react";

export { renderTerminal } from "./renderers/terminal";
export type { TerminalRenderOptions } from "./renderers/terminal";

// ─── Graph extraction (Obsidian-style) ───────────────────────────────────────
export { extractOutgoingConnections, buildBacklinkIndex } from "./graph";
export type { OutgoingConnections, GraphIndexEntry, BacklinkIndex } from "./graph";

// ─── Shortcuts (backwards compatible with old markdownEngine) ────────────────
export {
  detectBlockType,
  parseInlineMarkdown,
  parseMarkdownToBlocks,
  BLOCK_SHORTCUTS,
} from "./shortcuts";
export type { BlockDetection } from "./shortcuts";
