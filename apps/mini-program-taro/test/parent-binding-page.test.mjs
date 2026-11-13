import assert from "node:assert/strict";
import test from "node:test";
import { mountParentBindingPage } from "./helpers/parent-binding-page-harness.mjs";

// Run from the repository root:
// node --experimental-strip-types --test apps/mini-program-taro/test/parent-binding-page.test.mjs
// PARENT_BINDING_SOURCE_ROOT can point at an isolated candidate/worktree root.
// These regressions exercise lifecycle refresh and authoritative server state.

const studentId = "00000000-0000-4000-8000-000000000301";
const applicationId = "00000000-0000-4000-8000-000000000401";
const relationshipId = "00000000-0000-4000-8000-000000000501";
const paths = ["/parent/student-options", "/guardian-binding/applications", "/guardian-relationships"];
const pending = {
  id: applicationId,
  student_candidate_ref: studentId,
  relationship: "GUARDIAN",
  status: "PENDING",
  version: 1,
  submitted_at: "2026-11-14T03:00:00.000Z",
  reviewed_at: null,
};

function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}

async function setup(t, initialApplications = []) {
  const server = {
    applications: initialApplications,
    relationships: [],
    failReads: false,
    gate: null,
  };
  const page = await mountParentBindingPage({
    get: async (path) => {
      if (server.gate) await server.gate.promise;
      if (server.failReads) throw Object.assign(new Error("Synthetic unavailable"), { statusCode: 503 });
      if (path === "/parent/student-options") return [{ id: studentId, alias: "synthetic-a", label: "合成学生甲" }];
      if (path === "/guardian-binding/applications") return server.applications;
      if (path === "/guardian-relationships") return server.relationships;
      throw new Error(`Unexpected GET: ${path}`);
    },
    post: async (path, body) => {
      assert.equal(path, "/guardian-binding/applications");
      assert.deepEqual(JSON.parse(JSON.stringify(body)), {
        student_candidate_ref: studentId, relationship: "GUARDIAN", consent: true,
      });
      server.applications = [{ ...pending }];
      return server.applications[0];
    },
  });
  t.after(() => page.unmount());
  const getCalls = () => page.calls.filter(([method]) => method === "GET");
  const writeCalls = () => page.calls.filter(([method]) => method !== "GET");
  function approve() {
    server.applications = [{ ...pending, status: "APPROVED", version: 2,
      reviewed_at: "2026-11-14T03:05:00.000Z" }];
    server.relationships = [{ id: relationshipId, student_id: studentId, relationship: "GUARDIAN",
      status: "ACTIVE", source_application_id: applicationId, version: 1,
      approved_at: "2026-11-14T03:05:00.000Z" }];
  }
  async function submit() {
    page.consent(true);
    page.click("提交关系申请");
    await page.settle();
    assert.equal(writeCalls().length, 1, "exactly one application is submitted");
    assert.equal(page.byClass("binding-receipt").length, 1, "successful submission has a visible receipt");
  }
  function assertApproved() {
    assert.match(page.text(), /审核已通过/u);
    assert.match(page.text(), /监护关系已建立/u);
    assert.doesNotMatch(page.text(), /审核状态：等待员工审核/u);
    assert.equal(page.byClass("binding-receipt").length, 0,
      "the old local PENDING receipt must not override server-approved state");
  }
  return { page, server, approve, submit, assertApproved, getCalls, writeCalls };
}

test("page host executes the real scoped readers and submits only confirmed synthetic input", async (t) => {
  const flow = await setup(t);
  assert.deepEqual(flow.getCalls().map(([, path]) => path).sort(), [...paths].sort());
  assert.match(flow.page.text(), /合成学生甲/u);
  await flow.submit();
  assert.match(flow.page.text(), /审核状态：等待员工审核/u);
});

test("returning to the binding page refreshes a pending application approved on another client", async (t) => {
  const flow = await setup(t, [{ ...pending }]);
  const before = flow.getCalls().length;
  flow.page.hide();
  flow.approve();
  flow.page.show();
  await flow.page.settle();
  assert.deepEqual(flow.getCalls().slice(before).map(([, path]) => path).sort(), [...paths].sort(),
    "showing the existing page again must read all three current scoped projections");
  flow.assertApproved();
  assert.equal(flow.writeCalls().length, 0, "refresh never repeats a business action");
});

test("manual refresh after this page submits clears the local PENDING receipt once approval is read", async (t) => {
  const flow = await setup(t);
  await flow.submit();
  flow.approve();
  flow.page.click("刷新状态");
  await flow.page.settle();
  flow.assertApproved();
  assert.equal(flow.writeCalls().length, 1, "reading approval must not resubmit the application");
});

test("failed refresh preserves the successful submission receipt and a successful retry replaces it", async (t) => {
  const flow = await setup(t);
  await flow.submit();
  flow.approve();
  flow.server.failReads = true;
  flow.page.click("刷新状态");
  await flow.page.settle();
  assert.equal(flow.page.byClass("binding-receipt").length, 1,
    "a failed read must not discard a known successful submission receipt");
  assert.match(flow.page.text(), /审核状态：等待员工审核/u);
  assert.doesNotMatch(flow.page.text(), /审核已通过/u);
  assert.ok(flow.page.button("重新读取"), "failed state offers an explicit read retry");
  flow.server.failReads = false;
  flow.page.click("重新读取");
  await flow.page.settle();
  flow.assertApproved();
  assert.equal(flow.writeCalls().length, 1, "retry only reads and does not repeat submission");
});

test("overlapping refresh clicks and page-show events share one in-flight group of GETs", async (t) => {
  const flow = await setup(t, [{ ...pending }]);
  const refresh = flow.page.button("刷新状态");
  assert.ok(refresh, "binding page provides an explicit refresh control");
  const staleClick = refresh.props.onClick;
  const gate = deferred();
  flow.server.gate = gate;
  const before = flow.getCalls().length;
  try {
    flow.page.click("刷新状态");
    staleClick();
    flow.page.show();
    staleClick();
    flow.page.show();
    await flow.page.settle();
    assert.deepEqual(flow.getCalls().slice(before).map(([, path]) => path).sort(), [...paths].sort(),
      "overlapping events must not create a second copy of any scoped GET");
    assert.equal(flow.writeCalls().length, 0);
    flow.approve();
  } finally {
    flow.server.gate = null;
    gate.resolve();
    await flow.page.settle();
  }
  flow.assertApproved();
});
