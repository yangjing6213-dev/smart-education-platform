import assert from "node:assert/strict";
import { resolve } from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  ParentNoticeClient,
  createParentNoticeTransport,
  renderParentNoticesPanel,
} from "./parent-notices.js";

async function startServer() {
  const root =
    process.env.LOCAL_SYNTHETIC_CORE_ROOT ??
    fileURLToPath(new URL("../../../../", import.meta.url));
  const serverModule = await import(
    pathToFileURL(resolve(root, "apps/api/dist/src/local-synthetic/server.js")).href
  );
  const server = await serverModule.buildLocalSyntheticServer({
    mode: "local-synthetic",
  });
  const baseUrl = await server.start(0);
  return { server, baseUrl };
}

async function session(baseUrl: string, profile: string): Promise<string> {
  const response = await fetch(new URL("/local/sessions", baseUrl), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ profile }),
  });
  assert.equal(response.status, 201);
  return ((await response.json()) as { handle: string }).handle;
}

async function request(
  baseUrl: string,
  handle: string,
  method: string,
  path: string,
  body?: object,
) {
  const response = await fetch(new URL(path, baseUrl), {
    method,
    headers: {
      authorization: `Bearer ${handle}`,
      ...(body ? { "content-type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const value = await response.json();
  assert.ok(response.ok, `${method} ${path} failed: ${response.status} ${JSON.stringify(value)}`);
  return value as Record<string, unknown>;
}

test("notice transport only forwards the exact local parent-notice requests", async () => {
  let sent = 0;
  const transport = createParentNoticeTransport("http://127.0.0.1:4317", async () => {
    sent += 1;
    return Response.json([]);
  });
  assert.equal((await transport("/local/notices", { method: "GET" })).status, 200);
  assert.equal((await transport("/local/notices?scope=other", { method: "GET" })).status, 403);
  assert.equal((await transport("/local/notices", { method: "POST" })).status, 403);
  assert.equal((await transport("/local/resources", { method: "GET" })).status, 403);
  assert.equal(sent, 1);
  assert.throws(() => createParentNoticeTransport("https://example.com"), /本机/u);
});

test("notice panel requires reading before acknowledgement and never substitutes fixtures", () => {
  const unread = {
    id: "123e4567-e89b-42d3-a456-426614174000",
    version: 4,
    title: "班级活动安排",
    body: "本机合成通知内容。",
    target: "CLASS" as const,
    receiptStatus: "UNREAD" as const,
  };
  const unreadPanel = renderParentNoticesPanel({
    status: "READY",
    notices: [unread],
    message: "通知已更新。",
  });
  assert.match(unreadPanel, /data-parent-notice-action="read"/u);
  assert.doesNotMatch(unreadPanel, /data-parent-notice-action="ack"/u);
  assert.match(
    renderParentNoticesPanel({
      status: "READY",
      notices: [],
      message: "当前没有已发布的通知。",
    }),
    /当前没有已发布的通知/u,
  );
  assert.doesNotMatch(
    renderParentNoticesPanel({
      status: "ERROR",
      notices: [],
      message: "本机服务暂不可用。",
    }),
    /班级活动安排/u,
  );
});

test("parent notice client fails closed for malformed session and out-of-scope notices", async () => {
  const sessionValue = {
    mode: "local-synthetic",
    profile: "parent-alpha",
    label: "模拟家长",
    actorId: "123e4567-e89b-42d3-a456-426614174001",
    tenantId: "123e4567-e89b-42d3-a456-426614174002",
    campusId: "123e4567-e89b-42d3-a456-426614174003",
    classIds: ["123e4567-e89b-42d3-a456-426614174004"],
    actions: ["notice:read", "notice:ack"],
  };
  const createFetcher =
    (sessionPayload: object, notices: object[] = []) =>
    async (input: string | URL | Request) => {
      const path = new URL(String(input)).pathname;
      if (path === "/local/sessions")
        return Response.json({ handle: "h".repeat(43) }, { status: 201 });
      if (path === "/local/session") return Response.json(sessionPayload);
      if (path === "/local/notices") return Response.json(notices);
      return new Response(null, { status: 404 });
    };

  const malformedSessionClient = new ParentNoticeClient({
    fetcher: createFetcher({ ...sessionValue, profile: "staff-alpha" }),
  });
  await malformedSessionClient.connect();
  assert.equal(malformedSessionClient.snapshot.status, "DENIED");
  assert.deepEqual(malformedSessionClient.snapshot.notices, []);

  const outOfScopeNotice = {
    id: "123e4567-e89b-42d3-a456-426614174005",
    version: 1,
    title: "模拟通知",
    body: "仅供本机演示。",
    status: "PUBLISHED",
    published: true,
    synthetic: true,
    target: "CLASS",
    classId: "123e4567-e89b-42d3-a456-426614174099",
    requiresAcknowledgment: true,
    receiptStatus: "UNREAD",
  };
  const malformedNoticeClient = new ParentNoticeClient({
    fetcher: createFetcher(sessionValue, [outOfScopeNotice]),
  });
  await malformedNoticeClient.connect();
  assert.equal(malformedNoticeClient.snapshot.status, "ERROR");
  assert.deepEqual(malformedNoticeClient.snapshot.notices, []);
});

test("parent reads and acknowledges the same published notice version in the shared service", async (t) => {
  const { server, baseUrl } = await startServer();
  t.after(() => server.close());

  const parentHandle = await session(baseUrl, "parent-alpha");
  const ownerHandle = await session(baseUrl, "owner-east");
  const teacherHandle = await session(baseUrl, "teacher-east");
  const application = await request(baseUrl, parentHandle, "POST", "/local/binding-applications", {
    student: "student-alpha",
    relationship: "GUARDIAN",
  });
  const approved = await request(
    baseUrl,
    ownerHandle,
    "POST",
    `/local/binding-applications/${String(application.id)}/review`,
    { version: application.version, action: "approve" },
  );
  assert.equal(approved.status, "APPROVED");

  const created = await request(baseUrl, teacherHandle, "POST", "/local/notices", {
    template: "CLASS_ACTIVITY",
  });
  const submitted = await request(
    baseUrl,
    teacherHandle,
    "POST",
    `/local/notices/${String(created.id)}/submit`,
    { version: created.version },
  );
  const confirmed = await request(
    baseUrl,
    ownerHandle,
    "POST",
    `/local/notices/${String(created.id)}/review`,
    { version: submitted.version, action: "CONFIRM" },
  );
  const published = await request(
    baseUrl,
    ownerHandle,
    "POST",
    `/local/notices/${String(created.id)}/publish`,
    { version: confirmed.version },
  );

  const client = new ParentNoticeClient({ baseUrl });
  await client.connect();
  assert.equal(client.snapshot.status, "READY");
  const notice = client.snapshot.notices.find((row) => row.id === created.id);
  assert.ok(notice);
  assert.equal(notice.version, published.version);
  assert.equal(notice.receiptStatus, "UNREAD");
  assert.match(renderParentNoticesPanel(client.snapshot), /data-parent-notice-action="read"/u);
  assert.doesNotMatch(
    renderParentNoticesPanel(client.snapshot),
    /data-parent-notice-action="ack"/u,
  );

  const firstRepublish = await request(
    baseUrl,
    ownerHandle,
    "POST",
    `/local/notices/${notice.id}/publish`,
    { version: notice.version },
  );
  assert.ok(Number(firstRepublish.version) > notice.version);
  await client.receipt(notice.id, notice.version, "read");
  assert.equal(
    client.snapshot.notices.find((row) => row.id === notice.id)?.version,
    firstRepublish.version,
  );
  assert.equal(
    client.snapshot.notices.find((row) => row.id === notice.id)?.receiptStatus,
    "UNREAD",
  );
  assert.match(client.snapshot.message, /版本已更新/u);

  await client.receipt(notice.id, Number(firstRepublish.version), "read");
  assert.equal(client.snapshot.notices.find((row) => row.id === notice.id)?.receiptStatus, "READ");
  assert.match(renderParentNoticesPanel(client.snapshot), /data-parent-notice-action="ack"/u);
  await client.receipt(notice.id, Number(firstRepublish.version), "ack");
  assert.equal(
    client.snapshot.notices.find((row) => row.id === notice.id)?.receiptStatus,
    "ACKNOWLEDGED",
  );

  const republished = await request(
    baseUrl,
    ownerHandle,
    "POST",
    `/local/notices/${notice.id}/publish`,
    { version: Number(firstRepublish.version) },
  );
  assert.ok(Number(republished.version) > Number(firstRepublish.version));
  await client.refresh();
  assert.equal(
    client.snapshot.notices.find((row) => row.id === notice.id)?.version,
    republished.version,
  );
  assert.equal(
    client.snapshot.notices.find((row) => row.id === notice.id)?.receiptStatus,
    "UNREAD",
  );
  client.disconnect();
  assert.deepEqual(client.snapshot.notices, []);
});
