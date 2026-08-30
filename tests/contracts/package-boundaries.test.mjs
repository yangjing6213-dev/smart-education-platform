/* global process */

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { determineEvidenceMode, findForbiddenImports } from "../../scripts/verify_task_03.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function json(relativePath) {
  return JSON.parse(readFileSync(path.join(root, relativePath), "utf8"));
}

test("package-direction verifier rejects a reverse import", () => {
  const findings = findForbiddenImports(
    [
      { path: "packages/contracts/src/bad.ts", content: 'import "@student-care/validation";' },
      { path: "packages/tenant/src/zod.ts", content: 'import "zod/lib";' },
      { path: "packages/tenant/src/fastify.ts", content: 'import "fastify/plugin";' },
      { path: "packages/tenant/src/api.ts", content: 'import "@student-care/api/private";' },
      { path: "packages/tenant/src/require.ts", content: 'const z = require("zod");' },
      { path: "packages/tenant/src/export.ts", content: 'export * from "fastify/plugin";' },
      {
        path: "packages/tenant/src/relative.ts",
        content: 'import "../../../apps/api/src/index.js";',
      },
    ],
    ["@student-care/validation", "zod", "fastify", "@student-care/api", "../../../apps/api"],
  );
  assert.deepEqual(findings, [
    "packages/contracts/src/bad.ts -> @student-care/validation",
    "packages/tenant/src/zod.ts -> zod",
    "packages/tenant/src/fastify.ts -> fastify",
    "packages/tenant/src/api.ts -> @student-care/api",
    "packages/tenant/src/require.ts -> zod",
    "packages/tenant/src/export.ts -> fastify",
    "packages/tenant/src/relative.ts -> ../../../apps/api",
  ]);
});

test("Task 03 evidence gate is tri-state and fails closed for partial evidence", () => {
  assert.equal(determineEvidenceMode([false, false, false]), "implementation");
  assert.equal(determineEvidenceMode([true, true, true]), "final-review");
  for (const partial of [
    [true, false, false],
    [false, true, false],
    [false, false, true],
    [true, true, false],
    [true, false, true],
    [false, true, true],
  ]) {
    assert.throws(() => determineEvidenceMode(partial), /partial evidence/i);
  }
});

test("workspace package manifests preserve the approved dependency direction", () => {
  const contracts = json("packages/contracts/package.json");
  const validation = json("packages/validation/package.json");
  const tenant = json("packages/tenant/package.json");
  const api = json("apps/api/package.json");

  assert.equal(contracts.dependencies, undefined);
  assert.deepEqual(validation.dependencies, {
    "@student-care/contracts": "workspace:*",
    zod: "3.25.76",
  });
  assert.deepEqual(tenant.dependencies, {
    "@student-care/validation": "workspace:*",
  });
  assert.deepEqual(api.dependencies, {
    "@student-care/contracts": "workspace:*",
    "@student-care/tenant": "workspace:*",
    "@student-care/validation": "workspace:*",
    fastify: "5.12.1",
  });

  const expectedExports = {
    ".": { types: "./src/index.ts", import: "./dist/src/index.js" },
  };
  assert.deepEqual(contracts.exports, expectedExports);
  assert.deepEqual(validation.exports, expectedExports);
  assert.deepEqual(tenant.exports, expectedExports);
});

test("root scripts preserve the exact Task 03 verification contract", () => {
  const rootPackage = json("package.json");

  assert.deepEqual(rootPackage.scripts, {
    typecheck:
      "corepack pnpm --filter @student-care/contracts typecheck && corepack pnpm --filter @student-care/validation typecheck && corepack pnpm --filter @student-care/tenant typecheck && corepack pnpm --filter @student-care/api typecheck",
    lint: "corepack pnpm --filter @student-care/contracts lint && corepack pnpm --filter @student-care/validation lint && eslint eslint.config.mjs tests scripts",
    "format:check":
      "prettier --check --ignore-unknown package.json pnpm-workspace.yaml tsconfig.base.json eslint.config.mjs .prettierrc.json apps/api/package.json apps/api/tsconfig.json apps/api/src/**/*.ts apps/api/test/**/*.ts packages/*/package.json packages/*/tsconfig.json packages/*/src/**/*.ts packages/*/test/**/*.ts tests/**/*.mjs scripts/**/*.mjs PHASE_1B_TASK_03_CODEX_EXECUTION.md SHA256SUMS_PHASE_1B_TASK_03.txt docs/project/PHASE_1B_RUNTIME_BASELINE_DECISION.md docs/project/PHASE_1B_TASK_01_ACCEPTANCE.md docs/project/PHASE_1B_TASK_02_PLAN.md docs/project/PHASE_1B_TASK_03_PLAN.md docs/reviews/PHASE_1B_TASK_01_REVIEW.md",
    test: "corepack pnpm --filter @student-care/contracts test && corepack pnpm --filter @student-care/validation test && corepack pnpm --filter @student-care/tenant test && corepack pnpm --filter @student-care/api test && node --test tests/workspace/paths.test.mjs tests/contracts/package-boundaries.test.mjs",
    "test:coverage":
      "corepack pnpm --filter @student-care/tenant test:coverage && corepack pnpm --filter @student-care/api test:coverage && node --test tests/workspace/paths.test.mjs tests/contracts/package-boundaries.test.mjs",
    build:
      "corepack pnpm --filter @student-care/contracts build && corepack pnpm --filter @student-care/validation build && corepack pnpm --filter @student-care/tenant build && corepack pnpm --filter @student-care/api build",
    verify:
      "corepack pnpm typecheck && corepack pnpm lint && corepack pnpm format:check && corepack pnpm test && corepack pnpm test:coverage && corepack pnpm build && node scripts/verify_task_03.mjs",
  });
});

test("tenant source rejects forbidden package directions", () => {
  const tenantSources = ["src/index.ts", "src/resolve-scope.ts", "src/scope-context.ts"].map(
    (relativePath) => ({
      path: `packages/tenant/${relativePath}`,
      content: readFileSync(path.join(root, "packages/tenant", relativePath), "utf8"),
    }),
  );

  assert.deepEqual(
    findForbiddenImports(tenantSources, ["zod", "fastify", "@student-care/api"]),
    [],
  );
});

test("API workspace can resolve and use all explicit package exports", () => {
  const output = execFileSync(
    process.execPath,
    [
      "--input-type=module",
      "--eval",
      "import { ERROR_CODES } from '@student-care/contracts'; import { resolveScope } from '@student-care/tenant'; import { uuidSchema } from '@student-care/validation'; const id='00000000-0000-4000-8000-000000000001'; const result=resolveScope({trustedActor:{actorId:id},membership:{tenantId:id,campusIds:[],status:'ACTIVE'}}); if (!ERROR_CODES.includes('VALIDATION_FAILED') || !uuidSchema.safeParse(id).success || !result.ok || result.scopeContext.tenantId!==id) process.exit(1);",
    ],
    { cwd: path.join(root, "apps/api"), encoding: "utf8" },
  );
  assert.equal(output, "");
});

test("Task 03 verifier accepts the committed implementation boundary", () => {
  const output = execFileSync(process.execPath, ["scripts/verify_task_03.mjs"], {
    cwd: root,
    encoding: "utf8",
  });
  assert.doesNotMatch(output, /FAIL git HEAD:/);
  assert.match(output, /OK committed Task 03 state:/);
  assert.match(output, /TASK_03_(?:IMPLEMENTATION|FINAL_REVIEW)_VERIFY=PASS/);
});

test("Task 03 verifier audits the committed change boundary", () => {
  const output = execFileSync(process.execPath, ["scripts/verify_task_03.mjs"], {
    cwd: root,
    encoding: "utf8",
  });
  assert.match(output, /OK committed change boundary: 19 approved paths only/);
});
