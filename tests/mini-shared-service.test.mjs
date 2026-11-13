/* global fetch */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { request } from "node:http";
import { resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL, URL } from "node:url";
import process from "node:process";
import test from "node:test";

const miniRoot = resolve("apps/mini-program");
const generated = process.env.MINI_SHARED_RUNTIME === "generated";
if (!generated)
  registerHooks({
    resolve(specifier, context, nextResolve) {
      if (
        specifier.endsWith(".js") &&
        context.parentURL?.startsWith(pathToFileURL(miniRoot + sep).href)
      ) {
        const source = fileURLToPath(new URL(specifier, context.parentURL)).replace(
          /\.js$/u,
          ".ts",
        );
        if (source.startsWith(miniRoot + sep) && existsSync(source))
          return nextResolve(pathToFileURL(source).href, context);
      }
      return nextResolve(specifier, context);
    },
  });
const sharedCoreRoot = resolve(
  process.env.LOCAL_SYNTHETIC_CORE_ROOT ?? "../task20-local-shared-core",
);
const sharedCoreEntry = resolve(sharedCoreRoot, "apps/api/dist/src/local-synthetic/server.js");
if (!existsSync(sharedCoreEntry)) {
  throw new Error(
    "Mini shared-service tests need the local shared-core build. Set LOCAL_SYNTHETIC_CORE_ROOT to its folder.",
  );
}
const { buildLocalSyntheticServer } = await import(pathToFileURL(sharedCoreEntry));
const captured = new Map();
const requests = [];
let serviceOrigin;
let registered;
globalThis.Page = (page) => {
  registered = page;
};
globalThis.wx = {
  navigateTo() {},
  redirectTo() {},
  reLaunch() {},
  navigateBack() {},
  request(options) {
    const fixedMiniTarget = options.url.startsWith("http://127.0.0.1:4317/local/");
    const targetUrl = fixedMiniTarget
      ? options.url.replace("http://127.0.0.1:4317", serviceOrigin)
      : options.url;
    assert.ok(targetUrl.startsWith(`${serviceOrigin}/local/`));
    requests.push({ url: targetUrl, method: options.method, body: options.data });
    const req = request(
      targetUrl,
      { method: options.method, headers: options.header, timeout: options.timeout },
      (response) => {
        let body = "";
        response.on("data", (part) => {
          body += part;
        });
        response.on("end", () =>
          options.success({ statusCode: response.statusCode, data: JSON.parse(body) }),
        );
      },
    );
    req.on("error", options.fail);
    req.on("timeout", () => req.destroy(new Error("timeout")));
    req.end(options.data ? JSON.stringify(options.data) : undefined);
    return { abort: () => req.destroy() };
  },
};
async function page(path) {
  if (captured.has(path)) return captured.get(path);
  await import(pathToFileURL(resolve(miniRoot, `${path}/index.${generated ? "js" : "ts"}`)));
  assert.ok(registered);
  const instance = registered;
  instance.setData = function (patch) {
    this.data = { ...this.data, ...patch };
  };
  captured.set(path, instance);
  return instance;
}
async function invoke(instance, name, event) {
  assert.equal(typeof instance[name], "function", name);
  await instance[name].call(instance, event);
}
const event = (action, row) => ({
  currentTarget: {
    dataset: {
      action,
      id: row?.id,
      version: row?.version,
      bindingId: row?.bindingId,
      publicationVersion: row?.publicationVersion,
    },
  },
});
async function profile(instance, alias) {
  const index = instance.data.shared.profiles.findIndex((p) => p.profile === alias);
  assert.ok(index >= 0, alias);
  await invoke(instance, "handleSharedProfile", { detail: { value: String(index + 1) } });
  assert.equal(instance.data.shared.status, "READY");
}
const command = (instance, action, row) =>
  invoke(instance, "handleSharedCommand", event(action, row));
const monthlyAction = (instance, action, row) =>
  invoke(instance, "handleSharedMonthlyFeedbackAction", {
    currentTarget: { dataset: { action, id: row?.id, version: row?.version } },
  });
const resourceAction = (instance, action, row) =>
  invoke(instance, "handleSharedResourceAction", {
    currentTarget: { dataset: { action, id: row?.id, version: row?.version } },
  });
const httpCommand = (path, body, handle) =>
  new Promise((resolve, reject) =>
    globalThis.wx.request({
      url: `${serviceOrigin}${path}`,
      method: "POST",
      timeout: 5000,
      header: {
        "Content-Type": "application/json",
        ...(handle ? { Authorization: `Bearer ${handle}` } : {}),
      },
      data: body,
      success: (response) => {
        assert.ok(response.statusCode < 300);
        resolve(response.data);
      },
      fail: reject,
    }),
  );
async function show(instance) {
  await invoke(instance, "onShow");
}

test("Mini actual Page handlers use one HTTP authority for binding, leave and care flows", async () => {
  const server = await buildLocalSyntheticServer({ mode: "local-synthetic" });
  serviceOrigin = await server.start(0);
  try {
    const parent = await page("pages/parent/home");
    const bindingPage = await page("pages/parent/binding");
    const workbench = await page("pages/staff/workbench");
    const quick = await page("pages/staff/quick-action");
    await show(bindingPage);
    await invoke(bindingPage, "handleSharedEnable");
    await profile(bindingPage, "parent-alpha");
    await command(bindingPage, "binding-submit");
    const binding = bindingPage.data.shared.bindings[0];
    assert.equal(binding.status, "PENDING");
    await invoke(bindingPage, "onHide");
    await show(workbench);
    await profile(workbench, "teacher-east");
    assert.equal(workbench.data.shared.canReviewBinding, false);
    const writes = requests.length;
    await command(workbench, "binding-approve", binding);
    assert.equal(requests.length, writes);
    await profile(workbench, "owner-west");
    assert.equal(workbench.data.shared.bindings.length, 0);
    await profile(workbench, "owner-east");
    assert.equal(workbench.data.shared.bindings[0].id, binding.id);
    const beforeMalformed = requests.length;
    await invoke(workbench, "handleSharedCommand", {
      currentTarget: { dataset: { action: "binding-approve", id: binding.id, version: [1] } },
    });
    assert.equal(requests.length, beforeMalformed, "array version must not become an approval");
    await command(workbench, "binding-approve", workbench.data.shared.bindings[0]);
    await invoke(workbench, "onHide");
    await show(parent);
    await profile(parent, "parent-alpha");
    assert.equal(parent.data.shared.bindings[0].status, "APPROVED");
    await invoke(parent, "handleSharedDate", {
      currentTarget: { dataset: { field: "startDate" } },
      detail: { value: "2026-10-06" },
    });
    await invoke(parent, "handleSharedDate", {
      currentTarget: { dataset: { field: "endDate" } },
      detail: { value: "2026-10-06" },
    });
    await command(parent, "leave-submit");
    const leaveId = parent.data.shared.leaves[0].id;
    await invoke(parent, "onHide");
    await show(quick);
    await profile(quick, "teacher-east");
    await command(quick, "leave-return", quick.data.shared.leaves[0]);
    await profile(quick, "parent-alpha");
    assert.equal(quick.data.shared.leaves[0].acknowledged, false);
    await command(quick, "leave-receipt", quick.data.shared.leaves[0]);
    await invoke(quick, "handleSharedReason", { detail: { value: "1" } });
    await command(quick, "leave-resubmit", quick.data.shared.leaves[0]);
    assert.equal(quick.data.shared.leaves[0].id, leaveId);
    assert.equal(quick.data.shared.leaves[0].acknowledged, false);
    await profile(quick, "teacher-east");
    await command(quick, "leave-confirm", quick.data.shared.leaves[0]);
    await profile(quick, "parent-alpha");
    await command(quick, "leave-receipt", quick.data.shared.leaves[0]);
    assert.equal(quick.data.shared.leaves[0].version, 6);
    assert.equal(
      quick.data.shared.leaves[0].history.some((h) => h.status === "RETURNED" && h.acknowledged),
      true,
    );

    await profile(quick, "teacher-east");
    await invoke(quick, "handleSharedDate", {
      currentTarget: { dataset: { field: "careDate" } },
      detail: { value: "2026-10-06" },
    });
    await invoke(quick, "handleSharedCareField", {
      currentTarget: { dataset: { field: "homework" } },
      detail: { value: "1" },
    });
    await command(quick, "care-create");
    let care = quick.data.shared.care[0];
    assert.equal(care.status, "DRAFT");
    assert.equal(care.values.homework, "IN_PROGRESS");
    await command(quick, "care-submit", care);
    const stale = { ...quick.data.shared.care[0] };
    await command(quick, "care-confirm", stale);
    assert.equal(quick.data.shared.care[0].status, "SUBMITTED");
    await profile(quick, "owner-east");
    await command(quick, "care-return", quick.data.shared.care[0]);
    await profile(quick, "teacher-east");
    await command(quick, "care-resubmit", quick.data.shared.care[0]);
    await profile(quick, "owner-east");
    const beforeExternalReview = { ...quick.data.shared.care[0] };
    const outsideOwner = await httpCommand("/local/sessions", { profile: "owner-east" });
    await httpCommand(
      `/local/care-records/${quick.data.shared.care[0].id}/review`,
      { version: quick.data.shared.care[0].version, action: "escalate" },
      outsideOwner.handle,
    );
    const staleReviewStart = requests.length;
    await command(quick, "care-confirm", beforeExternalReview);
    const staleReviews = requests
      .slice(staleReviewStart)
      .filter(
        (request) =>
          request.method === "POST" &&
          request.url.endsWith(`/care-records/${beforeExternalReview.id}/review`),
      );
    assert.equal(staleReviews.length, 1, "an authorized reviewer must reach the version guard");
    assert.deepEqual(staleReviews[0].body, {
      version: beforeExternalReview.version,
      action: "confirm",
    });
    assert.equal(quick.data.shared.profile, "owner-east");
    assert.match(quick.data.shared.message, /资料已变化或存在重复/u);
    assert.equal(quick.data.shared.care[0].status, "EXCEPTION_PENDING");
    assert.equal(quick.data.shared.care[0].version, beforeExternalReview.version + 1);
    assert.equal(quick.data.shared.care[0].published, false);
    const obsoleteEventStart = requests.length;
    await command(quick, "care-confirm", beforeExternalReview);
    assert.equal(
      requests.length,
      obsoleteEventStart,
      "the refreshed page ignores an obsolete action",
    );
    await invoke(quick, "handleSharedRefresh");
    assert.equal(quick.data.shared.care[0].status, "EXCEPTION_PENDING");
    assert.equal(quick.data.shared.pendingCare, 1);
    assert.equal(
      quick.data.shared.care[0].buttons.some((button) => button.action === "care-confirm"),
      true,
    );
    await command(quick, "care-confirm", quick.data.shared.care[0]);
    assert.equal(quick.data.shared.care[0].published, false);
    await command(quick, "care-publish", quick.data.shared.care[0]);
    care = { ...quick.data.shared.care[0] };

    await profile(quick, "teacher-east");
    quick.setData({ sharedForm: { ...quick.data.sharedForm, dailyDate: care.date } });
    await invoke(quick, "handleSharedDailyAction", {
      currentTarget: { dataset: { action: "daily-create" } },
    });
    const daily = quick.data.shared.staffDailyReports.find((row) => row.date === care.date);
    assert.ok(daily);
    assert.deepEqual(
      daily.sourceRefs.find((source) => source.kind === "CARE_RECORD"),
      { kind: "CARE_RECORD", id: care.id, version: care.version },
    );
    assert.match(daily.sourceSummary, /托管记录 1/u);
    assert.equal(JSON.stringify(daily).includes(care.studentId), false);
    await invoke(quick, "onHide");
    await show(parent);
    await profile(parent, "parent-alpha");
    assert.equal(parent.data.shared.care[0].id, care.id);
    assert.equal(parent.data.shared.care[0].receipt, "UNREAD");
    assert.equal(parent.data.shared.care[0].details.length, 0);
    await command(parent, "care-acknowledge", parent.data.shared.care[0]);
    assert.equal(parent.data.shared.care[0].receipt, "UNREAD");
    await command(parent, "care-read", parent.data.shared.care[0]);
    assert.equal(parent.data.shared.care[0].details.length, 6);
    await command(parent, "care-acknowledge", parent.data.shared.care[0]);
    assert.equal(parent.data.shared.care[0].receipt, "ACKNOWLEDGED");
    assert.equal("history" in parent.data.shared.care[0], false);
    await profile(parent, "parent-beta");
    assert.equal(parent.data.shared.care.length, 0);
    await command(parent, "binding-submit");
    const betaBinding = { ...parent.data.shared.bindings[0] };
    await profile(parent, "owner-east");
    await command(
      parent,
      "binding-approve",
      parent.data.shared.bindings.find((b) => b.id === betaBinding.id),
    );
    await profile(parent, "parent-beta");
    assert.equal(
      parent.data.shared.care[0].receipt,
      "UNREAD",
      "second guardian does not inherit acknowledgement",
    );
    await command(parent, "care-read", parent.data.shared.care[0]);
    await command(parent, "care-acknowledge", parent.data.shared.care[0]);
    await profile(parent, "parent-alpha");
    await command(parent, "binding-release", parent.data.shared.bindings[0]);
    assert.equal(parent.data.shared.care.length, 0);
    await profile(parent, "parent-beta");
    assert.equal(
      parent.data.shared.care[0].receipt,
      "ACKNOWLEDGED",
      "releasing another guardian preserves my result",
    );
    await profile(parent, "parent-alpha");
    await command(parent, "binding-submit");
    const rebound = parent.data.shared.bindings.find((b) => b.status === "PENDING");
    await profile(parent, "owner-east");
    await command(
      parent,
      "binding-approve",
      parent.data.shared.bindings.find((b) => b.id === rebound.id),
    );
    await profile(parent, "parent-alpha");
    assert.equal(
      parent.data.shared.care[0].receipt,
      "UNREAD",
      "new binding cannot inherit old receipt",
    );
    const invalidBefore = requests.length;
    await invoke(parent, "handleSharedProfile", { detail: { value: [0] } });
    assert.equal(parent.data.shared.session, null);
    assert.equal(parent.data.shared.care.length, 0);
    await command(parent, "care-read", care);
    assert.equal(requests.length, invalidBefore);
    await profile(parent, "owner-other-tenant");
    assert.equal(parent.data.shared.care.length, 0);
    await profile(parent, "platform-admin");
    assert.equal(parent.data.shared.care.length, 0);
    await profile(parent, "teacher-east-peer");
    assert.equal(parent.data.shared.care.length, 0);
    await profile(parent, "owner-east");
    await command(parent, "care-revoke", parent.data.shared.care[0]);
    await profile(parent, "parent-alpha");
    assert.equal(parent.data.shared.care.length, 0);
    await profile(parent, "teacher-east");
    await command(parent, "care-edit-start", parent.data.shared.care[0]);
    assert.equal(parent.data.sharedForm.editId, care.id);
    await invoke(parent, "handleSharedCareField", {
      currentTarget: { dataset: { field: "wellbeing" } },
      detail: { value: "1" },
    });
    await command(parent, "care-edit", parent.data.shared.care[0]);
    assert.equal(parent.data.shared.care[0].status, "DRAFT");
    assert.equal(parent.data.shared.care[0].values.wellbeing, "CHECK_IN");
    await command(parent, "care-submit", parent.data.shared.care[0]);
    await profile(parent, "owner-east");
    await command(parent, "care-confirm", parent.data.shared.care[0]);
    await command(parent, "care-publish", parent.data.shared.care[0]);
    await profile(parent, "parent-beta");
    assert.equal(
      parent.data.shared.care[0].receipt,
      "UNREAD",
      "new publication resets another guardian receipt too",
    );
    await profile(parent, "parent-alpha");
    assert.equal(parent.data.shared.care[0].receipt, "UNREAD");
    await command(parent, "care-read", parent.data.shared.care[0]);
    assert.equal(
      parent.data.shared.care[0].details.find((detail) => detail.label === "一般状态").value,
      "需要老师留意",
    );
    await command(parent, "binding-release", parent.data.shared.bindings[0]);
    assert.equal(parent.data.shared.leaves.length, 0);
    await profile(parent, "owner-east");
    assert.equal(parent.data.shared.leaves.length, 0);
    assert.equal(
      requests.every((r) => !JSON.stringify(r.body ?? {}).includes("tenantId")),
      true,
    );
    await server.close();
    await invoke(parent, "handleSharedRefresh");
    assert.equal(parent.data.shared.status, "DISCONNECTED");
    assert.equal(parent.data.shared.bindings.length, 0);
    assert.equal(parent.data.sharedMode, true);
    await invoke(parent, "handleSharedOffline");
    assert.equal(parent.data.sharedMode, false);
    assert.deepEqual(parent.data.sharedReasons, []);
    assert.deepEqual(parent.data.sharedCareFields, []);
  } finally {
    await server.close();
  }
});

test("Mini monthly feedback is one shared employee-to-parent workflow", async () => {
  const server = await buildLocalSyntheticServer({ mode: "local-synthetic" });
  serviceOrigin = await server.start(0);
  const requestStart = requests.length;
  try {
    const bindingPage = await page("pages/parent/binding");
    await show(bindingPage);
    await invoke(bindingPage, "handleSharedEnable");
    await profile(bindingPage, "parent-alpha");
    await command(bindingPage, "binding-submit");
    const application = bindingPage.data.shared.bindings[0];
    assert.equal(application.status, "PENDING");

    const workbench = await page("pages/staff/workbench");
    await invoke(bindingPage, "onHide");
    await show(workbench);
    await profile(workbench, "owner-east");
    await command(workbench, "binding-approve", workbench.data.shared.bindings[0]);

    const quick = await page("pages/staff/quick-action");
    await invoke(workbench, "onHide");
    await show(quick);
    await profile(quick, "teacher-east");
    assert.equal(quick.data.shared.showMonthlyFeedback, true);
    await invoke(quick, "handleSharedMonthlyFeedbackField", {
      currentTarget: { dataset: { field: "month" } },
      detail: { value: "2026-10-15" },
    });
    await invoke(quick, "handleSharedMonthlyFeedbackField", {
      currentTarget: { dataset: { field: "learningParticipation" } },
      detail: { value: "2" },
    });
    await monthlyAction(quick, "create");
    let feedback = quick.data.shared.monthlyFeedbackRows[0];
    assert.equal(feedback.month, "2026-10");
    assert.equal(feedback.status, "DRAFT");
    assert.equal(feedback.values[0].valueLabel, "需要跟进");
    assert.equal(JSON.stringify(feedback).includes("sourceRefs"), false);
    await monthlyAction(quick, "submit", feedback);
    feedback = quick.data.shared.monthlyFeedbackRows[0];
    assert.equal(feedback.status, "SUBMITTED");

    await profile(quick, "owner-east");
    feedback = quick.data.shared.monthlyFeedbackRows[0];
    assert.equal(feedback.canReview, true);
    await monthlyAction(quick, "confirm", feedback);
    feedback = quick.data.shared.monthlyFeedbackRows[0];
    assert.equal(feedback.status, "CONFIRMED");
    await monthlyAction(quick, "publish", feedback);
    feedback = quick.data.shared.monthlyFeedbackRows[0];
    assert.equal(feedback.status, "PUBLISHED");
    const sharedId = feedback.id;
    const publishedVersion = feedback.version;

    const parent = await page("pages/parent/home");
    await invoke(quick, "onHide");
    await show(parent);
    await profile(parent, "parent-alpha");
    assert.equal(parent.data.shared.showMonthlyFeedback, true);
    let parentFeedback = parent.data.shared.monthlyFeedbackParentRows[0];
    assert.equal(parentFeedback.id, sharedId);
    assert.equal(parentFeedback.statusLabel, "已发布给家长");
    assert.equal("sourceSummary" in parentFeedback, false);
    assert.equal("sources" in parentFeedback, false);
    assert.equal(
      requests
        .slice(requestStart)
        .every((entry) => entry.url.startsWith(`${serviceOrigin}/local/`)),
      true,
    );
    await monthlyAction(parent, "ack", parentFeedback);
    parentFeedback = parent.data.shared.monthlyFeedbackParentRows[0];
    assert.equal(parentFeedback.acknowledged, true);
    assert.ok(parentFeedback.version >= publishedVersion);

    await invoke(parent, "onHide");
    await show(quick);
    await profile(quick, "teacher-east");
    await invoke(quick, "handleSharedDate", {
      currentTarget: { dataset: { field: "careDate" } },
      detail: { value: "2026-10-16" },
    });
    await command(quick, "care-create");
    let care = quick.data.shared.care.find((row) => row.date === "2026-10-16");
    assert.ok(care);
    await command(quick, "care-submit", care);
    await profile(quick, "owner-east");
    care = quick.data.shared.care.find((row) => row.date === "2026-10-16");
    await command(quick, "care-confirm", care);
    care = quick.data.shared.care.find((row) => row.date === "2026-10-16");
    await command(quick, "care-publish", care);
    feedback = quick.data.shared.monthlyFeedbackRows.find((row) => row.id === sharedId);
    assert.equal(feedback.status, "REVIEW_REQUIRED");

    await invoke(quick, "onHide");
    await show(parent);
    await profile(parent, "parent-alpha");
    parentFeedback = parent.data.shared.monthlyFeedbackParentRows[0];
    assert.equal(parentFeedback.id, sharedId);
    assert.equal(parentFeedback.statusLabel, "来源变化，待重新审核");
    assert.deepEqual(parentFeedback.items, []);
    assert.equal(parentFeedback.acknowledged, false);

    await invoke(parent, "onHide");
    await show(quick);
    await profile(quick, "teacher-east");
    feedback = quick.data.shared.monthlyFeedbackRows.find((row) => row.id === sharedId);
    await monthlyAction(quick, "edit-start", feedback);
    await monthlyAction(quick, "edit", feedback);
    assert.equal(quick.data.shared.status, "READY", quick.data.shared.message);
    feedback = quick.data.shared.monthlyFeedbackRows.find((row) => row.id === sharedId);
    assert.equal(feedback.status, "DRAFT");
    assert.equal(feedback.sourceVersion, 2);
    assert.equal(
      feedback.sourceSummary.some((summary) => summary.includes("已发布成长记录 1 条")),
      true,
    );
    await monthlyAction(quick, "submit", feedback);
    feedback = quick.data.shared.monthlyFeedbackRows.find((row) => row.id === sharedId);
    assert.equal(feedback.status, "SUBMITTED");
  } finally {
    await server.close();
  }
});

test("Mini shared templates preserve simple access and separate unconnected features", () => {
  const template = readFileSync(resolve(miniRoot, "templates/local-synthetic.wxml"), "utf8");
  assert.match(template, /同一台电脑/u);
  assert.match(template, /健康.*通知/u);
  assert.match(template, /handleSharedCommand/u);
  assert.match(template, /data-action="care-edit"/u);
  assert.match(template, /sharedForm\.editVersion/u);
  assert.match(template, /handleSharedMonthlyFeedbackAction/u);
  assert.match(template, /monthlyFeedbackParentRows/u);
  assert.match(template, /shared\.showResourceLibrary/u);
  assert.match(template, /data-resource-item/u);
  assert.match(template, /data-resource-detail/u);
  assert.match(template, /data-resource-collection="favorites"/u);
  assert.match(template, /data-resource-collection="recent"/u);
  assert.match(template, /handleSharedResourceAction/u);
  assert.doesNotMatch(template, /日报与月度反馈仍为独立展示/u);
  assert.doesNotMatch(template, /monthly-feedback-panel/u);
  for (const name of ["parent/home", "parent/binding", "staff/workbench", "staff/quick-action"]) {
    const markup = readFileSync(resolve(miniRoot, "pages", name, "index.wxml"), "utf8");
    assert.match(markup, /local-synthetic\.wxml/u);
    assert.match(markup, /!sharedMode/u);
  }
});

test("Mini quick page browses, opens, favorites and records only the current shared resource scope", async () => {
  const server = await buildLocalSyntheticServer({ mode: "local-synthetic" });
  serviceOrigin = await server.start(0);
  const requestStart = requests.length;
  try {
    const quick = await page("pages/staff/quick-action");
    await show(quick);
    await invoke(quick, "handleSharedOffline");
    await invoke(quick, "handleSharedEnable");
    await profile(quick, "teacher-east");
    assert.equal(quick.data.shared.showResourceLibrary, true);
    const campusResource = quick.data.shared.resources.find(
      (row) => row.title === "示例数学活动卡",
    );
    const classResource = quick.data.shared.resources.find((row) => row.title === "示例阅读引导单");
    assert.ok(campusResource);
    assert.ok(classResource);
    assert.equal(campusResource.scopeLabel, "本校区");
    assert.equal(campusResource.sourceLabel, "校内教研组（合成示例）");
    assert.equal(
      quick.data.shared.resources.some((row) => /已过期|已撤回/u.test(row.title)),
      false,
    );

    await resourceAction(quick, "open", campusResource);
    assert.equal(quick.data.shared.selectedResource.id, campusResource.id);
    assert.equal(quick.data.shared.selectedResource.version, campusResource.version);
    await resourceAction(quick, "favorite", quick.data.shared.selectedResource);
    assert.equal(quick.data.shared.resourceFavorites[0]?.id, campusResource.id);
    await resourceAction(
      quick,
      "use",
      quick.data.shared.resources.find((row) => row.id === campusResource.id),
    );
    assert.equal(quick.data.shared.resourceRecent[0]?.id, campusResource.id);

    await profile(quick, "teacher-east-peer");
    assert.deepEqual(
      quick.data.shared.resourceFavorites,
      [],
      "favorites are separated by synthetic identity",
    );
    await profile(quick, "teacher-other-class");
    assert.equal(
      quick.data.shared.resources.some((row) => row.id === classResource.id),
      false,
    );
    assert.equal(
      quick.data.shared.resources.some((row) => row.id === campusResource.id),
      true,
    );
    assert.equal(
      requests
        .slice(requestStart)
        .every((entry) => entry.url.startsWith(`${serviceOrigin}/local/`)),
      true,
    );
  } finally {
    await server.close();
  }
});

test("a late profile response never updates a hidden Mini page", async () => {
  const parent = await page("pages/parent/home");
  const originalRequest = globalThis.wx.request;
  let delayed;
  globalThis.wx.request = (options) => {
    delayed = options;
    return { abort() {} };
  };
  let updates = 0;
  const originalSetData = parent.setData;
  parent.setData = function (patch) {
    updates++;
    originalSetData.call(this, patch);
  };
  try {
    const pending = invoke(parent, "handleSharedEnable");
    assert.ok(delayed);
    await invoke(parent, "onHide");
    const afterHide = updates;
    delayed.success({
      statusCode: 200,
      data: {
        mode: "local-synthetic",
        profiles: [{ profile: "parent-alpha", label: "示例监护人甲" }],
      },
    });
    await pending;
    assert.equal(updates, afterHide);
    await invoke(parent, "handleSharedOffline");
  } finally {
    parent.setData = originalSetData;
    globalThis.wx.request = originalRequest;
  }
});

test("Mini completion and Admin check update one shared task version", async () => {
  const server = await buildLocalSyntheticServer({ mode: "local-synthetic" });
  serviceOrigin = await server.start(0);
  const quick = await page("pages/staff/quick-action");
  try {
    await invoke(quick, "handleSharedOffline");
    await invoke(quick, "handleSharedEnable");
    await show(quick);

    const owner = await httpCommand("/local/sessions", { profile: "owner-east" });
    const assigneeResponse = await globalThis.fetch(`${serviceOrigin}/local/staff-task-assignees`, {
      headers: { Authorization: `Bearer ${owner.handle}` },
    });
    assert.equal(assigneeResponse.status, 200);
    const assignees = await assigneeResponse.json();
    const assignee = assignees.find(
      (row) => row.actorId === "00000000-0000-4000-8000-000000000003",
    );
    assert.ok(assignee);
    const created = await httpCommand(
      "/local/staff-tasks",
      {
        code: "ACTIVITY_SETUP",
        assigneeId: assignee.actorId,
        targetType: "ACTIVITY",
        targetId: "ART_WORKSHOP",
        dueDate: "2026-10-13",
        priority: "IMPORTANT",
      },
      owner.handle,
    );

    await profile(quick, "teacher-east");
    const findTask = () => quick.data.shared.staffTasks.find((row) => row.id === created.id);
    let task = findTask();
    assert.equal(task?.status, "ASSIGNED");
    assert.equal(task?.canClaim, true);

    const requestStart = requests.length;
    await invoke(quick, "handleSharedTaskAction", event("claim", task));
    task = findTask();
    assert.equal(task?.status, "CLAIMED");
    assert.equal(task?.version, created.version + 1);
    assert.equal(task?.canStart, true);

    const afterClaim = requests.length;
    await invoke(quick, "handleSharedTaskAction", event("start", created));
    assert.equal(requests.length, afterClaim, "旧版本按钮不能提交任务操作");

    await invoke(quick, "handleSharedTaskAction", event("start", task));
    task = findTask();
    assert.equal(task?.status, "IN_PROGRESS");
    assert.equal(task?.canComplete, true);
    await invoke(quick, "handleSharedTaskResultChange", { detail: { value: "0" } });
    await invoke(quick, "handleSharedTaskAction", event("complete", task));
    task = findTask();
    assert.equal(task?.status, "COMPLETED");
    assert.equal(task?.result, "COMPLETED_AS_PLANNED");
    assert.equal(task?.resultLabel, "按计划完成");
    assert.equal(task?.version, created.version + 3);
    assert.ok(
      requests
        .slice(requestStart)
        .some((row) => row.url.endsWith(`/local/staff-tasks/${created.id}/complete`)),
    );

    const { StaffTaskAssignmentClient } =
      await import("../apps/admin-web/dist/local-review/task-assignment.js");
    const admin = new StaffTaskAssignmentClient((path, init) =>
      globalThis.fetch(new URL(path, serviceOrigin), init),
    );
    await admin.connect();
    assert.equal(admin.snapshot.status, "READY");
    const reviewTask = admin.snapshot.tasks.find((row) => row.id === created.id);
    assert.equal(reviewTask?.status, "COMPLETED");
    assert.equal(reviewTask?.version, task.version);
    await admin.review(created.id, task.version, "CONFIRM");
    const checked = admin.snapshot.tasks.find((row) => row.id === created.id);
    assert.equal(checked?.status, "CHECKED");
    assert.equal(checked?.version, task.version + 1);
    assert.equal(checked?.checkerId, admin.snapshot.session?.actorId);

    await profile(quick, "teacher-east");
    task = findTask();
    assert.equal(task?.id, created.id);
    assert.equal(task?.status, "CHECKED");
    assert.equal(task?.version, checked?.version);
  } finally {
    await invoke(quick, "handleSharedOffline");
    await server.close();
  }
});

test("Mini internal daily report is returned, resubmitted and confirmed across roles", async () => {
  const server = await buildLocalSyntheticServer({ mode: "local-synthetic" });
  serviceOrigin = await server.start(0);
  const quick = await page("pages/staff/quick-action");
  try {
    await invoke(quick, "handleSharedOffline");
    await invoke(quick, "handleSharedEnable");
    await show(quick);
    await profile(quick, "teacher-east");

    await invoke(quick, "handleSharedDailyAction", event("daily-create"));
    const findReport = () =>
      quick.data.shared.staffDailyReports.find(
        (row) => row.date === quick.data.sharedForm.dailyDate,
      );
    let report = findReport();
    assert.ok(report);
    assert.equal(report.status, "DRAFT");

    await invoke(quick, "handleSharedDailyAction", event("daily-submit", report));
    report = findReport();
    assert.equal(report.status, "SUBMITTED");
    assert.equal(report.version, 2);

    const { StaffDailyReviewClient } =
      await import("../apps/admin-web/dist/local-review/staff-daily.js");
    const admin = new StaffDailyReviewClient({
      transport: (path, init) => globalThis.fetch(new URL(path, serviceOrigin), init),
    });
    await admin.connect();
    assert.equal(admin.snapshot.status, "READY");
    const queued = admin.snapshot.rows.find((row) => row.id === report.id);
    assert.equal(queued?.version, report.version);
    await admin.review(report.id, report.version, "RETURN");

    await profile(quick, "teacher-east");
    report = findReport();
    assert.equal(report.status, "RETURNED");
    assert.equal(report.version, 3);
    await invoke(quick, "handleSharedDailyPickerChange", {
      currentTarget: { dataset: { field: "followUp" } },
      detail: { value: "1" },
    });
    assert.equal(quick.data.sharedForm.dailyValues.followUp, "OBSERVE_TOMORROW");
    await invoke(quick, "handleSharedDailyAction", event("daily-resubmit", report));
    report = findReport();
    assert.equal(report.status, "SUBMITTED");
    assert.equal(report.version, 4);
    assert.equal(report.values.followUp, "OBSERVE_TOMORROW");

    await admin.refresh();
    const resubmitted = admin.snapshot.rows.find((row) => row.id === report.id);
    assert.equal(resubmitted?.version, report.version);
    await admin.review(report.id, report.version, "CONFIRM");
    await profile(quick, "teacher-east");
    report = findReport();
    assert.equal(report.status, "CONFIRMED");
    assert.equal(report.version, 5);

    const parent = await httpCommand("/local/sessions", { profile: "parent-alpha" });
    const denied = await globalThis.fetch(
      new URL(`/local/staff-daily-reports/${report.id}`, serviceOrigin),
      {
        headers: { Authorization: `Bearer ${parent.handle}` },
      },
    );
    assert.equal(denied.ok, false);
    const deniedBody = await denied.json();
    assert.doesNotMatch(JSON.stringify(deniedBody), /OBSERVE_TOMORROW|示例学生/u);
  } finally {
    await invoke(quick, "handleSharedOffline");
    await server.close();
  }
});

test("Mini supply request is reviewed by Admin and claimed with the latest version", async () => {
  const server = await buildLocalSyntheticServer({ mode: "local-synthetic" });
  serviceOrigin = await server.start(0);
  const quick = await page("pages/staff/quick-action");
  try {
    await invoke(quick, "handleSharedOffline");
    await invoke(quick, "handleSharedEnable");
    await show(quick);
    await profile(quick, "teacher-east");
    await invoke(quick, "handleSharedSupplyField", {
      currentTarget: { dataset: { field: "quantity" } },
      detail: { value: "1" },
    });
    assert.equal(quick.data.sharedForm.supplyQuantityIndex, 1);

    await invoke(quick, "handleSharedSupplyCommand", event("supply-create"));
    let supply = quick.data.shared.supplies[0];
    assert.ok(supply);
    assert.equal(supply.status, "DRAFT");
    assert.equal(supply.quantity, 2);
    await invoke(quick, "handleSharedSupplyCommand", event("supply-submit", supply));
    supply = quick.data.shared.supplies.find((row) => row.id === supply.id);
    assert.equal(supply.status, "SUBMITTED");
    assert.equal(supply.version, 2);

    const { SupplyRequestReviewClient } =
      await import("../apps/admin-web/dist/local-review/supply-request.js");
    const admin = new SupplyRequestReviewClient((input, init) => {
      const target = new URL(input, serviceOrigin);
      assert.equal(target.origin, serviceOrigin);
      return globalThis.fetch(target, init);
    });
    await admin.connect("CAMPUS_REVIEWER");
    assert.equal(admin.snapshot.status, "READY");
    const submitted = admin.snapshot.rows.find((row) => row.id === supply.id);
    assert.equal(submitted?.status, "SUBMITTED");
    assert.equal(submitted?.version, supply.version);
    await admin.command(supply.id, supply.version, "CONFIRM");
    const ready = admin.snapshot.rows.find((row) => row.id === supply.id);
    assert.equal(ready?.status, "READY");
    assert.equal(ready?.version, supply.version + 1);

    await profile(quick, "teacher-east");
    supply = quick.data.shared.supplies.find((row) => row.id === supply.id);
    assert.equal(supply.status, "READY");
    const writesBeforeStaleClaim = requests.length;
    await invoke(quick, "handleSharedSupplyCommand", {
      currentTarget: { dataset: { action: "supply-claim", id: supply.id, version: 2 } },
    });
    assert.equal(requests.length, writesBeforeStaleClaim);
    await invoke(quick, "handleSharedSupplyCommand", event("supply-claim", supply));
    supply = quick.data.shared.supplies.find((row) => row.id === supply.id);
    assert.equal(supply.status, "CLAIMED");
    assert.equal(supply.version, 4);

    await admin.refresh();
    const claimed = admin.snapshot.history.find((row) => row.id === supply.id);
    assert.equal(claimed?.status, "CLAIMED");
    assert.equal(claimed?.version, supply.version);
  } finally {
    await invoke(quick, "handleSharedOffline");
    await server.close();
  }
});

test("Mini employee, Admin reviewer and Mini parent share one notice and receipt version", async () => {
  const server = await buildLocalSyntheticServer({ mode: "local-synthetic" });
  serviceOrigin = await server.start(0);
  const parent = await page("pages/parent/home");
  const bindingPage = await page("pages/parent/binding");
  const workbench = await page("pages/staff/workbench");
  const quick = await page("pages/staff/quick-action");
  try {
    await invoke(bindingPage, "handleSharedOffline");
    await invoke(bindingPage, "handleSharedEnable");
    await show(bindingPage);
    await profile(bindingPage, "parent-alpha");
    await command(bindingPage, "binding-submit");
    const binding = bindingPage.data.shared.bindings[0];
    assert.equal(binding.status, "PENDING");

    await show(workbench);
    await profile(workbench, "owner-east");
    await command(workbench, "binding-approve", binding);
    await invoke(quick, "handleSharedOffline");
    await invoke(quick, "handleSharedEnable");
    await show(quick);
    await profile(quick, "teacher-east");
    await invoke(quick, "handleSharedNoticeCommand", {
      currentTarget: {
        dataset: { action: "notice-create", template: "CLASS_ACTIVITY" },
      },
    });
    let notice = quick.data.shared.noticeOwned[0];
    assert.equal(notice.status, "DRAFT");
    await invoke(quick, "handleSharedNoticeCommand", event("notice-submit", notice));
    notice = quick.data.shared.noticeOwned.find((row) => row.id === notice.id);
    assert.equal(notice.status, "SUBMITTED");
    assert.equal(notice.version, 2);

    await invoke(parent, "handleSharedEnable");
    await show(parent);
    await profile(parent, "parent-alpha");
    assert.deepEqual(parent.data.shared.visibleNotices, [], "未发布通知不向家长显示");

    const { NoticeReviewClient } =
      await import("../apps/admin-web/dist/local-review/notice-shared.js");
    const admin = new NoticeReviewClient((input, init) => {
      const target = new URL(input, serviceOrigin);
      assert.equal(target.origin, serviceOrigin);
      return globalThis.fetch(target, init);
    });
    await admin.connect();
    assert.equal(admin.snapshot.status, "READY");
    const queued = admin.snapshot.queue.find((row) => row.id === notice.id);
    assert.equal(queued?.version, notice.version);
    assert.equal(queued?.status, "SUBMITTED");
    await admin.command(notice.id, notice.version, "CONFIRM");
    assert.equal(admin.snapshot.history.find((row) => row.id === notice.id)?.version, 3);
    await admin.command(notice.id, 3, "PUBLISH");
    const published = admin.snapshot.history.find((row) => row.id === notice.id);
    assert.equal(published?.status, "PUBLISHED");
    assert.equal(published?.version, 4);

    await invoke(parent, "handleSharedRefresh");
    let visible = parent.data.shared.visibleNotices.find((row) => row.id === notice.id);
    assert.equal(visible?.version, published?.version);
    assert.equal(visible?.receiptStatus, "UNREAD");
    const writes = requests.filter((requestRow) => requestRow.method === "POST").length;
    await invoke(parent, "handleSharedNoticeCommand", {
      currentTarget: {
        dataset: {
          action: "notice-read",
          id: notice.id,
          version: notice.version,
        },
      },
    });
    assert.equal(requests.filter((requestRow) => requestRow.method === "POST").length, writes);

    await invoke(parent, "handleSharedNoticeCommand", event("notice-read", visible));
    visible = parent.data.shared.visibleNotices.find((row) => row.id === notice.id);
    assert.equal(visible?.receiptStatus, "READ");
    assert.ok(visible?.body.includes("合成内容"));
    await invoke(parent, "handleSharedNoticeCommand", event("notice-ack", visible));
    assert.equal(
      parent.data.shared.visibleNotices.find((row) => row.id === notice.id)?.receiptStatus,
      "ACKNOWLEDGED",
    );
    await admin.refresh();
    assert.equal(admin.snapshot.history.find((row) => row.id === notice.id)?.version, 4);
    assert.ok(requests.every((requestRow) => new URL(requestRow.url).hostname === "127.0.0.1"));
  } finally {
    await invoke(quick, "handleSharedOffline");
    await invoke(parent, "handleSharedOffline");
    await server.close();
  }
});

test("Mini learning Page can end and clear an ended owned session", async () => {
  const server = await buildLocalSyntheticServer({ mode: "local-synthetic" });
  serviceOrigin = await server.start(0);
  try {
    const learning = await page("pages/parent/learning");
    await invoke(learning, "onLoad", { profile: "teacher-east" });
    await invoke(learning, "handleRefresh");
    assert.ok(learning.data.students.length > 0, learning.data.message);
    await invoke(learning, "handleStudentChange", { detail: { value: "0" } });
    await invoke(learning, "handleConsent", { detail: { value: ["confirmed"] } });
    assert.equal(learning.data.canStart, true);
    await invoke(learning, "handleStart");

    const session = learning.data.activeSession;
    assert.ok(
      session,
      JSON.stringify({
        message: learning.data.message,
        profile: learning.data.profile,
        students: learning.data.students,
        selectedStudentId: learning.data.selectedStudentId,
        consentConfirmed: learning.data.consentConfirmed,
        canStart: learning.data.canStart,
      }),
    );
    assert.equal(session.status, "ACTIVE");
    await invoke(learning, "handleClose");
    assert.equal(learning.data.sessions.find((row) => row.id === session.id)?.status, "CLOSED");
    await invoke(learning, "handleDelete", { currentTarget: { dataset: { id: session.id } } });

    assert.equal(
      learning.data.sessions.some((row) => row.id === session.id),
      false,
      JSON.stringify({
        message: learning.data.message,
        sessions: learning.data.sessions.map((row) => ({ id: row.id, status: row.status })),
      }),
    );
    assert.equal(learning.data.message, "本机学习记录已删除。");
    assert.ok(
      requests.some(
        (row) =>
          row.url.endsWith(`/local/learning-sessions/${session.id}/delete`) &&
          row.method === "POST",
      ),
    );
  } finally {
    await server.close();
  }
});

test("Mini teacher can hand off and clear a parent session in the authorized class", async () => {
  const server = await buildLocalSyntheticServer({ mode: "local-synthetic" });
  serviceOrigin = await server.start(0);
  const api = async (handle, method, path, body, expected = 200) => {
    const response = await fetch(new URL(path, serviceOrigin), {
      method,
      headers: {
        origin: serviceOrigin,
        ...(handle ? { authorization: `Bearer ${handle}` } : {}),
        ...(body === undefined ? {} : { "content-type": "application/json" }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    assert.equal(response.status, expected, `${method} ${path}`);
    return response.json();
  };
  try {
    const connect = async (profile) =>
      (await api(null, "POST", "/local/sessions", { profile }, 201)).handle;
    const parent = await connect("parent-alpha");
    const owner = await connect("owner-east");
    const student = (await api(parent, "GET", "/local/student-options"))[0];
    const binding = await api(
      parent,
      "POST",
      "/local/binding-applications",
      { student: student.alias, relationship: "GUARDIAN" },
      201,
    );
    await api(owner, "POST", `/local/binding-applications/${binding.id}/review`, {
      version: binding.version,
      action: "approve",
    });
    const session = await api(
      parent,
      "POST",
      "/local/learning-sessions",
      {
        studentId: student.id,
        questionId: "math-grade-3-addition-01",
        consentVersion: "LEARNING_DEMO_V2",
        durationMinutes: 10,
      },
      201,
    );

    requests.length = 0;
    const learning = await page("pages/parent/learning");
    await invoke(learning, "onLoad", { profile: "teacher-east" });
    await invoke(learning, "handleRefresh");
    assert.ok(learning.data.teacherSummaryRows.some((row) => row.id === session.id));
    await invoke(learning, "handleTeacherHandoff", {
      currentTarget: { dataset: { id: session.id } },
    });
    assert.equal(
      learning.data.teacherSummaryRows.find((row) => row.id === session.id)?.status,
      "HANDED_OFF",
    );
    await invoke(learning, "handleDelete", {
      currentTarget: { dataset: { id: session.id } },
    });

    assert.equal(
      learning.data.teacherSummaryRows.some((row) => row.id === session.id),
      false,
      learning.data.message,
    );
    assert.equal(learning.data.message, "本机学习记录已删除。");
    assert.ok(
      requests.some(
        (requestRow) =>
          requestRow.url.endsWith(`/local/learning-sessions/${session.id}/delete`) &&
          requestRow.method === "POST",
      ),
    );
  } finally {
    await server.close();
  }
});
