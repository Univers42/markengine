/* ************************************************************************** */
/*                                                                            */
/*                                                        :::      ::::::::   */
/*   inlineEditorDom.ts                                 :+:      :+:    :+:   */
/*                                                    +:+ +:+         +:+     */
/*   By: rstancu <rstancu@student.42madrid.com>     +#+  +:+       +#+        */
/*                                                +#+#+#+#+#+   +#+           */
/*   Created: 2026/04/16 22:23:33 by rstancu           #+#    #+#             */
/*   Updated: 2026/04/16 22:23:34 by rstancu          ###   ########.fr       */
/*                                                                            */
/* ************************************************************************** */

import type { InlineNode } from "./markdown/index";
import { normalizeInlineNodes, serializeInlineNodes } from "./inlineAst";
import { normalizeInlineColorToken } from "./inlineTextStyles";

const INLINE_SOURCE_NORMALIZATION_PATTERN = /[[\]_*~`:$!<\\=]/;

interface DomReadResult {
  nodes: InlineNode[];
  requiresNormalization: boolean;
  hasElementNodes: boolean;
}

interface ElementFormattingState {
  bold: boolean;
  italic: boolean;
  strikethrough: boolean;
  underline: boolean;
  highlight: boolean;
  textColor: string | null;
  backgroundColor: string | null;
  linkHref: string | null;
  linkTitle: string | null;
  code: boolean;
  codeTextColor: string | null;
  codeBackgroundColor: string | null;
}

export interface InlineEditorDomState {
  nodes: InlineNode[];
  source: string;
  requiresNormalization: boolean;
}

/**
 * Reads the current `contentEditable` DOM and converts it into markengine inline AST.
 * The DOM stays as an implementation detail of the editor while the serialized source
 * and normalization decisions come from the AST model.
 */
export function readInlineEditorDomState(
  root: HTMLElement,
): InlineEditorDomState {
  const result = readDomChildNodes(Array.from(root.childNodes));
  const nodes = normalizeInlineNodes(result.nodes);
  const source = serializeInlineNodes(nodes);

  return {
    nodes,
    source,
    requiresNormalization:
      result.requiresNormalization ||
      (!result.hasElementNodes &&
        INLINE_SOURCE_NORMALIZATION_PATTERN.test(source)),
  };
}

function readDomChildNodes(childNodes: Node[]): DomReadResult {
  const nodes: InlineNode[] = [];
  let requiresNormalization = false;
  let hasElementNodes = false;

  for (const childNode of childNodes) {
    const childResult = readDomNode(childNode);
    nodes.push(...childResult.nodes);
    requiresNormalization ||= childResult.requiresNormalization;
    hasElementNodes ||= childResult.hasElementNodes;
  }

  return {
    nodes,
    requiresNormalization,
    hasElementNodes,
  };
}

function readDomNode(node: Node): DomReadResult {
  if (node.nodeType === Node.TEXT_NODE) {
    return readTextNode(node);
  }

  if (node.nodeType !== Node.ELEMENT_NODE) {
    return {
      nodes: [],
      requiresNormalization: false,
      hasElementNodes: false,
    };
  }

  return readElementNode(node as HTMLElement);
}

function readTextNode(node: Node): DomReadResult {
  const value = node.textContent ?? "";
  return value
    ? {
        nodes: [{ type: "text", value }],
        requiresNormalization: false,
        hasElementNodes: false,
      }
    : {
        nodes: [],
        requiresNormalization: false,
        hasElementNodes: false,
      };
}

function readElementNode(element: HTMLElement): DomReadResult {
  if (element.tagName === "BR") {
    return {
      nodes: [{ type: "line_break" }],
      requiresNormalization: false,
      hasElementNodes: true,
    };
  }

  if (element.tagName === "IMG") {
    return readImageElement(element);
  }

  const childResult = readDomChildNodes(Array.from(element.childNodes));
  if (isBlockContainerElement(element)) {
    return {
      nodes: childResult.nodes,
      requiresNormalization: true,
      hasElementNodes: true,
    };
  }

  const formatting = getElementFormattingState(element);
  const nodes = applyElementFormatting(childResult.nodes, formatting);

  return {
    nodes,
    requiresNormalization:
      childResult.requiresNormalization ||
      !isCanonicalInlineElement(element, formatting),
    hasElementNodes: true,
  };
}

function readImageElement(element: HTMLElement): DomReadResult {
  const src = element.getAttribute("src");
  const alt = element.getAttribute("alt") ?? "";
  const title = element.getAttribute("title") ?? undefined;

  if (!src) {
    return {
      nodes: [],
      requiresNormalization: true,
      hasElementNodes: true,
    };
  }

  return {
    nodes: [{ type: "image", src, alt, title }],
    requiresNormalization: false,
    hasElementNodes: true,
  };
}

function applyElementFormatting(
  nodes: InlineNode[],
  formatting: ElementFormattingState,
): InlineNode[] {
  if (nodes.length === 0) {
    return nodes;
  }

  let currentNodes = nodes;

  if (formatting.linkHref) {
    currentNodes = [
      {
        type: "link",
        href: formatting.linkHref,
        title: formatting.linkTitle ?? undefined,
        children: currentNodes,
      },
    ];
  }

  if (formatting.bold) {
    currentNodes = [{ type: "bold", children: currentNodes }];
  }

  if (formatting.italic) {
    currentNodes = [{ type: "italic", children: currentNodes }];
  }

  if (formatting.strikethrough) {
    currentNodes = [{ type: "strikethrough", children: currentNodes }];
  }

  if (formatting.underline) {
    currentNodes = [{ type: "underline", children: currentNodes }];
  }

  if (formatting.highlight) {
    currentNodes = [{ type: "highlight", children: currentNodes }];
  }

  if (formatting.textColor) {
    currentNodes = [
      {
        type: "text_color",
        color: formatting.textColor,
        children: currentNodes,
      },
    ];
  }

  if (formatting.backgroundColor) {
    currentNodes = [
      {
        type: "background_color",
        color: formatting.backgroundColor,
        children: currentNodes,
      },
    ];
  }

  if (formatting.code) {
    let codeChildren = currentNodes;

    if (formatting.codeTextColor) {
      codeChildren = [
        {
          type: "text_color",
          color: formatting.codeTextColor,
          children: codeChildren,
        },
      ];
    }

    if (formatting.codeBackgroundColor) {
      codeChildren = [
        {
          type: "background_color",
          color: formatting.codeBackgroundColor,
          children: codeChildren,
        },
      ];
    }

    currentNodes = [{ type: "code_rich", children: codeChildren }];
  }

  return currentNodes;
}

function getElementFormattingState(
  element: HTMLElement,
): ElementFormattingState {
  const code = isCodeElement(element);

  return {
    bold: isBoldElement(element),
    italic: isItalicElement(element),
    strikethrough: isStrikeElement(element),
    underline: isUnderlineElement(element),
    highlight: isHighlightElement(element),
    textColor: getTextColor(element),
    backgroundColor: getBackgroundColor(element),
    linkHref: getLinkHref(element),
    linkTitle: getLinkTitle(element),
    code,
    codeTextColor: code ? getCodeTextColor(element) : null,
    codeBackgroundColor: code ? getCodeBackgroundColor(element) : null,
  };
}

function isCanonicalInlineElement(
  element: HTMLElement,
  formatting: ElementFormattingState,
) {
  switch (element.tagName) {
    case "A":
      return Boolean(formatting.linkHref) && hasOnlyFormatting(formatting, ["link"]);
    case "STRONG":
      return hasOnlyFormatting(formatting, ["bold"]);
    case "EM":
      return hasOnlyFormatting(formatting, ["italic"]);
    case "DEL":
      return hasOnlyFormatting(formatting, ["strikethrough"]);
    case "U":
      return hasOnlyFormatting(formatting, ["underline"]);
    case "MARK":
      return hasOnlyFormatting(formatting, ["highlight"]);
    case "CODE":
      return (
        element.dataset.inlineType === "code" &&
        hasOnlyFormatting(formatting, ["code"])
      );
    case "SPAN":
      if (element.dataset.inlineType === "text_color" && formatting.textColor) {
        return hasOnlyFormatting(formatting, ["textColor"]);
      }

      if (
        element.dataset.inlineType === "background_color" &&
        formatting.backgroundColor
      ) {
        return hasOnlyFormatting(formatting, ["backgroundColor"]);
      }

      return false;
    default:
      return false;
  }
}

function hasOnlyFormatting(
  formatting: ElementFormattingState,
  allowedKinds: ReadonlyArray<FormattingKind>,
) {
  return getActiveFormattingKinds(formatting).every((kind) =>
    allowedKinds.includes(kind),
  );
}

type FormattingKind =
  | "bold"
  | "italic"
  | "strikethrough"
  | "underline"
  | "highlight"
  | "textColor"
  | "backgroundColor"
  | "link"
  | "code";

function getActiveFormattingKinds(formatting: ElementFormattingState) {
  const activeKinds: FormattingKind[] = [];

  if (formatting.bold) {
    activeKinds.push("bold");
  }

  if (formatting.italic) {
    activeKinds.push("italic");
  }

  if (formatting.strikethrough) {
    activeKinds.push("strikethrough");
  }

  if (formatting.underline) {
    activeKinds.push("underline");
  }

  if (formatting.highlight) {
    activeKinds.push("highlight");
  }

  if (formatting.textColor) {
    activeKinds.push("textColor");
  }

  if (formatting.backgroundColor) {
    activeKinds.push("backgroundColor");
  }

  if (formatting.linkHref) {
    activeKinds.push("link");
  }

  if (formatting.code) {
    activeKinds.push("code");
  }

  return activeKinds;
}

function isBlockContainerElement(element: HTMLElement) {
  return element.tagName === "DIV" || element.tagName === "P";
}

function isBoldElement(element: HTMLElement) {
  if (element.dataset.inlineType === "bold") {
    return true;
  }

  if (element.tagName === "STRONG" || element.tagName === "B") {
    return true;
  }

  const fontWeight = element.style.fontWeight;
  return fontWeight === "bold" || Number(fontWeight) >= 600;
}

function isItalicElement(element: HTMLElement) {
  return (
    element.dataset.inlineType === "italic" ||
    element.tagName === "EM" ||
    element.tagName === "I" ||
    element.style.fontStyle === "italic"
  );
}

function isStrikeElement(element: HTMLElement) {
  return (
    element.dataset.inlineType === "strikethrough" ||
    element.tagName === "DEL" ||
    element.tagName === "S" ||
    element.tagName === "STRIKE" ||
    element.style.textDecoration.includes("line-through")
  );
}

function isUnderlineElement(element: HTMLElement) {
  return (
    element.dataset.inlineType === "underline" ||
    element.tagName === "U" ||
    element.style.textDecoration.includes("underline")
  );
}

function isHighlightElement(element: HTMLElement) {
  return element.dataset.inlineType === "highlight" || element.tagName === "MARK";
}

function isCodeElement(element: HTMLElement) {
  return element.dataset.inlineType === "code" || element.tagName === "CODE";
}

function getLinkHref(element: HTMLElement) {
  if (element.tagName !== "A") {
    return null;
  }

  const href = element.getAttribute("href");
  return href?.trim() ? href : null;
}

function getLinkTitle(element: HTMLElement) {
  if (element.tagName !== "A") {
    return null;
  }

  const title = element.getAttribute("title");
  return title?.trim() ? title : null;
}

function getTextColor(element: HTMLElement) {
  return (
    normalizeDomColorToken(element.dataset.inlineColor) ??
    normalizeDomColorToken(element.style.color) ??
    normalizeDomColorToken(element.getAttribute("color"))
  );
}

function getBackgroundColor(element: HTMLElement) {
  return (
    normalizeDomColorToken(element.dataset.inlineColor) ??
    normalizeDomColorToken(element.style.backgroundColor)
  );
}

function getCodeTextColor(element: HTMLElement) {
  return normalizeDomColorToken(
    element.style.getPropertyValue("--inline-code-color"),
  );
}

function getCodeBackgroundColor(element: HTMLElement) {
  return normalizeDomColorToken(
    stripHexAlphaSuffix(
      element.style.getPropertyValue("--inline-code-background"),
    ),
  );
}

function normalizeDomColorToken(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  return normalizeInlineColorToken(value.trim());
}

function stripHexAlphaSuffix(value: string) {
  const normalized = value.trim();
  const match = normalized.match(/^#([0-9a-fA-F]{6})[0-9a-fA-F]{2}$/);
  return match ? `#${match[1]}` : normalized;
}
