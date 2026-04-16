import type { InlineNode } from "../ast";

export const INLINE_CODE_STYLE =
  "background-color:var(--inline-code-background,var(--color-surface-tertiary-soft2));border:1px solid var(--color-line);border-radius:6px;padding:0 0.35em;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:0.92em;color:var(--inline-code-color,currentColor);text-decoration-color:var(--inline-code-decoration-color,currentColor);--inline-background-fill:transparent;--inline-background-padding:0;--inline-background-radius:0;";

export function unwrapCodeRichStyles(nodes: InlineNode[]) {
  let currentNodes = nodes;
  let textColor: string | null = null;
  let backgroundColor: string | null = null;

  while (currentNodes.length === 1) {
    const [node] = currentNodes;
    if (node.type === "text_color") {
      textColor = node.color;
      currentNodes = node.children;
      continue;
    }
    if (node.type === "background_color") {
      backgroundColor = node.color;
      currentNodes = node.children;
      continue;
    }
    break;
  }

  return { nodes: currentNodes, textColor, backgroundColor };
}

export function shouldSuppressInlineBackground(nodes: InlineNode[]): boolean {
  if (nodes.length !== 1) {
    return false;
  }

  const [node] = nodes;
  switch (node.type) {
    case "code":
    case "code_rich":
      return true;
    case "bold":
    case "italic":
    case "bold_italic":
    case "strikethrough":
    case "underline":
    case "highlight":
    case "text_color":
    case "background_color":
      return shouldSuppressInlineBackground(node.children);
    default:
      return false;
  }
}
