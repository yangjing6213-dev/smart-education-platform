import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import process from "node:process";

const root = resolve(import.meta.dirname, "..");
const miniRoot = resolve(root, "apps/mini-program");
const appJsonPath = resolve(miniRoot, "app.json");
const requireGeneratedJs = process.argv.includes("--require-generated-js");

const failures = [];

if (!existsSync(appJsonPath)) {
  failures.push(`missing ${appJsonPath}`);
} else {
  let appConfig;
  try {
    appConfig = JSON.parse(readFileSync(appJsonPath, "utf8"));
  } catch (error) {
    failures.push(`invalid ${appJsonPath}: ${error.message}`);
  }

  const pages = Array.isArray(appConfig?.pages) ? appConfig.pages : [];
  if (pages.length === 0) failures.push("apps/mini-program/app.json has no pages");

  for (const page of pages) {
    const pageJsonPath = resolve(miniRoot, `${page}.json`);
    if (!existsSync(pageJsonPath)) {
      failures.push(`missing ${page}.json`);
      continue;
    }

    try {
      const pageConfig = JSON.parse(readFileSync(pageJsonPath, "utf8"));
      if (!pageConfig || Array.isArray(pageConfig) || typeof pageConfig !== "object") {
        failures.push(`invalid page config ${page}.json`);
      }
    } catch (error) {
      failures.push(`invalid ${page}.json: ${error.message}`);
    }

    if (requireGeneratedJs) {
      const pageJsPath = resolve(miniRoot, `${page}.js`);
      if (!existsSync(pageJsPath)) {
        failures.push(`missing generated ${page}.js`);
      } else if (statSync(pageJsPath).size === 0) {
        failures.push(`empty generated ${page}.js`);
      }
    }
  }
}

if (failures.length > 0) {
  globalThis.console.error("MINI_PAGE_REGISTRATION_FAIL");
  for (const failure of failures) globalThis.console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  globalThis.console.log(
    `MINI_PAGE_REGISTRATION_PASS generatedJs=${requireGeneratedJs ? "required" : "not-required"}`,
  );
}
