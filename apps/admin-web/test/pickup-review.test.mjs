import assert from "node:assert/strict";
import test from "node:test";
let pickupReviewModule = null;
try {
  pickupReviewModule = await import("../dist/local-review/pickup-review.js");
} catch {
  pickupReviewModule = null;
}

test("the management pickup review module is available", () => {
  assert.ok(pickupReviewModule, "the main tree has no dedicated G2.3 pickup review module yet");
});

const uuid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const handle = "h".repeat(43);
const ownerSession = {
  profile: "owner-east",
  label: "示例校区负责人",
  actorId: uuid(4),
  tenantId: uuid(100),
  campusId: uuid(101),
  classIds: [uuid(103)],
  actions: ["pickup:read", "pickup:review"],
};

function createHarness({
  profile = "owner-east",
  actions = ownerSession.actions,
  removeExceptionScopeField,
  mismatchExceptionScopeField,
  conflictOnReview = false,
  summary = {
    synthetic: true,
    counts: {
      activeAuthorizations: 2,
      completedRecords: 3,
      openExceptions: 1,
      followingExceptions: 1,
      resolvedExceptions: 4,
    },
  },
} = {}) {
  const calls = [];
  const exception = {
    id: uuid(501),
    version: 1,
    status: "OPEN",
    studentId: uuid(200),
    studentLabel: "示例学生甲",
    date: "2026-10-10",
    category: "NO_AUTHORIZATION",
    outcome: null,
    reviewedBy: uuid(4),
    reviewedAt: "2026-10-10T01:00:00.000Z",
    tenantId: uuid(100),
    campusId: uuid(101),
    classId: uuid(103),
  };
  if (removeExceptionScopeField) delete exception[removeExceptionScopeField];
  if (mismatchExceptionScopeField) {
    exception[mismatchExceptionScopeField] = {
      tenantId: uuid(999),
      campusId: uuid(102),
      classId: uuid(104),
    }[mismatchExceptionScopeField];
  }
  const session = { ...ownerSession, profile, actions };
  const authorizations = [
    {
      id: uuid(601),
      version: 1,
      status: "ACTIVE",
      currentlyValid: true,
      studentId: uuid(200),
      studentLabel: "示例学生甲",
      recipient: "RECIPIENT_A",
      recipientLabel: "示例接送人甲",
      type: "REGULAR",
      startDate: "2026-10-10",
      endDate: "2026-10-20",
      startTime: "16:00",
      endTime: "18:00",
      bindingId: uuid(701),
      credential: "must-not-render",
      tenantId: uuid(100),
      campusId: uuid(101),
      classId: uuid(103),
    },
  ];
  const records = [
    {
      id: uuid(801),
      version: 1,
      status: "COMPLETED",
      date: "2026-10-09",
      time: "17:10",
      studentId: uuid(200),
      studentLabel: "示例学生甲",
      recipient: "示例接送人甲",
      checks: { student: true, recipient: true, authorization: true },
      deviceLabel: "仅本机模拟设备",
      teacherId: uuid(5),
      tenantId: uuid(100),
      campusId: uuid(101),
      classId: uuid(103),
    },
  ];
  const transport = async (path, init = {}) => {
    const pathname = String(path);
    const method = init.method ?? "GET";
    calls.push({
      path: pathname,
      method,
      body: init.body ? JSON.parse(init.body) : undefined,
    });
    if (pathname === "/local/sessions" && method === "POST")
      return globalThis.Response.json({ handle });
    if (pathname === "/local/session") return globalThis.Response.json(session);
    if (pathname === "/local/pickup-authorizations")
      return globalThis.Response.json(authorizations);
    if (pathname === "/local/pickup-records") return globalThis.Response.json(records);
    if (pathname === "/local/pickup-exceptions") return globalThis.Response.json([exception]);
    if (pathname === "/local/pickup-summary") return globalThis.Response.json(summary);
    if (pathname.endsWith(`/local/pickup-exceptions/${exception.id}/review`) && method === "POST") {
      if (conflictOnReview) return new globalThis.Response(null, { status: 409 });
      if (init.body) {
        const body = JSON.parse(init.body);
        exception.status = body.action === "follow" ? "FOLLOWING" : "RESOLVED";
        exception.version += 1;
        exception.outcome = body.outcome;
      }
      return globalThis.Response.json(exception);
    }
    return new globalThis.Response(null, { status: 404 });
  };
  return { calls, exception, transport };
}

if (pickupReviewModule) {
  const { PickupReviewClient, renderPickupReview } = pickupReviewModule;

  test("owner sees scoped summaries and the fixed follow action without internal fields", async () => {
    const harness = createHarness();
    const client = new PickupReviewClient(harness.transport);
    await client.connect("owner-east");

    const snapshot = client.snapshot;
    assert.equal(snapshot.status, "READY");
    assert.equal(snapshot.exceptions[0]?.studentLabel, "示例学生甲");
    assert.equal("reviewedBy" in snapshot.exceptions[0], false);
    assert.equal("checks" in snapshot.records[0], false);
    assert.equal("teacherId" in snapshot.records[0], false);
    assert.equal("credential" in snapshot.authorizations[0], false);

    const html = renderPickupReview(snapshot, true);
    assert.match(html, /data-pickup-action="follow"/);
    assert.doesNotMatch(html, /must-not-render|teacherId|reviewedBy|authorizationId|credential/i);
    assert.doesNotMatch(html, /强制放行|确认离校/);
  });

  test("a read-only employee can view allowed summaries but cannot review exceptions", async () => {
    const harness = createHarness({
      profile: "teacher-east",
      actions: ["pickup:read", "pickup:verify"],
    });
    const client = new PickupReviewClient(harness.transport);
    await client.connect("teacher-east");

    assert.equal(client.snapshot.status, "READY");
    assert.equal(client.snapshot.exceptions.length, 0);
    assert.equal(
      harness.calls.some((call) => call.path === "/local/pickup-exceptions"),
      false,
    );
    assert.doesNotMatch(renderPickupReview(client.snapshot, true), /data-pickup-action=/);
  });

  test("platform profile sees only aggregate pickup counts and requests no detail endpoints", async () => {
    const harness = createHarness({
      profile: "platform-admin",
      actions: ["pickup:summary"],
    });
    const client = new PickupReviewClient(harness.transport);
    await client.connect("platform-admin");

    assert.equal(client.snapshot.status, "READY");
    assert.deepEqual(client.snapshot.summary, {
      synthetic: true,
      counts: {
        activeAuthorizations: 2,
        completedRecords: 3,
        openExceptions: 1,
        followingExceptions: 1,
        resolvedExceptions: 4,
      },
    });
    assert.deepEqual(client.snapshot.exceptions, []);
    assert.deepEqual(client.snapshot.authorizations, []);
    assert.deepEqual(client.snapshot.records, []);
    const html = renderPickupReview(client.snapshot, true);
    assert.match(html, /平台汇总/);
    assert.match(html, /<strong>3<\/strong><span>已完成接送<\/span>/);
    assert.doesNotMatch(html, /示例学生甲|data-pickup-action=/);
    assert.deepEqual(
      harness.calls.map(({ method, path }) => `${method} ${path}`),
      ["POST /local/sessions", "GET /local/session", "GET /local/pickup-summary"],
    );
  });

  test("platform summary rejects an unexpected detail field and clears the view", async () => {
    const harness = createHarness({
      profile: "platform-admin",
      actions: ["pickup:summary"],
      summary: {
        synthetic: true,
        counts: {
          activeAuthorizations: 0,
          completedRecords: 0,
          openExceptions: 0,
          followingExceptions: 0,
          resolvedExceptions: 0,
        },
        rows: [{ studentLabel: "示例学生甲" }],
      },
    });
    const client = new PickupReviewClient(harness.transport);
    await client.connect("platform-admin");

    assert.equal(client.snapshot.status, "ERROR");
    assert.equal(client.snapshot.summary, null);
    assert.doesNotMatch(renderPickupReview(client.snapshot, true), /示例学生甲/);
    assert.equal(
      harness.calls.some(({ path }) => /pickup-(?:authorizations|records|exceptions)$/u.test(path)),
      false,
    );
  });

  test("server-scoped API rows may omit internal scope IDs while mismatched scope is rejected", async () => {
    const fields = ["tenantId", "campusId", "classId"];
    for (const field of fields) {
      const scopedApiRow = new PickupReviewClient(
        createHarness({ removeExceptionScopeField: field }).transport,
      );
      await scopedApiRow.connect("owner-east");
      assert.equal(scopedApiRow.snapshot.status, "READY", `${field} may be omitted by the API DTO`);
      assert.equal(scopedApiRow.snapshot.exceptions.length, 1);

      const mismatched = new PickupReviewClient(
        createHarness({ mismatchExceptionScopeField: field }).transport,
      );
      await mismatched.connect("owner-east");
      assert.equal(mismatched.snapshot.status, "ERROR", `${field} mismatch must be rejected`);
      assert.equal(mismatched.snapshot.session, null);
      assert.deepEqual(mismatched.snapshot.exceptions, []);
      assert.equal(mismatched.snapshot.message, "接送异常或当前范围无效，已停止显示。");
    }
  });

  test("review sends only the current version and fixed follow outcome", async () => {
    const harness = createHarness();
    const client = new PickupReviewClient(harness.transport);
    await client.connect("owner-east");
    await client.review(uuid(501), 1, "follow");

    const write = harness.calls.find(
      (call) => call.method === "POST" && call.path.includes("/review"),
    );
    assert.deepEqual(write?.body, {
      version: 1,
      action: "follow",
      outcome: "CONTACT_GUARDIAN",
    });
    assert.equal(client.snapshot.exceptions[0]?.status, "FOLLOWING");
    assert.equal(client.snapshot.exceptions[0]?.version, 2);
  });

  test("stale versions and unsupported actions never reach the proxy", async () => {
    const harness = createHarness();
    const client = new PickupReviewClient(harness.transport);
    await client.connect("owner-east");
    await client.review(uuid(501), 9, "follow");
    await client.review(uuid(501), 1, "publish");

    assert.equal(
      harness.calls.some(
        (call) => call.method === "POST" && call.path.includes("/pickup-exceptions/"),
      ),
      false,
    );
  });

  test("a server version conflict clears the session and blocks later review actions", async () => {
    const harness = createHarness({ conflictOnReview: true });
    const client = new PickupReviewClient(harness.transport);
    await client.connect("owner-east");
    await client.review(uuid(501), 1, "follow");
    const writesAfterConflict = harness.calls.filter(
      (call) => call.method === "POST" && call.path.includes("/pickup-exceptions/"),
    ).length;

    assert.equal(client.snapshot.status, "ERROR");
    assert.equal(client.snapshot.session, null);
    assert.deepEqual(client.snapshot.exceptions, []);
    assert.equal(client.snapshot.message, "记录已变化，请刷新后重试。");
    await client.review(uuid(501), 1, "follow");
    assert.equal(
      harness.calls.filter(
        (call) => call.method === "POST" && call.path.includes("/pickup-exceptions/"),
      ).length,
      writesAfterConflict,
    );
  });
}
