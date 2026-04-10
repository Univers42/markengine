export interface BlockAnnotation {
  id: string;
  meta?: Record<string, unknown>;
}

/**
 * Parse hidden block annotation line.
 * Format: <!-- @block id=... key=value key="value with spaces" -->
 */
export function parseBlockAnnotationLine(line: string): BlockAnnotation | null {
  const trimmed = line.trim();
  if (!trimmed.startsWith("<!--") || !trimmed.endsWith("-->")) return null;
  const inner = trimmed.slice(4, -3).trim();
  if (!inner.startsWith("@block")) return null;
  const rest = inner.slice("@block".length).trim();
  if (!rest) return null;

  const meta: Record<string, unknown> = {};
  let id: string | null = null;

  for (const { key, value } of readKeyValuePairs(rest)) {
    if (key === "id") id = value;
    else meta[key] = coerceScalar(value);
  }

  if (!id) return null;
  return Object.keys(meta).length ? { id, meta } : { id };
}

export function formatBlockAnnotationLine(id: string, meta?: Record<string, unknown>): string {
  const parts: string[] = [`id=${quoteIfNeeded(id)}`];
  if (meta) {
    for (const [k, v] of Object.entries(meta)) {
      if (v === undefined) continue;
      parts.push(`${k}=${quoteIfNeeded(valueToString(v))}`);
    }
  }
  return `<!-- @block ${parts.join(" ")} -->`;
}

function* readKeyValuePairs(input: string): Generator<{ key: string; value: string }> {
  const re = /([a-zA-Z_][a-zA-Z0-9_-]*)=("[^"]*"|'[^']*'|[^\s]+)/g;
  for (const m of input.matchAll(re)) {
    const key = m[1];
    let value = m[2];
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    yield { key, value };
  }
}

function coerceScalar(v: string): unknown {
  if (v === "true") return true;
  if (v === "false") return false;
  if (/^-?\d+(\.\d+)?$/.test(v)) return Number(v);
  if (v === "null") return null;
  return v;
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
    return String(v);
  }
}

