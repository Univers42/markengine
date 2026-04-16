// Markdown shortcuts — inline parsing and block conversion
import type { BlockType, Block } from "@/entities/block";
import type { InlineNode } from "./markdown/ast";
import { parseInlineMarkdown as renderInlineMarkdown } from "./markdown/shortcuts";
import { parse } from "./markdown/parser";

export type { BlockDetection } from "./shortcutsDetect";
export { BLOCK_SHORTCUTS, detectBlockType } from "./shortcutsDetect";

export function parseInlineMarkdown(text: string): string {
  return renderInlineMarkdown(text);
}

/**
 * Convert a full markdown string into an array of Notion-style blocks.
 * Uses the full AST parser, then maps to Block types.
 */
export function parseMarkdownToBlocks(markdown: string): Block[] {
  const ast = parse(markdown);
  return ast.flatMap((node) => astToBlocks(node));
}

function astToBlocks(node: import("./markdown/ast").BlockNode): Block[] {
  switch (node.type) {
    case "heading": {
      const level = Math.min(node.level, 4);
      const headingType = `heading_${level}` as BlockType;
      return [
        {
          id: crypto.randomUUID(),
          type: headingType,
          content: inlineToMarkdown(node.children),
        },
      ];
    }
    case "paragraph":
      return [
        {
          id: crypto.randomUUID(),
          type: "paragraph",
          content: inlineToMarkdown(node.children),
        },
      ];
    case "thematic_break":
      return [{ id: crypto.randomUUID(), type: "divider", content: "" }];
    case "blockquote":
      return [
        {
          id: crypto.randomUUID(),
          type: "quote",
          content: node.children.map((c) => blockToMarkdown(c)).join("\n"),
        },
      ];
    case "code_block":
      return [
        {
          id: crypto.randomUUID(),
          type: "code",
          content: node.value,
          language: node.lang || "plaintext",
        },
      ];
    case "unordered_list":
      return node.children.map((item) => ({
        id: crypto.randomUUID(),
        type: "bulleted_list" as BlockType,
        content: item.children.map((c) => blockToMarkdown(c)).join("\n"),
      }));
    case "ordered_list":
      return node.children.map((item) => ({
        id: crypto.randomUUID(),
        type: "numbered_list" as BlockType,
        content: item.children.map((c) => blockToMarkdown(c)).join("\n"),
      }));
    case "task_list":
      return node.children.map((item) => ({
        id: crypto.randomUUID(),
        type: "to_do" as BlockType,
        content: item.children.map((c) => blockToMarkdown(c)).join("\n"),
        checked: item.checked,
      }));
    case "callout":
      return [
        {
          id: crypto.randomUUID(),
          type: "callout" as BlockType,
          content: node.children.map((c) => blockToMarkdown(c)).join("\n"),
        },
      ];
    case "table":
      return [
        {
          id: crypto.randomUUID(),
          type: "table_block",
          content: "",
          tableData: [
            node.head.cells.map((cell) => inlineToPlain(cell.children)),
            ...node.rows.map((row) =>
              row.cells.map((cell) => inlineToPlain(cell.children)),
            ),
          ],
        },
      ];
    default:
      return [];
  }
}

function inlineToPlain(nodes: InlineNode[]): string {
  return nodes
    .map((n) => {
      switch (n.type) {
        case "text":
          return n.value;
        case "bold":
        case "italic":
        case "bold_italic":
        case "strikethrough":
        case "underline":
        case "text_color":
        case "background_color":
        case "code_rich":
        case "highlight":
          return inlineToPlain(n.children);
        case "code":
          return n.value;
        case "link":
          return inlineToPlain(n.children);
        case "image":
          return n.alt;
        case "emoji":
          return n.value;
        case "line_break":
          return "\n";
        case "math_inline":
          return n.value;
        case "footnote_ref":
          return `[${n.label}]`;
        default:
          return "";
      }
    })
    .join("");
}

function inlineToMarkdown(nodes: InlineNode[]): string {
  return nodes
    .map((n) => {
      switch (n.type) {
        case "text":
          return n.value;
        case "bold":
          return `**${inlineToMarkdown(n.children)}**`;
        case "italic":
          return `*${inlineToMarkdown(n.children)}*`;
        case "bold_italic":
          return `***${inlineToMarkdown(n.children)}***`;
        case "strikethrough":
          return `~~${inlineToMarkdown(n.children)}~~`;
        case "underline":
          return `__${inlineToMarkdown(n.children)}__`;
        case "text_color":
          return `[color=${n.color}]${inlineToMarkdown(n.children)}[/color]`;
        case "background_color":
          return `[bg=${n.color}]${inlineToMarkdown(n.children)}[/bg]`;
        case "code_rich":
          return `[code]${inlineToMarkdown(n.children)}[/code]`;
        case "highlight":
          return `==${inlineToMarkdown(n.children)}==`;
        case "code":
          return `\`${n.value}\``;
        case "link":
          return `[${inlineToMarkdown(n.children)}](${n.href})`;
        case "image":
          return `![${n.alt}](${n.src})`;
        case "emoji":
          return n.value;
        case "line_break":
          return "\n";
        case "math_inline":
          return `$${n.value}$`;
        case "footnote_ref":
          return `[^${n.label}]`;
        default:
          return "";
      }
    })
    .join("");
}

function blockToMarkdown(node: import("./markdown/ast").BlockNode): string {
  switch (node.type) {
    case "paragraph":
      return inlineToMarkdown(node.children);
    case "heading":
      return inlineToMarkdown(node.children);
    default:
      return "";
  }
}
