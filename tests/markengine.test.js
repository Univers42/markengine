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
  assert.ok(Array.isArray(result.ast));
  assert.equal(result.ast.length, 6);

  const [heading, paragraph, blockquote, list, codeBlock, breakNode] =
    result.ast;
  assert.equal(heading.type, "heading");
  assert.equal(heading.level, 1);
  assert.equal(paragraph.type, "paragraph");
  assert.equal(blockquote.type, "blockquote");
  assert.equal(list.type, "unordered_list");
  assert.equal(codeBlock.type, "code_block");
  assert.equal(breakNode.type, "thematic_break");
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
  const nodes = parseInlines("See [docs](https://example.com) and `code`.");

  assert.equal(nodes.length, 5);
  assert.equal(nodes[0].type, "text");
  assert.equal(nodes[1].type, "link");
  assert.equal(nodes[1].href, "https://example.com");
  assert.equal(nodes[2].type, "text");
  assert.equal(nodes[3].type, "code");
  assert.equal(nodes[3].value, "code");
  assert.equal(nodes[4].type, "text");
});

test("supports incremental reparsing", () => {
  const previousText = "# Title\n\nA *fast* **AST** engine.";
  const previousResult = parseMarkdown(previousText, { documentVersion: 1 });

  const next = incrementalParse(previousText, previousResult, {
    fromLine: 2,
    toLine: 2,
    text: "A *very fast* **AST** engine.",
  });

  assert.equal(next.ast.length, 2);
  assert.equal(next.changedNodeIds.length, 1);
  assert.ok(next.changedNodeIds[0]);
  assert.match(renderHtml(next.ast), /very fast/);
});
