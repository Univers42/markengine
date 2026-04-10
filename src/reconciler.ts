import type { EditorBlock } from "./blocks";

export interface ReconcileOptions {
  /**
   * If true, preserve object identity for unchanged blocks (by id),
   * which helps UI layers avoid re-renders.
   */
  preserveReferences?: boolean;
}

export function reconcileBlocks(
  prev: readonly EditorBlock[],
  next: readonly EditorBlock[],
  opts?: ReconcileOptions,
): EditorBlock[] {
  const o = { preserveReferences: true, ...opts };
  if (!o.preserveReferences) return [...next];

  const prevById = new Map(prev.map((b) => [b.id, b] as const));
  return next.map((b) => {
    const p = prevById.get(b.id);
    if (!p) return b;
    // If the AST/range/meta changed, keep the new block; else reuse the old reference.
    const same =
      p.range.startLine === b.range.startLine &&
      p.range.endLine === b.range.endLine &&
      shallowEqual(p.meta, b.meta) &&
      p.active === b.active &&
      JSON.stringify(p.ast) === JSON.stringify(b.ast);
    return same ? p : b;
  });
}

export function setActiveBlock(blocks: readonly EditorBlock[], id: string, active: boolean): EditorBlock[] {
  return blocks.map((b) => (b.id === id ? { ...b, active } : b));
}

function shallowEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  if (typeof a !== "object" || typeof b !== "object") return false;
  const ao = a as Record<string, unknown>;
  const bo = b as Record<string, unknown>;
  const ak = Object.keys(ao);
  const bk = Object.keys(bo);
  if (ak.length !== bk.length) return false;
  for (const k of ak) {
    if (ao[k] !== bo[k]) return false;
  }
  return true;
}

