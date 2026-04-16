// Markdown shortcuts — inline parsing and block conversion
import type { BlockType, Block } from '@/entities/block';
import type { InlineNode } from './ast';
import { renderInlineNodesToHtml } from './renderers/inlineHtml';
import { parse, parseInline } from './parser';

export type { BlockDetection } from './shortcutsDetect';
export { BLOCK_SHORTCUTS, detectBlockType } from './shortcutsDetect';

export function parseInlineMarkdown(text: string): string {
  // Use the full parser's inline engine → convert to HTML
  const nodes = parseInline(text);
  return renderInlineNodesToHtml(nodes);
}

/**
 * Convert a full markdown string into an array of Notion-style blocks.
 * Uses the full AST parser, then maps to Block types.
 */
export function parseMarkdownToBlocks(markdown: string): Block[] {
  const ast = parse(markdown);
  return ast.flatMap(node => astToBlocks(node));
}

function astToBlocks(node: import('./ast').BlockNode): Block[] {
  switch (node.type) {
    case 'heading': {
      const level = Math.min(node.level, 4);
      const headingType = `heading_${level}` as BlockType;
      return [{ id: crypto.randomUUID(), type: headingType, content: inlineToPlain(node.children) }];
    }
    case 'paragraph':
      return [{ id: crypto.randomUUID(), type: 'paragraph', content: inlineToPlain(node.children) }];
    case 'thematic_break':
      return [{ id: crypto.randomUUID(), type: 'divider', content: '' }];
    case 'blockquote':
      return [{ id: crypto.randomUUID(), type: 'quote', content: node.children.map(c => blockToPlain(c)).join('\n') }];
    case 'code_block':
      return [{ id: crypto.randomUUID(), type: 'code', content: node.value, language: node.lang || 'plaintext' }];
    case 'unordered_list':
      return node.children.map(item => ({
        id: crypto.randomUUID(),
        type: 'bulleted_list' as BlockType,
        content: item.children.map(c => blockToPlain(c)).join('\n'),
      }));
    case 'ordered_list':
      return node.children.map(item => ({
        id: crypto.randomUUID(),
        type: 'numbered_list' as BlockType,
        content: item.children.map(c => blockToPlain(c)).join('\n'),
      }));
    case 'task_list':
      return node.children.map(item => ({
        id: crypto.randomUUID(),
        type: 'to_do' as BlockType,
        content: item.children.map(c => blockToPlain(c)).join('\n'),
        checked: item.checked,
      }));
    case 'callout':
      return [{
        id: crypto.randomUUID(),
        type: 'callout' as BlockType,
        content: node.children.map(c => blockToPlain(c)).join('\n'),
      }];
    case 'table':
      return [{ id: crypto.randomUUID(), type: 'paragraph', content: '[table]' }];
    default:
      return [];
  }
}

function inlineToPlain(nodes: InlineNode[]): string {
  return nodes.map(n => {
    switch (n.type) {
      case 'text': return n.value;
      case 'bold': case 'italic': case 'bold_italic': case 'strikethrough':
      case 'underline': case 'highlight': case 'text_color': case 'background_color': case 'code_rich':
        return inlineToPlain(n.children);
      case 'code': return n.value;
      case 'link': return inlineToPlain(n.children);
      case 'image': return n.alt;
      case 'emoji': return n.value;
      case 'line_break': return '\n';
      case 'math_inline': return n.value;
      case 'footnote_ref': return `[${n.label}]`;
      default: return '';
    }
  }).join('');
}

function blockToPlain(node: import('./ast').BlockNode): string {
  switch (node.type) {
    case 'paragraph': return inlineToPlain(node.children);
    case 'heading': return inlineToPlain(node.children);
    default: return '';
  }
}
