const test = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const esbuild = require("esbuild");

function loadModule(entryPoint) {
  const bundle = esbuild.buildSync({
    entryPoints: [entryPoint],
    bundle: true,
    platform: "node",
    format: "cjs",
    write: false,
    tsconfig: "tsconfig.json",
  });

  const module = { exports: {} };
  vm.runInNewContext(bundle.outputFiles[0].text, {
    module,
    exports: module.exports,
    require,
    console,
    process,
    Buffer,
    setTimeout,
    clearTimeout,
    queueMicrotask,
  });
  return module.exports;
}

const { applyInlineFormatting } = loadModule(
  "src/shared/lib/markengine/inlineFormatting.ts",
);
const { applyInlineTextEdit } = loadModule(
  "src/shared/lib/markengine/inlineTextEditing.ts",
);
const { parseInlineMarkdown } = loadModule(
  "src/shared/lib/markengine/shortcuts.ts",
);

function createSelection(start, end) {
  return { start, end };
}

test("supports mixed inline formats across a single line", () => {
  let source = "alpha beta gamma delta epsilon zeta";

  source = applyInlineFormatting(source, createSelection(0, 5), {
    type: "toggle_format",
    format: "bold",
  });
  source = applyInlineFormatting(source, createSelection(6, 10), {
    type: "toggle_format",
    format: "italic",
  });
  source = applyInlineFormatting(source, createSelection(11, 16), {
    type: "toggle_format",
    format: "strikethrough",
  });
  source = applyInlineFormatting(source, createSelection(17, 22), {
    type: "set_color",
    colorKind: "text",
    color: "#2563EB",
  });
  source = applyInlineFormatting(source, createSelection(23, 30), {
    type: "set_color",
    colorKind: "background",
    color: "#FACC15",
  });
  source = applyInlineFormatting(source, createSelection(17, 30), {
    type: "toggle_format",
    format: "code",
  });

  assert.equal(
    source,
    "[b]alpha[/b] [i]beta[/i] [s]gamma[/s] [code][color=#2563EB]delta[/color] [bg=#FACC15]epsilon[/bg][/code] zeta",
  );

  const html = parseInlineMarkdown(source);
  assert.match(html, /<strong>alpha<\/strong>/);
  assert.match(html, /<em style="font-style:italic">beta<\/em>/);
  assert.match(
    html,
    /<del style="text-decoration-color:currentColor">gamma<\/del>/,
  );
  assert.match(html, /data-inline-type="code"/);
  assert.match(html, /data-inline-type="text_color"/);
  assert.match(html, /data-inline-type="background_color"/);
});

test("replacing the same background color range keeps a single wrapper", () => {
  let source = "alpha beta gamma";

  source = applyInlineFormatting(source, createSelection(6, 16), {
    type: "set_color",
    colorKind: "background",
    color: "#F87171",
  });
  source = applyInlineFormatting(source, createSelection(6, 16), {
    type: "set_color",
    colorKind: "background",
    color: "#60A5FA",
  });

  assert.equal(source, "alpha [bg=#60A5FA]beta gamma[/bg]");
  assert.equal(source.includes("#F87171"), false);
});

test("partial background recolors only split the affected segment", () => {
  let source = "alpha beta gamma";

  source = applyInlineFormatting(source, createSelection(6, 16), {
    type: "set_color",
    colorKind: "background",
    color: "#60A5FA",
  });
  source = applyInlineFormatting(source, createSelection(11, 16), {
    type: "set_color",
    colorKind: "background",
    color: "#34D399",
  });

  assert.equal(source, "alpha [bg=#60A5FA]beta [/bg][bg=#34D399]gamma[/bg]");
});

test("background color excludes trailing whitespace from the wrapper", () => {
  const source = applyInlineFormatting("alpha beta ", createSelection(6, 11), {
    type: "set_color",
    colorKind: "background",
    color: "#FACC15",
  });

  assert.equal(source, "alpha [bg=#FACC15]beta[/bg] ");
});

test("background color HTML does not use inline padding that shifts wrapping", () => {
  const html = parseInlineMarkdown("[bg=#FACC15]wrapped text[/bg]");

  assert.match(html, /box-decoration-break:clone/);
  assert.match(html, /padding:var\(--inline-background-padding, 0\)/);
  assert.match(html, /-webkit-box-decoration-break:clone/);
  assert.equal(html.includes("0 0.2em"), false);
});

test("typing inside colored text preserves the active color wrapper", () => {
  const result = applyInlineTextEdit(
    "[color=#2563EB]delta[/color] zeta",
    createSelection(5, 5),
    {
      type: "insert_text",
      text: "X",
    },
  );

  assert.equal(result.source, "[color=#2563EB]deltaX[/color] zeta");
  assert.equal(result.selection.start, 6);
  assert.equal(result.selection.end, 6);
});

test("typing at the start of a colored span keeps the inserted text inside the span", () => {
  const result = applyInlineTextEdit(
    "alpha [color=#2563EB]delta[/color]",
    createSelection(6, 6),
    {
      type: "insert_text",
      text: "X",
    },
  );

  assert.equal(result.source, "alpha [color=#2563EB]Xdelta[/color]");
  assert.equal(result.selection.start, 7);
  assert.equal(result.selection.end, 7);
});

test("backspace removes text without discarding the surrounding formatting", () => {
  const result = applyInlineTextEdit(
    "[b][color=#2563EB]delta[/color][/b]",
    createSelection(5, 5),
    {
      type: "delete_backward",
    },
  );

  assert.equal(result.source, "[b][color=#2563EB]delt[/color][/b]");
  assert.equal(result.selection.start, 4);
  assert.equal(result.selection.end, 4);
});
