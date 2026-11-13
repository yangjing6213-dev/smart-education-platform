import assert from "node:assert/strict";
import test from "node:test";
import {
  ParentPickupClient,
  renderParentPickupPanel,
  type ParentPickupInput,
  type ParentPickupSnapshot,
} from "./parent-pickup.js";

const bindingId = "10000000-0000-4000-8000-000000000001";
const pendingBindingId = "10000000-0000-4000-8000-000000000002";
const authorizationId = "20000000-0000-4000-8000-000000000001";
const draftAuthorizationId = "20000000-0000-4000-8000-000000000002";
const shanghaiToday = () => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const fields = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${fields.year}-${fields.month}-${fields.day}`;
};
const addDays = (value: string, days: number) => {
  const result = new Date(`${value}T00:00:00.000Z`);
  result.setUTCDate(result.getUTCDate() + days);
  return result.toISOString().slice(0, 10);
};

const emptySnapshot = (overrides: Partial<ParentPickupSnapshot> = {}): ParentPickupSnapshot => ({
  status: "READY",
  bindings: [],
  authorizations: [],
  records: [],
  credential: null,
  historyFrom: "",
  historyTo: "",
  message: "已连接本机接送资料。",
  ...overrides,
});

const approvedBinding = {
  id: bindingId,
  version: 2,
  status: "APPROVED" as const,
  studentId: "30000000-0000-4000-8000-000000000001",
  studentLabel: "示例学生甲",
  classLabel: "三年级示例班",
};

const authorization = {
  id: authorizationId,
  version: 1,
  status: "ACTIVE" as const,
  currentlyValid: true,
  bindingId,
  studentId: approvedBinding.studentId,
  studentLabel: approvedBinding.studentLabel,
  classLabel: approvedBinding.classLabel,
  recipient: "pickup-alpha" as const,
  recipientLabel: "示例接送人甲",
  type: "TEMPORARY" as const,
  startDate: "2026-10-09",
  endDate: "2026-10-09",
  startTime: "15:00",
  endTime: "18:00",
};

function pickupClient() {
  const calls: {
    path: string;
    method: string;
    body: unknown;
    credentials: RequestCredentials | undefined;
    authorization: string | null;
  }[] = [];
  let rows: Record<string, unknown>[] = [authorization];
  let credentialLifetime = 5 * 60 * 1000;
  let revokeAfterCredentialIssue = false;
  const fetcher: typeof fetch = async (input, init = {}) => {
    const url = new URL(String(input));
    const method = init.method ?? "GET";
    const body = typeof init.body === "string" ? JSON.parse(init.body) : undefined;
    const authorizationHeader = new Headers(init.headers).get("Authorization");
    calls.push({
      path: url.pathname,
      method,
      body,
      credentials: init.credentials,
      authorization: authorizationHeader,
    });

    if (url.pathname === "/api-local/parent/pickup" && method === "GET")
      return Response.json({
        data: {
          bindings: [
            { ...approvedBinding },
            {
              ...approvedBinding,
              id: pendingBindingId,
              status: "PENDING",
              studentLabel: "未审核学生",
            },
          ],
          authorizations: rows,
          records: [
            {
              id: "50000000-0000-4000-8000-000000000001",
              date: "2026-10-09",
              time: "17:30",
              studentId: approvedBinding.studentId,
              studentLabel: approvedBinding.studentLabel,
              recipient: "示例接送人甲",
              status: "COMPLETED",
              teacherId: "private-internal-id",
              checks: { student: true, recipient: true, authorization: true },
            },
          ],
        },
      });
    if (url.pathname === "/api-local/parent/pickup/authorizations" && method === "POST") {
      const created = { ...authorization, ...body, status: "DRAFT", version: 1 };
      rows = [...rows, created];
      return Response.json({ data: created }, { status: 201 });
    }
    const action =
      /^\/api-local\/parent\/pickup\/authorizations\/([^/]+)\/(activate|revoke|credential)$/u.exec(
        url.pathname,
      );
    if (action?.[1] === authorizationId && action[2] === "credential") {
      if (revokeAfterCredentialIssue)
        rows = [{ ...authorization, status: "REVOKED", currentlyValid: false, version: 2 }];
      return Response.json({
        data: {
          authorizationId,
          expiresAt: new Date(Date.now() + credentialLifetime).toISOString(),
          credential: "b".repeat(43),
        },
      });
    }
    if (action?.[1] && action[2] !== "credential") {
      rows = rows.map((row) =>
        row.id === action[1]
          ? {
              ...row,
              status: action[2] === "activate" ? "ACTIVE" : "REVOKED",
              version: Number(row.version) + 1,
              currentlyValid: action[2] === "activate",
            }
          : row,
      );
      return Response.json({ data: rows.find((row) => row.id === action[1]) });
    }
    return Response.json({ error: { code: "UNAVAILABLE" } }, { status: 404 });
  };

  return {
    calls,
    client: new ParentPickupClient({ baseUrl: "http://127.0.0.1:7215", fetcher }),
    setRows(next: Record<string, unknown>[]) {
      rows = next;
    },
    setCredentialLifetime(value: number) {
      credentialLifetime = value;
    },
    revokeAfterCredentialIssue() {
      revokeAfterCredentialIssue = true;
    },
  };
}

test("parent panel hides authorization actions until an approved relationship exists", () => {
  const html = renderParentPickupPanel(emptySnapshot());
  assert.match(html, /尚无已审核的孩子关系/);
  assert.doesNotMatch(html, /data-parent-pickup-form/);
  assert.doesNotMatch(html, /data-parent-pickup-action/);
});

test("parent panel shows safe records, date filters and escaped labels without internal checks", () => {
  const html = renderParentPickupPanel(
    emptySnapshot({
      bindings: [approvedBinding],
      authorizations: [
        {
          ...authorization,
          id: draftAuthorizationId,
          status: "DRAFT",
          currentlyValid: false,
          studentLabel: "<img src=x onerror=alert(1)>",
        },
        authorization,
      ],
      records: [
        {
          id: "50000000-0000-4000-8000-000000000001",
          date: "2026-10-09",
          time: "17:30",
          studentLabel: "示例学生甲",
          recipient: "示例接送人甲",
        },
      ],
    }),
  );
  assert.match(html, /name="historyFrom"/);
  assert.match(html, /name="historyTo"/);
  assert.match(html, /确认接送授权/);
  assert.match(html, /生成现场凭证/);
  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.doesNotMatch(html, /<img src=x/);
  assert.doesNotMatch(html, /private-internal-id|authorizationId|student: true/);
});

test("client scopes creation to approved bindings from the invitation session", async () => {
  const { client, calls } = pickupClient();
  await client.connect();
  const today = shanghaiToday();

  assert.equal(client.snapshot.status, "READY");
  assert.deepEqual(
    client.snapshot.bindings.map((row) => row.id),
    [bindingId],
  );
  assert.equal(client.snapshot.records.length, 1);
  assert.equal("teacherId" in client.snapshot.records[0]!, false);
  assert.equal("checks" in client.snapshot.records[0]!, false);

  await client.create({
    bindingId: pendingBindingId,
    recipient: "pickup-alpha",
    type: "TEMPORARY",
    startDate: today,
    endDate: today,
    startTime: "15:00",
    endTime: "18:00",
  });
  assert.equal(
    calls.some(
      (call) => call.method === "POST" && call.path === "/api-local/parent/pickup/authorizations",
    ),
    false,
  );

  await client.create({
    bindingId,
    recipient: "pickup-alpha",
    type: "TEMPORARY",
    startDate: today,
    endDate: today,
    startTime: "15:00",
    endTime: "18:00",
  });
  const create = calls.find(
    (call) => call.method === "POST" && call.path === "/api-local/parent/pickup/authorizations",
  );
  assert.deepEqual(create?.body, {
    bindingId,
    recipient: "pickup-alpha",
    type: "TEMPORARY",
    startDate: today,
    endDate: today,
    startTime: "15:00",
    endTime: "18:00",
  });
  assert.ok(calls.every((call) => call.credentials === "same-origin"));
  assert.ok(calls.every((call) => call.authorization === null));
});

test("client rejects expired, over-90-day and multi-day temporary authorizations before sending", async () => {
  const { client, calls } = pickupClient();
  await client.connect();
  const today = shanghaiToday();
  const validInput: ParentPickupInput = {
    bindingId,
    recipient: "pickup-alpha",
    type: "REGULAR",
    startDate: today,
    endDate: addDays(today, 90),
    startTime: "15:00",
    endTime: "18:00",
  };
  await client.create(validInput);
  assert.equal(
    calls.some((call) => call.method === "POST"),
    true,
  );

  const createsBeforeInvalidInputs = calls.filter(
    (call) => call.method === "POST" && call.path === "/api-local/parent/pickup/authorizations",
  ).length;
  const invalidInputs: ParentPickupInput[] = [
    { ...validInput, type: "REGULAR", endDate: addDays(today, 91) },
    { ...validInput, type: "REGULAR", startDate: addDays(today, -1), endDate: addDays(today, -1) },
    { ...validInput, type: "TEMPORARY", endDate: addDays(today, 1) },
  ];
  for (const input of invalidInputs) await client.create(input);
  assert.equal(
    calls.filter(
      (call) => call.method === "POST" && call.path === "/api-local/parent/pickup/authorizations",
    ).length,
    createsBeforeInvalidInputs,
  );
  assert.match(client.snapshot.message, /日期/u);
});

test("client hides authorization rows that do not match an approved child's identity", async () => {
  const { client, setRows } = pickupClient();
  setRows([
    {
      ...authorization,
      studentId: "30000000-0000-4000-8000-000000000002",
      studentLabel: "错误学生",
    },
    { ...authorization, studentLabel: "伪造学生名", classLabel: "伪造班级" },
  ]);
  await client.connect();

  assert.equal(client.snapshot.status, "READY");
  assert.equal(client.snapshot.authorizations.length, 1);
  assert.equal(client.snapshot.authorizations[0]?.studentId, approvedBinding.studentId);
  assert.equal(client.snapshot.authorizations[0]?.studentLabel, approvedBinding.studentLabel);
  assert.equal(client.snapshot.authorizations[0]?.classLabel, approvedBinding.classLabel);
});

test("refresh and disconnect clear the one-time credential from page memory", async () => {
  const { client } = pickupClient();
  await client.connect();
  await client.issueCredential(authorizationId, 1);
  assert.equal(client.snapshot.credential?.value, "b".repeat(43));

  await client.refresh();
  assert.equal(client.snapshot.credential, null);
  client.disconnect();
  assert.equal(client.snapshot.credential, null);
  assert.equal(client.snapshot.records.length, 0);
});

test("credential expires from page memory without a refresh", async () => {
  const { client, setCredentialLifetime } = pickupClient();
  setCredentialLifetime(200);
  let expiryUpdates = 0;
  client.setCredentialExpiryListener(() => {
    expiryUpdates += 1;
  });
  await client.connect();
  await client.issueCredential(authorizationId, 1);
  assert.equal(client.snapshot.credential?.value, "b".repeat(43));

  await new Promise((resolve) => setTimeout(resolve, 350));

  assert.equal(client.snapshot.credential, null);
  assert.match(client.snapshot.message, /已过期/u);
  assert.equal(expiryUpdates, 1);
});

test("client does not display a credential if the authorization is revoked during issuance", async () => {
  const { client, revokeAfterCredentialIssue } = pickupClient();
  await client.connect();
  revokeAfterCredentialIssue();

  await client.issueCredential(authorizationId, 1);

  assert.equal(client.snapshot.authorizations[0]?.status, "REVOKED");
  assert.equal(client.snapshot.credential, null);
  assert.match(client.snapshot.message, /授权已变化/u);
});

test("history date filter changes only the visible parent record projection", async () => {
  const { client } = pickupClient();
  await client.connect();
  client.setHistoryFilter("2026-10-10", "2026-10-11");
  const html = renderParentPickupPanel(client.snapshot);
  assert.match(html, /2026-10-10/);
  assert.match(html, /2026-10-11/);
  assert.match(html, /暂无符合日期的接送记录/);
  assert.doesNotMatch(html, /17:30/);
});

test("parent pickup client uses the invitation cookie proxy instead of creating a fixed profile", async () => {
  const calls: {
    path: string;
    method: string;
    credentials: RequestCredentials | undefined;
    authorization: string | null;
  }[] = [];
  const fetcher: typeof fetch = async (input, init = {}) => {
    const url = new URL(String(input));
    calls.push({
      path: url.pathname,
      method: init.method ?? "GET",
      credentials: init.credentials,
      authorization: new Headers(init.headers).get("authorization"),
    });
    return Response.json({
      data: {
        bindings: [approvedBinding],
        authorizations: [authorization],
        records: [],
      },
    });
  };
  const client = new ParentPickupClient({ baseUrl: "http://127.0.0.1:3000", fetcher });

  await client.connect();

  assert.equal(client.snapshot.status, "READY");
  assert.deepEqual(calls, [
    {
      path: "/api-local/parent/pickup",
      method: "GET",
      credentials: "same-origin",
      authorization: null,
    },
  ]);
  assert.equal(client.snapshot.bindings[0]?.id, bindingId);
  assert.equal(client.snapshot.authorizations[0]?.id, authorizationId);
});
