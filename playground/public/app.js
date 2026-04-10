const editor = document.querySelector("#editor");
const preview = document.querySelector("#preview");
const ast = document.querySelector("#ast");
const sampleButton = document.querySelector("#sample-button");
const clearButton = document.querySelector("#clear-button");

const HIGHLIGHT_JS_SRC =
  "https://cdn.jsdelivr.net/npm/highlight.js@11.11.1/lib/highlight.min.js";
const MERMAID_SRC =
  "https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js";

const scriptPromises = new Map();
let mermaidInitialized = false;
let renderRevision = 0;

const sample = `
markdown
# 1. Pruebas de Encabezados
# H1 Grande
## H2 Normal
### H3 Sutil
#### H4 Pequeño
##### H5 Muy pequeño
###### H6 Mínimo

# 2. Énfasis y Estilos de Texto
*Este texto es cursiva con asteriscos.*
_Este texto es cursiva con guiones bajos._

**Este texto es negrita con asteriscos.**
__Este texto es negrita con guiones bajos.__

***Negrita e Italica combinadas***
~~Texto tachado (GFM)~~

**Negrita con _cursiva interna_** y viceversa.

# 3. Listas (Anidamiento y Mezcla)
* Elemento 1
* Elemento 2
    * Sub-elemento indentado (4 espacios)
    * Otro sub-elemento
        1. Lista numerada interna
        2. Segundo ítem
* Elemento 3 con \`código embebido\`

1. Uno
2. Dos
    - Mezclando viñetas dentro de números
    - Otro más
3. Tres
- [x] Hacer la compra :warning: :check:
- [ ] Comerse la comida :smile:
- [X] Evacuar la comida :wave:

# 4. Enlaces e Imágenes
[Enlace simple a Google](https://google.com)
[Enlace con título](https://google.com "Buscador de Google")
Enlace directo: <https://github.com>

Imagen con Alt Text:
![Logo Markdown](https://markdown-here.com)

# 5. Bloques de Código (Code Blocks)
\`Código en línea (inline code)\` con caracteres raros: \`< > / \\ * _\`

\`\`\`python
# Bloque de código con resaltado de sintaxis
def hola_mundo():
    print("Hola, Markdown Engine!")
    return True
\`\`\`


> [!tip] tip

> [!note] note

> [!error] error

> [!tip] tip

> [!faq] faq

> [!todo] todo

> [!example] example


\`\`\`mermaid
graph TB
    Browser

    subgraph Compose["Docker Compose"]
        Nginx["nginx  ·  :80"]
        Frontend["React + Vite  ·  :5173"]
        Backend["NestJS  ·  :3000"]
        WS["WebSocket Gateway"]
        PG[("PostgreSQL  ·  :5432")]
        Redis[("Redis  ·  :6379")]
    end

    OAuth["42 OAuth 2.0"]

    Browser -->|"HTTP / WS"| Nginx
    Nginx --> Frontend
    Nginx --> Backend
    Backend --> WS
    Backend -->|"Prisma ORM"| PG
    Backend --> Redis
    Backend -->|"token exchange"| OAuth

    style Compose fill:#f8fafc,stroke:#cbd5e1,color:#1e293b
    style Frontend fill:#dbeafe,stroke:#3b82f6,color:#1e3a5f
    style Backend fill:#ede9fe,stroke:#7c3aed,color:#3b1f6e
    style WS fill:#ede9fe,stroke:#7c3aed,color:#3b1f6e
    style PG fill:#dcfce7,stroke:#22c55e,color:#14532d
    style Redis fill:#fecaca,stroke:#dc2626,color:#7f1d1d
    style Nginx fill:#fef3c7,stroke:#d97706,color:#78350f
    style OAuth fill:#fce7f3,stroke:#db2777,color:#831843
\`\`\`
`;

editor.value = sample;

async function render() {
  const currentRevision = ++renderRevision;
  const response = await fetch("/api/preview", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ markdown: editor.value }),
  });

  const data = await response.json();
  if (currentRevision !== renderRevision) {
    return;
  }

  if (!response.ok) {
    preview.innerHTML = `<pre class="error">${escapeHtml(data.error || "Preview failed")}</pre>`;
    ast.textContent = "";
    return;
  }

  preview.innerHTML = data.html;
  ast.textContent = JSON.stringify(data.ast, null, 2);

  await enhancePreview(preview);
}

async function enhancePreview(root) {
  await ensurePreviewLibraries();
  replaceMermaidBlocks(root);
  highlightCodeBlocks(root);
  await renderMermaidBlocks(root);
}

async function ensurePreviewLibraries() {
  const results = await Promise.allSettled([
    loadScriptOnce(HIGHLIGHT_JS_SRC),
    loadScriptOnce(MERMAID_SRC),
  ]);

  for (const result of results) {
    if (result.status === "rejected") {
      console.warn(result.reason);
    }
  }

  if (
    !mermaidInitialized &&
    globalThis.mermaid &&
    typeof globalThis.mermaid.initialize === "function"
  ) {
    globalThis.mermaid.initialize({
      startOnLoad: false,
      securityLevel: "strict",
      theme: "base",
    });
    mermaidInitialized = true;
  }
}

function loadScriptOnce(src) {
  if (scriptPromises.has(src)) {
    return scriptPromises.get(src);
  }

  const promise = new Promise((resolve, reject) => {
    const existing = document.querySelector(
      `script[data-preview-lib="${src}"]`,
    );
    if (existing) {
      existing.addEventListener("load", () => resolve(existing));
      existing.addEventListener("error", () =>
        reject(new Error(`Unable to load ${src}`)),
      );
      return;
    }

    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.crossOrigin = "anonymous";
    script.dataset.previewLib = src;
    script.addEventListener("load", () => resolve(script));
    script.addEventListener("error", () =>
      reject(new Error(`Unable to load ${src}`)),
    );
    document.head.append(script);
  });

  scriptPromises.set(src, promise);
  return promise;
}

function replaceMermaidBlocks(root) {
  const mermaidBlocks = root.querySelectorAll("pre > code.language-mermaid");

  for (const code of mermaidBlocks) {
    const pre = code.parentElement;
    if (!pre) {
      continue;
    }

    const mermaidBlock = document.createElement("div");
    mermaidBlock.className = "mermaid md-mermaid";
    mermaidBlock.textContent = code.textContent ? code.textContent.trim() : "";
    pre.replaceWith(mermaidBlock);
  }
}

function highlightCodeBlocks(root) {
  const hljs = globalThis.hljs;
  if (!hljs || typeof hljs.highlightElement !== "function") {
    return;
  }

  const codeBlocks = root.querySelectorAll('pre > code[class*="language-"]');
  for (const code of codeBlocks) {
    if (code.classList.contains("language-mermaid")) {
      continue;
    }

    hljs.highlightElement(code);
  }
}

async function renderMermaidBlocks(root) {
  const mermaid = globalThis.mermaid;
  if (!mermaid || typeof mermaid.run !== "function") {
    return;
  }

  const nodes = Array.from(root.querySelectorAll(".mermaid"));
  if (nodes.length === 0) {
    return;
  }

  try {
    await mermaid.run({ nodes });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Mermaid rendering failed";
    for (const node of nodes) {
      node.innerHTML = `<pre class="error">${escapeHtml(message)}</pre>`;
    }
  }
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

let timer = 0;
function scheduleRender() {
  globalThis.clearTimeout(timer);
  timer = globalThis.setTimeout(() => {
    render().catch((error) => {
      preview.innerHTML = `<pre class="error">${escapeHtml(error.message)}</pre>`;
    });
  }, 80);
}

function selectedLineRange(text, start, end) {
  const lineStart = text.lastIndexOf("\n", start - 1) + 1;
  const nextNewline = text.indexOf("\n", end);
  const lineEnd = nextNewline === -1 ? text.length : nextNewline;
  return { lineStart, lineEnd };
}

function getCurrentLineInfo() {
  const start = editor.selectionStart;
  const end = editor.selectionEnd;
  const text = editor.value;
  const { lineStart, lineEnd } = selectedLineRange(text, start, end);
  const line = text.slice(lineStart, lineEnd);
  return { start, end, text, lineStart, lineEnd, line };
}

function parseListLine(line) {
  const taskMatch = /^(\s*)([-*+]\s+)\[([ xX])\]\s+(.*)$/.exec(line);
  if (taskMatch) {
    const indent = taskMatch[1];
    const bullet = taskMatch[2];
    const content = taskMatch[4];
    return {
      indent,
      marker: `${bullet}[ ] `,
      content,
      isBlank: content.trim().length === 0,
      nextMarker: `${indent}${bullet}[ ] `,
      kind: "task",
    };
  }

  const match = /^(\s*)([-*+]\s+|\d+[.)]\s+)(.*)$/.exec(line);
  if (!match) return null;

  const indent = match[1];
  const marker = match[2];
  const content = match[3];
  const ordered = /\d+[.)]\s+/.test(marker);

  if (!ordered) {
    return {
      indent,
      marker,
      content,
      isBlank: content.trim().length === 0,
      nextMarker: `${indent}${marker}`,
      kind: "unordered",
    };
  }

  const orderedMatch = /^(\d+)([.)])\s+$/.exec(marker);
  const current = orderedMatch ? Number.parseInt(orderedMatch[1], 10) : 1;
  const sep = orderedMatch ? orderedMatch[2] : ".";
  return {
    indent,
    marker,
    content,
    isBlank: content.trim().length === 0,
    nextMarker: `${indent}${current + 1}${sep} `,
    kind: "ordered",
  };
}

function indentLineAtLevel(lineStart, lineEnd, shiftKey) {
  const line = editor.value.slice(lineStart, lineEnd);
  if (shiftKey) {
    if (line.startsWith("\t")) {
      editor.setRangeText("", lineStart, lineStart + 1, "preserve");
      return;
    }
    if (line.startsWith("  ")) {
      editor.setRangeText("", lineStart, lineStart + 2, "preserve");
      return;
    }
    return;
  }

  editor.setRangeText("  ", lineStart, lineStart, "preserve");
}

function handleTabIndent(event) {
  const { start, end, text, lineStart, lineEnd, line } = getCurrentLineInfo();
  const listInfo = parseListLine(line);

  if (start === end && listInfo) {
    indentLineAtLevel(lineStart, lineEnd, event.shiftKey);
    scheduleRender();
    return;
  }

  if (start === end && !event.shiftKey) {
    editor.setRangeText("\t", start, end, "end");
    scheduleRender();
    return;
  }

  const block = text.slice(lineStart, lineEnd);
  const lines = block.split("\n");

  if (event.shiftKey) {
    const outdented = lines.map((line) => {
      if (line.startsWith("\t")) return line.slice(1);
      if (line.startsWith("    ")) return line.slice(4);
      if (line.startsWith("  ")) return line.slice(2);
      return line;
    });
    const replacement = outdented.join("\n");
    editor.setRangeText(replacement, lineStart, lineEnd, "preserve");
    scheduleRender();
    return;
  }

  const indented = lines.map((line) => `\t${line}`).join("\n");
  editor.setRangeText(indented, lineStart, lineEnd, "preserve");
  scheduleRender();
}

function handleEnterInList(event) {
  const { start, end, text, lineStart, lineEnd, line } = getCurrentLineInfo();
  if (start !== end) return;

  const listInfo = parseListLine(line);
  if (!listInfo) return;

  event.preventDefault();

  if (listInfo.isBlank) {
    if (lineEnd < text.length && text[lineEnd] === "\n") {
      editor.setRangeText("", lineStart, lineEnd + 1, "start");
    } else if (lineStart > 0 && text[lineStart - 1] === "\n") {
      editor.setRangeText("", lineStart - 1, lineEnd, "start");
    } else {
      editor.setRangeText("", lineStart, lineEnd, "start");
    }
    scheduleRender();
    return;
  }

  editor.setRangeText(`\n${listInfo.nextMarker}`, start, start, "end");
  scheduleRender();
}

editor.addEventListener("input", scheduleRender);
editor.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    handleEnterInList(event);
    return;
  }
  if (event.key !== "Tab") return;
  event.preventDefault();
  handleTabIndent(event);
});
sampleButton.addEventListener("click", () => {
  editor.value = sample;
  scheduleRender();
});
clearButton.addEventListener("click", () => {
  editor.value = "";
  scheduleRender();
  editor.focus();
});

render().catch((error) => {
  preview.innerHTML = `<pre class="error">${escapeHtml(error.message)}</pre>`;
});
