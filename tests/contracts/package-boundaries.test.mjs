/* global process */

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  findForbiddenImports,
  frozenTask03Evidence,
  sha256File,
} from "../../scripts/verify_task_05.mjs";
import { frozenTask01To05Evidence as task06FrozenTask01To05Evidence } from "../../scripts/verify_task_06.mjs";

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

test("Task 03 evidence is frozen by SHA without running the historical verifier", () => {
  for (const [relativePath, expectedSha] of frozenTask03Evidence) {
    assert.equal(sha256File(relativePath), expectedSha, relativePath);
  }
});

test("Task 06 verifier pins the complete prior task evidence boundary", () => {
  const requiredEvidence = [
    "SHA256SUMS_PHASE_1B_TASK_01.txt",
    "SHA256SUMS_PHASE_1B_TASK_02.txt",
    "SHA256SUMS_PHASE_1B_TASK_03.txt",
    "SHA256SUMS_PHASE_1B_TASK_04.txt",
    "SHA256SUMS_PHASE_1B_TASK_05.txt",
    "docs/project/PHASE_1B_TASK_01_ACCEPTANCE.md",
    "docs/project/PHASE_1B_TASK_02_ACCEPTANCE.md",
    "docs/project/PHASE_1B_TASK_03_ACCEPTANCE.md",
    "docs/project/PHASE_1B_TASK_04_ACCEPTANCE.md",
    "docs/project/PHASE_1B_TASK_05_ACCEPTANCE.md",
    "docs/reviews/PHASE_1B_TASK_04_REVIEW.md",
    "docs/reviews/PHASE_1B_TASK_05_REVIEW.md",
    "artifacts/review-package/student-care-platform-phase1b-task-04-review-pack-v1.0.zip",
    "artifacts/review-package/student-care-platform-phase1b-task-05-review-pack-v1.0.zip",
  ];

  for (const relativePath of requiredEvidence) {
    assert.equal(task06FrozenTask01To05Evidence.has(relativePath), true, relativePath);
  }
  assert.ok(task06FrozenTask01To05Evidence.size >= requiredEvidence.length);
});

test("workspace package manifests preserve the approved dependency direction", () => {
  const contracts = json("packages/contracts/package.json");
  const auth = json("packages/auth/package.json");
  const validation = json("packages/validation/package.json");
  const tenant = json("packages/tenant/package.json");
  const api = json("apps/api/package.json");

  assert.equal(contracts.dependencies, undefined);
  assert.deepEqual(auth.dependencies, { "@student-care/contracts": "workspace:*" });
  assert.deepEqual(validation.dependencies, {
    "@student-care/contracts": "workspace:*",
    zod: "3.25.76",
  });
  assert.deepEqual(tenant.dependencies, {
    "@student-care/validation": "workspace:*",
  });
  assert.deepEqual(api.dependencies, {
    "@student-care/auth": "workspace:*",
    "@student-care/contracts": "workspace:*",
    "@student-care/tenant": "workspace:*",
    "@student-care/validation": "workspace:*",
    fastify: "5.12.1",
  });

  const expectedExports = {
    ".": { types: "./src/index.ts", import: "./dist/src/index.js" },
  };
  assert.deepEqual(contracts.exports, expectedExports);
  assert.deepEqual(auth.exports, expectedExports);
  assert.deepEqual(validation.exports, expectedExports);
  assert.deepEqual(tenant.exports, expectedExports);
});

test("root scripts use the active Task 06 verifier and include admin-web", () => {
  const rootPackage = json("package.json");

  for (const script of ["typecheck", "lint", "test", "test:coverage", "build"]) {
    assert.match(rootPackage.scripts[script], /@student-care\/auth/, script);
  }
  assert.match(rootPackage.scripts.verify, /scripts\/verify_task_06\.mjs --mode=structure/);
  assert.doesNotMatch(rootPackage.scripts.verify, /verify_task_03|verify_task_04/);
  assert.match(rootPackage.scripts.typecheck, /@student-care\/admin-web/);
  assert.match(rootPackage.scripts.lint, /@student-care\/admin-web/);
  assert.match(rootPackage.scripts.test, /@student-care\/admin-web/);
  assert.match(rootPackage.scripts.build, /@student-care\/admin-web/);
  assert.match(rootPackage.scripts["format:check"], /PHASE_1B_TASK_04_CODEX_EXECUTION\.md/);
  assert.match(rootPackage.scripts["format:check"], /PHASE_1B_TASK_06_CODEX_EXECUTION\.md/);
  assert.doesNotMatch(rootPackage.scripts["format:check"], /SHA256SUMS_PHASE_1B_TASK_04/);
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

test("auth source depends only on public contracts", () => {
  const authSources = ["identity.ts", "index.ts", "membership-policy.ts", "session.ts"].map(
    (fileName) => ({
      path: `packages/auth/src/${fileName}`,
      content: readFileSync(path.join(root, "packages/auth/src", fileName), "utf8"),
    }),
  );
  assert.deepEqual(
    findForbiddenImports(authSources, [
      "@student-care/validation",
      "@student-care/tenant",
      "fastify",
      "@student-care/api",
    ]),
    [],
  );
});

test("API workspace can resolve and use all explicit package exports", () => {
  const output = execFileSync(
    process.execPath,
    [
      "--input-type=module",
      "--eval",
      "import { resolveAuthContext } from '@student-care/auth'; import { ERROR_CODES } from '@student-care/contracts'; import { resolveScope } from '@student-care/tenant'; import { uuidSchema } from '@student-care/validation'; const id='00000000-0000-4000-8000-000000000001'; const result=resolveScope({trustedActor:{actorId:id},membership:{tenantId:id,campusIds:[],status:'ACTIVE'}}); if (!ERROR_CODES.includes('VALIDATION_FAILED') || !uuidSchema.safeParse(id).success || !result.ok || result.scopeContext.tenantId!==id || resolveAuthContext(null).ok) process.exit(1);",
    ],
    { cwd: path.join(root, "apps/api"), encoding: "utf8" },
  );
  assert.equal(output, "");
});

test("Task 06 verifier structure mode accepts the active implementation boundary", () => {
  const output = execFileSync(
    process.execPath,
    ["scripts/verify_task_06.mjs", "--mode=structure"],
    {
      cwd: root,
      encoding: "utf8",
    },
  );
  assert.match(output, /TASK_06_STRUCTURE_VERIFY=PASS/);
});
