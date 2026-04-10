import type { BlockNode, InlineNode } from "./ast";

export interface OutgoingConnections {
  wikilinks: { target: string; alias?: string; embed?: boolean }[];
  links: { href: string; title?: string }[];
  tags: string[];
}

export interface GraphIndexEntry {
  noteId: string;
  connections: OutgoingConnections;
}

export interface BacklinkIndex {
  /** target -> noteIds that link to it */
  wikilinks: Map<string, Set<string>>;
  /** tag -> noteIds that mention it */
  tags: Map<string, Set<string>>;
}

export function extractOutgoingConnections(blocks: BlockNode[]): OutgoingConnections {
  const acc: Acc = { wikilinks: [], links: [], tags: new Set<string>() };
  collectFromBlocks(blocks, acc);
  return { wikilinks: acc.wikilinks, links: acc.links, tags: [...acc.tags] };
}

type Acc = {
  wikilinks: OutgoingConnections["wikilinks"];
  links: OutgoingConnections["links"];
  tags: Set<string>;
};

function collectFromBlocks(nodes: BlockNode[], acc: Acc): void {
  for (const b of nodes) collectFromBlock(b, acc);
}

function collectFromBlock(b: BlockNode, acc: Acc): void {
  if (collectFromTextualBlock(b, acc)) return;
  if (collectFromContainerBlock(b, acc)) return;
  if (collectFromListBlock(b, acc)) return;
  if (collectFromTableBlock(b, acc)) return;
  if (collectFromCalloutBlock(b, acc)) return;
  if (collectFromToggleBlock(b, acc)) return;
  if (collectFromFootnoteBlock(b, acc)) return;
  collectFromDefinitionListBlock(b, acc);
}

function collectFromInlines(nodes: InlineNode[], acc: Acc): void {
  for (const n of nodes) collectFromInline(n, acc);
}

function collectFromTextualBlock(b: BlockNode, acc: Acc): boolean {
  if (b.type !== "paragraph" && b.type !== "heading") return false;
  collectFromInlines(b.children, acc);
  return true;
}

function collectFromContainerBlock(b: BlockNode, acc: Acc): boolean {
  if (b.type !== "blockquote" && b.type !== "document") return false;
  collectFromBlocks(b.children, acc);
  return true;
}

function collectFromListBlock(b: BlockNode, acc: Acc): boolean {
  if (b.type !== "unordered_list" && b.type !== "ordered_list" && b.type !== "task_list") return false;
  for (const it of b.children) collectFromBlocks(it.children, acc);
  return true;
}

function collectFromTableBlock(b: BlockNode, acc: Acc): boolean {
  if (b.type !== "table") return false;
  collectFromInlines(b.head.cells.flatMap((c) => c.children), acc);
  for (const r of b.rows) collectFromInlines(r.cells.flatMap((c) => c.children), acc);
  return true;
}

function collectFromCalloutBlock(b: BlockNode, acc: Acc): boolean {
  if (b.type !== "callout") return false;
  collectFromInlines(b.title, acc);
  collectFromBlocks(b.children, acc);
  return true;
}

function collectFromToggleBlock(b: BlockNode, acc: Acc): boolean {
  if (b.type !== "toggle") return false;
  collectFromInlines(b.summary, acc);
  collectFromBlocks(b.children, acc);
  return true;
}

function collectFromFootnoteBlock(b: BlockNode, acc: Acc): boolean {
  if (b.type !== "footnote_def") return false;
  collectFromBlocks(b.children, acc);
  return true;
}

function collectFromDefinitionListBlock(b: BlockNode, acc: Acc): boolean {
  if (b.type !== "definition_list") return false;
  for (const it of b.items) {
    collectFromInlines(it.term, acc);
    for (const def of it.definitions) collectFromInlines(def, acc);
  }
  return true;
}

function collectFromInline(n: InlineNode, acc: Acc): void {
  if (n.type === "text") { extractTagsFromText(n.value, acc.tags); return; }
  if (n.type === "wikilink") { acc.wikilinks.push({ target: n.target, alias: n.alias, embed: n.embed }); return; }
  if (n.type === "link") { acc.links.push({ href: n.href, title: n.title }); collectFromInlines(n.children, acc); return; }
  if ("children" in n && Array.isArray((n as { children?: unknown }).children)) {
    collectFromInlines((n as { children: InlineNode[] }).children, acc);
  }
}

export function buildBacklinkIndex(entries: GraphIndexEntry[]): BacklinkIndex {
  const wikilinks = new Map<string, Set<string>>();
  const tags = new Map<string, Set<string>>();

  for (const e of entries) {
    for (const wl of e.connections.wikilinks) {
      const key = normalizeWikilinkTarget(wl.target);
      const set = wikilinks.get(key);
      if (set) set.add(e.noteId);
      else wikilinks.set(key, new Set([e.noteId]));
    }
    for (const t of e.connections.tags) {
      const key = normalizeTag(t);
      const set = tags.get(key);
      if (set) set.add(e.noteId);
      else tags.set(key, new Set([e.noteId]));
    }
  }

  return { wikilinks, tags };
}

export function normalizeWikilinkTarget(target: string): string {
  return target.trim();
}

export function normalizeTag(tag: string): string {
  return tag.trim().replace(/^#/, "").toLowerCase();
}

function extractTagsFromText(text: string, out: Set<string>): void {
  // Simple, fast hashtag extraction. Keeps `#foo/bar` and `#foo-bar`.
  // Avoids email fragments by requiring a word boundary or start.
  const re = /(^|[\s(])#([A-Za-z0-9][A-Za-z0-9/_-]*)/g;
  for (const m of text.matchAll(re)) {
    out.add(m[2]);
  }
}

