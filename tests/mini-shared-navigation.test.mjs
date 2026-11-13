import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { createRequire, registerHooks } from "node:module";
import { resolve, sep } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import test from "node:test";
import ts from "typescript";

const require = createRequire(import.meta.url);
const miniRoot = resolve("apps/mini-program") + sep;
if (process.env.MINI_SHARED_RUNTIME !== "generated") {
  registerHooks({
    load(url, context, nextLoad) {
      if (url.startsWith("file:") && url.endsWith(".js")) {
        const path = fileURLToPath(url);
        const source = path.replace(/\.js$/u, ".ts");
        if (path.startsWith(miniRoot) && existsSync(source)) {
          return {
            format: "commonjs",
            shortCircuit: true,
            source: ts.transpileModule(readFileSync(source, "utf8"), {
              compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
            }).outputText,
          };
        }
      }
      return nextLoad(url, context);
    },
  });
}

test("shared staff navigation works while offline business handlers stay isolated", async () => {
  let page;
  globalThis.Page = (definition) => {
    page = definition;
  };
  globalThis.wx = {
    request(options) {
      assert.equal(options.url, "http://127.0.0.1:4317/local/profiles");
      options.success({ statusCode: 200, data: { mode: "local-synthetic", profiles: [] } });
    },
  };
  require(resolve(miniRoot, "pages/staff/quick-action/index.js"));
  page.setData = function (patch) {
    Object.assign(this.data, patch);
  };
  const section = (value) => ({ currentTarget: { dataset: { section: value } } });
  page.handleStaffSectionChange(section("parents"));
  assert.equal(page.data.staffSection, "parents");
  await page.handleSharedEnable();
  assert.equal(page.data.sharedMode, true);
  for (const name of ["records", "work", "services", "parents"]) {
    page.handleStaffSectionChange(section(name));
    assert.equal(page.data.staffSection, name);
  }
  page.handleStaffSectionChange(section("invalid"));
  assert.equal(page.data.staffSection, "parents");
  const before = globalThis.structuredClone(page.data);
  page.handleAction({ currentTarget: { dataset: { action: "INVALID" } } });
  assert.deepEqual(page.data, before, "shared mode must not invoke offline business actions");
  delete globalThis.Page;
  delete globalThis.wx;
});

const uuid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const teacherSession = {
  mode: "local-synthetic",
  profile: "teacher-east",
  label: "模拟数据·示例教师",
  actorId: uuid(3),
  tenantId: uuid(100),
  campusId: uuid(101),
  classIds: [uuid(103)],
  actions: ["daily:read", "daily:create", "daily:submit"],
};

function response(path, dailyRows = []) {
  if (path === "/local/profiles")
    return {
      status: 200,
      data: {
        mode: "local-synthetic",
        profiles: [{ profile: teacherSession.profile, label: teacherSession.label }],
      },
    };
  if (path === "/local/sessions")
    return { status: 201, data: { mode: "local-synthetic", handle: "x".repeat(43) } };
  if (path === "/local/session") return { status: 200, data: teacherSession };
  if (path === "/local/staff-daily-owned") return { status: 200, data: dailyRows };
  assert.ok(
    [
      "/local/binding-applications",
      "/local/leave-requests",
      "/local/care-records",
      "/local/student-options",
    ].includes(path),
    `Unexpected local request: ${path}`,
  );
  return { status: 200, data: [] };
}

function restoreGlobal(name, descriptor) {
  if (descriptor) Object.defineProperty(globalThis, name, descriptor);
  else delete globalThis[name];
}

async function withPage(check, entryPath = "pages/staff/quick-action/index.js") {
  const previousPage = Object.getOwnPropertyDescriptor(globalThis, "Page");
  const previousWx = Object.getOwnPropertyDescriptor(globalThis, "wx");
  const entry = resolve(miniRoot, entryPath);
  const sharedPage = resolve(miniRoot, "src/local-synthetic/page.js");
  const calls = [];
  let page;
  try {
    delete require.cache[entry];
    delete require.cache[sharedPage];
    globalThis.Page = (definition) => {
      page = definition;
    };
    globalThis.wx = {
      request(options) {
        assert.ok(options.url.startsWith("http://127.0.0.1:4317/local/"));
        const path = options.url.slice("http://127.0.0.1:4317".length);
        calls.push({ path, method: options.method, body: options.data });
        const reply = response(path);
        options.success({ statusCode: reply.status, data: reply.data });
      },
      redirectTo({ url }) {
        calls.push({ navigation: "redirectTo", url });
      },
      navigateTo({ url }) {
        calls.push({ navigation: "navigateTo", url });
      },
      navigateBack({ delta }) {
        calls.push({ navigation: "navigateBack", delta });
      },
      reLaunch({ url }) {
        calls.push({ navigation: "reLaunch", url });
      },
    };
    require(entry);
    page.setData = function (patch) {
      Object.assign(this.data, patch);
    };
    await check(page, calls);
  } finally {
    try {
      page?.onUnload?.();
    } finally {
      delete require.cache[entry];
      delete require.cache[sharedPage];
      restoreGlobal("Page", previousPage);
      restoreGlobal("wx", previousWx);
    }
  }
}

test("shared quick back redirects to the staff workbench without invoking offline behavior", async () => {
  await withPage(async (page, calls) => {
    await page.handleSharedEnable();
    assert.equal(page.data.sharedMode, true);
    const before = globalThis.structuredClone(page.data);
    const requestCount = calls.length;
    page.handleBack();
    assert.deepEqual(calls.slice(requestCount), [
      { navigation: "redirectTo", url: "/pages/staff/workbench/index" },
    ]);
    assert.deepEqual(page.data, before);
  });
});

test("shared workbench learning entry requires an explicitly selected current identity", async () => {
  await withPage(async (page, calls) => {
    page.onLoad();
    await page.onShow();
    assert.equal(page.data.sharedMode, true);
    const navigationCalls = () => calls.filter((call) => call.navigation);
    page.handleLearningEntry();
    assert.deepEqual(navigationCalls(), []);
    assert.equal(
      calls.some((call) => call.path === "/local/sessions"),
      false,
    );

    await page.handleSharedProfile({ detail: { value: "1" } });
    assert.equal(page.data.shared.status, "READY");
    assert.equal(page.data.shared.profile, "teacher-east");
    page.handleLearningEntry();
    assert.deepEqual(navigationCalls(), [
      { navigation: "redirectTo", url: "/pages/parent/learning/index?profile=teacher-east" },
    ]);

    await page.handleSharedProfile({ detail: { value: "0" } });
    assert.equal(page.data.shared.profile, null);
    page.handleLearningEntry();
    assert.equal(navigationCalls().length, 1);
    assert.equal(calls.filter((call) => call.path === "/local/sessions").length, 1);
  }, "pages/staff/workbench/index.js");
});
