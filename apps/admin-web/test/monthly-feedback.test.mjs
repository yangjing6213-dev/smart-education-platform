/* global Response */
import assert from "node:assert/strict";
import { URL } from "node:url";
import test from "node:test";
import {
  MonthlyFeedbackReviewClient,
  renderMonthlyFeedbackReview,
} from "../dist/local-review/monthly-feedback.js";

const session = {
  profile: "owner-east",
  label: "示例东校区负责人",
  actorId: "00000000-0000-4000-8000-000000000004",
  tenantId: "00000000-0000-4000-8000-000000000100",
  campusId: "00000000-0000-4000-8000-000000000101",
  classIds: ["00000000-0000-4000-8000-000000000103"],
  actions: ["feedback:read", "feedback:review", "feedback:publish"],
};
const row = {
  kind: "monthlyFeedback",
  id: "00000000-0000-4000-8000-000000000601",
  version: 2,
  tenantId: session.tenantId,
  campusId: session.campusId,
  classId: session.classIds[0],
  month: "2026-10",
  teacherId: "00000000-0000-4000-8000-000000000003",
  teacherLabel: "示例东校区教师",
  sourceSummary: [
    { kind: "GROWTH_RECORD", label: "已发布成长记录", count: 1, dates: ["2026-10-08"] },
    { kind: "ATTENDANCE_OVERVIEW", label: "已确认考勤概览", count: 0, dates: [] },
    { kind: "STAFF_DAILY", label: "已确认工作日报", count: 0, dates: [] },
  ],
  supplements: {
    learningParticipation: "PROGRESSING",
    dailyHabits: "KEEP_WATCHING",
    activityParticipation: "PROGRESSING",
    familySchoolCollaboration: "FOLLOW_UP",
  },
  status: "SUBMITTED",
  published: false,
  synthetic: true,
};

test("monthly feedback review embeds in the existing staff page and scopes actions", () => {
  const html = renderMonthlyFeedbackReview(
    {
      role: "CAMPUS_REVIEWER",
      status: "READY",
      session,
      rows: [row],
      counts: {
        DRAFT: 0,
        SUBMITTED: 1,
        RETURNED: 0,
        CONFIRMED: 0,
        PUBLISHED: 0,
        REVIEW_REQUIRED: 0,
      },
      message: "负责人审核队列已更新。",
      error: null,
    },
    true,
  );
  assert.match(html, /月度成长反馈审核/u);
  assert.match(html, /确认反馈/u);
  assert.match(html, /退回修改/u);
  assert.match(html, /已发布成长记录 1 条/u);
  assert.doesNotMatch(html, /admin\/monthly-feedback-review|返回管理首页/u);
});

test("review client submits the displayed version to the existing local endpoint", async () => {
  const writes = [];
  let current = row;
  const fetcher = async (input, init = {}) => {
    const path = new URL(String(input)).pathname;
    if (init.method === "POST" && path.endsWith("/review")) {
      writes.push({ path, body: JSON.parse(String(init.body)) });
      current = { ...row, version: 3, status: "CONFIRMED" };
      return new Response(JSON.stringify(current));
    }
    const payload =
      path === "/local/sessions"
        ? { handle: "a".repeat(43) }
        : path === "/local/session"
          ? { ...session, mode: "local-synthetic" }
          : path === "/local/monthly-feedback-review"
            ? [current]
            : [];
    return new Response(JSON.stringify(payload));
  };
  const client = new MonthlyFeedbackReviewClient({ transport: fetcher });
  await client.connect();
  await client.command(row.id, row.version, "CONFIRM");
  assert.deepEqual(writes, [
    {
      path: `/local/monthly-feedback/${row.id}/review`,
      body: { version: 2, action: "CONFIRM" },
    },
  ]);
  assert.equal(client.snapshot.rows[0]?.status, "CONFIRMED");
});

test("disconnect clears monthly feedback and ignores a late refresh response", async () => {
  let listCalls = 0;
  let resolveLateList;
  const lateList = new Promise((resolve) => {
    resolveLateList = resolve;
  });
  const client = new MonthlyFeedbackReviewClient({
    transport: async (input) => {
      const path = new URL(String(input)).pathname;
      if (path === "/local/sessions")
        return new Response(JSON.stringify({ handle: "a".repeat(43) }));
      if (path === "/local/session")
        return new Response(JSON.stringify({ ...session, mode: "local-synthetic" }));
      if (path === "/local/monthly-feedback-review") {
        listCalls += 1;
        return listCalls === 1 ? new Response(JSON.stringify([row])) : lateList;
      }
      return new Response(null, { status: 403 });
    },
  });

  await client.connect();
  assert.equal(client.snapshot.rows.length, 1);
  const refresh = client.refresh();
  client.disconnect();
  resolveLateList(new Response(JSON.stringify([row])));
  await refresh;

  assert.equal(client.snapshot.status, "IDLE");
  assert.equal(client.snapshot.session, null);
  assert.deepEqual(client.snapshot.rows, []);
});

test("monthly feedback from another campus fails closed and cannot be reviewed", async () => {
  const writes = [];
  const client = new MonthlyFeedbackReviewClient({
    transport: async (input, init = {}) => {
      const path = new URL(String(input)).pathname;
      if (path === "/local/sessions")
        return new Response(JSON.stringify({ handle: "a".repeat(43) }));
      if (path === "/local/session")
        return new Response(JSON.stringify({ ...session, mode: "local-synthetic" }));
      if (path === "/local/monthly-feedback-review")
        return new Response(
          JSON.stringify([{ ...row, campusId: "00000000-0000-4000-8000-000000000102" }]),
        );
      if (init.method === "POST") writes.push(path);
      return new Response(null, { status: 403 });
    },
  });

  await client.connect();
  assert.equal(client.snapshot.status, "ERROR");
  assert.equal(client.snapshot.session, null);
  assert.deepEqual(client.snapshot.rows, []);
  await assert.rejects(
    client.command(row.id, row.version, "CONFIRM"),
    /REVIEWER_SESSION_REQUIRED/u,
  );
  assert.deepEqual(writes, []);
});
