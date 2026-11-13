/* global Response */
import assert from "node:assert/strict";
import test from "node:test";
import {
  createLocalStaffDailyTransport,
  renderStaffDailyReview,
  StaffDailyReviewClient,
} from "../src/local-review/staff-daily.ts";

const reviewer = {
  mode: "local-synthetic",
  profile: "owner-east",
  label: "示例东校区负责人",
  actorId: "00000000-0000-4000-8000-000000000004",
  tenantId: "00000000-0000-4000-8000-000000000100",
  campusId: "00000000-0000-4000-8000-000000000101",
  classIds: ["00000000-0000-4000-8000-000000000103"],
  actions: ["daily:read", "daily:review"],
};

const row = {
  id: "00000000-0000-4000-8000-000000000501",
  version: 2,
  kind: "staffDaily",
  tenantId: reviewer.tenantId,
  campusId: reviewer.campusId,
  classId: reviewer.classIds[0],
  date: "2026-10-08",
  values: {
    arrival: "ARRIVED_AS_PLANNED",
    homework: "COMPLETED",
    activity: "PARTICIPATED",
    classroom: "ROUTINE",
    followUp: "NONE",
  },
  sourceRefs: [
    { kind: "TASK", id: "00000000-0000-4000-8000-000000000601", version: 2 },
    { kind: "ATTENDANCE", id: "00000000-0000-4000-8000-000000000602", version: 1 },

    { kind: "CARE_RECORD", id: "00000000-0000-4000-8000-000000000605", version: 2 },
    { kind: "PICKUP", id: "00000000-0000-4000-8000-000000000603", version: 3 },
    { kind: "PICKUP_EXCEPTION", id: "00000000-0000-4000-8000-000000000604", version: 1 },
  ],
  status: "SUBMITTED",
  createdBy: "00000000-0000-4000-8000-000000000003",
  authorLabel: "示例东校区教师",
  synthetic: true,
  learningSummary: {
    completedLearnerBand: "2_PLUS",
    usedGuidance: true,
    needsTeacherFollowUp: true,
  },
};

test("负责人页面只展示授权范围内日报、固定内容和来源数量", () => {
  const html = renderStaffDailyReview({
    status: "READY",
    session: reviewer,
    rows: [
      {
        id: row.id,
        version: row.version,
        status: row.status,
        date: row.date,
        authorLabel: row.authorLabel,
        values: row.values,
        sourceCounts: { TASK: 1, ATTENDANCE: 1, CARE_RECORD: 1, PICKUP: 1, PICKUP_EXCEPTION: 1 },
        learningSummary: row.learningSummary,
      },
    ],
    message: "有 1 份日报待审核",
    error: null,
  });
  assert.match(html, /待负责人审核/u);
  assert.match(html, /按计划到校/u);
  assert.match(html, /来源记录：任务 1 · 考勤 1 · 托管记录 1 · 接送 1 · 异常 1/u);
  assert.match(html, /确认日报/u);
  assert.match(html, /退回修改/u);
  assert.match(html, /固定题学习摘要（本机合成）/u);
  assert.match(html, /2 人及以上已完成练习/u);
  assert.doesNotMatch(
    html,
    /00000000-0000-4000-8000-00000000060|studentId|sourceRefs|学生姓名|hintText/u,
  );
});

test("负责人审核固定使用 owner-east、版本号和本机请求白名单", async () => {
  const calls = [];
  let inQueue = true;
  const transport = async (path, init = {}) => {
    calls.push({ path, method: init.method ?? "GET", body: init.body });
    const method = init.method ?? "GET";
    const payload =
      path === "/local/sessions"
        ? { handle: "b".repeat(43) }
        : path === "/local/session"
          ? reviewer
          : path === "/local/staff-daily-review"
            ? inQueue
              ? [row]
              : []
            : path.endsWith("/review") && method === "POST"
              ? ((inQueue = false), { ...row, status: "CONFIRMED", version: 3 })
              : {};
    return new Response(JSON.stringify(payload), { status: 200 });
  };
  const client = new StaffDailyReviewClient({ transport });
  await client.connect();
  assert.equal(client.snapshot.status, "READY");
  assert.deepEqual(client.snapshot.rows[0]?.learningSummary, row.learningSummary);
  await client.review(row.id, row.version, "CONFIRM");
  assert.equal(client.snapshot.rows.length, 0);
  const reviewCall = calls.find((call) => call.path.endsWith("/review"));
  assert.deepEqual(JSON.parse(reviewCall.body), { version: 2, action: "CONFIRM" });
  await client.review(row.id, row.version, "CONFIRM");
  assert.equal(calls.filter((call) => call.path.endsWith("/review")).length, 1);
  assert.equal(JSON.parse(calls[0].body).profile, "owner-east");
  const guarded = createLocalStaffDailyTransport("http://127.0.0.1:4317", async () => {
    throw new Error("unexpected request");
  });
  assert.equal((await guarded("/local/staff-daily-owned")).status, 403);
});

test("负责人日报解析器拒绝学习摘要中的个人或多余字段", async () => {
  const unsafeRow = {
    ...row,
    learningSummary: {
      ...row.learningSummary,
      learnerId: "must-not-be-rendered",
    },
  };
  const transport = async (path) => {
    const payload =
      path === "/local/sessions"
        ? { handle: "b".repeat(43) }
        : path === "/local/session"
          ? reviewer
          : [unsafeRow];
    return new Response(JSON.stringify(payload), { status: 200 });
  };
  const client = new StaffDailyReviewClient({ transport });
  await client.connect();
  assert.equal(client.snapshot.status, "ERROR");
  assert.deepEqual(client.snapshot.rows, []);
});

test("负责人审核期间锁定重复操作并忽略离页后的旧连接", async () => {
  let releaseReview;
  let markReviewStarted;
  let reviewCalls = 0;
  const reviewStarted = new Promise((resolve) => (markReviewStarted = resolve));
  const pendingReview = new Promise((resolve) => (releaseReview = resolve));
  const transport = async (path) => {
    if (path === "/local/sessions") return new Response(JSON.stringify({ handle: "b".repeat(43) }));
    if (path === "/local/session") return new Response(JSON.stringify(reviewer));
    if (path === "/local/staff-daily-review") return new Response(JSON.stringify([row]));
    if (path.endsWith("/review")) {
      reviewCalls += 1;
      markReviewStarted();
      return pendingReview;
    }
    throw new Error("unexpected request");
  };
  const client = new StaffDailyReviewClient({ transport });
  await client.connect();
  const first = client.review(row.id, row.version, "CONFIRM");
  await reviewStarted;
  const statusWhileSaving = String(client.snapshot.status);
  const second = client.review(row.id, row.version, "CONFIRM");
  const writesWhilePending = reviewCalls;
  releaseReview(new Response(JSON.stringify({ ...row, status: "CONFIRMED", version: 3 })));
  await Promise.all([first, second]);
  assert.equal(statusWhileSaving, "BUSY");
  assert.equal(writesWhilePending, 1, "同一日报的重复点击只能产生一条审核写入");

  let releaseBootstrap;
  let markBootstrapStarted;
  const bootstrapStarted = new Promise((resolve) => (markBootstrapStarted = resolve));
  const bootstrap = new Promise((resolve) => (releaseBootstrap = resolve));
  const delayedTransport = async (path) => {
    if (path === "/local/sessions") {
      markBootstrapStarted();
      return bootstrap;
    }
    if (path === "/local/session") return new Response(JSON.stringify(reviewer));
    return new Response(JSON.stringify([row]));
  };
  const secondClient = new StaffDailyReviewClient({ transport: delayedTransport });
  const connecting = secondClient.connect();
  await bootstrapStarted;
  const disconnect = Reflect.get(secondClient, "disconnect");
  if (typeof disconnect === "function") disconnect.call(secondClient);
  releaseBootstrap(new Response(JSON.stringify({ handle: "b".repeat(43) })));
  await connecting;
  assert.equal(typeof disconnect, "function", "审核页面离开时应作废未完成的连接");
  assert.equal(secondClient.snapshot.status, "IDLE");
  assert.equal(secondClient.snapshot.session, null);
  assert.deepEqual(secondClient.snapshot.rows, []);
});

test("负责人审核失败时读取错误响应并清除旧身份和旧记录", async () => {
  let failedResponse;
  const transport = async (path) => {
    if (path === "/local/sessions") return new Response(JSON.stringify({ handle: "b".repeat(43) }));
    if (path === "/local/session") return new Response(JSON.stringify(reviewer));
    if (path === "/local/staff-daily-review") return new Response(JSON.stringify([row]));
    if (path.endsWith("/review")) {
      failedResponse = new Response('{"error":{"code":"VERSION_CONFLICT"}}', { status: 409 });
      return failedResponse;
    }
    throw new Error("unexpected request");
  };
  const client = new StaffDailyReviewClient({ transport });
  await client.connect();
  await client.review(row.id, row.version, "CONFIRM");
  assert.equal(failedResponse?.bodyUsed, true, "失败响应正文需要被读取且不得暴露服务细节");
  assert.equal(client.snapshot.status, "ERROR");
  assert.equal(client.snapshot.session, null);
  assert.deepEqual(client.snapshot.rows, []);
});
