import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
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
  "apps/api/src/modules/content/content.service.ts",
  "apps/api/src/modules/content/content.repository.ts",
  "apps/api/src/routes/public-content.route.ts",
  "apps/api/src/modules/content/content.test.ts",
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
  "scripts/verify_task_05.mjs",
  "PHASE_1B_TASK_04_CODEX_EXECUTION.md",
  "docs/project/PHASE_1B_TASK_04_PLAN.md",
  "PHASE_1B_TASK_05_CODEX_EXECUTION.md",
  "docs/project/PHASE_1B_TASK_05_PLAN.md",
  "PHASE_1B_TASK_06_CODEX_EXECUTION.md",
  "docs/project/PHASE_1B_TASK_06_PLAN.md",
  "apps/api/src/modules/institution/institution.service.ts",
  "apps/api/src/modules/institution/institution.test.ts",
  "apps/api/src/routes/admin-institution.route.ts",
  "apps/api/src/modules/teachers/public-profile.service.ts",
  "apps/api/src/modules/teachers/public-profile.test.ts",
  "apps/api/src/routes/public-teachers.route.ts",
  "apps/admin-web/package.json",
  "apps/admin-web/tsconfig.json",
  "apps/admin-web/index.html",
  "apps/admin-web/src/main.ts",
  "apps/admin-web/src/pages/home-content.tsx",
  "apps/admin-web/src/pages/public-teachers.tsx",
  "apps/admin-web/test/home-content.test.mjs",
  "scripts/verify_task_06.mjs",
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

test("Task 07 entrypoints preserve home content and expose the public teacher admin route", () => {
  const apiServer = readFileSync(path.join(root, "apps/api/src/server.ts"), "utf8");
  const main = readFileSync(path.join(root, "apps/admin-web/src/main.ts"), "utf8");
  const page = readFileSync(
    path.join(root, "apps/admin-web/src/pages/public-teachers.tsx"),
    "utf8",
  );
  assert.match(apiServer, /registerPublicTeacherRoutes/);
  assert.match(main, /PublicTeacherIntroductionsPage/);
  assert.match(main, /\/admin\/public-teachers/);
  assert.match(main, /HomeContentPage/);
  assert.match(page, /route: "\/admin\/public-teachers"/);
});
