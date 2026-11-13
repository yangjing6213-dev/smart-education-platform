/* global process, Request, Response */

import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import test from "node:test";
import { GET, PATCH, POST } from "../src/app/api-local/[...path]/handler.ts";

test("writes require a single browser origin that matches the public host and scheme", async (t) => {
  const site = "https://trial.example.test:8443";
  const host = new URL(site).host;
  const cookie = "student_care_local_session=" + "s".repeat(43);
  const path = ["parent", "pickup", "authorizations"];
  const ctx = { params: Promise.resolve({ path }) };
  const upstream = t.mock.method(globalThis, "fetch", async () => Response.json({ data: {} }));
  const old = process.env.USER_WEB_NEST_API_BASE_URL;
  process.env.USER_WEB_NEST_API_BASE_URL = "https://api.example.test";
  try {
    for (const [method, route] of [
      ["POST", path],
      ["PATCH", ["staff", "child-monthly-reports", "00000000-0000-4000-8000-000000000001"]],
    ]) {
      const call = method === "POST" ? POST : PATCH;
      const pathname = "/api-local/" + route.join("/");
      for (const origin of [
        undefined,
        "",
        "null",
        site + "/",
        site + "/wrong",
        site + ", " + site,
        "https://other.example.test:8443",
        "https://someone@" + host,
        "http://" + host,
      ]) {
        const headers = { cookie, host, ...(origin === undefined ? {} : { origin }) };
        const response = await call(new Request(site + pathname, { method, headers }), {
          params: Promise.resolve({ path: route }),
        });
        assert.equal(response.status, 403, method + " origin rejected");
      }
    }
    assert.equal(upstream.mock.callCount(), 0);
    const response = await POST(
      new Request("https://internal-backend.test/api-local/" + path.join("/"), {
        method: "POST",
        headers: { cookie, host, origin: site, "content-type": "application/json" },
        body: "{}",
      }),
      ctx,
    );
    assert.equal(response.status, 200);
    assert.equal(upstream.mock.callCount(), 1);
    const cross = await POST(
      new Request(site + "/api-local/" + path.join("/"), {
        method: "POST",
        headers: {
          cookie,
          host: "other.example.test:8443",
          origin: site,
          "x-forwarded-host": host,
        },
      }),
      ctx,
    );
    assert.equal(cross.status, 403);
    assert.equal(upstream.mock.callCount(), 1);
  } finally {
    if (old === undefined) delete process.env.USER_WEB_NEST_API_BASE_URL;
    else process.env.USER_WEB_NEST_API_BASE_URL = old;
  }
});

test("HTTPS sets and removes only the family cookie, bounded by the verified session expiry", async (t) => {
  const site = "https://trial.example.test";
  const token = "f".repeat(43);
  const old = process.env.USER_WEB_NEST_API_BASE_URL;
  process.env.USER_WEB_NEST_API_BASE_URL = "https://api.example.test";
  let response;
  t.mock.method(globalThis, "fetch", async () => response);
  const call = (method, path) =>
    (method === "POST" ? POST : GET)(
      new Request(site + "/api-local/" + path.join("/"), {
        method,
        headers: {
          host: new URL(site).host,
          origin: site,
          cookie: "student_care_local_session=" + token,
        },
      }),
      { params: Promise.resolve({ path }) },
    );
  try {
    const expiresAt = new Date(Date.now() + 60000).toISOString();
    for (const invalid of [
      { token_type: "Other", expires_at: expiresAt },
      { token_type: "Bearer", expires_at: new Date(Date.now() - 60000).toISOString() },
    ]) {
      response = Response.json({ data: { access_token: token, ...invalid } });
      const rejected = await call("POST", ["identity", "login"]);
      assert.equal(rejected.status, 502);
      assert.equal(rejected.headers.has("set-cookie"), false);
    }
    response = Response.json({
      data: { access_token: token, token_type: "Bearer", expires_at: expiresAt },
    });
    const login = await call("POST", ["identity", "login"]);
    assert.equal(login.status, 200);
    const header = login.headers.get("set-cookie") ?? "";
    assert.match(header, /^student_care_local_session=/u);
    for (const property of ["Path=/api-local", "HttpOnly", "SameSite=Lax", "Secure"])
      assert.ok(header.split("; ").includes(property));
    const lifetime = Number(header.match(/Max-Age=(\d+)/u)?.[1]);
    assert.ok(lifetime >= 1 && lifetime <= 60);
    assert.equal(JSON.stringify(await login.json()).includes(token), false);
    for (const [method, path, status, body] of [
      ["POST", ["identity", "logout"], 200, '{"data":{"logged_out":true}}'],
      ["GET", ["me"], 401, ""],
      ["POST", ["identity", "logout"], 502, "bad gateway"],
    ]) {
      response = new Response(body, { status });
      const result = await call(method, path);
      const clear = result.headers.get("set-cookie") ?? "";
      assert.equal(result.status, status);
      assert.match(clear, /^student_care_local_session=;/u);
      for (const property of ["Path=/api-local", "HttpOnly", "SameSite=Lax", "Max-Age=0", "Secure"])
        assert.ok(clear.split("; ").includes(property));
    }
  } finally {
    if (old === undefined) delete process.env.USER_WEB_NEST_API_BASE_URL;
    else process.env.USER_WEB_NEST_API_BASE_URL = old;
  }
});

test("parent binding routes are authenticated and the proxy forwards only the cookie token", async () => {
  const previousApi = process.env.USER_WEB_NEST_API_BASE_URL;
  const previousPreview = process.env.USER_WEB_LOCAL_PREVIEW;
  const forwarded = {};
  const upstream = createServer((request, response) => {
    forwarded.path = request.url;
    forwarded.method = request.method;
    forwarded.authorization = request.headers.authorization;
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ data: [{ id: "synthetic" }] }));
  });
  upstream.listen(0, "127.0.0.1");
  await once(upstream, "listening");
  const address = upstream.address();
  assert.ok(address && typeof address !== "string");
  process.env.USER_WEB_NEST_API_BASE_URL = `http://127.0.0.1:${address.port}`;
  process.env.USER_WEB_LOCAL_PREVIEW = "true";
  const context = (path) => ({ params: Promise.resolve({ path }) });
  try {
    const anonymous = await GET(
      new Request("http://127.0.0.1:3000/api-local/consent-policies"),
      context(["consent-policies"]),
    );
    assert.equal(anonymous.status, 401, "the route must exist and require the invite cookie");

    const sessionToken = "a".repeat(43);
    const response = await GET(
      new Request("http://127.0.0.1:3000/api-local/consent-policies", {
        headers: { cookie: `student_care_local_session=${sessionToken}` },
      }),
      context(["consent-policies"]),
    );
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { data: [{ id: "synthetic" }] });
    assert.equal(forwarded.path, "/consent-policies");
    assert.equal(forwarded.authorization, `Bearer ${sessionToken}`);

    const fees = await GET(
      new Request("http://127.0.0.1:3000/api-local/parent/fees", {
        headers: { cookie: `student_care_local_session=${sessionToken}` },
      }),
      context(["parent", "fees"]),
    );
    assert.equal(fees.status, 200);
    assert.equal(forwarded.path, "/parent/fees");
    assert.equal(forwarded.authorization, `Bearer ${sessionToken}`);

    const learning = await GET(
      new Request("http://127.0.0.1:3000/api-local/parent/learning", {
        headers: { cookie: `student_care_local_session=${sessionToken}` },
      }),
      context(["parent", "learning"]),
    );
    assert.equal(learning.status, 200);
    assert.equal(forwarded.path, "/parent/learning");
    assert.equal(forwarded.method, "GET");
    assert.equal(forwarded.authorization, `Bearer ${sessionToken}`);

    const monthly = await GET(
      new Request("http://127.0.0.1:3000/api-local/parent/monthly-feedback", {
        headers: { cookie: `student_care_local_session=${sessionToken}` },
      }),
      context(["parent", "monthly-feedback"]),
    );
    assert.equal(monthly.status, 200);
    assert.equal(forwarded.path, "/parent/monthly-feedback");
    assert.equal(forwarded.method, "GET");
    assert.equal(forwarded.authorization, `Bearer ${sessionToken}`);

    const monthlyAckId = "00000000-0000-4000-8000-000000000101";
    const monthlyAck = await POST(
      new Request(`http://127.0.0.1:3000/api-local/parent/monthly-feedback/${monthlyAckId}/ack`, {
        method: "POST",
        headers: {
          origin: "http://127.0.0.1:3000",
          cookie: `student_care_local_session=${sessionToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ version: 2 }),
      }),
      context(["parent", "monthly-feedback", monthlyAckId, "ack"]),
    );
    assert.equal(monthlyAck.status, 200);
    assert.equal(forwarded.path, `/parent/monthly-feedback/${monthlyAckId}/ack`);
    assert.equal(forwarded.method, "POST");
    assert.equal(forwarded.authorization, `Bearer ${sessionToken}`);

    const invalidMonthlyAck = await POST(
      new Request("http://127.0.0.1:3000/api-local/parent/monthly-feedback/not-a-uuid/ack", {
        method: "POST",
        headers: {
          origin: "http://127.0.0.1:3000",
          cookie: `student_care_local_session=${sessionToken}`,
        },
      }),
      context(["parent", "monthly-feedback", "not-a-uuid", "ack"]),
    );
    assert.equal(invalidMonthlyAck.status, 404);

    const studentId = "00000000-0000-4000-8000-0000000000c8";
    const controls = await POST(
      new Request(`http://127.0.0.1:3000/api-local/parent/learning/${studentId}/controls`, {
        method: "POST",
        headers: {
          origin: "http://127.0.0.1:3000",
          cookie: `student_care_local_session=${sessionToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          enabled: false,
          maxDurationMinutes: 10,
          maxHintLevel: 2,
        }),
      }),
      context(["parent", "learning", studentId, "controls"]),
    );
    assert.equal(controls.status, 200);
    assert.equal(forwarded.path, `/parent/learning/${studentId}/controls`);
    assert.equal(forwarded.method, "POST");
    assert.equal(forwarded.authorization, `Bearer ${sessionToken}`);

    const health = await GET(
      new Request("http://127.0.0.1:3000/api-local/parent/health-incidents", {
        headers: { cookie: `student_care_local_session=${sessionToken}` },
      }),
      context(["parent", "health-incidents"]),
    );
    assert.equal(health.status, 200);
    assert.equal(forwarded.path, "/parent/health-incidents");
    assert.equal(forwarded.method, "GET");
    assert.equal(forwarded.authorization, `Bearer ${sessionToken}`);

    const healthId = "00000000-0000-4000-8000-000000000102";
    const healthRead = await POST(
      new Request(`http://127.0.0.1:3000/api-local/parent/health-incidents/${healthId}/read`, {
        method: "POST",
        headers: {
          origin: "http://127.0.0.1:3000",
          cookie: `student_care_local_session=${sessionToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ version: 1 }),
      }),
      context(["parent", "health-incidents", healthId, "read"]),
    );
    assert.equal(healthRead.status, 200);
    assert.equal(forwarded.path, `/parent/health-incidents/${healthId}/read`);
    assert.equal(forwarded.method, "POST");
    assert.equal(forwarded.authorization, `Bearer ${sessionToken}`);

    const healthAck = await POST(
      new Request(`http://127.0.0.1:3000/api-local/parent/health-incidents/${healthId}/ack`, {
        method: "POST",
        headers: {
          origin: "http://127.0.0.1:3000",
          cookie: `student_care_local_session=${sessionToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ version: 1 }),
      }),
      context(["parent", "health-incidents", healthId, "ack"]),
    );
    assert.equal(healthAck.status, 200);
    assert.equal(forwarded.path, `/parent/health-incidents/${healthId}/ack`);
    assert.equal(forwarded.method, "POST");
    assert.equal(forwarded.authorization, `Bearer ${sessionToken}`);

    const invalidHealthId = await POST(
      new Request("http://127.0.0.1:3000/api-local/parent/health-incidents/not-a-uuid/read", {
        method: "POST",
        headers: {
          origin: "http://127.0.0.1:3000",
          cookie: `student_care_local_session=${sessionToken}`,
        },
      }),
      context(["parent", "health-incidents", "not-a-uuid", "read"]),
    );
    assert.equal(invalidHealthId.status, 404);

    const invalidStudent = await POST(
      new Request("http://127.0.0.1:3000/api-local/parent/learning/not-a-uuid/controls", {
        method: "POST",
        headers: {
          origin: "http://127.0.0.1:3000",
          cookie: `student_care_local_session=${sessionToken}`,
        },
      }),
      context(["parent", "learning", "not-a-uuid", "controls"]),
    );
    assert.equal(invalidStudent.status, 404);

    const unsupportedLearningMethod = await POST(
      new Request("http://127.0.0.1:3000/api-local/parent/learning", {
        method: "POST",
        headers: {
          origin: "http://127.0.0.1:3000",
          cookie: `student_care_local_session=${sessionToken}`,
        },
      }),
      context(["parent", "learning"]),
    );
    assert.equal(unsupportedLearningMethod.status, 404);

    const unsupportedMethod = await POST(
      new Request("http://127.0.0.1:3000/api-local/parent/fees", {
        method: "POST",
        headers: {
          origin: "http://127.0.0.1:3000",
          cookie: `student_care_local_session=${sessionToken}`,
        },
      }),
      context(["parent", "fees"]),
    );
    assert.equal(unsupportedMethod.status, 404);

    const unknown = await GET(
      new Request("http://127.0.0.1:3000/api-local/admin/users", {
        headers: { cookie: `student_care_local_session=${sessionToken}` },
      }),
      context(["admin", "users"]),
    );
    assert.equal(unknown.status, 404);
  } finally {
    if (previousApi === undefined) delete process.env.USER_WEB_NEST_API_BASE_URL;
    else process.env.USER_WEB_NEST_API_BASE_URL = previousApi;
    if (previousPreview === undefined) delete process.env.USER_WEB_LOCAL_PREVIEW;
    else process.env.USER_WEB_LOCAL_PREVIEW = previousPreview;
    upstream.close();
    await once(upstream, "close");
  }
});

test("staff task and relationship review proxy allowlist accepts exact cookie-authenticated routes only", async () => {
  const previousApi = process.env.USER_WEB_NEST_API_BASE_URL;
  const previousPreview = process.env.USER_WEB_LOCAL_PREVIEW;
  const forwarded = [];
  const upstream = createServer((request, response) => {
    forwarded.push({
      path: request.url,
      method: request.method,
      authorization: request.headers.authorization,
    });
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ data: [] }));
  });
  upstream.listen(0, "127.0.0.1");
  await once(upstream, "listening");
  const address = upstream.address();
  assert.ok(address && typeof address !== "string");
  process.env.USER_WEB_NEST_API_BASE_URL = `http://127.0.0.1:${address.port}`;
  process.env.USER_WEB_LOCAL_PREVIEW = "true";
  const token = "b".repeat(43);
  const cookie = { cookie: `student_care_local_session=${token}` };
  const context = (path) => ({ params: Promise.resolve({ path }) });
  try {
    const tasks = await GET(
      new Request("http://127.0.0.1:3000/api-local/staff/tasks", { headers: cookie }),
      context(["staff", "tasks"]),
    );
    assert.equal(tasks.status, 200);

    const id = "00000000-0000-4000-8000-000000000201";
    const claim = await POST(
      new Request(`http://127.0.0.1:3000/api-local/staff/tasks/${id}/claim`, {
        method: "POST",
        headers: { origin: "http://127.0.0.1:3000", ...cookie, "content-type": "application/json" },
        body: JSON.stringify({ version: 1 }),
      }),
      context(["staff", "tasks", id, "claim"]),
    );
    assert.equal(claim.status, 200);

    const queue = await GET(
      new Request("http://127.0.0.1:3000/api-local/staff/guardian-binding/applications", {
        headers: cookie,
      }),
      context(["staff", "guardian-binding", "applications"]),
    );
    assert.equal(queue.status, 200);

    const review = await POST(
      new Request(
        `http://127.0.0.1:3000/api-local/staff/guardian-binding/applications/${id}/review`,
        {
          method: "POST",
          headers: {
            origin: "http://127.0.0.1:3000",
            ...cookie,
            "content-type": "application/json",
          },
          body: JSON.stringify({ version: 1, action: "approve" }),
        },
      ),
      context(["staff", "guardian-binding", "applications", id, "review"]),
    );
    assert.equal(review.status, 200);

    const invalidTaskId = await POST(
      new Request("http://127.0.0.1:3000/api-local/staff/tasks/not-a-uuid/claim", {
        headers: cookie,
      }),
      context(["staff", "tasks", "not-a-uuid", "claim"]),
    );
    const invalidReviewId = await POST(
      new Request(
        "http://127.0.0.1:3000/api-local/staff/guardian-binding/applications/not-a-uuid/review",
        { headers: cookie },
      ),
      context(["staff", "guardian-binding", "applications", "not-a-uuid", "review"]),
    );
    const unsupported = await GET(
      new Request(`http://127.0.0.1:3000/api-local/staff/tasks/${id}/claim`, { headers: cookie }),
      context(["staff", "tasks", id, "claim"]),
    );
    assert.equal(invalidTaskId.status, 404);
    assert.equal(invalidReviewId.status, 404);
    assert.equal(unsupported.status, 404);
    assert.deepEqual(
      forwarded.map(({ path, method }) => ({ path, method })),
      [
        { path: "/staff/tasks", method: "GET" },
        { path: `/staff/tasks/${id}/claim`, method: "POST" },
        { path: "/staff/guardian-binding/applications", method: "GET" },
        { path: `/staff/guardian-binding/applications/${id}/review`, method: "POST" },
      ],
    );
    assert.ok(forwarded.every(({ authorization }) => authorization === `Bearer ${token}`));
  } finally {
    await new Promise((resolve) => upstream.close(resolve));
    if (previousApi === undefined) delete process.env.USER_WEB_NEST_API_BASE_URL;
    else process.env.USER_WEB_NEST_API_BASE_URL = previousApi;
    if (previousPreview === undefined) delete process.env.USER_WEB_LOCAL_PREVIEW;
    else process.env.USER_WEB_LOCAL_PREVIEW = previousPreview;
  }
});

test("parent notice proxy permits only same-origin notice read and receipt routes", async () => {
  const previousApi = process.env.USER_WEB_NEST_API_BASE_URL;
  const previousPreview = process.env.USER_WEB_LOCAL_PREVIEW;
  const forwarded = [];
  const upstream = createServer((request, response) => {
    forwarded.push({
      path: request.url,
      method: request.method,
      authorization: request.headers.authorization,
    });
    response.writeHead(200, { "content-type": "application/json" });
    response.end(
      JSON.stringify({ data: request.method === "GET" ? [] : { receiptStatus: "READ" } }),
    );
  });
  upstream.listen(0, "127.0.0.1");
  await once(upstream, "listening");
  const address = upstream.address();
  assert.ok(address && typeof address !== "string");
  process.env.USER_WEB_NEST_API_BASE_URL = `http://127.0.0.1:${address.port}`;
  process.env.USER_WEB_LOCAL_PREVIEW = "true";
  const context = (path) => ({ params: Promise.resolve({ path }) });
  const sessionToken = "b".repeat(43);
  try {
    const list = await GET(
      new Request("http://127.0.0.1:3000/api-local/parent/notices", {
        headers: { cookie: `student_care_local_session=${sessionToken}` },
      }),
      context(["parent", "notices"]),
    );
    assert.equal(list.status, 200);
    const id = "00000000-0000-4000-8000-000000000101";
    const read = await POST(
      new Request(`http://127.0.0.1:3000/api-local/parent/notices/${id}/read`, {
        method: "POST",
        headers: {
          origin: "http://127.0.0.1:3000",
          cookie: `student_care_local_session=${sessionToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ version: 1 }),
      }),
      context(["parent", "notices", id, "read"]),
    );
    assert.equal(read.status, 200);
    assert.deepEqual(
      forwarded.map(({ path, method, authorization }) => ({ path, method, authorization })),
      [
        { path: "/parent/notices", method: "GET", authorization: `Bearer ${sessionToken}` },
        {
          path: `/parent/notices/${id}/read`,
          method: "POST",
          authorization: `Bearer ${sessionToken}`,
        },
      ],
    );
    const unsupported = await POST(
      new Request(`http://127.0.0.1:3000/api-local/parent/notices/${id}/publish`, {
        method: "POST",
        headers: {
          origin: "http://127.0.0.1:3000",
          cookie: `student_care_local_session=${sessionToken}`,
        },
      }),
      context(["parent", "notices", id, "publish"]),
    );
    assert.equal(unsupported.status, 404);
    assert.equal(forwarded.length, 2);
  } finally {
    if (previousApi === undefined) delete process.env.USER_WEB_NEST_API_BASE_URL;
    else process.env.USER_WEB_NEST_API_BASE_URL = previousApi;
    if (previousPreview === undefined) delete process.env.USER_WEB_LOCAL_PREVIEW;
    else process.env.USER_WEB_LOCAL_PREVIEW = previousPreview;
    upstream.close();
    await once(upstream, "close");
  }
});

test("parent pickup proxy permits only the invite-bound pickup workflow routes", async () => {
  const previousApi = process.env.USER_WEB_NEST_API_BASE_URL;
  const previousPreview = process.env.USER_WEB_LOCAL_PREVIEW;
  const forwarded = [];
  const upstream = createServer((request, response) => {
    forwarded.push({
      path: request.url,
      method: request.method,
      authorization: request.headers.authorization,
    });
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ data: { bindings: [], authorizations: [], records: [] } }));
  });
  upstream.listen(0, "127.0.0.1");
  await once(upstream, "listening");
  const address = upstream.address();
  assert.ok(address && typeof address !== "string");
  process.env.USER_WEB_NEST_API_BASE_URL = `http://127.0.0.1:${address.port}`;
  process.env.USER_WEB_LOCAL_PREVIEW = "true";
  const context = (path) => ({ params: Promise.resolve({ path }) });
  const sessionToken = "p".repeat(43);
  const cookie = { cookie: `student_care_local_session=${sessionToken}` };
  const id = "00000000-0000-4000-8000-000000000111";
  try {
    const snapshot = await GET(
      new Request("http://127.0.0.1:3000/api-local/parent/pickup", { headers: cookie }),
      context(["parent", "pickup"]),
    );
    assert.equal(snapshot.status, 200);
    assert.equal(snapshot.headers.get("cache-control"), "no-store");

    const create = await POST(
      new Request("http://127.0.0.1:3000/api-local/parent/pickup/authorizations", {
        method: "POST",
        headers: { origin: "http://127.0.0.1:3000", ...cookie, "content-type": "application/json" },
        body: JSON.stringify({ bindingId: id }),
      }),
      context(["parent", "pickup", "authorizations"]),
    );
    assert.equal(create.status, 200);

    const actions = ["activate", "revoke", "credential"];
    for (const action of actions) {
      const response = await POST(
        new Request(
          `http://127.0.0.1:3000/api-local/parent/pickup/authorizations/${id}/${action}`,
          {
            method: "POST",
            headers: {
              origin: "http://127.0.0.1:3000",
              ...cookie,
              "content-type": "application/json",
            },
            body: JSON.stringify({ version: 1 }),
          },
        ),
        context(["parent", "pickup", "authorizations", id, action]),
      );
      assert.equal(response.status, 200);
    }

    const invalidId = await POST(
      new Request(
        "http://127.0.0.1:3000/api-local/parent/pickup/authorizations/not-a-uuid/activate",
        {
          method: "POST",
          headers: {
            origin: "http://127.0.0.1:3000",
            ...cookie,
            "content-type": "application/json",
          },
          body: JSON.stringify({ version: 1 }),
        },
      ),
      context(["parent", "pickup", "authorizations", "not-a-uuid", "activate"]),
    );
    assert.equal(invalidId.status, 404);

    const unsupported = await GET(
      new Request("http://127.0.0.1:3000/api-local/parent/pickup/authorizations", {
        headers: cookie,
      }),
      context(["parent", "pickup", "authorizations"]),
    );
    assert.equal(unsupported.status, 404);
    assert.deepEqual(
      forwarded.map(({ path, method }) => ({ path, method })),
      [
        { path: "/parent/pickup", method: "GET" },
        { path: "/parent/pickup/authorizations", method: "POST" },
        ...actions.map((action) => ({
          path: `/parent/pickup/authorizations/${id}/${action}`,
          method: "POST",
        })),
      ],
    );
    assert.ok(forwarded.every(({ authorization }) => authorization === `Bearer ${sessionToken}`));
  } finally {
    await new Promise((resolve) => upstream.close(resolve));
    if (previousApi === undefined) delete process.env.USER_WEB_NEST_API_BASE_URL;
    else process.env.USER_WEB_NEST_API_BASE_URL = previousApi;
    if (previousPreview === undefined) delete process.env.USER_WEB_LOCAL_PREVIEW;
    else process.env.USER_WEB_LOCAL_PREVIEW = previousPreview;
  }
});
