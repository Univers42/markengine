const test = require("node:test");
const assert = require("node:assert/strict");

const {
  compileMarkdownToHtml,
  incrementalParse,
  parseInlines,
  parseMarkdown,
  renderHtml,
} = require("../dist/markdown.js");

test("parses blocks into an AST", () => {
  const source = [
    "# Title",
    "",
    "A *fast* **AST** engine.",
    "",
    "> quoted line",
    "",
    "- one",
    "- two",
    "",
    "```ts",
    'console.log("x");',
    "```",
    "",
    "---",
  ].join("\n");

  const result = parseMarkdown(source, { documentVersion: 1 });
  assert.equal(result.ast.kind, "document");
  assert.equal(result.ast.children.length, 6);

  const [heading, paragraph, blockquote, list, codeBlock, breakNode] =
    result.ast.children;
  assert.equal(heading.kind, "heading");
  assert.equal(heading.depth, 1);
  assert.equal(paragraph.kind, "paragraph");
  assert.equal(blockquote.kind, "blockquote");
  assert.equal(list.kind, "list");
  assert.equal(codeBlock.kind, "code_block");
  assert.equal(breakNode.kind, "thematic_break");
});

test("renders semantic html for inline and block nodes", () => {
  const source = "# Title\n\nA *fast* **AST** engine.";
  const result = compileMarkdownToHtml(source);

  assert.match(result.html, /<h1[^>]*>Title<\/h1>/);
  assert.match(result.html, /<em[^>]*>fast<\/em>/);
  assert.match(result.html, /<strong[^>]*>AST<\/strong>/);
  assert.match(result.html, /<p[^>]*>A /);
});

test("parses inline links and code spans", () => {
  const nodes = parseInlines("See [docs](https://example.com) and `code`.", 0);

  assert.equal(nodes.length, 5);
  assert.equal(nodes[0].kind, "text");
  assert.equal(nodes[1].kind, "link");
  assert.equal(nodes[1].href, "https://example.com");
  assert.equal(nodes[2].kind, "text");
  assert.equal(nodes[3].kind, "code_span");
  assert.equal(nodes[3].value, "code");
  assert.equal(nodes[4].kind, "text");
});

test("supports incremental reparsing", () => {
  const previousText = "# Title\n\nA *fast* **AST** engine.";
  const previousResult = parseMarkdown(previousText, { documentVersion: 1 });

  const next = incrementalParse(previousText, previousResult, {
    fromLine: 2,
    toLine: 2,
    text: "A *very fast* **AST** engine.",
  });

  assert.equal(next.ast.children.length, 2);
  assert.equal(next.changedNodeIds.length, 1);
  assert.ok(next.changedNodeIds[0]);
  assert.match(renderHtml(next.ast), /very fast/);
});
