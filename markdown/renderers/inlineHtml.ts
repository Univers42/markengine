import type { InlineNode } from "../ast";
import {
  getInlineBackgroundCss,
  getInlineCodeCss,
  getInlineTextColorCss,
  shouldSuppressInlineBackground,
  unwrapCodeRichStyles,
} from "./inlineStyleHelpers";

export interface InlineHtmlOptions {
  resolveInternalLinkTitle?: (pageId: string) => { title: string; icon?: string } | null;
}

export function renderInlineNodesToHtml(nodes: InlineNode[], options: InlineHtmlOptions = {}): string {
  return nodes
    .map((node) => {
      switch (node.type) {
        case "text":
          return esc(node.value);
        case "bold":
          return `<strong>${renderInlineNodesToHtml(node.children, options)}</strong>`;
        case "italic":
          return `<em style="font-style:italic">${renderInlineNodesToHtml(node.children, options)}</em>`;
        case "bold_italic":
          return `<strong><em style="font-style:italic">${renderInlineNodesToHtml(node.children, options)}</em></strong>`;
        case "strikethrough":
          return `<del style="text-decoration-color:currentColor">${renderInlineNodesToHtml(node.children, options)}</del>`;
        case "underline":
          return `<u>${renderInlineNodesToHtml(node.children, options)}</u>`;
        case "text_color":
          return `<span data-inline-type="text_color" data-inline-color="${esc(node.color)}" style="${getInlineTextColorCss(node.color)}">${renderInlineNodesToHtml(node.children, options)}</span>`;
        case "background_color":
          return `<span data-inline-type="background_color" data-inline-color="${esc(node.color)}" style="${getInlineBackgroundCss(node.color, shouldSuppressInlineBackground(node.children))}">${renderInlineNodesToHtml(node.children, options)}</span>`;
        case "code_rich": {
          const {
            nodes: codeChildren,
            textColor,
            backgroundColor,
          } = unwrapCodeRichStyles(node.children);
          const style = getInlineCodeCss(textColor, backgroundColor);
          return `<code class="inline-code" data-inline-type="code" style="${style}">${renderInlineNodesToHtml(codeChildren, options)}</code>`;
        }
        case "code":
          return `<code class="inline-code" data-inline-type="code" style="${getInlineCodeCss()}">${esc(node.value)}</code>`;
        case "link":
          return `<a 
            href="${esc(node.href)}" 
            target="_blank" 
            rel="noopener noreferrer"
            style="color:var(--color-accent);cursor:pointer;text-decoration:underline;text-underline-offset:0.14em"
          >${renderInlineNodesToHtml(node.children, options)}</a>\u200B`;
        case "internal_link": {
          const resolved = options.resolveInternalLinkTitle?.(node.pageId);
          const title = resolved?.title || node.pageId;
          const icon = resolved?.icon ? `<span style="margin-right:4px">${resolved.icon}</span>` : "";
          
          return `<span 
            class="page-mention-placeholder" 
            data-page-id="${esc(node.pageId)}"
            style="color:var(--color-accent);text-decoration:none;background:var(--color-surface-tertiary);padding:0 4px;border-radius:4px;font-weight:500;cursor:pointer;display:inline-flex;align-items:center;white-space:nowrap"
            contenteditable="false"
          >${icon}${esc(title)}</span>`;
        }
        case "image":
          return `<img src="${esc(node.src)}" alt="${esc(node.alt)}" />`;
        case "highlight":
          return `<mark>${renderInlineNodesToHtml(node.children, options)}</mark>`;
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
