import assert from "node:assert/strict";
import test from "node:test";
import type { ParentLearningSnapshot } from "./learning.js";

const studentId = "00000000-0000-4000-8000-0000000000c8";
const baseControls = {
  studentId,
  studentLabel: "示例学生甲",
  enabled: true,
  maxDurationMinutes: 15,
  maxHintLevel: 3,
  contactStatus: "NOT_REQUESTED",
} as const;
type Control = {
  studentId: string;
  studentLabel: string;
  enabled: boolean;
  maxDurationMinutes: 5 | 10 | 15;
  maxHintLevel: 0 | 1 | 2 | 3;
  contactStatus: "NOT_REQUESTED" | "RECORDED_LOCAL";
};

function learningData(overrides: Record<string, unknown> = {}) {
  return {
    approvedStudents: [
      { studentId, studentLabel: "示例学生甲", classLabel: "示例三年级甲班" },
    ],
    parentControls: [{ ...baseControls }],
    parentSummary: [
      {
        studentId,
        studentLabel: "示例学生甲",
        usedMinutes: 12,
        sessionCount: 3,
        completedSessions: 2,
        knowledgePoints: [
          { label: "两位数加法与进位", sessionCount: 3, completedSessions: 2 },
        ],
        attentionCount: 0,
      },
    ],
    parentSummaryUpdatedAt: "2026-10-19T00:00:00.000Z",
    ...overrides,
  };
}

function envelope(data: unknown, status = 200): Response {
  return new Response(JSON.stringify({ data }), {
    status,
    headers: { "content-type": "application/json" },
  });
}

type InviteClient = {
  readonly snapshot: ParentLearningSnapshot;
  connect(): Promise<void>;
  refresh(): Promise<void>;
  updateParentControls(
    id: string,
    values: { enabled: boolean; maxDurationMinutes: 5 | 10 | 15; maxHintLevel: 0 | 1 | 2 | 3 },
  ): Promise<void>;
  contactTeacher(id: string): Promise<void>;
};

type InviteClientConstructor = new (options: {
  readonly baseUrl: string;
  readonly fetcher?: typeof fetch;
}) => InviteClient;

async function clientConstructor(): Promise<InviteClientConstructor> {
  const modulePath = "./parent-learning-invite-client.js";
  const loaded: unknown = await import(modulePath).catch(() => undefined);
  assert.ok(loaded, "新版家长学习摘要必须提供邀请会话客户端。");
  assert.ok(typeof loaded === "object" && loaded !== null);
  assert.ok("ParentLearningInviteClient" in loaded);
  return (loaded as { ParentLearningInviteClient: InviteClientConstructor })
    .ParentLearningInviteClient;
}

test("parent learning invite client uses only same-origin invite credentials and approved projections", async () => {
  const ParentLearningInviteClient = await clientConstructor();
  const calls: { url: string; method: string; init: RequestInit | undefined }[] = [];
  const client = new ParentLearningInviteClient({
    baseUrl: "https://parent.example",
    fetcher: async (input, init) => {
      calls.push({ url: String(input), method: init?.method ?? "GET", init });
      return envelope(learningData());
    },
  });

  await client.connect();

  assert.equal(client.snapshot.status, "READY");
  assert.equal(client.snapshot.approvedStudents.length, 1);
  assert.equal(client.snapshot.approvedStudents[0]?.studentId, studentId);
  assert.equal(client.snapshot.parentControls?.[0]?.studentId, studentId);
  assert.equal(client.snapshot.parentSummary?.[0]?.usedMinutes, 12);
  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.url, "https://parent.example/api-local/parent/learning");
  assert.equal(calls[0]?.method, "GET");
  assert.equal(calls[0]?.init?.credentials, "same-origin");
  assert.equal(new Headers(calls[0]?.init?.headers).has("authorization"), false);
  assert.equal(calls[0]?.init?.body, undefined);
});

test("parent learning controls and contact use approved-child routes and never send messages", async () => {
  const ParentLearningInviteClient = await clientConstructor();
  const calls: { url: string; method: string; body?: string }[] = [];
  let control: Control = { ...baseControls };
  const client = new ParentLearningInviteClient({
    baseUrl: "http://localhost:3000",
    fetcher: async (input, init) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      calls.push({ url, method, ...(typeof init?.body === "string" ? { body: init.body } : {}) });
      if (method === "POST" && url.endsWith("/controls")) {
        const values = JSON.parse(String(init?.body)) as Pick<Control, "enabled" | "maxDurationMinutes" | "maxHintLevel">;
        control = { ...control, ...values };
        return envelope(control);
      }
      if (method === "POST" && url.endsWith("/contact")) {
        control = { ...control, contactStatus: "RECORDED_LOCAL" };
        return envelope(
          {
            id: "00000000-0000-4000-8000-0000000000c9",
            studentId,
            studentLabel: "示例学生甲",
            status: "RECORDED_LOCAL",
            createdAt: "2026-10-19T00:01:00.000Z",
          },
          201,
        );
      }
      return envelope(learningData({ parentControls: [control] }));
    },
  });
  await client.connect();

  await client.updateParentControls(studentId, {
    enabled: false,
    maxDurationMinutes: 10,
    maxHintLevel: 2,
  });
  await client.contactTeacher(studentId);

  assert.equal(client.snapshot.parentControls?.[0]?.enabled, false);
  assert.equal(client.snapshot.parentControls?.[0]?.maxDurationMinutes, 10);
  assert.equal(client.snapshot.parentControls?.[0]?.maxHintLevel, 2);
  assert.equal(client.snapshot.parentControls?.[0]?.contactStatus, "RECORDED_LOCAL");
  const writes = calls.filter((call) => call.method === "POST");
  assert.deepEqual(
    writes.map(({ url, body }) => ({ url, body: body ? JSON.parse(body) : undefined })),
    [
      {
        url: `http://localhost:3000/api-local/parent/learning/${studentId}/controls`,
        body: { enabled: false, maxDurationMinutes: 10, maxHintLevel: 2 },
      },
      {
        url: `http://localhost:3000/api-local/parent/learning/${studentId}/contact`,
        body: {},
      },
    ],
  );
});

test("expired invitation or over-broad response clears the previous learning summary", async () => {
  const ParentLearningInviteClient = await clientConstructor();
  let unauthorized = false;
  const client = new ParentLearningInviteClient({
    baseUrl: "https://parent.example",
    fetcher: async () =>
      unauthorized
        ? envelope({ error: { code: "UNAUTHENTICATED" } }, 401)
        : envelope(learningData()),
  });
  await client.connect();
  assert.equal(client.snapshot.parentSummary?.length, 1);

  unauthorized = true;
  await client.refresh();
  assert.equal(client.snapshot.status, "DENIED");
  assert.deepEqual(client.snapshot.approvedStudents, []);
  assert.deepEqual(client.snapshot.parentSummary, []);

  const overBroad = new ParentLearningInviteClient({
    baseUrl: "https://parent.example",
    fetcher: async () =>
      envelope(
        learningData({
          approvedStudents: [
            { studentId, studentLabel: "示例学生甲", classLabel: "示例三年级甲班", campusId: "forged" },
          ],
        }),
      ),
  });
  await overBroad.connect();
  assert.equal(overBroad.snapshot.status, "DENIED");
  assert.deepEqual(overBroad.snapshot.parentControls, []);
  assert.deepEqual(overBroad.snapshot.parentSummary, []);

  const malformedControl = new ParentLearningInviteClient({
    baseUrl: "https://parent.example",
    fetcher: async () =>
      envelope(
        learningData({
          parentControls: [{ ...baseControls, maxDurationMinutes: "15" }],
        }),
      ),
  });
  await malformedControl.connect();
  assert.equal(malformedControl.snapshot.status, "DENIED");
  assert.deepEqual(malformedControl.snapshot.parentControls, []);

  const unavailable = new ParentLearningInviteClient({
    baseUrl: "https://parent.example",
    fetcher: async () => {
      throw new Error("connection refused");
    },
  });
  await unavailable.connect();
  assert.equal(unavailable.snapshot.status, "DENIED");
  assert.equal(unavailable.snapshot.message, "学习摘要暂不可用，请稍后重试。");
});
