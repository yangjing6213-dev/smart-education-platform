import { cp, mkdir, readFile, stat } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = fileURLToPath(new URL(".", import.meta.url));
const sourceRoot = resolve(packageRoot, "src");
const distRoot = resolve(packageRoot, "dist");
const browserEntry = resolve(distRoot, "main.js");
const indexSource = resolve(packageRoot, "index.html");
const stylesheetSource = resolve(sourceRoot, "styles/user-web.css");

const BARE_IMPORT = /(?:from\s*|import\s*\(\s*)["'](?![./])[^"']+["']/u;
const EXTERNAL_URL = /https?:\/\//iu;

const visited = new Set();
const importSpecifier = /(?:from\s*|import\s*\(\s*)["']([^"']+)["']/gu;

async function validateBrowserGraph(path) {
  if (visited.has(path)) {
    return;
  }
  visited.add(path);
  const source = await readFile(path, "utf8");
  if (BARE_IMPORT.test(source)) {
    throw new Error("DEPENDENCY_EXPANSION_REQUIRED: bare browser import found");
  }
  for (const match of source.matchAll(importSpecifier)) {
    const specifier = match[1];
    if (specifier === undefined || !specifier.startsWith(".")) {
      continue;
    }
    const dependency = resolve(dirname(path), specifier);
    await stat(dependency);
    await validateBrowserGraph(dependency);
  }
}

await validateBrowserGraph(browserEntry);

const indexHtml = await readFile(indexSource, "utf8");
const stylesheet = await readFile(stylesheetSource, "utf8");
if (EXTERNAL_URL.test(indexHtml) || EXTERNAL_URL.test(stylesheet)) {
  throw new Error("External URL is not allowed in the user-web browser assets");
}

await mkdir(join(distRoot, "styles"), { recursive: true });
await cp(indexSource, resolve(distRoot, "index.html"));
await cp(stylesheetSource, resolve(distRoot, "styles/user-web.css"));
await readFile(browserEntry);
