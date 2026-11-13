import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { createRequire, registerHooks } from "node:module";
import { resolve, sep } from "node:path";
import process from "node:process";
import { fileURLToPath, URL } from "node:url";
import test, { after } from "node:test";
import ts from "typescript";

const require = createRequire(import.meta.url);
const miniRoot = resolve(fileURLToPath(new URL("../apps/mini-program/", import.meta.url))) + sep;
const hook =
  process.env.MINI_SHARED_RUNTIME === "generated"
    ? undefined
    : registerHooks({
        load(url, context, nextLoad) {
          if (url.startsWith("file:") && url.endsWith(".js")) {
            const path = fileURLToPath(url);
            const source = path.replace(/\.js$/u, ".ts");
            if (path.startsWith(miniRoot) && existsSync(source))
              return {
                format: "commonjs",
                shortCircuit: true,
                source: ts.transpileModule(readFileSync(source, "utf8"), {
                  compilerOptions: {
                    target: ts.ScriptTarget.ES2020,
                    module: ts.ModuleKind.CommonJS,
                  },
                }).outputText,
              };
          }
          return nextLoad(url, context);
        },
      });
after(() => hook?.deregister());

function clearRuntime() {
  for (const path of Object.keys(require.cache)) {
    if (path.startsWith(miniRoot)) delete require.cache[path];
  }
}

async function withPage(relativePath, check) {
  const previousPage = Object.getOwnPropertyDescriptor(globalThis, "Page");
  const previousWx = Object.getOwnPropertyDescriptor(globalThis, "wx");
  const navigation = [];
  const requests = [];
  let page;
  try {
    clearRuntime();
    globalThis.Page = (definition) => {
      page = definition;
    };
    globalThis.wx = {
      navigateTo: ({ url }) => navigation.push({ method: "navigateTo", url }),
      redirectTo: ({ url }) => navigation.push({ method: "redirectTo", url }),
      reLaunch: ({ url }) => navigation.push({ method: "reLaunch", url }),
      request(options) {
        requests.push({ url: options.url, method: options.method });
        assert.equal(options.url, "http://127.0.0.1:4317/local/profiles");
        options.success({ statusCode: 200, data: { mode: "local-synthetic", profiles: [] } });
      },
    };
    require(resolve(miniRoot, relativePath));
    page.setData = function (patch) {
      Object.assign(this.data, patch);
    };
    await check({ page, navigation, requests });
  } finally {
    page?.onUnload?.();
    clearRuntime();
    if (previousPage) Object.defineProperty(globalThis, "Page", previousPage);
    else delete globalThis.Page;
    if (previousWx) Object.defineProperty(globalThis, "wx", previousWx);
    else delete globalThis.wx;
  }
}

const sectionEvent = (section) => ({ currentTarget: { dataset: { section } } });
const template = (path) => readFileSync(resolve(miniRoot, path), "utf8");
const offlineTemplate = (path) => {
  const value = template(path);
  const start = value.indexOf('<block wx:if="{{!sharedMode}}">');
  assert.ok(start >= 0, "the remaining offline views must stay behind their existing gate");
  return value.slice(start, value.lastIndexOf("</block>"));
};

test("the section resolver accepts only the four exact section strings", () => {
  clearRuntime();
  const { resolveStaffQuickSection } = require(
    resolve(miniRoot, "src/pages/staff/quick-action.js"),
  );
  assert.equal(typeof resolveStaffQuickSection, "function");
  for (const section of ["work", "records", "parents", "services"]) {
    assert.equal(resolveStaffQuickSection(section), section);
  }
  for (const value of [
    undefined,
    null,
    "",
    "Parents",
    " parents",
    "parents?x=1",
    "__proto__",
    1,
    true,
    ["parents"],
    { toString: () => "parents" },
  ]) {
    assert.equal(resolveStaffQuickSection(value), "work");
  }
});

test("the real quick Page initializes each shared section from the route and keeps tab guards", async () => {
  await withPage("pages/staff/quick-action/index.js", async ({ page }) => {
    assert.equal(page.data.sharedMode, true);
    for (const section of ["work", "records", "parents", "services"]) {
      page.onLoad({ section });
      assert.equal(page.data.staffSection, section);
      await page.onShow();
      assert.equal(page.data.staffSection, section);
    }
    page.handleStaffSectionChange(sectionEvent("parents"));
    page.handleStaffSectionChange(sectionEvent("invalid"));
    assert.equal(page.data.staffSection, "parents");
    const before = globalThis.structuredClone(page.data);
    page.handleAction({ currentTarget: { dataset: { action: "REVIEW_TASKS" } } });
    assert.deepEqual(page.data, before, "shared mode still blocks offline business handlers");
  });
});

test("the real quick Page falls back to work for missing or malformed route sections", async () => {
  await withPage("pages/staff/quick-action/index.js", ({ page }) => {
    for (const section of [undefined, null, "invalid", ["parents"], { section: "parents" }, 1]) {
      page.handleStaffSectionChange(sectionEvent("parents"));
      page.onLoad({ section });
      assert.equal(page.data.staffSection, "work");
    }
    page.onLoad();
    assert.equal(page.data.staffSection, "work");
  });
});

test("the default shared workbench opens parent review without selecting an identity or writing data", async () => {
  await withPage("pages/staff/workbench/index.js", ({ page, navigation, requests }) => {
    page.onLoad();
    assert.equal(page.data.sharedMode, true);
    assert.equal(page.data.shared.session, null);
    page.handleBindingReviewEntry();
    assert.deepEqual(navigation, [
      { method: "redirectTo", url: "/pages/staff/quick-action/index?section=parents" },
    ]);
    assert.equal(page.data.shared.session, null);
    assert.equal(requests.length, 0, "navigation must not create a session or submit a review");
    page.handleLearningEntry();
    assert.equal(navigation.length, 1, "the teacher-only learning guard remains intact");
  });
});

test("the offline workbench opens the same parent section without a pending application", async () => {
  await withPage("pages/staff/workbench/index.js", ({ page, navigation, requests }) => {
    page.handleSharedOffline();
    assert.equal(page.data.sharedMode, false);
    page.handleBindingReviewEntry();
    assert.deepEqual(navigation, [
      { method: "navigateTo", url: "/pages/staff/quick-action/index?section=parents" },
    ]);
    assert.equal(requests.length, 0);
  });
});

test("one stable parent review card is visible outside the offline-only block", () => {
  const value = template("pages/staff/workbench/index.wxml");
  const cards = [...value.matchAll(/<view\b[^>]*class="[^"]*\bbinding-entry-card\b[^"]*"[^>]*>/gu)];
  assert.equal(cards.length, 1);
  assert.equal(
    /\bwx:if=/u.test(cards[0][0]),
    false,
    "review entry must not depend on an old pending application",
  );
  const offlineStart = value.indexOf('<block wx:if="{{!sharedMode}}">');
  const offlineEnd = value.lastIndexOf("</block>");
  assert.ok(
    cards[0].index < offlineStart || cards[0].index > offlineEnd,
    "default shared mode must render the same entry",
  );
  assert.equal(
    value.includes('bindchange="handleBindingRoleChange"'),
    false,
    "identity selection belongs to the destination shared flow",
  );
});

test("offline staff growth editing is replaced by shared guidance while other local flows remain", () => {
  const value = offlineTemplate("pages/staff/quick-action/index.wxml");
  assert.equal(value.includes("care-record-shared-guidance"), true);
  const guidance =
    value.match(/<view[^>]*care-record-shared-guidance[^>]*>([\s\S]*?)<\/view>/u)?.[1] ?? "";
  assert.equal(
    /页面顶部|进入本机协同/u.test(guidance),
    false,
    "guidance must not direct users to a nonexistent mode switch",
  );
  assert.equal(/bind(?:tap|change)="handleCareRecord/u.test(value), false);
  assert.equal(/\bcareRecordRecords\b/u.test(value), false);
  for (const handler of [
    "handleBindingReview",
    "handleIncidentAction",
    "handleLeaveReviewAction",
    "handlePickupAction",
    "handleSupplyRequestAction",
  ]) {
    assert.equal(value.includes(`bindtap="${handler}"`), true, handler);
  }
  assert.equal(/模拟数据 · 仅在本机(?:演示|使用)，暂不与网页同步/u.test(value), true);
  assert.equal(/aria-label="选择(?:物资申请体验身份|当前员工角色)"/u.test(value), true);
});

test("offline parent growth details and acknowledgements use shared guidance without removing other services", () => {
  const value = offlineTemplate("pages/parent/home/index.wxml");
  assert.equal(value.includes("growth-record-shared-guidance"), true);
  const guidance =
    value.match(/<view[^>]*growth-record-shared-guidance[^>]*>([\s\S]*?)<\/view>/u)?.[1] ?? "";
  assert.equal(
    /页面顶部|进入本机协同/u.test(guidance),
    false,
    "guidance must not direct users to a nonexistent mode switch",
  );
  assert.equal(/updates\.(?:careRecords|selectedCare)/u.test(value), false);
  assert.equal(/bindtap="handle(?:View|Acknowledge)Care"/u.test(value), false);
  for (const handler of [
    "handleBinding",
    "handleAcknowledgeNotice",
    "handleAcknowledgeLeave",
    "handleAcknowledgeHealth",
    "handlePickupAction",
  ]) {
    assert.equal(value.includes(`bindtap="${handler}"`), true, handler);
  }
  assert.equal(
    template("pages/parent/home/index.wxml").includes('url="/pages/parent/learning/index"'),
    true,
  );
});
