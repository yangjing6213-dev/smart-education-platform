/* global Headers, Request, Response, URL, process */

import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import test from "node:test";

const routeUrl = new URL("../src/app/api/admin/[...path]/handler.ts", import.meta.url);
const routeExists = existsSync(routeUrl);
const routeModule = routeExists ? await import(routeUrl.href) : undefined;
const TOKEN = "a".repeat(43);
const APPLICATION_ID = "11111111-1111-4111-8111-111111111111";

function context(path) {
  return { params: Promise.resolve({ path }) };
}

function request(
  path,
  {
    method = "GET",
    cookie,
    body,
    origin = "http://127.0.0.1:3000",
    host = "127.0.0.1:3000",
    urlOrigin = "http://127.0.0.1:3000",
  } = {},
) {
  const headers = new Headers({ origin, host });
  if (cookie) headers.set("cookie", cookie);
  if (body !== undefined) headers.set("content-type", "application/json");
  return new Request(new URL("/api/admin/" + path.join("/"), urlOrigin), {
    method,
    headers,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

function withEnvironment(values, run) {
  const previous = new Map();
  for (const [key, value] of Object.entries(values)) {
    previous.set(key, process.env[key]);
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  return Promise.resolve()
    .then(run)
    .finally(() => {
      for (const [key, value] of previous) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    });
}

test("Admin invite API route exists before its behavior is exercised", () => {
  assert.ok(routeExists, "The same-origin Admin API route is not implemented yet.");
});

test("same-origin login accepts the visible Host when Next supplies an internal URL alias", async (t) => {
  if (!routeModule)
    return t.skip("Route implementation is not present during the expected RED run.");
  await withEnvironment(
    {
      NODE_ENV: "development",
      ADMIN_WEB_LOCAL_NEST_API: "http://127.0.0.1:4321",
      ADMIN_WEB_NEST_API_BASE_URL: undefined,
    },
    async () => {
      const originalFetch = globalThis.fetch;
      const calls = [];
      globalThis.fetch = async (input) => {
        calls.push(String(input));
        return Response.json({
          data: {
            access_token: TOKEN,
            token_type: "Bearer",
            expires_at: "2099-01-01T00:00:00.000Z",
          },
        });
      };
      try {
        const response = await routeModule.POST(
          request(["identity", "login"], {
            method: "POST",
            origin: "http://127.0.0.1:3000",
            host: "127.0.0.1:3000",
            urlOrigin: "http://localhost:3000",
            body: { username: "reviewer-demo", password: "synthetic-only-password" },
          }),
          context(["identity", "login"]),
        );
        assert.equal(response.status, 200);
        assert.deepEqual(calls, ["http://127.0.0.1:4321/identity/login"]);
      } finally {
        globalThis.fetch = originalFetch;
      }
    },
  );
});

test("invite session stays in HttpOnly cookie while scoped binding calls use the server token", async (t) => {
  if (!routeModule)
    return t.skip("Route implementation is not present during the expected RED run.");
  await withEnvironment(
    {
      NODE_ENV: "development",
      ADMIN_WEB_LOCAL_NEST_API: "http://127.0.0.1:4321",
      ADMIN_WEB_NEST_API_BASE_URL: undefined,
    },
    async () => {
      const originalFetch = globalThis.fetch;
      const calls = [];
      globalThis.fetch = async (input, init) => {
        const url = String(input);
        calls.push({
          url,
          method: init?.method,
          authorization: new Headers(init?.headers).get("authorization"),
          body: init?.body,
        });
        if (url.endsWith("/identity/login"))
          return Response.json({
            data: {
              access_token: TOKEN,
              token_type: "Bearer",
              expires_at: "2099-01-01T00:00:00.000Z",
            },
          });
        if (url.endsWith("/me"))
          return Response.json({
            data: {
              actor_id: "synthetic-reviewer",
              display_name: "模拟审核员",
              memberships: [
                {
                  tenant_id: "synthetic-tenant",
                  campus_ids: ["synthetic-campus"],
                  status: "ACTIVE",
                  capabilities: ["identity:read", "binding:review"],
                },
              ],
            },
          });
        if (url.endsWith("/staff/guardian-binding/applications"))
          return Response.json({
            data: [
              {
                id: APPLICATION_ID,
                student_candidate_ref: "00000000-0000-4000-8000-0000000000c8",
                applicant_label: "模拟家长甲",
                student_label: "示例学生甲",
                relationship: "GUARDIAN",
                status: "PENDING",
                version: 1,
                submitted_at: "2026-10-18T08:00:00.000Z",
                reviewed_at: null,
              },
            ],
          });
        if (url.endsWith("/review"))
          return Response.json({
            data: {
              id: APPLICATION_ID,
              relationship: "GUARDIAN",
              status: "APPROVED",
              version: 2,
            },
          });
        if (url.endsWith("/identity/logout")) return Response.json({ data: { logged_out: true } });
        throw new Error("Unexpected upstream request: " + url);
      };

      try {
        const { GET, POST } = routeModule;
        const login = await POST(
          request(["identity", "login"], {
            method: "POST",
            body: { username: "reviewer-demo", password: "synthetic-only-password" },
          }),
          context(["identity", "login"]),
        );
        assert.equal(login.status, 200);
        const cookie = login.headers.get("set-cookie") ?? "";
        assert.match(cookie, /HttpOnly/iu);
        assert.match(cookie, /SameSite=Lax/iu);
        assert.match(cookie, /Path=\/api\/admin/iu);
        assert.doesNotMatch(await login.text(), /access_token|(?:a){43}/u);

        const browserCookie = cookie.split(";")[0];
        const session = await GET(request(["me"], { cookie: browserCookie }), context(["me"]));
        assert.equal(session.status, 200);
        const sessionBody = await session.json();
        assert.equal(sessionBody.data.display_name, "模拟审核员");
        assert.doesNotMatch(JSON.stringify(sessionBody), /actor_id|tenant_id|campus_ids/u);

        const queue = await GET(
          request(["staff", "guardian-binding", "applications"], { cookie: browserCookie }),
          context(["staff", "guardian-binding", "applications"]),
        );
        assert.equal(queue.status, 200);
        const queueBody = await queue.json();
        assert.equal(queueBody.data[0].id, APPLICATION_ID);
        assert.equal(queueBody.data[0].applicant_label, "模拟家长甲");
        assert.equal(queueBody.data[0].student_label, "示例学生甲");
        assert.doesNotMatch(JSON.stringify(queueBody), /student_candidate_ref/u);
        const reviewed = await POST(
          request(["staff", "guardian-binding", "applications", APPLICATION_ID, "review"], {
            method: "POST",
            cookie: browserCookie,
            body: { version: 1, action: "approve" },
          }),
          context(["staff", "guardian-binding", "applications", APPLICATION_ID, "review"]),
        );
        assert.equal(reviewed.status, 200);
        assert.doesNotMatch(await reviewed.clone().text(), /student_candidate_ref/u);
        const logout = await POST(
          request(["identity", "logout"], {
            method: "POST",
            cookie: browserCookie,
            body: {},
          }),
          context(["identity", "logout"]),
        );
        assert.equal(logout.status, 200);
        assert.match(logout.headers.get("set-cookie") ?? "", /Max-Age=0/iu);
        assert.deepEqual(
          calls.map((call) => call.url.replace("http://127.0.0.1:4321", "")),
          [
            "/identity/login",
            "/me",
            "/staff/guardian-binding/applications",
            "/staff/guardian-binding/applications/" + APPLICATION_ID + "/review",
            "/identity/logout",
          ],
        );
        assert.ok(calls.slice(1).every((call) => call.authorization === "Bearer " + TOKEN));
      } finally {
        globalThis.fetch = originalFetch;
      }
    },
  );
});

test("Admin invite proxy rejects unauthenticated, cross-origin, oversized, and unlisted requests without leaking upstream calls", async (t) => {
  if (!routeModule)
    return t.skip("Route implementation is not present during the expected RED run.");
  await withEnvironment(
    {
      NODE_ENV: "development",
      ADMIN_WEB_LOCAL_NEST_API: "http://127.0.0.1:4321",
      ADMIN_WEB_NEST_API_BASE_URL: undefined,
    },
    async () => {
      const originalFetch = globalThis.fetch;
      let calls = 0;
      globalThis.fetch = async (input) => {
        calls += 1;
        if (String(input).endsWith("/identity/login"))
          return Response.json(
            { error: { code: "UNAUTHENTICATED", message: "Sign-in failed." } },
            { status: 401 },
          );
        return Response.json({ data: {} });
      };
      try {
        const { GET, POST } = routeModule;
        const invalidLogin = await POST(
          request(["identity", "login"], {
            method: "POST",
            body: { username: "missing-demo", password: "synthetic-only-password" },
          }),
          context(["identity", "login"]),
        );
        assert.equal(invalidLogin.status, 401);
        assert.equal(invalidLogin.headers.get("set-cookie"), null);
        const noSession = await GET(
          request(["staff", "guardian-binding", "applications"]),
          context(["staff", "guardian-binding", "applications"]),
        );
        assert.equal(noSession.status, 401);
        const blocked = await GET(
          request(["platform", "secrets"]),
          context(["platform", "secrets"]),
        );
        assert.equal(blocked.status, 404);
        const crossOrigin = await POST(
          request(["identity", "login"], {
            method: "POST",
            origin: "https://attacker.invalid",
            body: { username: "reviewer-demo", password: "synthetic-only-password" },
          }),
          context(["identity", "login"]),
        );
        assert.equal(crossOrigin.status, 403);
        const queryRequest = new Request("http://127.0.0.1:3000/api/admin/me?include=internal", {
          headers: { cookie: "student_care_admin_session=" + TOKEN },
        });
        const queryBlocked = await GET(queryRequest, context(["me"]));
        assert.equal(queryBlocked.status, 400);
        const originMissing = await POST(
          new Request("http://127.0.0.1:3000/api/admin/identity/login", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              username: "reviewer-demo",
              password: "synthetic-only-password",
            }),
          }),
          context(["identity", "login"]),
        );
        assert.equal(originMissing.status, 403);
        const tooLarge = await POST(
          new Request("http://127.0.0.1:3000/api/admin/identity/login", {
            method: "POST",
            headers: {
              origin: "http://127.0.0.1:3000",
              host: "127.0.0.1:3000",
              "content-type": "application/json",
            },
            body: JSON.stringify({ username: "x".repeat(17000), password: "x" }),
          }),
          context(["identity", "login"]),
        );
        assert.equal(tooLarge.status, 413);
        assert.equal(calls, 1);
      } finally {
        globalThis.fetch = originalFetch;
      }
    },
  );
});

test("production API origin must be HTTPS and non-loopback; invalid configuration sends no request", async (t) => {
  if (!routeModule)
    return t.skip("Route implementation is not present during the expected RED run.");
  await withEnvironment(
    {
      NODE_ENV: "production",
      ADMIN_WEB_LOCAL_NEST_API: undefined,
      ADMIN_WEB_NEST_API_BASE_URL: "http://127.0.0.1:4321",
    },
    async () => {
      const originalFetch = globalThis.fetch;
      const calls = [];
      globalThis.fetch = async (input) => {
        calls.push(String(input));
        return Response.json({
          data: {
            access_token: TOKEN,
            token_type: "Bearer",
            expires_at: "2099-01-01T00:00:00.000Z",
          },
        });
      };
      try {
        const { POST } = routeModule;
        const response = await POST(
          request(["identity", "login"], {
            method: "POST",
            body: { username: "reviewer-demo", password: "synthetic-only-password" },
          }),
          context(["identity", "login"]),
        );
        assert.equal(response.status, 503);
        assert.deepEqual(calls, []);
      } finally {
        globalThis.fetch = originalFetch;
      }
    },
  );
});

test("production HTTPS login uses only the stub and marks the hidden session cookie Secure", async (t) => {
  if (!routeModule)
    return t.skip("Route implementation is not present during the expected RED run.");
  await withEnvironment(
    {
      NODE_ENV: "production",
      ADMIN_WEB_LOCAL_NEST_API: undefined,
      ADMIN_WEB_NEST_API_BASE_URL: "https://api.example.invalid",
    },
    async () => {
      const originalFetch = globalThis.fetch;
      const calls = [];
      globalThis.fetch = async (input) => {
        calls.push(String(input));
        return Response.json({
          data: {
            access_token: TOKEN,
            token_type: "Bearer",
            expires_at: "2099-01-01T00:00:00.000Z",
          },
        });
      };
      try {
        const { POST } = routeModule;
        const response = await POST(
          new Request("https://admin.example.invalid/api/admin/identity/login", {
            method: "POST",
            headers: {
              origin: "https://admin.example.invalid",
              host: "admin.example.invalid",
              "content-type": "application/json",
            },
            body: JSON.stringify({
              username: "reviewer-demo",
              password: "synthetic-only-password",
            }),
          }),
          context(["identity", "login"]),
        );
        assert.equal(response.status, 200);
        assert.match(response.headers.get("set-cookie") ?? "", /Secure/iu);
        assert.doesNotMatch(await response.text(), /access_token/u);
        assert.deepEqual(calls, ["https://api.example.invalid/identity/login"]);
      } finally {
        globalThis.fetch = originalFetch;
      }
    },
  );
});

test("development proxy never uses a configured public API origin", async (t) => {
  if (!routeModule)
    return t.skip("Route implementation is not present during the expected RED run.");
  await withEnvironment(
    {
      NODE_ENV: "development",
      ADMIN_WEB_LOCAL_NEST_API: undefined,
      ADMIN_WEB_NEST_API_BASE_URL: "https://api.example.invalid",
    },
    async () => {
      const originalFetch = globalThis.fetch;
      const calls = [];
      globalThis.fetch = async (input) => {
        calls.push(String(input));
        return Response.json({
          data: {
            access_token: TOKEN,
            token_type: "Bearer",
            expires_at: "2099-01-01T00:00:00.000Z",
          },
        });
      };
      try {
        const response = await routeModule.POST(
          request(["identity", "login"], {
            method: "POST",
            body: { username: "reviewer-demo", password: "synthetic-only-password" },
          }),
          context(["identity", "login"]),
        );
        assert.equal(response.status, 200);
        assert.deepEqual(calls, ["http://127.0.0.1:4321/identity/login"]);
      } finally {
        globalThis.fetch = originalFetch;
      }
    },
  );
});

test("invite proxy permits only scoped care-record review and returns a minimal projection", async (t) => {
  if (!routeModule)
    return t.skip("Route implementation is not present during the expected RED run.");
  await withEnvironment(
    {
      NODE_ENV: "development",
      ADMIN_WEB_LOCAL_NEST_API: "http://127.0.0.1:4321",
      ADMIN_WEB_NEST_API_BASE_URL: undefined,
    },
    async () => {
      const originalFetch = globalThis.fetch;
      const calls = [];
      globalThis.fetch = async (input, init) => {
        calls.push({
          url: String(input),
          method: init?.method,
          authorization: new Headers(init?.headers).get("authorization"),
        });
        if (String(input).endsWith("/staff/care-records"))
          return Response.json({
            data: [
              {
                id: APPLICATION_ID,
                student_id: "22222222-2222-4222-8222-222222222222",
                student_display_ref: "模拟学生甲",
                class_ref: "模拟一年级一班",
                service_date: "2026-10-19",
                values: {
                  arrival: "ARRIVED_AS_PLANNED",
                  homework: "COMPLETED",
                  meal: "FINISHED",
                  rest: "RESTED",
                  activity: "PARTICIPATED",
                  wellbeing: "ROUTINE",
                },
                status: "SUBMITTED",
                version: 1,
                published: false,
                publication_version: 0,
                updated_at: "2026-10-19T01:00:00.000Z",
                actions: ["review"],
                internal_note: "must-not-pass",
              },
            ],
            request_id: "hidden-request-id",
          });
        if (String(input).endsWith("/staff/care-records/" + APPLICATION_ID + "/review"))
          return Response.json({
            data: {
              id: APPLICATION_ID,
              student_id: "22222222-2222-4222-8222-222222222222",
              student_display_ref: "模拟学生甲",
              class_ref: "模拟一年级一班",
              service_date: "2026-10-19",
              values: {
                arrival: "ARRIVED_AS_PLANNED",
                homework: "COMPLETED",
                meal: "FINISHED",
                rest: "RESTED",
                activity: "PARTICIPATED",
                wellbeing: "ROUTINE",
              },
              status: "CONFIRMED",
              version: 2,
              published: false,
              publication_version: 0,
              updated_at: "2026-10-19T01:00:00.000Z",
              actions: ["publish"],
              unrelated_internal_field: "must-not-pass",
            },
          });
        if (String(input).endsWith("/staff/care-records/" + APPLICATION_ID + "/publish"))
          return Response.json({
            data: {
              id: APPLICATION_ID,
              student_display_ref: "模拟学生甲",
              class_ref: "模拟一年级一班",
              service_date: "2026-10-19",
              values: {
                arrival: "ARRIVED_AS_PLANNED",
                homework: "COMPLETED",
                meal: "FINISHED",
                rest: "RESTED",
                activity: "PARTICIPATED",
                wellbeing: "ROUTINE",
              },
              status: "CONFIRMED",
              version: 3,
              published: true,
              publication_version: 1,
              updated_at: "2026-10-19T01:01:00.000Z",
              actions: [],
            },
          });
        return Response.json(
          { error: { code: "NOT_FOUND", message: "not found" } },
          { status: 404 },
        );
      };
      try {
        const response = await routeModule.POST(
          request(["staff", "care-records", APPLICATION_ID, "review"], {
            method: "POST",
            cookie: "student_care_admin_session=" + TOKEN,
            body: { version: 1, action: "confirm" },
          }),
          context(["staff", "care-records", APPLICATION_ID, "review"]),
        );
        const payload = await response.json();
        assert.equal(response.status, 200);
        assert.equal(payload.data.status, "CONFIRMED");
        assert.equal(payload.data.student_display_ref, "模拟学生甲");
        assert.equal("student_id" in payload.data, false);
        assert.equal("unrelated_internal_field" in payload.data, false);
        assert.equal(calls[0]?.authorization, "Bearer " + TOKEN);

        const list = await routeModule.GET(
          request(["staff", "care-records"], { cookie: "student_care_admin_session=" + TOKEN }),
          context(["staff", "care-records"]),
        );
        const listPayload = await list.json();
        assert.equal(list.status, 200);
        assert.equal("student_id" in listPayload.data[0], false);
        assert.equal("internal_note" in listPayload.data[0], false);
        assert.equal("request_id" in listPayload, false);

        const published = await routeModule.POST(
          request(["staff", "care-records", APPLICATION_ID, "publish"], {
            method: "POST",
            cookie: "student_care_admin_session=" + TOKEN,
            body: { version: 2 },
          }),
          context(["staff", "care-records", APPLICATION_ID, "publish"]),
        );
        const publishedPayload = await published.json();
        assert.equal(published.status, 200);
        assert.equal(publishedPayload.data.published, true);
        assert.equal("student_id" in publishedPayload.data, false);

        const invalid = await routeModule.POST(
          request(["staff", "care-records", APPLICATION_ID, "review"], {
            method: "POST",
            cookie: "student_care_admin_session=" + TOKEN,
            body: {
              version: 1,
              action: "confirm",
              student_id: "22222222-2222-4222-8222-222222222222",
            },
          }),
          context(["staff", "care-records", APPLICATION_ID, "review"]),
        );
        assert.equal(invalid.status, 400);
        assert.equal(calls.length, 3, "代理必须在访问上游前拒绝多余字段。");
      } finally {
        globalThis.fetch = originalFetch;
      }
    },
  );
});

test("logout clears the browser session even when the production API origin is invalid", async (t) => {
  if (!routeModule)
    return t.skip("Route implementation is not present during the expected RED run.");
  await withEnvironment(
    {
      NODE_ENV: "production",
      ADMIN_WEB_LOCAL_NEST_API: undefined,
      ADMIN_WEB_NEST_API_BASE_URL: "http://127.0.0.1:4321",
    },
    async () => {
      const response = await routeModule.POST(
        request(["identity", "logout"], {
          method: "POST",
          cookie: "student_care_admin_session=" + TOKEN,
          body: {},
        }),
        context(["identity", "logout"]),
      );
      assert.equal(response.status, 503);
      assert.match(response.headers.get("set-cookie") ?? "", /Max-Age=0/iu);
    },
  );
});

test("invite proxy permits only scoped health review calls and strips internal health identifiers", async (t) => {
  if (!routeModule)
    return t.skip("Route implementation is not present during the expected RED run.");
  await withEnvironment(
    {
      NODE_ENV: "development",
      ADMIN_WEB_LOCAL_NEST_API: "http://127.0.0.1:4321",
      ADMIN_WEB_NEST_API_BASE_URL: undefined,
    },
    async () => {
      const originalFetch = globalThis.fetch;
      const calls = [];
      const record = {
        id: APPLICATION_ID,
        version: 1,
        status: "SUBMITTED",
        studentLabel: "示例学生甲",
        observationCode: "NEEDS_FOLLOW_UP",
        observationLabel: "需要跟进",
        dispositionCode: null,
        dispositionLabel: null,
        summaryCode: null,
        published: false,
        createdByLabel: "示例员工",
        tenantId: "internal-tenant",
        campusId: "internal-campus",
        classId: "internal-class",
        studentId: "internal-student",
        bindingId: "internal-binding",
        bindingVersion: 7,
        actorId: "internal-actor",
        freeText: "must never reach the browser",
      };
      globalThis.fetch = async (input, init = {}) => {
        calls.push({ url: String(input), init });
        return Response.json({ data: String(input).endsWith("/health-incidents") ? [record] : record });
      };
      try {
        const { GET, POST } = routeModule;
        const queue = await GET(
          request(["staff", "health-incidents"], { cookie: "student_care_admin_session=" + TOKEN }),
          context(["staff", "health-incidents"]),
        );
        assert.equal(queue.status, 200);
        const queueBody = await queue.json();
        assert.deepEqual(queueBody.data, [{
          id: APPLICATION_ID,
          version: 1,
          status: "SUBMITTED",
          student_label: "示例学生甲",
          observation_code: "NEEDS_FOLLOW_UP",
          observation_label: "需要跟进",
          disposition_code: null,
          disposition_label: null,
          summary_code: null,
          published: false,
          created_by_label: "示例员工",
        }]);

        const reviewed = await POST(
          request(["staff", "health-incidents", APPLICATION_ID, "review"], {
            method: "POST",
            cookie: "student_care_admin_session=" + TOKEN,
            body: { version: 1, action: "CONFIRM" },
          }),
          context(["staff", "health-incidents", APPLICATION_ID, "review"]),
        );
        assert.equal(reviewed.status, 200);
        assert.doesNotMatch(await reviewed.text(), /internal-|freeText|must never/iu);
        assert.equal(new URL(calls[0].url).pathname, "/staff/health-incidents");
        assert.equal(JSON.parse(calls[1].init.body).action, "CONFIRM");

        const invalid = await POST(
          request(["staff", "health-incidents", APPLICATION_ID, "review"], {
            method: "POST",
            cookie: "student_care_admin_session=" + TOKEN,
            body: { version: 1, action: "CONFIRM", campusId: "forged" },
          }),
          context(["staff", "health-incidents", APPLICATION_ID, "review"]),
        );
        assert.equal(invalid.status, 400);
        const unknown = await GET(
          request(["staff", "health-incidents", "internal"], {
            cookie: "student_care_admin_session=" + TOKEN,
          }),
          context(["staff", "health-incidents", "internal"]),
        );
        assert.equal(unknown.status, 404);
        assert.equal(calls.length, 2, "无效请求必须在访问上游前被拒绝。");
      } finally {
        globalThis.fetch = originalFetch;
      }
    },
  );
});

test("notice invite proxy exposes only the review queue and safe fixed-template results", async (t) => {
  if (!routeModule)
    return t.skip("Route implementation is not present during the expected RED run.");
  await withEnvironment(
    {
      NODE_ENV: "development",
      ADMIN_WEB_LOCAL_NEST_API: "http://127.0.0.1:4321",
      ADMIN_WEB_NEST_API_BASE_URL: undefined,
    },
    async () => {
      const originalFetch = globalThis.fetch;
      const calls = [];
      const notice = {
        id: APPLICATION_ID,
        templateCode: "CLASS_ACTIVITY",
        target: "CLASS",
        classRef: "must-not-reach-browser",
        status: "SUBMITTED",
        version: 2,
        published: false,
        createdAt: "2026-10-19T08:00:00.000Z",
        updatedAt: "2026-10-19T08:05:00.000Z",
        title: "班级活动",
        body: "班级近期有活动安排，请家长查看并留意相关时间。",
        synthetic: true,
      };
      let currentNotice = notice;
      globalThis.fetch = async (input, init = {}) => {
        calls.push({ url: String(input), init });
        const path = new URL(String(input)).pathname;
        const method = init.method ?? "GET";
        if (method === "POST" && path.endsWith("/review"))
          currentNotice = {
            ...currentNotice,
            status: JSON.parse(String(init.body)).action === "APPROVE" ? "APPROVED" : "RETURNED",
            version: 3,
          };
        else if (method === "POST" && path.endsWith("/publish"))
          currentNotice = { ...currentNotice, status: "PUBLISHED", published: true, version: 4 };
        else if (method === "POST" && path.endsWith("/revoke"))
          currentNotice = { ...currentNotice, status: "REVOKED", published: false, version: 5 };
        const payload = method === "GET" ? [currentNotice] : { ...currentNotice, request_id: "must-not-reach-browser" };
        return Response.json({ data: payload, request_id: "must-not-reach-browser" });
      };
      try {
        const { GET, POST } = routeModule;
        const cookie = "student_care_admin_session=" + TOKEN;
        const queue = await GET(
          request(["staff", "notices", "review"], { cookie }),
          context(["staff", "notices", "review"]),
        );
        assert.equal(queue.status, 200);
        const queueBody = await queue.json();
        assert.deepEqual(queueBody.data, [
          {
            id: APPLICATION_ID,
            templateCode: "CLASS_ACTIVITY",
            target: "CLASS",
            status: "SUBMITTED",
            version: 2,
            published: false,
            createdAt: "2026-10-19T08:00:00.000Z",
            updatedAt: "2026-10-19T08:05:00.000Z",
            title: "班级活动",
            body: "班级近期有活动安排，请家长查看并留意相关时间。",
            synthetic: true,
          },
        ]);
        assert.equal("request_id" in queueBody, false);
        assert.equal(new URL(calls[0].url).pathname, "/staff/notices/review");
        assert.equal(
          calls[0]?.init.headers && new Headers(calls[0].init.headers).get("authorization"),
          "Bearer " + TOKEN,
        );

        const reviewed = await POST(
          request(["staff", "notices", APPLICATION_ID, "review"], {
            method: "POST",
            cookie,
            body: { version: 2, action: "APPROVE" },
          }),
          context(["staff", "notices", APPLICATION_ID, "review"]),
        );
        assert.equal(reviewed.status, 200);
        assert.doesNotMatch(await reviewed.text(), /must-not-reach-browser|request_id|classRef/u);
        assert.deepEqual(JSON.parse(String(calls[1]?.init.body)), { version: 2, action: "APPROVE" });

        const published = await POST(
          request(["staff", "notices", APPLICATION_ID, "publish"], {
            method: "POST",
            cookie,
            body: { version: 3 },
          }),
          context(["staff", "notices", APPLICATION_ID, "publish"]),
        );
        assert.equal(published.status, 200);
        assert.doesNotMatch(await published.text(), /request_id|classRef/u);
        assert.deepEqual(JSON.parse(String(calls[2]?.init.body)), { version: 3 });
        assert.equal(new URL(calls[2].url).pathname, `/staff/notices/${APPLICATION_ID}/publish`);

        const revoked = await POST(
          request(["staff", "notices", APPLICATION_ID, "revoke"], {
            method: "POST",
            cookie,
            body: { version: 4 },
          }),
          context(["staff", "notices", APPLICATION_ID, "revoke"]),
        );
        assert.equal(revoked.status, 200);
        assert.doesNotMatch(await revoked.text(), /request_id|classRef/u);
        assert.deepEqual(JSON.parse(String(calls[3]?.init.body)), { version: 4 });
        assert.equal(new URL(calls[3].url).pathname, `/staff/notices/${APPLICATION_ID}/revoke`);

        const invalid = await POST(
          request(["staff", "notices", APPLICATION_ID, "review"], {
            method: "POST",
            cookie,
            body: { version: 2, action: "APPROVE", campusId: "forged" },
          }),
          context(["staff", "notices", APPLICATION_ID, "review"]),
        );
        assert.equal(invalid.status, 400);
        const unsupported = await GET(
          request(["staff", "notices"], { cookie }),
          context(["staff", "notices"]),
        );
        assert.equal(unsupported.status, 404);
        assert.equal(calls.length, 4, "无效通知路径必须在访问上游前拒绝。");
      } finally {
        globalThis.fetch = originalFetch;
      }
    },
  );
});

test("institution home-content proxy scopes draft methods and strips internal record fields", async (t) => {
  if (!routeModule)
    return t.skip("Route implementation is not present during the expected RED run.");
  await withEnvironment(
    {
      NODE_ENV: "development",
      ADMIN_WEB_LOCAL_NEST_API: "http://127.0.0.1:4321",
      ADMIN_WEB_NEST_API_BASE_URL: undefined,
    },
    async () => {
      const originalFetch = globalThis.fetch;
      const calls = [];
      const contentKey = "home-content-synthetic-east";
      const row = {
        id: APPLICATION_ID,
        content_key: contentKey,
        tenant_id: "must-not-reach-browser",
        campus_id: "must-not-reach-browser",
        type: "HOME_BLOCK",
        status: "DRAFT",
        title: "合成首页介绍",
        version: 1,
        visibility: "PUBLIC",
        body: {
          summary: "虚构的摘要。",
          blocks: [{ kind: "TEXT", text: "虚构的正文。" }],
        },
        published_at: null,
        synthetic_data: true,
        editor_note: "must-not-reach-browser",
        moderation_state: "must-not-reach-browser",
        tenant_admin_note: "must-not-reach-browser",
        campus_admin_note: "must-not-reach-browser",
        updated_by: "must-not-reach-browser",
        updated_at: "2026-11-03T08:00:00.000Z",
      };
      globalThis.fetch = async (input, init = {}) => {
        calls.push({ url: String(input), init });
        return Response.json({ data: row, request_id: "must-not-reach-browser" });
      };
      try {
        const { GET, POST } = routeModule;
        const path = ["institution", "home", contentKey, "draft"];
        const cookie = "student_care_admin_session=" + TOKEN;
        const loaded = await GET(request(path, { cookie }), context(path));
        assert.equal(loaded.status, 200);
        const loadedPayload = await loaded.json();
        assert.deepEqual(loadedPayload.data, {
          content_key: contentKey,
          title: row.title,
          type: "HOME_BLOCK",
          status: "DRAFT",
          version: 1,
          visibility: "PUBLIC",
          body: row.body,
          synthetic_data: true,
        });
        assert.equal(new URL(calls[0].url).pathname, `/admin/institution/home/${contentKey}/draft`);
        assert.equal(
          new Headers(calls[0].init.headers).get("authorization"),
          "Bearer " + TOKEN,
        );
        assert.doesNotMatch(JSON.stringify(loadedPayload), /must-not-reach-browser|request_id/u);

        const payload = {
          title: "保存的合成首页",
          type: "HOME_BLOCK",
          visibility: "PUBLIC",
          body: { summary: "新的合成摘要。", blocks: [{ kind: "TEXT", text: "新正文。" }] },
        };
        const saved = await POST(
          request(path, { method: "POST", cookie, body: { payload, expected_version: null } }),
          context(path),
        );
        assert.equal(saved.status, 200);
        assert.equal(new URL(calls[1].url).pathname, `/admin/institution/home/${contentKey}/draft`);
        assert.deepEqual(JSON.parse(String(calls[1].init.body)), {
          payload,
          expected_version: null,
        });

        const invalidPaths = [
          ["institution", "profile", contentKey, "draft"],
          ["institution", "home", "bad/key", "draft"],
        ];
        for (const invalidPath of invalidPaths) {
          const response = await GET(request(invalidPath, { cookie }), context(invalidPath));
          assert.equal(response.status, 404);
        }
        assert.equal(calls.length, 2, "拒绝的路径不得访问上游。");
      } finally {
        globalThis.fetch = originalFetch;
      }
    },
  );
});
