// @ts-nocheck

const { existsSync } = require("node:fs");
const { resolve } = require("node:path");
const { defineConfig } = require("vite");

const ROOT_DIR = __dirname;
const ENGINE_PATH = resolve(ROOT_DIR, "dist", "markdown.js");

function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolveBody, rejectBody) => {
    const chunks = [];

    req.on("data", (chunk) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    req.on("end", () => {
      resolveBody(Buffer.concat(chunks).toString("utf8"));
    });
    req.on("error", rejectBody);
  });
}

function parsePayload(raw) {
  if (raw.trim().length === 0) {
    return {};
  }

  const parsed = JSON.parse(raw);
  if (typeof parsed !== "object" || parsed === null) {
    throw new Error("Invalid JSON payload");
  }

  return parsed;
}

function loadEngineModule() {
  if (!existsSync(ENGINE_PATH)) {
    throw new Error("Engine build not found. Run npm run build:engine first.");
  }

  const resolvedPath = require.resolve(ENGINE_PATH);
  delete require.cache[resolvedPath];
  const moduleValue = require(ENGINE_PATH);

  if (
    typeof moduleValue !== "object" ||
    moduleValue === null ||
    typeof moduleValue.compileMarkdownToHtml !== "function"
  ) {
    throw new Error("Invalid engine module shape");
  }

  return moduleValue;
}

async function handlePreview(res, rawBody) {
  const payload = parsePayload(rawBody);
  const source = typeof payload.markdown === "string" ? payload.markdown : "";
  const engine = loadEngineModule();
  const result = engine.compileMarkdownToHtml(source, { documentVersion: 1 });

  sendJson(res, 200, {
    html: result.html,
    ast: result.ast,
  });
}

function createApiPlugin() {
  const registerRoutes = (middleware, routeType) => {
    middleware.use(async (req, res, next) => {
      if (!req.url) {
        next();
        return;
      }

      if (req.url === "/api/health") {
        sendJson(res, 200, { ok: true, mode: routeType });
        return;
      }

      if (req.method !== "POST" || req.url !== "/api/preview") {
        next();
        return;
      }

      try {
        const rawBody = await readBody(req);
        await handlePreview(res, rawBody);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Invalid request";
        sendJson(res, 400, { error: message });
      }
    });
  };

  return {
    name: "markengine-api",
    configureServer(server) {
      registerRoutes(server.middlewares, "dev");
    },
    configurePreviewServer(server) {
      registerRoutes(server.middlewares, "preview");
    },
  };
}

module.exports = defineConfig({
  root: "playground/public",
  plugins: [createApiPlugin()],
  server: {
    host: true,
    port: 3000,
    strictPort: true,
  },
  preview: {
    host: true,
    port: 3000,
    strictPort: true,
  },
});
