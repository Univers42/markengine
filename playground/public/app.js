const editor = document.querySelector("#editor");
const preview = document.querySelector("#preview");
const ast = document.querySelector("#ast");
const sampleButton = document.querySelector("#sample-button");
const clearButton = document.querySelector("#clear-button");

const sample = `# MarkEngine Playground

This is a **live** playground for the markdown engine.

## Blocks

- Paragraphs
- Headings
- Lists
- Blockquotes
- Code blocks

> Edit the text on the left and the server will re-run the TypeScript engine.


\`\`\`ts
const answer = 42;
console.log(answer);
\`\`\`
`;

editor.value = sample;

async function render() {
  const response = await fetch("/api/preview", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ markdown: editor.value }),
  });

  const data = await response.json();
  if (!response.ok) {
    preview.innerHTML = `<pre class="error">${escapeHtml(data.error || "Preview failed")}</pre>`;
    ast.textContent = "";
    return;
  }

  preview.innerHTML = data.html;
  ast.textContent = JSON.stringify(data.ast, null, 2);
}

function escapeHtml(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

let timer = 0;
function scheduleRender() {
  window.clearTimeout(timer);
  timer = window.setTimeout(() => {
    render().catch((error) => {
      preview.innerHTML = `<pre class="error">${escapeHtml(error.message)}</pre>`;
    });
  }, 80);
}

editor.addEventListener("input", scheduleRender);
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
