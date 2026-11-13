import assert from "node:assert/strict";
import test from "node:test";
import {
  createLocalStaffDailyTransport,
  createStaffDailyProxyTransport,
  parseStaffDailyRows,
  renderStaffDailyPanel,
  STAFF_DAILY_OPTIONS,
  StaffDailyClient,
} from "./staff-daily.js";

const teacher = {
  mode: "local-synthetic",
  profile: "teacher-east",
  label: "示例东校区教师",
  actorId: "00000000-0000-4000-8000-000000000003",
  tenantId: "00000000-0000-4000-8000-000000000100",
  campusId: "00000000-0000-4000-8000-000000000101",
  classIds: ["00000000-0000-4000-8000-000000000103"],
  actions: ["daily:read", "daily:create", "daily:submit"],
} as const;

const baseRow = {
  id: "00000000-0000-4000-8000-000000000501",
  version: 1,
  kind: "staffDaily",
  tenantId: teacher.tenantId,
  campusId: teacher.campusId,
  classId: teacher.classIds[0],
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
  status: "DRAFT",
  createdBy: teacher.actorId,
  authorLabel: teacher.label,
  synthetic: true,
  learningSummary: null,
};

test("日报只接受固定字段和当前教师校区班级范围，并只展示来源分类数量", () => {
  const rows = parseStaffDailyRows([baseRow], teacher);
  assert.deepEqual(rows[0]?.sourceCounts, {
    TASK: 1,
    ATTENDANCE: 1,

    CARE_RECORD: 1,
    PICKUP: 1,
    PICKUP_EXCEPTION: 1,
  });
  assert.equal(STAFF_DAILY_OPTIONS.followUp.length, 3);
  const summary = {
    completedLearnerBand: "2_PLUS",
    usedGuidance: true,
    needsTeacherFollowUp: true,
  } as const;
  const summaryRows = parseStaffDailyRows([{ ...baseRow, learningSummary: summary }], teacher);
  assert.deepEqual(summaryRows[0]?.learningSummary, summary);
  assert.throws(() =>
    parseStaffDailyRows(
      [{ ...baseRow, campusId: "00000000-0000-4000-8000-000000000102" }],
      teacher,
    ),
  );
  assert.throws(() =>
    parseStaffDailyRows(
      [{ ...baseRow, values: { ...baseRow.values, activity: "自由输入" } }],
      teacher,
    ),
  );
  assert.throws(() =>
    parseStaffDailyRows(
      [
        {
          ...baseRow,
          sourceRefs: [{ ...baseRow.sourceRefs[0], studentId: "不得进入页面" }],
        },
      ],
      teacher,
    ),
  );
  assert.throws(() =>
    parseStaffDailyRows(
      [{ ...baseRow, learningSummary: { ...summary, studentId: "不得进入页面" } }],
      teacher,
    ),
  );
  const html = renderStaffDailyPanel({
    status: "READY",
    session: teacher,
    rows: summaryRows,
    message: "已更新",
    error: null,
  });
  assert.match(html, /来源记录：任务 1 · 考勤 1 · 托管记录 1 · 接送 1 · 异常 1/u);
  assert.match(html, /固定题学习摘要（本机合成）/u);
  assert.match(html, /2 人及以上已完成练习/u);
  assert.match(html, /保存日报草稿/u);
  assert.doesNotMatch(html, /00000000-0000-4000-8000-00000000060|studentId|不得进入页面/u);
});

test("教师日报请求只走本机白名单并省略浏览器凭据", async () => {
  const calls: RequestInit[] = [];
  const fetcher = (async (_input: string | URL | Request, init?: RequestInit) => {
    calls.push(init ?? {});
    return new Response("{}", { status: 200 });
  }) as typeof fetch;
  assert.throws(() => createLocalStaffDailyTransport("https://example.com", fetcher));
  const transport = createLocalStaffDailyTransport("http://127.0.0.1:4317", fetcher);
  await transport("/local/staff-daily-owned");
  const denied = await transport("/local/staff-daily-review");
  assert.equal(denied.status, 403);
  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.credentials, "omit");
  assert.equal(calls[0]?.cache, "no-store");
});

test("新版日报只把固定员工请求映射到本机员工代理", async () => {
  const calls: { path: string; method: string; credentials?: RequestCredentials }[] = [];
  const proxy = createStaffDailyProxyTransport(
    "http://127.0.0.1:4317",
    async (input, init = {}) => {
      const call: { path: string; method: string; credentials?: RequestCredentials } = {
        path: new URL(String(input)).pathname,
        method: init.method ?? "GET",
      };
      if (init.credentials) call.credentials = init.credentials;
      calls.push(call);
      return new Response("[]", { status: 200 });
    },
  );
  await proxy("/local/staff-daily-owned");
  await proxy("/local/staff-daily-reports", { method: "POST", body: "{}" });
  await proxy("/local/staff-daily-reports/00000000-0000-4000-8000-000000000501", {
    method: "PATCH",
    body: "{}",
  });
  await proxy("/local/staff-daily-reports/00000000-0000-4000-8000-000000000501/submit", {
    method: "POST",
    body: "{}",
  });
  assert.deepEqual(
    calls.map(({ path, method }) => [path, method]),
    [
      ["/staff-local/staff-daily-owned", "GET"],
      ["/staff-local/staff-daily-reports", "POST"],
      ["/staff-local/staff-daily-reports/00000000-0000-4000-8000-000000000501", "PATCH"],
      ["/staff-local/staff-daily-reports/00000000-0000-4000-8000-000000000501/submit", "POST"],
    ],
  );
  assert.ok(calls.every((call) => call.credentials === "omit"));
  assert.equal(
    (
      await proxy("/local/staff-daily-reports/00000000-0000-4000-8000-000000000501/submit", {
        method: "PATCH",
      })
    ).status,
    403,
  );
  assert.equal(calls.length, 4, "不匹配的读写方法不得到达本机服务。");
});

test("员工日报客户端通过新版本机代理成功连接合成服务", async () => {
  const paths: string[] = [];
  const proxy = createStaffDailyProxyTransport("http://127.0.0.1:4317", async (input) => {
    const path = new URL(String(input)).pathname;
    paths.push(path);
    const value =
      path === "/staff-local/sessions"
        ? { handle: "a".repeat(43) }
        : path === "/staff-local/session"
          ? teacher
          : [];
    return new Response(JSON.stringify(value), { status: 200 });
  });
  const client = new StaffDailyClient({
    baseUrl: "http://127.0.0.1:4317",
    fetcher: proxy,
  });

  await client.connect();

  assert.equal(client.snapshot.status, "READY");
  assert.deepEqual(paths, [
    "/staff-local/sessions",
    "/staff-local/session",
    "/staff-local/staff-daily-owned",
  ]);
});

test("日报草稿按当前版本提交，旧版本不会再次写入", async () => {
  let row = { ...baseRow };
  const calls: { path: string; method: string; body?: unknown }[] = [];
  const fetcher = (async (input: string | URL | Request, init?: RequestInit) => {
    const path = new URL(String(input)).pathname;
    const method = init?.method ?? "GET";
    calls.push({ path, method, ...(init?.body ? { body: JSON.parse(String(init.body)) } : {}) });
    const payload =
      path === "/local/sessions"
        ? { handle: "a".repeat(43) }
        : path === "/local/session"
          ? teacher
          : path === "/local/staff-daily-owned"
            ? [row]
            : path === "/local/staff-daily-reports" && method === "POST"
              ? row
              : path.endsWith("/submit")
                ? (row = { ...row, version: row.version + 1, status: "SUBMITTED" })
                : {};
    return new Response(JSON.stringify(payload), { status: 200 });
  }) as typeof fetch;
  const client = new StaffDailyClient({ fetcher });
  await client.connect();
  assert.equal(client.snapshot.status, "READY");
  await client.submit(baseRow.id, 1);
  assert.equal(client.snapshot.rows[0]?.status, "SUBMITTED");
  assert.equal(client.snapshot.rows[0]?.version, 2);
  const writeCount = calls.filter(
    (call) => call.method === "POST" && call.path.endsWith("/submit"),
  ).length;
  await client.submit(baseRow.id, 1);
  assert.equal(
    calls.filter((call) => call.method === "POST" && call.path.endsWith("/submit")).length,
    writeCount,
  );
  assert.deepEqual(calls.find((call) => call.path.endsWith("/submit"))?.body, { version: 1 });
});

test("日报草稿可按当前版本编辑，保存后仍是草稿", async () => {
  let row = { ...baseRow };
  const calls: { path: string; method: string; body?: unknown }[] = [];
  const values = { ...baseRow.values, homework: "NEEDS_SUPPORT" };
  const fetcher = (async (input: string | URL | Request, init?: RequestInit) => {
    const path = new URL(String(input)).pathname;
    const method = init?.method ?? "GET";
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ path, method, ...(body === undefined ? {} : { body }) });
    const payload =
      path === "/local/sessions"
        ? { handle: "a".repeat(43) }
        : path === "/local/session"
          ? teacher
          : path === "/local/staff-daily-owned"
            ? [row]
            : method === "PATCH"
              ? (row = { ...row, values, version: row.version + 1 })
              : {};
    return new Response(JSON.stringify(payload), { status: 200 });
  }) as typeof fetch;
  const client = new StaffDailyClient({ fetcher });
  await client.connect();
  const edit = Reflect.get(client, "edit");
  assert.equal(typeof edit, "function", "草稿必须可以修改后再提交");
  await edit.call(client, baseRow.id, 1, values);
  assert.equal(client.snapshot.rows[0]?.status, "DRAFT");
  assert.equal(client.snapshot.rows[0]?.version, 2);
  const write = calls.find((call) => call.method === "PATCH");
  assert.equal(write?.path, "/local/staff-daily-reports/" + baseRow.id);
  assert.deepEqual(write?.body, { version: 1, values });
  await edit.call(client, baseRow.id, 1, baseRow.values);
  assert.equal(calls.filter((call) => call.method === "PATCH").length, 1);
});

test("员工重复提交期间立即锁定并且只写入一次", async () => {
  let row = { ...baseRow };
  let finishSubmit!: (response: Response) => void;
  const pendingSubmit = new Promise<Response>((resolve) => (finishSubmit = resolve));
  const calls: string[] = [];
  const fetcher = (async (input: string | URL | Request, init?: RequestInit) => {
    const path = new URL(String(input)).pathname;
    const method = init?.method ?? "GET";
    calls.push(`${method} ${path}`);
    if (path === "/local/sessions") return new Response(JSON.stringify({ handle: "a".repeat(43) }));
    if (path === "/local/session") return new Response(JSON.stringify(teacher));
    if (path === "/local/staff-daily-owned") return new Response(JSON.stringify([row]));
    if (path.endsWith("/submit")) {
      row = { ...row, version: row.version + 1, status: "SUBMITTED" };
      return pendingSubmit;
    }
    throw new Error("unexpected request");
  }) as typeof fetch;
  const client = new StaffDailyClient({ fetcher });
  await client.connect();

  const first = client.submit(row.id, row.version);
  const second = client.submit(row.id, row.version);
  assert.equal(client.snapshot.status, "BUSY");
  assert.equal(calls.filter((call) => call.endsWith("/submit")).length, 1);
  finishSubmit(new Response(JSON.stringify(row), { status: 200 }));
  await Promise.all([first, second]);

  assert.equal(client.snapshot.status, "READY");
  assert.equal(client.snapshot.rows[0]?.status, "SUBMITTED");
});

test("员工离开日报页后忽略迟到连接结果", async () => {
  let releaseBootstrap!: (response: Response) => void;
  let markStarted!: () => void;
  const started = new Promise<void>((resolve) => (markStarted = resolve));
  const bootstrap = new Promise<Response>((resolve) => (releaseBootstrap = resolve));
  const fetcher = (async (input: string | URL | Request) => {
    const path = new URL(String(input)).pathname;
    if (path === "/local/sessions") {
      markStarted();
      return bootstrap;
    }
    const payload = path === "/local/session" ? teacher : [baseRow];
    return new Response(JSON.stringify(payload), { status: 200 });
  }) as typeof fetch;
  const client = new StaffDailyClient({ fetcher });
  const connecting = client.connect();
  await started;
  const disconnect = Reflect.get(client, "disconnect");
  if (typeof disconnect === "function") disconnect.call(client);
  releaseBootstrap(new Response(JSON.stringify({ handle: "a".repeat(43) }), { status: 201 }));
  await connecting;
  assert.equal(typeof disconnect, "function", "页面离开时应能断开并作废旧请求");
  assert.equal(client.snapshot.status, "IDLE");
  assert.equal(client.snapshot.session, null);
  assert.deepEqual(client.snapshot.rows, []);
});

test("员工日报刷新失败时清除旧身份和旧记录，等待明确重连", async () => {
  let reads = 0;
  const fetcher = (async (input: string | URL | Request) => {
    const path = new URL(String(input)).pathname;
    if (path === "/local/sessions")
      return new Response(JSON.stringify({ handle: "a".repeat(43) }), { status: 201 });
    if (path === "/local/session") return new Response(JSON.stringify(teacher), { status: 200 });
    if (path === "/local/staff-daily-owned") {
      reads += 1;
      return reads === 1
        ? new Response(JSON.stringify([baseRow]), { status: 200 })
        : new Response('{"error":{"code":"TEMPORARY_UNAVAILABLE"}}', { status: 503 });
    }
    throw new Error("unexpected request");
  }) as typeof fetch;
  const client = new StaffDailyClient({ fetcher });
  await client.connect();
  await client.refresh();
  assert.equal(client.snapshot.status, "ERROR");
  assert.equal(client.snapshot.session, null);
  assert.deepEqual(client.snapshot.rows, []);
  assert.equal(reads, 2, "刷新失败后不得自动重试或重放请求");
});
