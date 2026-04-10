import type { BlockNode, NodeRange } from "./ast";
import { parseWithMeta } from "./parser";

export interface EditorBlock {
  /** Notion-style stable id for transclusion/references */
  id: string;
  /** AST node for this block (source of truth) */
  ast: BlockNode;
  /** 0-based inclusive line range in the source markdown */
  range: NodeRange;
  /** Per-block metadata (collapsed, color, etc.) */
  meta?: Record<string, unknown>;
  /** Editor state: true when focused in "source" mode */
  active?: boolean;
}

export interface ParseEditorBlocksOptions {
  /**
   * If true, blocks missing an annotation will receive a generated id.
   * Combine with `stringifyEditorBlocks()` to persist ids back to markdown.
   */
  assignMissingIds?: boolean;
  /** Read `<!-- @block ... -->` lines */
  readAnnotations?: boolean;
}

export function parseEditorBlocks(markdown: string, opts?: ParseEditorBlocksOptions): EditorBlock[] {
  const o = { assignMissingIds: false, readAnnotations: true, ...opts };
  const { blocks } = parseWithMeta(markdown, {
    assignMissingBlockIds: o.assignMissingIds,
    readBlockAnnotations: o.readAnnotations,
  });

  return blocks.map((b) => {
    const id = (b as BlockNode & { blockId?: string }).blockId ?? crypto.randomUUID();
    const range = (b as BlockNode & { range?: NodeRange }).range ?? { startLine: 0, endLine: 0 };
    const meta = (b as BlockNode & { meta?: Record<string, unknown> }).meta;
    const active = (b as BlockNode & { active?: boolean }).active;
    return { id, ast: b, range, meta, active };
  });
}

export interface StringifyEditorBlocksOptions {
  /** Emit a hidden annotation line before each block */
  includeAnnotations?: boolean;
}

/**
 * Serialize blocks back to markdown, preserving block ids via annotation lines.
 * This is the round-trip "source of truth" bridge for a block editor.
 */
export function stringifyEditorBlocks(blocks: EditorBlock[], opts?: StringifyEditorBlocksOptions): string {
  const o = { includeAnnotations: true, ...opts };
  const out: string[] = [];
  for (const b of blocks) {
    const chunk: string[] = [];
    if (o.includeAnnotations) chunk.push(formatBlockAnnotationLine(b.id, b.meta));
    chunk.push(stringifyBlockNode(b.ast), ""); // block separator
    out.push(...chunk);
  }
  while (out.length > 0 && out.at(-1) === "") out.pop();
  return out.join("\n");
}

function formatBlockAnnotationLine(id: string, meta?: Record<string, unknown>): string {
  const parts: string[] = [`id=${quoteIfNeeded(id)}`];
  if (meta) {
    for (const [k, v] of Object.entries(meta)) {
      if (v === undefined) continue;
      parts.push(`${k}=${quoteIfNeeded(valueToString(v))}`);
    }
  }
  return `<!-- @block ${parts.join(" ")} -->`;
}

function quoteIfNeeded(v: string): string {
  return /\s/.test(v) ? JSON.stringify(v) : v;
}

function valueToString(v: unknown): string {
  if (v === null) return "null";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  try {
    return JSON.stringify(v);
  } catch {
    return Object.prototype.toString.call(v);
  }
}

function stringifyBlockNode(node: BlockNode): string {
  switch (node.type) {
    case "paragraph":
      return stringifyInlines(node.children);
    case "heading": {
      const hashes = "#".repeat(node.level);
      return `${hashes} ${stringifyInlines(node.children)}`;
    }
    case "thematic_break":
      return "---";
    case "blockquote": {
      const inner = node.children.map(stringifyBlockNode).join("\n\n");
      return inner
        .split("\n")
        .map((l) => (l ? `> ${l}` : ">"))
        .join("\n");
    }
    case "code_block": {
      const info = [node.lang, node.meta].filter(Boolean).join(" ").trim();
      const fence = "```";
      return `${fence}${info ? " " + info : ""}\n${node.value}\n${fence}`;
    }
    case "unordered_list":
      return node.children
        .map((it) => `- ${it.children.map(stringifyBlockNode).join("\n")}`.trimEnd())
        .join("\n");
    case "ordered_list":
      return node.children
        .map((it, i) => `${(node.start ?? 1) + i}. ${it.children.map(stringifyBlockNode).join("\n")}`.trimEnd())
        .join("\n");
    case "task_list":
      return node.children
        .map((it) => `- [${it.checked ? "x" : " "}] ${it.children.map(stringifyBlockNode).join("\n")}`.trimEnd())
        .join("\n");
    case "table": {
      const row = (cells: { children: import("./ast").InlineNode[] }[]) =>
        `| ${cells.map((c) => stringifyInlines(c.children)).join(" | ")} |`;
      const align = node.alignments.map((a) => {
        if (a === "left") return ":---";
        if (a === "right") return "---:";
        if (a === "center") return ":---:";
        return "---";
      }).join(" | ");
      const head = row(node.head.cells);
      const sep = `| ${align} |`;
      const rows = node.rows.map((r) => row(r.cells)).join("\n");
      return `${head}\n${sep}${rows ? "\n" + rows : ""}`;
    }
    case "callout": {
      const title = node.title.length ? " " + stringifyInlines(node.title) : "";
      const header = `> [!${node.kind}]${title}`;
      const body = node.children
        .map(stringifyBlockNode)
        .join("\n\n")
        .split("\n")
        .map((l) => `> ${l}`.trimEnd())
        .join("\n");
      return `${header}\n${body}`;
    }
    case "math_block":
      return `$$\n${node.value}\n$$`;
    case "html_block":
      return node.value;
    case "footnote_def": {
      const body = node.children.map(stringifyBlockNode).join("\n");
      return `[^${node.label}]: ${body}`;
    }
    case "definition_list": {
      // Minimal: term\n: def
      return node.items
        .map((it) => {
          const term = stringifyInlines(it.term);
          const defs = it.definitions.map((d) => `: ${stringifyInlines(d)}`).join("\n");
          return `${term}\n${defs}`;
        })
        .join("\n\n");
    }
    case "toggle": {
      const summary = stringifyInlines(node.summary);
      const body = node.children.map(stringifyBlockNode).join("\n\n");
      return `<details>\n<summary>${summary}</summary>\n\n${body}\n</details>`;
    }
    case "document":
      return node.children.map(stringifyBlockNode).join("\n\n");
    case "list_item":
      return node.children.map(stringifyBlockNode).join("\n");
    default:
      return "";
  }
}

function stringifyInlines(nodes: import("./ast").InlineNode[]): string {
  return nodes
    .map((n) => {
      switch (n.type) {
        case "text":
          return n.value;
        case "bold":
          return `**${stringifyInlines(n.children)}**`;
        case "italic":
          return `*${stringifyInlines(n.children)}*`;
        case "bold_italic":
          return `***${stringifyInlines(n.children)}***`;
        case "strikethrough":
          return `~~${stringifyInlines(n.children)}~~`;
        case "underline":
          return `__${stringifyInlines(n.children)}__`;
        case "code":
          return "`" + n.value + "`";
        case "link":
          return stringifyLink(n.href, stringifyInlines(n.children), n.title);
        case "wikilink": {
          const inner = n.alias ? `${n.target}|${n.alias}` : n.target;
          return `${n.embed ? "!" : ""}[[${inner}]]`;
        }
        case "image":
          return stringifyImage(n.src, n.alt, n.title);
        case "line_break":
          return "\n";
        case "highlight":
          return `==${stringifyInlines(n.children)}==`;
        case "math_inline":
          return `$${n.value}$`;
        case "footnote_ref":
          return `[^${n.label}]`;
        case "emoji":
          return `:${n.raw}:`;
        default:
          return "";
      }
    })
    .join("");
}

function stringifyLink(href: string, label: string, title?: string): string {
  const t = title ? ` "${title}"` : "";
  return `[${label}](${href}${t})`;
}

function stringifyImage(src: string, alt: string, title?: string): string {
  const t = title ? ` "${title}"` : "";
  return `![${alt}](${src}${t})`;
}

