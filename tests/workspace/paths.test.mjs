import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

const requiredPaths = [
  "package.json",
  "pnpm-workspace.yaml",
  "pnpm-lock.yaml",
  "tsconfig.base.json",
  "eslint.config.mjs",
  ".prettierrc.json",
  ".prettierignore",
  "apps/api/package.json",
  "apps/api/tsconfig.json",
  "apps/api/src/health/health.route.ts",
  "apps/api/src/server.ts",
  "apps/api/src/index.ts",
  "apps/api/test/health.route.test.ts",
  "scripts/verify_task_01.mjs",
  "docs/project/PHASE_1B_RUNTIME_BASELINE_DECISION.md",
  "docs/reviews/PHASE_1B_TASK_01_REVIEW.md",
  "SHA256SUMS_PHASE_1B_TASK_01.txt",
];

test("required Task 01 workspace paths resolve from the repository root", () => {
  for (const relativePath of requiredPaths) {
    assert.equal(existsSync(path.join(root, relativePath)), true, relativePath);
  }
});
