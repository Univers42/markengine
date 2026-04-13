# Markdown Engine

A compact Markdown engine built around a canonical `src/` implementation.

## What it provides

- Markdown parsing into a typed AST
- Semantic HTML rendering
- Incremental reparsing from line-range patches
- Diagnostics for malformed or out-of-bounds input

## Public API

The main entry point is [markdown.ts](markdown.ts).

Typical usage:

```ts
import {
  compileMarkdownToHtml,
  incrementalParse,
  parseMarkdown,
  renderHtml,
} from "./markdown";

const parsed = parseMarkdown("# Title\n\nA *fast* engine.", {
  documentVersion: 1,
});

const html = renderHtml(parsed.ast);
const compiled = compileMarkdownToHtml("# Title\n\nA *fast* engine.");

const next = incrementalParse("# Title\n\nA *fast* engine.", parsed, {
  fromLine: 2,
  toLine: 2,
  text: "A *very fast* engine.",
});
```

## Architecture notes

- [src/block-parser.ts](src/block-parser.ts) handles block structure.
- [src/inline-parser.ts](src/inline-parser.ts) handles inline syntax.
- [src/renderer.ts](src/renderer.ts) converts the AST to HTML.
- [src/incremental.ts](src/incremental.ts) applies patches and reports changed nodes.

For a deeper architecture overview, see [docs/Markdown_engine.md](docs/Markdown_engine.md).
