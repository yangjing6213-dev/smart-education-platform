import assert from "node:assert/strict";
import { resolve } from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { CareRecordClient, createCareRecordTransport } from "./care-record-client.js";

const values = {
  arrival: "ARRIVED_AS_PLANNED",
  homework: "COMPLETED",
  meal: "FINISHED",
  rest: "RESTED",
  activity: "PARTICIPATED",
  wellbeing: "ROUTINE",
} as const;

async function createServer() {
  const root =
    process.env.LOCAL_SYNTHETIC_CORE_ROOT ??
    fileURLToPath(new URL("../../../../", import.meta.url));
  const moduleUrl = pathToFileURL(
    resolve(root, "apps/api/dist/src/local-synthetic/server.js"),
  ).href;
  const { buildLocalSyntheticServer } = await import(moduleUrl);
  const server = await buildLocalSyntheticServer({ mode: "local-synthetic" });
  const address = await server.start(0);
  return { server, baseUrl: address };
}

async function request(
  baseUrl: string,
  profile: string,
  path: string,
  method = "GET",
  body?: object,
) {
  const session = await fetch(`${baseUrl}/local/sessions`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ profile }),
  });
  assert.equal(session.status, 201);
  const { handle } = (await session.json()) as { handle: string };
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      authorization: `Bearer ${handle}`,
      ...(body ? { "content-type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return { response, data: await response.json() };
}

test("employee and parent Web client use the shared service record and receipt", async (t) => {
  const { server, baseUrl } = await createServer();
  t.after(() => server.close());

  const employee = new CareRecordClient({ baseUrl });
  await employee.connect("teacher-east");
  assert.equal(employee.snapshot.status, "READY");
  await employee.create(values, "2026-10-10");
  const draft = employee.snapshot.records[0];
  assert.ok(draft?.id);
  await employee.command(draft.id, draft.version, "submit");
  const submitted = employee.snapshot.records[0];
  assert.equal(submitted?.status, "SUBMITTED");
  assert.equal(submitted?.id, draft.id);

  const pendingBinding = await request(
    baseUrl,
    "parent-alpha",
    "/local/binding-applications",
    "POST",
    { student: "student-alpha", relationship: "GUARDIAN" },
  );
  assert.equal(pendingBinding.response.status, 201);
  const binding = pendingBinding.data as { id: string; version: number };
  const approved = await request(
    baseUrl,
    "owner-east",
    `/local/binding-applications/${binding.id}/review`,
    "POST",
    { version: binding.version, action: "approve" },
  );
  assert.equal(approved.response.status, 200);

  const reviewed = await request(
    baseUrl,
    "owner-east",
    `/local/care-records/${draft.id}/review`,
    "POST",
    { version: submitted!.version, action: "confirm" },
  );
  assert.equal(reviewed.response.status, 200);
  const confirmed = reviewed.data as { version: number };
  const published = await request(
    baseUrl,
    "owner-east",
    `/local/care-records/${draft.id}/publish`,
    "POST",
    { version: confirmed.version },
  );
  assert.equal(published.response.status, 200);

  const parent = new CareRecordClient({ baseUrl });
  await parent.connect("parent-alpha");
  assert.equal(parent.snapshot.parentRecords[0]?.id, draft.id);
  const publishedParent = parent.snapshot.parentRecords[0]!;
  await parent.receipt(draft.id, publishedParent.version, "read");
  assert.equal(parent.snapshot.parentRecords[0]?.receipt, "READ");
  await parent.receipt(draft.id, publishedParent.version, "acknowledge");
  assert.equal(parent.snapshot.parentRecords[0]?.receipt, "ACKNOWLEDGED");
  assert.equal(parent.snapshot.parentRecords[0]?.id, draft.id);

  const revoke = await request(
    baseUrl,
    "owner-east",
    `/local/care-records/${draft.id}/revoke-publication`,
    "POST",
    { version: (published.data as { version: number }).version },
  );
  assert.equal(revoke.response.status, 200);
  await parent.refresh();
  assert.deepEqual(parent.snapshot.parentRecords, []);
});

test("Web client rejects non-loopback destinations and clears stale data on disconnect", () => {
  assert.throws(() => new CareRecordClient({ baseUrl: "https://example.com" }), /本机|loopback/u);
  const client = new CareRecordClient({ baseUrl: "http://127.0.0.1:4317" });
  client.disconnect();
  assert.deepEqual(client.snapshot.records, []);
  assert.deepEqual(client.snapshot.parentRecords, []);
});

test("Web care-record transport refuses unrelated paths without sending them", async () => {
  let sent = 0;
  const transport = createCareRecordTransport("http://127.0.0.1:4317", async () => {
    sent += 1;
    return Response.json([]);
  });
  const response = await transport("/local/resources", { method: "GET" });
  assert.equal(response.status, 403);
  assert.equal(sent, 0);
});

test("teacher uses actual scoped student choices and can edit two children on the same day", async (t) => {
  const { server, baseUrl } = await createServer();
  t.after(() => server.close());
  const client = new CareRecordClient({ baseUrl });
  await client.connect("teacher-east");
  const students: unknown = Reflect.get(client.snapshot, "students");
  assert.ok(Array.isArray(students), "教师必须取得真实授权学生列表，不能固定学生甲。");
  assert.equal(students.length, 2);
  const alpha = students.find((row) => row.alias === "student-alpha");
  const beta = students.find((row) => row.alias === "student-beta");
  assert.ok(alpha && beta);
  assert.notEqual(alpha.id, beta.id);
  await Reflect.apply(client.create, client, [values, "2026-10-18", beta.alias]);
  const betaDraft = client.snapshot.records[0]!;
  assert.equal(betaDraft.studentId, beta.id);
  assert.equal(Reflect.get(betaDraft, "studentLabel"), beta.label);
  await Reflect.apply(client.create, client, [values, "2026-10-18", alpha.alias]);
  assert.equal(client.snapshot.records.length, 2);
  assert.equal(new Set(client.snapshot.records.map((row) => row.studentId)).size, 2);
  const edit: unknown = Reflect.get(client, "edit");
  assert.equal(typeof edit, "function", "教师必须能编辑实际草稿。");
  await Reflect.apply(edit as (...args: unknown[]) => Promise<void>, client, [
    betaDraft.id,
    betaDraft.version,
    { ...values, homework: "NEEDS_SUPPORT" },
  ]);
  const edited = client.snapshot.records.find((row) => row.id === betaDraft.id)!;
  assert.equal(edited.studentId, beta.id);
  assert.equal(edited.date, "2026-10-18");
  assert.equal(edited.values.homework, "NEEDS_SUPPORT");
  assert.equal(edited.version, betaDraft.version + 1);
  await client.command(edited.id, edited.version, "submit");
  const submitted = client.snapshot.records.find((row) => row.id === edited.id)!;
  const review = await request(
    baseUrl,
    "owner-east",
    "/local/care-records/" + edited.id + "/review",
    "POST",
    { version: submitted.version, action: "return" },
  );
  assert.equal(review.response.status, 200);
  await client.refresh();
  const returned = client.snapshot.records.find((row) => row.id === edited.id)!;
  assert.equal(returned.status, "RETURNED");
  await client.command(returned.id, returned.version, "resubmit", {
    ...values,
    homework: "IN_PROGRESS",
  });
  assert.equal(client.snapshot.records.find((row) => row.id === edited.id)?.status, "SUBMITTED");
  assert.equal(
    client.snapshot.records.find((row) => row.id === edited.id)?.values.homework,
    "IN_PROGRESS",
  );
});

test("disconnected teacher bootstrap never performs a late private session read", async () => {
  let release: (value: Response) => void = () => {};
  const pending = new Promise<Response>((resolve) => {
    release = resolve;
  });
  const calls: string[] = [];
  const client = new CareRecordClient({
    fetcher: async (input) => {
      calls.push(String(input));
      if (String(input).endsWith("/local/sessions")) return pending;
      return Response.json({ error: { code: "UNAVAILABLE" } }, { status: 403 });
    },
  });
  const connecting = client.connect("teacher-east");
  assert.equal(calls.length, 1);
  client.disconnect();
  release(Response.json({ handle: "a".repeat(43) }));
  await connecting;
  assert.equal(calls.length, 1, "断开后迟到会话不能再读取私密身份。");
  assert.equal(client.snapshot.status, "IDLE");
});

test("teacher refresh cannot bypass an in-flight create and failures require a fresh session", async (t) => {
  const { server, baseUrl } = await createServer();
  t.after(() => server.close());
  let hold = false;
  let failOnce = false;
  let release: () => void = () => {};
  let writes = 0;
  let sessions = 0;
  const client = new CareRecordClient({
    baseUrl,
    fetcher: async (input, init) => {
      const url = new URL(String(input));
      if (url.pathname === "/local/sessions") sessions += 1;
      if (url.pathname === "/local/care-records" && init?.method === "POST") {
        writes += 1;
        if (hold)
          await new Promise<void>((resolve) => {
            release = resolve;
          });
        if (failOnce) {
          failOnce = false;
          return Response.json({ error: { code: "LOCAL_SYNTHETIC_UNAVAILABLE" } }, { status: 503 });
        }
      }
      return fetch(input, init);
    },
  });
  await client.connect("teacher-east");
  await client.create(values, "2026-10-19");
  assert.equal(client.snapshot.records.length, 1);
  hold = true;
  const writing = client.create(values, "2026-10-20");
  assert.equal(client.snapshot.status, "BUSY");
  assert.deepEqual(client.snapshot.records, [], "写入开始应立即清旧记录。");
  assert.deepEqual(Reflect.get(client.snapshot, "students"), [], "写入时不能保留可操作学生选项。");
  await client.refresh();
  assert.equal(client.snapshot.status, "BUSY");
  await client.create(values, "2026-10-21");
  assert.equal(writes, 2);
  hold = false;
  release();
  await writing;
  assert.equal(client.snapshot.status, "READY");
  failOnce = true;
  await client.create(values, "2026-10-21");
  assert.equal(client.snapshot.status, "ERROR");
  assert.deepEqual(client.snapshot.records, []);
  const oldSessions = sessions;
  const oldWrites = writes;
  await client.refresh();
  assert.equal(sessions, oldSessions + 1, "错误后必须新建会话而不是继续使用旧句柄。");
  assert.equal(writes, oldWrites, "重连不能自动重放写入。");
  assert.equal(client.snapshot.status, "READY");
});
