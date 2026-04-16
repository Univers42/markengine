import type { InlineNode } from "../ast";
import {
  INLINE_CODE_STYLE,
  shouldSuppressInlineBackground,
  unwrapCodeRichStyles,
} from "./inlineStyleHelpers";

export function renderInlineNodesToHtml(nodes: InlineNode[]): string {
  return nodes
    .map((node) => {
      switch (node.type) {
        case "text":
          return esc(node.value);
        case "bold":
          return `<strong>${renderInlineNodesToHtml(node.children)}</strong>`;
        case "italic":
          return `<em style="font-style:italic">${renderInlineNodesToHtml(node.children)}</em>`;
        case "bold_italic":
          return `<strong><em style="font-style:italic">${renderInlineNodesToHtml(node.children)}</em></strong>`;
        case "strikethrough":
          return `<del style="text-decoration-color:currentColor">${renderInlineNodesToHtml(node.children)}</del>`;
        case "underline":
          return `<u>${renderInlineNodesToHtml(node.children)}</u>`;
        case "text_color":
          return `<span data-inline-type="text_color" data-inline-color="${esc(node.color)}" style="color:${esc(node.color)};text-decoration-color:${esc(node.color)};--inline-code-color:${esc(node.color)};--inline-code-decoration-color:${esc(node.color)}">${renderInlineNodesToHtml(node.children)}</span>`;
        case "background_color":
          return `<span data-inline-type="background_color" data-inline-color="${esc(node.color)}" style="background-color:var(--inline-background-fill,${esc(node.color)}33);border-radius:var(--inline-background-radius,4px);padding:var(--inline-background-padding,0 0.2em);--inline-code-background:${esc(node.color)}33;${shouldSuppressInlineBackground(node.children) ? "--inline-background-fill:transparent;--inline-background-padding:0;--inline-background-radius:0;" : ""}">${renderInlineNodesToHtml(node.children)}</span>`;
        case "code_rich": {
          const {
            nodes: codeChildren,
            textColor,
            backgroundColor,
          } = unwrapCodeRichStyles(node.children);
          const style = [
            INLINE_CODE_STYLE,
            textColor
              ? `--inline-code-color:${esc(textColor)};--inline-code-decoration-color:${esc(textColor)};`
              : "",
            backgroundColor
              ? `--inline-code-background:${esc(backgroundColor)}33;`
              : "",
          ].join("");
          return `<code class="inline-code" data-inline-type="code" style="${style}">${renderInlineNodesToHtml(codeChildren)}</code>`;
        }
        case "code":
          return `<code class="inline-code" data-inline-type="code" style="${INLINE_CODE_STYLE}">${esc(node.value)}</code>`;
        case "link":
          return `<a href="${esc(node.href)}">${renderInlineNodesToHtml(node.children)}</a>`;
        case "image":
          return `<img src="${esc(node.src)}" alt="${esc(node.alt)}" />`;
        case "highlight":
          return `<mark>${renderInlineNodesToHtml(node.children)}</mark>`;
        case "math_inline":
          return `<span class="math-inline">${esc(node.value)}</span>`;
        case "emoji":
          return node.value;
        case "line_break":
          return "<br />";
        case "footnote_ref":
          return `<sup>[${esc(node.label)}]</sup>`;
        default:
          return "";
      }
    })
    .join("");
}

function esc(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
