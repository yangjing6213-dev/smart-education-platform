import assert from "node:assert/strict";
import test from "node:test";
import {
  parseMonthlyFeedbackParentRows,
  parseMonthlyFeedbackRows,
  renderMonthlyFeedbackPanel,
} from "./monthly-feedback.js";
import { MonthlyFeedbackClient } from "./monthly-feedback-client.js";

const teacher = {
  profile: "teacher-east" as const,
  label: "示例东校区教师",
  actorId: "00000000-0000-4000-8000-000000000003",
  tenantId: "00000000-0000-4000-8000-000000000100",
  campusId: "00000000-0000-4000-8000-000000000101",
  classIds: ["00000000-0000-4000-8000-000000000103"],
  actions: ["feedback:read", "feedback:create", "feedback:submit"],
};
const row = {
  kind: "monthlyFeedback",
  id: "00000000-0000-4000-8000-000000000601",
  version: 1,
  tenantId: teacher.tenantId,
  campusId: teacher.campusId,
  classId: teacher.classIds[0],
  month: "2026-10",
  sourceSummary: [
    {
      kind: "GROWTH_RECORD",
      label: "已发布成长记录",
      count: 1,
      dates: ["2026-10-08"],
    },
    {
      kind: "ATTENDANCE_OVERVIEW",
      label: "已确认考勤概览",
      count: 0,
      dates: [],
    },
    { kind: "STAFF_DAILY", label: "已确认工作日报", count: 0, dates: [] },
  ],
  supplements: {
    learningParticipation: "PROGRESSING",
    dailyHabits: "KEEP_WATCHING",
    activityParticipation: "PROGRESSING",
    familySchoolCollaboration: "FOLLOW_UP",
  },
  status: "PUBLISHED",
  createdBy: teacher.actorId,
  authorLabel: teacher.label,
  published: true,
  synthetic: true,
};

test("monthly feedback parsing rejects out-of-scope rows and source identifiers", () => {
  assert.equal(parseMonthlyFeedbackRows([row], teacher)[0]?.id, row.id);
  assert.throws(() =>
    parseMonthlyFeedbackRows(
      [{ ...row, campusId: "00000000-0000-4000-8000-000000000102" }],
      teacher,
    ),
  );
  assert.throws(() =>
    parseMonthlyFeedbackRows(
      [{ ...row, sourceSummary: [{ ...row.sourceSummary[0], id: "source-record-id" }] }],
      teacher,
    ),
  );
});

test("parent projection hides internal sources and invalidated supplement values", () => {
  const published = parseMonthlyFeedbackParentRows([
    {
      id: row.id,
      version: 4,
      month: row.month,
      status: "PUBLISHED",
      items: [{ label: "学习参与", value: "PROGRESSING" }],
      acknowledged: false,
      synthetic: true,
    },
  ]);
  const parentSnapshot = {
    status: "READY" as const,
    profile: "parent-alpha" as const,
    session: {
      ...teacher,
      profile: "parent-alpha" as const,
      actions: ["feedback:read", "feedback:ack"],
    },
    monthlyFeedbackOwned: [],
    monthlyFeedbackReview: [],
    monthlyFeedbackParent: published,
    message: "月度反馈已更新。",
    error: null,
  };
  const visible = renderMonthlyFeedbackPanel(parentSnapshot);
  assert.match(visible, /确认知悉/u);
  assert.match(visible, /已有进步/u);
  assert.doesNotMatch(visible, /已发布成长记录|source-record-id|示例东校区教师/u);

  const invalidated = renderMonthlyFeedbackPanel({
    ...parentSnapshot,
    monthlyFeedbackParent: parseMonthlyFeedbackParentRows([
      {
        id: row.id,
        version: 5,
        month: row.month,
        status: "REVIEW_REQUIRED",
        items: [],
        acknowledged: false,
        synthetic: true,
      },
    ]),
  });
  assert.match(invalidated, /来源发生变化/u);
  assert.doesNotMatch(invalidated, /已有进步|确认知悉/u);
});

test("teacher submit uses the current row version and the existing local endpoint", async () => {
  const requests: { path: string; method: string; body?: unknown }[] = [];
  let current = { ...row, status: "DRAFT", published: false };
  const fetcher: typeof fetch = async (input, init = {}) => {
    const path = new URL(String(input)).pathname;
    const method = init.method ?? "GET";
    requests.push({
      path,
      method,
      ...(init.body ? { body: JSON.parse(String(init.body)) as unknown } : {}),
    });
    const payload =
      path === "/local/sessions"
        ? { handle: "a".repeat(43) }
        : path === "/local/session"
          ? { ...teacher, mode: "local-synthetic" }
          : path === "/local/monthly-feedback-owned"
            ? [current]
            : path.endsWith("/submit")
              ? (current = { ...current, version: 2, status: "SUBMITTED" })
              : [];
    return new Response(JSON.stringify(payload), { status: 200 });
  };
  const client = new MonthlyFeedbackClient("teacher-east", { fetcher });
  await client.connect();
  await client.command("submit", row.id, 1);
  assert.equal(client.snapshot.monthlyFeedbackOwned[0]?.version, 2);
  assert.ok(
    requests.some(
      (request) =>
        request.path === `/local/monthly-feedback/${row.id}/submit` &&
        request.method === "POST" &&
        (request.body as { version?: number }).version === 1,
    ),
  );
});
