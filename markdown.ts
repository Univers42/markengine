import type { BlockType } from '../../types/database';

// ─── Block Detection ──────────────────────────────────────────────────────────
// Mirrors: TermWriter::_parse_line() prefix dispatch
// Returns the detected block type and the cleaned content (prefix stripped),
// or null if no markdown prefix is detected.

export interface BlockDetection {
  type: BlockType;
  content: string;
  checked?: boolean;
}

/** Helpers ported from writer.cpp static methods */
function ltrim(s: string): string {
  let i = 0;
  while (i < s.length && s[i] === ' ') i++;
  return s.substring(i);
}

function startsWith(s: string, prefix: string): boolean {
  return s.startsWith(prefix);
}

function stripPrefix(s: string, n: number): string {
  let i = n;
  while (i < s.length && s[i] === ' ') i++;
  return s.substring(i);
}

function isRepeated(s: string, c: string): boolean {
  if (s.length === 0) return false;
  for (let i = 0; i < s.length; i++) {
    if (s[i] !== c) return false;
  }
  return true;
}

function isOrdered(s: string): { num: number; rest: string } | null {
  let i = 0;
  while (i < s.length && s[i] >= '0' && s[i] <= '9') i++;
  if (i === 0 || i >= s.length) return null;
  if (s[i] !== '.') return null;
  const num = parseInt(s.substring(0, i), 10);
  const rest = stripPrefix(s, i + 1);
  return { num, rest };
}

/**
 * Detect block type from a line of text.
 * Mirrors the prefix dispatch from TermWriter::_parse_line()
 *
 * Call this on `onInput` to auto-convert markdown shortcuts:
 *   - User types "## Hello" → returns { type: 'heading_2', content: 'Hello' }
 *   - User types "- item"   → returns { type: 'bulleted_list', content: 'item' }
 *   - User types "1. first" → returns { type: 'numbered_list', content: 'first' }
 *   - User types "[] task"  → returns { type: 'to_do', content: 'task', checked: false }
 *   - User types "[x] done" → returns { type: 'to_do', content: 'done', checked: true }
 *   - User types "> quote"  → returns { type: 'quote', content: 'quote' }
 *   - User types "---"      → returns { type: 'divider', content: '' }
 *   - User types "```"      → returns { type: 'code', content: '' }
 *   - User types "> "       → returns { type: 'toggle', content: '' }  (toggle via >)
 */
export function detectBlockType(text: string): BlockDetection | null {
  const line = ltrim(text);

  // ── Divider: --- (3+ dashes)
  if (line.length >= 3 && isRepeated(line, '-')) {
    return { type: 'divider', content: '' };
  }

  // ── Code block: ``` (triple backtick)
  if (line === '```' || startsWith(line, '```')) {
    const lang = line.length > 3 ? line.substring(3).trim() : '';
    return { type: 'code', content: '', ...(lang ? {} : {}) };
  }

  // ── Headings: # ## ### ####
  // Checked in reverse specificity order (most specific first)
  if (startsWith(line, '#### ')) {
    return { type: 'heading_4', content: stripPrefix(line, 5) };
  }
  if (startsWith(line, '### ')) {
    return { type: 'heading_3', content: stripPrefix(line, 4) };
  }
  if (startsWith(line, '## ')) {
    return { type: 'heading_2', content: stripPrefix(line, 3) };
  }
  if (startsWith(line, '# ')) {
    return { type: 'heading_1', content: stripPrefix(line, 2) };
  }

  // ── To-do list: [] or [x] (Notion-style)
  if (startsWith(line, '[] ') || startsWith(line, '[ ] ')) {
    const prefixLen = line.startsWith('[] ') ? 3 : 4;
    return { type: 'to_do', content: stripPrefix(line, prefixLen), checked: false };
  }
  if (startsWith(line, '[x] ') || startsWith(line, '[X] ')) {
    return { type: 'to_do', content: stripPrefix(line, 4), checked: true };
  }

  // ── Blockquote: > text  (writer.cpp: "> ")
  if (startsWith(line, '" ')) {
    return { type: 'quote', content: stripPrefix(line, 2) };
  }
  if (startsWith(line, '> ') && !startsWith(line, '>![')) {
    // Distinguish toggle "> " (empty after) vs quote "> text"
    const rest = stripPrefix(line, 2);
    return { type: 'quote', content: rest };
  }

  // ── Bulleted list: - item  (writer.cpp: "- ")
  if (startsWith(line, '- ')) {
    return { type: 'bulleted_list', content: stripPrefix(line, 2) };
  }

  // ── Numbered list: N. item  (writer.cpp: _is_ordered)
  const orderedResult = isOrdered(line);
  if (orderedResult) {
    return { type: 'numbered_list', content: orderedResult.rest };
  }

  // ── Callout: >![type] label  (writer.cpp callout open)
  if (startsWith(line, '>![')) {
    const close = line.indexOf(']', 3);
    if (close !== -1) {
      const label = stripPrefix(line, close + 1);
      return { type: 'callout', content: label || '' };
    }
  }

  return null;
}

// ─── Inline Markdown Formatting ───────────────────────────────────────────────
// Mirrors: TermWriter inline style detection (**bold**, *italic*, etc.)
// Converts markdown inline syntax to HTML for contentEditable rendering.

/**
 * Parse inline markdown formatting and return HTML.
 * Handles: **bold**, *italic*, ~~strikethrough~~, `code`, __underline__
 *
 * This mirrors the inline detection from TermWriter::_parse_line() but
 * outputs HTML spans instead of ANSI escape sequences.
 */
export function parseInlineMarkdown(text: string): string {
  let result = text;

  // ── Code: `text` → <code>text</code>
  result = result.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');

  // ── Bold: **text** → <strong>text</strong>
  result = result.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

  // ── Italic: *text* → <em>text</em>
  result = result.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em>$1</em>');

  // ── Strikethrough: ~~text~~ → <del>text</del>
  result = result.replace(/~~([^~]+)~~/g, '<del>$1</del>');

  // ── Underline: __text__ → <u>text</u>
  result = result.replace(/__([^_]+)__/g, '<u>$1</u>');

  return result;
}

// ─── Markdown to Blocks ───────────────────────────────────────────────────────
// Multi-line parser: converts a full markdown string into an array of blocks.
// Mirrors TermWriter::parse() which iterates line-by-line via _parse_line().

import type { Block } from '../types/database';

export function parseMarkdownToBlocks(markdown: string): Block[] {
  const lines = markdown.split('\n');
  const blocks: Block[] = [];
  let inCodeBlock = false;
  let codeContent = '';
  let codeLang = '';

  for (const raw of lines) {
    // ── Fenced code block handling
    if (raw.trimStart().startsWith('```')) {
      if (inCodeBlock) {
        // Closing fence
        blocks.push({
          id: crypto.randomUUID(),
          type: 'code',
          content: codeContent,
          language: codeLang || 'plaintext',
        });
        inCodeBlock = false;
        codeContent = '';
        codeLang = '';
      } else {
        // Opening fence
        inCodeBlock = true;
        codeLang = raw.trimStart().substring(3).trim();
      }
      continue;
    }

    if (inCodeBlock) {
      codeContent += (codeContent ? '\n' : '') + raw;
      continue;
    }

    // ── Normal line — run through detector
    const detection = detectBlockType(raw);
    if (detection) {
      blocks.push({
        id: crypto.randomUUID(),
        type: detection.type,
        content: detection.content,
        ...(detection.checked !== undefined ? { checked: detection.checked } : {}),
      });
    } else if (raw.trim() === '') {
      // Skip empty lines (they don't create blocks)
    } else {
      // Plain paragraph
      blocks.push({
        id: crypto.randomUUID(),
        type: 'paragraph',
        content: raw.trim(),
      });
    }
  }

  // If we ended inside an unclosed code block, flush it
  if (inCodeBlock && codeContent) {
    blocks.push({
      id: crypto.randomUUID(),
      type: 'code',
      content: codeContent,
      language: codeLang || 'plaintext',
    });
  }

  return blocks;
}

// ─── Shortcut Map (for display in SlashCommandMenu) ───────────────────────────

export const BLOCK_SHORTCUTS: Record<string, string> = {
  heading_1: '# ',
  heading_2: '## ',
  heading_3: '### ',
  heading_4: '#### ',
  bulleted_list: '- ',
  numbered_list: '1. ',
  to_do: '[] ',
  quote: '" ',
  toggle: '> ',
  code: '```',
  divider: '---',
};
