import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { URL } from "node:url";
import {
  mountStaffMonthlyPage as mount,
  settleStaffMonthlyPage as settle,
} from "./helpers/staff-monthly-page-harness.mjs";

const id = "00000000-0000-4000-8000-000000000346";
const supplements = {
  learningParticipation: "KEEP_WATCHING",
  dailyHabits: "KEEP_WATCHING",
  activityParticipation: "KEEP_WATCHING",
  familySchoolCollaboration: "KEEP_WATCHING",
};
const row = (overrides = {}) => ({
  id,
  version: 1,
  sourceVersion: 1,
  month: "2026-10",
  classRef: "合成月度甲班",
  audience: "STAFF_INTERNAL",
  status: "DRAFT",
  supplements,
  sourceCounts: { GROWTH_RECORD: 1, ATTENDANCE_OVERVIEW: 2, STAFF_DAILY: 3 },
  actions: ["edit", "submit"],
  ...overrides,
});
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
};
const listing = (records = [], canCreate = true) => ({ records, canCreate });
const state = (page) => page.nodes()[0].props["data-monthly-state"];

test("monthly route preserves every existing route and provides a permission-gated workbench entry", () => {
  const config = fs.readFileSync(new URL("../src/app.config.ts", import.meta.url), "utf8");
  const paths = [...config.matchAll(/"(pages\/[^"]+)"/gu)].map((match) => match[1]);
  const previous = [
    "visitor/home",
    "visitor/meals",
    "visitor/institution",
    "visitor/home-school",
    "visitor/day-flow",
    "visitor/activities",
    "visitor/activity-detail",
    "auth/login",
    "parent/home",
    "parent/notices",
    "parent/fees",
    "parent/learning",
    "parent/binding",
    "parent/pickup",
    "parent/care-record",
    "parent/leave",
    "parent/health-notices",
    "staff/workbench",
    "staff/pickup",
    "staff/care-record",
    "staff/daily-report",
    "staff/leave",
    "staff/health-report",
  ];
  assert.deepEqual(
    [...paths].sort(),
    [...previous, "staff/monthly", "staff/child-monthly", "parent/child-monthly"]
      .map((path) => `pages/${path}/index`)
      .sort(),
  );
  assert.equal(new Set(paths).size, paths.length);
  const workbench = fs.readFileSync(
    new URL("../src/pages/staff/workbench/index.tsx", import.meta.url),
    "utf8",
  );
  assert.match(workbench, /canReadMonthlyFeedback/u);
  assert.match(workbench, /pages\/staff\/monthly\/index/u);
  assert.match(workbench, /班级月度总结/u);
});

test("real month and fixed-choice events create, edit and submit a staff-internal draft", async () => {
  let records = [];
  const page = await mount({
    get: async () => listing(records),
    post: async (path, body) => {
      records = path.endsWith("/submit")
        ? [row({ ...records[0], version: 3, status: "SUBMITTED", actions: [] })]
        : [row({ month: body.month, supplements: body.supplements })];
      return records[0];
    },
    patch: async (_path, body) => {
      records = [row({ version: 2, supplements: body.supplements })];
      return records[0];
    },
  });
  page.change("month", "2026-10");
  page.change("learningParticipation", 1);
  page.click("保存总结草稿");
  await settle();
  page.render();
  assert.match(page.text(), /合成月度甲班|草稿/u);
  assert.doesNotMatch(page.text(), /00000000|家长可见|学生报告/u);
  const oldSubmit = page.button("提交负责人审核").props.onClick;
  page.click("编辑草稿");
  page.change("dailyHabits", 2);
  assert.equal(page.button("提交负责人审核").props.disabled, true);
  oldSubmit();
  await settle();
  assert.equal(page.calls.filter(([method]) => method === "POST").length, 1);
  page.click("保存修改");
  await settle();
  page.render();
  assert.equal(page.button("提交负责人审核").props.disabled, false);
  page.click("提交负责人审核");
  await settle();
  page.render();
  assert.match(page.text(), /待负责人审核/u);
  assert.equal(page.button("提交负责人审核"), undefined);
  assert.deepEqual(JSON.parse(JSON.stringify(page.calls.filter(([method]) => method !== "GET"))), [
    [
      "POST",
      "/staff/monthly-feedback",
      { month: "2026-10", supplements: { ...supplements, learningParticipation: "PROGRESSING" } },
    ],
    [
      "PATCH",
      `/staff/monthly-feedback/${id}`,
      {
        version: 1,
        supplements: {
          ...supplements,
          learningParticipation: "PROGRESSING",
          dailyHabits: "FOLLOW_UP",
        },
      },
    ],
    ["POST", `/staff/monthly-feedback/${id}/submit`, { version: 2 }],
  ]);
});

test("returned and outdated summaries save as drafts before submitting; reviewer actions never become staff buttons", async () => {
  for (const status of ["RETURNED", "REVIEW_REQUIRED"]) {
    let record = row({ status, actions: ["edit"] });
    const page = await mount({
      get: async () => listing([record], false),
      patch: async (_path, body) => {
        record = row({ version: 2, supplements: body.supplements });
        return record;
      },
    });
    assert.equal(page.button("提交负责人审核"), undefined);
    page.click("核对并修改");
    page.change("activityParticipation", 2);
    page.click("保存修改");
    await settle();
    page.render();
    assert.ok(page.button("提交负责人审核"));
    assert.equal(page.calls.filter(([method]) => method === "POST").length, 0);
  }
  for (const [status, actions] of [
    ["SUBMITTED", ["confirm", "return"]],
    ["CONFIRMED", ["return", "publish"]],
    ["PUBLISHED", []],
  ]) {
    const page = await mount({ get: async () => listing([row({ status, actions })], false) });
    assert.equal(state(page), "READY");
    assert.equal(page.button("确认总结"), undefined);
    assert.equal(page.button("内部发布"), undefined);
    assert.equal(page.button("退回修改"), undefined);
    assert.equal(page.button("保存总结草稿"), undefined);
  }
});

test("saving, editing and submitting keep the chosen month and put its record ahead of history", async () => {
  const history = row({ month: "2025-07", status: "PUBLISHED", actions: [] });
  const chosen = "2025-03";
  const chosenId = "00000000-0000-4000-8000-000000000407";
  let current;
  const page = await mount({
    get: async () => listing(current ? [history, current] : [history]),
    post: async (path, body) => {
      current = path.endsWith("/submit")
        ? { ...current, version: 3, status: "SUBMITTED", actions: [] }
        : row({ id: chosenId, month: body.month, supplements: body.supplements });
      return current;
    },
    patch: async (_path, body) =>
      (current = { ...current, version: 2, supplements: body.supplements }),
  });
  const pickers = () => page.nodes().filter((node) => node.type === "Picker");
  async function expectChosenMonth() {
    await settle();
    page.render();
    assert.equal(pickers()[0].props.value, chosen);
    assert.equal(pickers().length, 1, "an existing month offers only the month selector");
    assert.equal(page.button("保存总结草稿"), undefined);
    const rows = page
      .nodes()
      .map((node) => node.props["data-monthly-row"])
      .filter(Boolean);
    assert.deepEqual(rows, [chosenId, history.id]);
  }
  page.change("month", chosen);
  page.click("保存总结草稿");
  await expectChosenMonth();
  page.click("编辑草稿");
  page.change("dailyHabits", 1);
  page.click("保存修改");
  await expectChosenMonth();
  page.click("提交负责人审核");
  await expectChosenMonth();
  assert.match(page.text(), /待负责人审核/u);
  page.change("month", "2025-02");
  assert.equal(pickers().length, 5);
  assert.ok(page.button("保存总结草稿") && !page.button("保存总结草稿").props.disabled);
});

test("409 refreshes the changed source, clears editing and never replays the write", async () => {
  let record = row();
  const page = await mount({
    get: async () => listing([record], false),
    patch: async () => {
      record = row({ version: 2, sourceVersion: 2, status: "REVIEW_REQUIRED", actions: ["edit"] });
      throw Object.assign(Error("PRIVATE"), { statusCode: 409 });
    },
  });
  page.click("编辑草稿");
  page.change("dailyHabits", 1);
  page.click("保存修改");
  await settle();
  page.render();
  assert.match(page.text(), /未保存|重新核对/u);
  assert.match(page.text(), /来源已变化/u);
  assert.equal(page.button("保存修改"), undefined);
  assert.equal(page.calls.filter(([method]) => method === "PATCH").length, 1);
  assert.equal(page.calls.filter(([method]) => method === "GET").length, 2);
  assert.doesNotMatch(page.text(), /PRIVATE/u);
});

test("refresh keeps the month in the active session, and resets it when the session changes", async () => {
  const chosen = "2025-03";
  let records = [row({ month: chosen })];
  let permitted = true;
  const page = await mount({
    restore: async (session) => {
      session.snapshot = { ...session.snapshot };
      return session.snapshot;
    },
    get: () => {
      if (!permitted) throw Object.assign(Error("Forbidden"), { statusCode: 403 });
      return listing(records);
    },
  });
  const month = () =>
    page.nodes().find((n) => n.props["data-monthly-field"] === "month").props.value;
  const initial = month();
  page.change("month", chosen);
  page.click("刷新");
  await settle();
  page.render();
  assert.equal(page.calls.filter(([method]) => method === "GET").length, 2);
  assert.equal(month(), chosen);
  page.session.snapshot = { ...page.session.snapshot };
  records = [row({ month: initial, classRef: "合成乙班" })];
  page.click("刷新");
  await settle();
  page.render();
  assert.equal(month(), initial);
  assert.match(page.text(), /合成乙班/u);
  assert.doesNotMatch(page.text(), /合成月度甲班/u);
  permitted = false;
  page.click("刷新");
  await settle();
  page.render();
  assert.equal(state(page), "DENIED");
  assert.doesNotMatch(page.text(), /合成乙班/u);
});

test("the just-saved class is the first actionable record even when another class has the same month", async () => {
  const chosen = "2025-03";
  const first = row({ id: "00000000-0000-4000-8000-000000000302", month: chosen });
  let second = row({
    id: "00000000-0000-4000-8000-000000000303",
    month: chosen,
    classRef: "合成月度乙班",
  });
  const page = await mount({
    get: () => listing([first, second]),
    patch: (path, body) => {
      assert.equal(path, `/staff/monthly-feedback/${second.id}`);
      second = { ...second, version: 2, supplements: body.supplements };
      return second;
    },
    post: (path, body) => {
      assert.equal(path, `/staff/monthly-feedback/${second.id}/submit`);
      assert.deepEqual(JSON.parse(JSON.stringify(body)), { version: 2 });
      second = { ...second, version: 3, status: "SUBMITTED", actions: [] };
      return second;
    },
  });
  page.change("month", chosen);
  const rows = () => page.nodes().filter((n) => n.props["data-monthly-row"]);
  const secondEdit = page
    .nodes(rows()[1])
    .find((n) => n.type === "Button" && page.text(n) === "编辑草稿");
  secondEdit.props.onClick();
  page.render();
  page.change("dailyHabits", 1);
  page.click("保存修改");
  await settle();
  page.render();
  assert.deepEqual(
    rows().map((n) => n.props["data-monthly-row"]),
    [second.id, first.id],
  );
  page.click("提交负责人审核");
  await settle();
  page.render();
  assert.equal(rows()[0].props["data-monthly-row"], second.id);
  assert.match(page.text(rows()[0]), /待负责人审核/u);
  assert.match(page.text(rows()[1]), /草稿/u);
  assert.equal(page.calls.filter(([method]) => method === "POST").length, 1);
});

test("duplicate mutation clicks only write once and leaving discards late success", async () => {
  for (const leave of ["hide", "unload", "back", "account"]) {
    const pending = deferred();
    const page = await mount({
      get: async () => listing([row()], false),
      post: () => pending.promise,
    });
    const click = page.button("提交负责人审核").props.onClick;
    click();
    click();
    await settle();
    assert.equal(page.calls.filter(([method]) => method === "POST").length, 1);
    if (leave === "back") page.click("‹ 返回工作台");
    else if (leave === "account")
      page.session.snapshot = { status: "READY", roles: ["STAFF"], canReadMonthlyFeedback: true };
    else page.events[leave]();
    pending.resolve(row({ version: 2, status: "SUBMITTED", actions: [] }));
    await settle();
    page.render();
    assert.doesNotMatch(page.text(), /合成月度甲班|已提交负责人审核/u);
    assert.equal(page.calls.filter(([method]) => method === "GET").length, 1);
    if (leave === "back") assert.deepEqual(page.routes, ["/pages/staff/workbench/index"]);
  }
});

test("expired and forbidden mutations clear records and unsaved fields without exposing upstream messages", async () => {
  for (const statusCode of [401, 403, 404, 503]) {
    const page = await mount({
      get: async () => listing([row()], false),
      patch: async () => {
        throw Object.assign(Error("PRIVATE_TOKEN"), { statusCode });
      },
    });
    page.click("编辑草稿");
    page.change("dailyHabits", 2);
    page.click("保存修改");
    await settle();
    page.render();
    assert.equal(state(page), statusCode === 503 ? "ERROR" : "DENIED");
    assert.equal(page.button("保存修改"), undefined);
    assert.doesNotMatch(page.text(), /合成月度甲班|PRIVATE_TOKEN/u);
    assert.ok(page.button("重新读取"));
    if (statusCode === 401) assert.ok(page.button("重新登录"));
  }
});

test("hidden read results cannot replace a new visit and hidden editing is cleared", async () => {
  const old = deferred();
  let reads = 0;
  const page = await mount({
    get: () => (++reads === 1 ? old.promise : Promise.resolve(listing([], false))),
  });
  page.events.hide();
  page.events.show();
  await settle();
  page.render();
  assert.match(page.text(), /暂无班级月度总结/u);
  old.resolve(listing([row()]));
  await settle();
  page.render();
  assert.match(page.text(), /暂无班级月度总结/u);
  assert.doesNotMatch(page.text(), /合成月度甲班/u);
  const editing = await mount({ get: async () => listing([row()], false) });
  editing.click("编辑草稿");
  editing.events.hide();
  editing.events.show();
  await settle();
  editing.render();
  assert.equal(editing.button("保存修改"), undefined);
});

test("pending identity restoration is shared on reentry; temporary identity failures retry without login redirect", async () => {
  const pending = deferred();
  let restores = 0;
  const page = await mount({
    restore: (session) => {
      restores++;
      if (restores > 1) return session.snapshot;
      session.snapshot = { status: "CHECKING", roles: [], canReadMonthlyFeedback: false };
      return pending.promise;
    },
  });
  page.events.hide();
  page.events.show();
  await settle();
  assert.equal(restores, 1);
  assert.deepEqual(page.routes, []);
  assert.equal(page.calls.length, 0);
  page.session.snapshot = { status: "READY", roles: ["STAFF"], canReadMonthlyFeedback: true };
  pending.resolve(page.session.snapshot);
  await settle();
  page.render();
  assert.equal(state(page), "READY");
  for (const status of ["CHECKING", "BUSY", "ERROR"]) {
    const transient = await mount({ restore: (session) => ({ ...session.snapshot, status }) });
    assert.equal(state(transient), "ERROR");
    assert.deepEqual(transient.routes, []);
    assert.equal(transient.calls.length, 0);
    assert.ok(transient.button("重新读取"));
  }
});

test("parent or missing monthly permission sends no monthly requests, and retry recovers an empty service", async () => {
  for (const options of [{ roles: ["PARENT"] }, { canReadMonthlyFeedback: false }]) {
    const denied = await mount(options);
    assert.equal(denied.calls.length, 0);
    assert.equal(state(denied), "DENIED");
    assert.equal(denied.button("保存总结草稿"), undefined);
  }
  let failed = true;
  const page = await mount({
    get: async () => {
      if (failed) throw Error("PRIVATE");
      return listing([], false);
    },
  });
  assert.equal(state(page), "ERROR");
  failed = false;
  page.click("重新读取");
  await settle();
  page.render();
  assert.equal(state(page), "READY");
  assert.match(page.text(), /暂无班级月度总结/u);
});

test("month changes and invalid picker values do not bypass permissions; cancel unlocks submission", async () => {
  const page = await mount({ get: async () => listing([row()], true) });
  page.change("month", "2026-10");
  assert.equal(page.button("保存总结草稿"), undefined);
  assert.equal(page.nodes().filter((node) => node.type === "Picker").length, 1);
  page.click("编辑草稿");
  const form = page
    .nodes()
    .find((node) => node.type === "Picker" && node.props["data-monthly-field"] === "month");
  assert.equal(form.props.disabled, true);
  page.change("dailyHabits", "invalid");
  page.click("取消修改");
  assert.equal(page.button("保存总结草稿"), undefined);
  assert.equal(page.button("提交负责人审核").props.disabled, false);
  assert.equal(page.calls.filter(([method]) => method !== "GET").length, 0);
});

test("monthly page keeps a left back button and centered wrapping brand-green actions", () => {
  const path = new URL("../src/pages/staff/monthly/index.css", import.meta.url);
  assert.ok(fs.existsSync(path), "monthly page needs scoped styles");
  const css = fs.readFileSync(path, "utf8");
  assert.match(css, /\.staff-monthly-topbar \.staff-monthly-back\s*\{[^}]*margin:\s*0 auto 0 0/su);
  assert.match(css, /flex-wrap:\s*wrap/u);
  assert.match(css, /justify-content:\s*center/u);
  assert.match(css, /#82b435/u);
});
