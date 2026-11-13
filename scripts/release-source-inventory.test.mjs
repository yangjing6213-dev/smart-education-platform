import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  collectSourcePaths,
  inspectSourceFiles,
  scanSensitiveText,
  readSourceInventory,
  verifySourceInventory,
  writeSourceInventory,
} from "./release-source-inventory.mjs";

function fixture() {
  const root = mkdtempSync(join(tmpdir(), "release-source-inventory-"));
  const put = (path, value = "export const synthetic = true;\n") => {
    mkdirSync(join(root, path, ".."), { recursive: true });
    writeFileSync(join(root, path), value);
  };
  return { root, put };
}

test("source inventory includes complete target sources, migrations and license inputs", () => {
  const { root, put } = fixture();
  const paths = [
    "package.json",
    "pnpm-lock.yaml",
    "apps/api/prisma/migrations/001/init.sql",
    "apps/api/src/generated/prisma/client.ts",
    "apps/user-web/src/local-synthetic/client.ts",
    "apps/admin-web/src/pages/audit-logs.ts",
    "apps/mini-program-taro/config/index.ts",
    "apps/mini-program-taro/licenses/pages/auth/login/index.js.LICENSE.txt",
    "packages/contracts/openapi/v1.json",
    "apps/user-web/public/assets/team.jpg",
  ];
  for (const path of paths) put(path);
  assert.deepEqual(collectSourcePaths(root).candidates, paths.sort());
});

test("excluded caches, private settings and old Mini are never traversed or read", () => {
  const { root, put } = fixture();
  put("apps/user-web/src/app/page.tsx");
  for (const path of [
    "apps/user-web/.next-task-old/nested/cache.json",
    "apps/api/.dist-task-old/a.js",
    "artifacts/old-run/trace.json",
    "apps/mini-program/pages/home/index.ts",
    "apps/user-web/.env.production",
    "apps/mini-program-taro/project.private.config.json",
    "apps/user-web/next-env.d.ts",
    "apps/user-web/next.tsconfig.tsbuildinfo",
    "apps/user-web/src/credentials.json",
    "apps/user-web/src/secrets.yaml",
    "PLANS.md",
  ])
    put(path);
  const inventory = collectSourcePaths(root);
  assert.deepEqual(inventory.candidates, ["apps/user-web/src/app/page.tsx"]);
  assert.ok(inventory.excluded.some((entry) => entry.path === "apps/user-web/.next-task-old"));
  assert.ok(!inventory.excluded.some((entry) => entry.path.includes("nested/cache")));
  assert.ok(inventory.excluded.some((entry) => entry.reason === "PRIVATE_FILE_NAME"));
});

test("only the three trial Nginx templates enter the inventory as redacted, scanned text", () => {
  const { root, put } = fixture();
  const templates = [
    "docs/operations/trial-mini-api.nginx.conf",
    "docs/operations/trial-web-backend.nginx.conf",
    "docs/operations/trial-web.nginx.conf",
  ];
  const marker = "gh" + "p_" + "Z8x9W7v6".repeat(5);
  for (const path of templates) put(path, `# local test fixture\n# ${marker}\n`);
  for (const elsewhere of [
    "docs/operations/other.nginx.conf",
    "docs/operations/nested/trial-mini-api.nginx.conf",
    "docs/operations/nested/trial-web-backend.nginx.conf",
    "docs/operations/nested/trial-web.nginx.conf",
    "scripts/trial-mini-api.nginx.conf",
    "scripts/trial-web-backend.nginx.conf",
    "scripts/trial-web.nginx.conf",
  ])
    put(elsewhere);
  const selection = collectSourcePaths(root);
  assert.deepEqual(selection.candidates, templates);
  const inventory = writeSourceInventory(root, "artifacts/report");
  assert.ok(inventory.files.every((file) => file.scan === "TEXT_RULE_SCAN"));
  assert.equal(inventory.status, "REVIEW_REQUIRED");
  assert.deepEqual(
    inventory.findings,
    templates.map((path) => ({ path, line: 2, rule: "GITHUB_TOKEN" })),
  );
  assert.ok(!readFileSync(join(root, "artifacts/report/inventory.json"), "utf8").includes(marker));
});

test("source and output directory junctions cannot escape the selected tree", () => {
  const { root, put } = fixture();
  const outside = fixture();
  outside.put("hidden.ts");
  put("apps/api/src/main.ts");
  symlinkSync(outside.root, join(root, "apps/api/src/linked"), "junction");
  const inventory = collectSourcePaths(root);
  assert.ok(inventory.blockers.some((entry) => entry.reason === "SYMLINK_REJECTED"));
  assert.ok(!inventory.candidates.some((path) => path.includes("hidden")));
  mkdirSync(join(root, "artifacts"));
  symlinkSync(outside.root, join(root, "artifacts/linked"), "junction");
  assert.throws(() => writeSourceInventory(root, "artifacts/linked/output"), /SYMLINK/u);
});

test("secret findings retain only location and rule, never matched values", () => {
  const value = "gh" + "p_" + "A1b2C3d4".repeat(5);
  const source = `export const value = '${value}';\n`;
  const findings = scanSensitiveText("apps/api/src/main.ts", source);
  assert.equal(findings.length, 1);
  assert.equal(findings[0].line, 1);
  assert.equal(findings[0].rule, "GITHUB_TOKEN");
  assert.ok(!JSON.stringify(findings).includes(value));
  assert.equal(scanSensitiveText("x.ts", "const x = process.env.API_KEY;\n").length, 0);
  const privateKey = "-----BEGIN " + "PRIVATE KEY-----";
  assert.equal(scanSensitiveText("x.ts", privateKey)[0].rule, "PRIVATE_KEY");
});

test("credential-like values are not exempted by words in a username or password", () => {
  const connection = "postgresql://synthetic:" + "A-real-looking-value@host.invalid/db";
  assert.ok(
    scanSensitiveText("x.ts", connection).some(
      (row) => row.rule === "EMBEDDED_CONNECTION_PASSWORD",
    ),
  );
  const assignment = "const password = '" + "Latest-looking-value" + "';";
  assert.ok(
    scanSensitiveText("x.ts", assignment).some(
      (row) => row.rule === "POSSIBLE_HARDCODED_CREDENTIAL",
    ),
  );
});

test("a link in a repository ancestor cannot bypass source or output boundaries", () => {
  const parent = fixture();
  const target = fixture();
  target.put("repo/apps/api/src/main.ts");
  symlinkSync(target.root, join(parent.root, "linked"), "junction");
  const linkedRoot = join(parent.root, "linked/repo");
  assert.throws(() => collectSourcePaths(linkedRoot), /SYMLINK/u);
  assert.throws(() => writeSourceInventory(linkedRoot, "artifacts/check"), /SYMLINK/u);
});

test("manifest verification rejects private names and never leaks malformed JSON content", () => {
  const { root, put } = fixture();
  for (const path of [
    "artifacts/check/.env",
    "artifacts/check/server.key",
    "artifacts/credentials.yaml/inventory.json",
    "artifacts/.env/inventory.json",
  ]) {
    put(path, "private-file-not-to-be-read");
    assert.throws(() => readSourceInventory(root, path), {
      message: "INVALID_INVENTORY_FILE_PATH",
    });
  }
  put("artifacts/check/inventory.json", "private-file-not-to-be-printed");
  assert.throws(() => readSourceInventory(root, "artifacts/check/inventory.json"), {
    message: "INVALID_INVENTORY_JSON",
  });
  put("artifacts/check/inventory.json", JSON.stringify({ files: [] }));
  assert.deepEqual(readSourceInventory(root, "artifacts/check/inventory.json"), { files: [] });
});

test("source hashes are deterministic and later changes invalidate verification", () => {
  const { root, put } = fixture();
  put("apps/api/src/main.ts");
  const selection = collectSourcePaths(root);
  const first = inspectSourceFiles(root, selection, {
    trackedPaths: [selection.candidates[0]],
    modifiedPaths: [selection.candidates[0]],
  });
  const second = inspectSourceFiles(root, selection, {
    trackedPaths: [selection.candidates[0]],
    modifiedPaths: [selection.candidates[0]],
  });
  assert.deepEqual(first, second);
  assert.equal(first.files[0].gitState, "TRACKED_MODIFIED");
  assert.equal(verifySourceInventory(root, first).status, "PASS_CURRENT_FILES_MATCH");
  put("apps/api/src/main.ts", "export const synthetic = false;\n");
  assert.equal(verifySourceInventory(root, first).status, "FAIL_CURRENT_FILES_CHANGED");
});

test("inventory writes only a new artifact output and never copies private source values", () => {
  const { root, put } = fixture();
  const token = "gh" + "p_" + "Z9x8W7v6".repeat(5);
  put("apps/api/src/main.ts", `export const credential = '${token}';\n`);
  const result = writeSourceInventory(root, "artifacts/check-one");
  assert.equal(result.status, "REVIEW_REQUIRED");
  assert.ok(
    !readFileSync(join(root, "artifacts/check-one/inventory.json"), "utf8").includes(token),
  );
  assert.throws(() => writeSourceInventory(root, "artifacts/check-one"), /EXISTS/u);
  assert.throws(() => writeSourceInventory(root, "../outside"), /ARTIFACT/u);
  assert.throws(
    () => inspectSourceFiles(root, { candidates: ["../outside"], blockers: [], excluded: [] }),
    /PATH/u,
  );
});
