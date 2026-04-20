import type { InlineNode } from "../ast";
import {
  getInlineBackgroundCss,
  getInlineCodeCss,
  getInlineTextColorCss,
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
          return `<span data-inline-type="text_color" data-inline-color="${esc(node.color)}" style="${getInlineTextColorCss(node.color)}">${renderInlineNodesToHtml(node.children)}</span>`;
        case "background_color":
          return `<span data-inline-type="background_color" data-inline-color="${esc(node.color)}" style="${getInlineBackgroundCss(node.color, shouldSuppressInlineBackground(node.children))}">${renderInlineNodesToHtml(node.children)}</span>`;
        case "code_rich": {
          const {
            nodes: codeChildren,
            textColor,
            backgroundColor,
          } = unwrapCodeRichStyles(node.children);
          const style = getInlineCodeCss(textColor, backgroundColor);
          return `<code class="inline-code" data-inline-type="code" style="${style}">${renderInlineNodesToHtml(codeChildren)}</code>`;
        }
        case "code":
          return `<code class="inline-code" data-inline-type="code" style="${getInlineCodeCss()}">${esc(node.value)}</code>`;
        case "link":
          return `<a href="${esc(node.href)}">${renderInlineNodesToHtml(node.children)}</a>`;
        case "internal_link":
          return `<span class="page-mention-placeholder" style="color:var(--color-primary);text-decoration:underline">[[ ${esc(node.pageId)} ]]</span>`;
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
