/* global process */

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { findForbiddenImports } from "../../scripts/verify_task_02.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function json(relativePath) {
  return JSON.parse(readFileSync(path.join(root, relativePath), "utf8"));
}

test("package-direction verifier rejects a reverse import", () => {
  const findings = findForbiddenImports(
    [{ path: "packages/contracts/src/bad.ts", content: 'import "@student-care/validation";' }],
    ["@student-care/validation"],
  );
  assert.deepEqual(findings, ["packages/contracts/src/bad.ts -> @student-care/validation"]);
});

test("workspace package manifests preserve the approved dependency direction", () => {
  const contracts = json("packages/contracts/package.json");
  const validation = json("packages/validation/package.json");
  const api = json("apps/api/package.json");

  assert.equal(contracts.dependencies, undefined);
  assert.deepEqual(validation.dependencies, {
    "@student-care/contracts": "workspace:*",
    zod: "3.25.76",
  });
  assert.equal(api.dependencies["@student-care/contracts"], "workspace:*");
  assert.equal(api.dependencies["@student-care/validation"], "workspace:*");
});

test("API workspace can resolve and use both explicit package exports", () => {
  const output = execFileSync(
    process.execPath,
    [
      "--input-type=module",
      "--eval",
      "import { ERROR_CODES } from '@student-care/contracts'; import { uuidSchema } from '@student-care/validation'; if (!ERROR_CODES.includes('VALIDATION_FAILED') || !uuidSchema.safeParse('00000000-0000-4000-8000-000000000001').success) process.exit(1);",
    ],
    { cwd: path.join(root, "apps/api"), encoding: "utf8" },
  );
  assert.equal(output, "");
});
