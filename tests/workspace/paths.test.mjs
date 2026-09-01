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
  "apps/api/src/plugins/scope.plugin.ts",
  "apps/api/src/plugins/auth.plugin.ts",
  "apps/api/src/routes/me.route.ts",
  "apps/api/src/routes/memberships.route.ts",
  "apps/api/test/task04.routes.test.ts",
  "apps/api/test/scope.plugin.test.ts",
  "apps/api/test/health.route.test.ts",
  "packages/tenant/package.json",
  "packages/tenant/tsconfig.json",
  "packages/tenant/src/index.ts",
  "packages/tenant/src/resolve-scope.ts",
  "packages/tenant/src/scope-context.ts",
  "packages/tenant/test/isolation.test.ts",
  "packages/auth/package.json",
  "packages/auth/tsconfig.json",
  "packages/auth/src/index.ts",
  "packages/auth/src/identity.ts",
  "packages/auth/src/session.ts",
  "packages/auth/src/membership-policy.ts",
  "packages/auth/test/policy.test.ts",
  "packages/contracts/src/identity.ts",
  "packages/contracts/test/identity.test.ts",
  "scripts/verify_task_01.mjs",
  "scripts/verify_task_02.mjs",
  "scripts/verify_task_03.mjs",
  "scripts/verify_task_04.mjs",
  "PHASE_1B_TASK_04_CODEX_EXECUTION.md",
  "docs/project/PHASE_1B_TASK_04_PLAN.md",
  "PHASE_1B_TASK_03_CODEX_EXECUTION.md",
  "docs/plans/PHASE_1B_TASK_DEPENDENCY_GRAPH.md",
  "docs/plans/PHASE_1B_V0_1_IMPLEMENTATION_PLAN.md",
  "docs/project/PHASE_1B_T10_T12_DEPENDENCY_AUTHORITY_V1.md",
  "docs/project/PHASE_1B_TASK_02_ACCEPTANCE.md",
  "docs/project/PHASE_1B_TASK_03_PLAN.md",
  "docs/project/PHASE_1B_RUNTIME_BASELINE_DECISION.md",
  "docs/reviews/PHASE_1B_TASK_01_REVIEW.md",
  "SHA256SUMS_PHASE_1B_TASK_01.txt",
];

test("required Task 04 implementation paths resolve from the repository root", () => {
  for (const relativePath of requiredPaths) {
    assert.equal(existsSync(path.join(root, relativePath)), true, relativePath);
  }
});
