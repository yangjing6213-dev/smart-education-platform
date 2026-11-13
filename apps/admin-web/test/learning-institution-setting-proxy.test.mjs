/* global AbortSignal, AbortController, setTimeout, Request, Response, Headers */
import assert from "node:assert/strict";
import process from "node:process";
import { URL } from "node:url";
import test from "node:test";
const proxy = await import(new URL("../src/app/api/admin/[...path]/handler.ts", import.meta.url));
const path = ["learning-institution-setting"];
const context = { params: Promise.resolve({ path }) };
function request(method = "GET", body, headers = {}, query = "") {
  return new Request("http://127.0.0.1:3000/api/admin/learning-institution-setting" + query, {
    method,
    headers: {
      host: "127.0.0.1:3000",
      origin: "http://127.0.0.1:3000",
      cookie: "student_care_admin_session=" + "s".repeat(43),
      "content-type": "application/json",
      ...headers,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}
async function environment(run) {
  const fetcher = globalThis.fetch;
  const env = {
    NODE_ENV: process.env.NODE_ENV,
    ADMIN_WEB_LOCAL_NEST_API: process.env.ADMIN_WEB_LOCAL_NEST_API,
  };
  process.env.NODE_ENV = "development";
  process.env.ADMIN_WEB_LOCAL_NEST_API = "http://127.0.0.1:4321";
  try {
    await run();
  } finally {
    globalThis.fetch = fetcher;
    for (const [key, value] of Object.entries(env)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

test("institution proxy bounds a hung upstream and returns a retryable safe error", async (t) =>
  environment(async () => {
    let aborted = false;
    t.mock.method(AbortSignal, "timeout", (milliseconds) => {
      assert.equal(milliseconds, 8000);
      const controller = new AbortController();
      setTimeout(() => controller.abort(), 1);
      return controller.signal;
    });
    globalThis.fetch = async (_, init) => {
      assert.ok(init.signal);
      return new Promise((_, reject) =>
        init.signal.addEventListener(
          "abort",
          () => {
            aborted = true;
            reject(new Error("private upstream error"));
          },
          { once: true },
        ),
      );
    };
    const result = await proxy.GET(request(), context);
    assert.equal(aborted, true);
    assert.equal(result.status, 503);
    assert.doesNotMatch(JSON.stringify(await result.json()), /private/u);
  }));
test("institution proxy uses server session only, scopes endpoint and strips private response fields", async () =>
  environment(async () => {
    const calls = [];
    globalThis.fetch = async (url, init) => {
      calls.push({ url: String(url), init });
      return Response.json({
        data: { enabled: true, version: 1, tenantId: "private", updatedBy: "private" },
      });
    };
    for (const method of ["GET", "POST"]) {
      const response = await proxy[method](
        request(method, method === "POST" ? { enabled: true, expectedVersion: 0 } : undefined, {
          authorization: "Bearer forged",
          "x-campus-id": "forged",
        }),
        context,
      );
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), { data: { enabled: true, version: 1 } });
      assert.equal(response.headers.get("cache-control"), "no-store");
    }
    for (const call of calls) {
      assert.equal(call.url, "http://127.0.0.1:4321/admin/learning-institution-setting");
      const headers = new Headers(call.init.headers);
      assert.equal(headers.get("authorization"), "Bearer " + "s".repeat(43));
      assert.equal(headers.has("x-campus-id"), false);
    }
  }));
test("institution proxy rejects unauthenticated cross-origin extra-field query and wrong-method writes before forwarding", async () =>
  environment(async () => {
    let calls = 0;
    globalThis.fetch = async () => {
      calls++;
      throw new Error("unexpected upstream");
    };
    assert.equal((await proxy.GET(request("GET", undefined, { cookie: "" }), context)).status, 401);
    assert.equal(
      (
        await proxy.POST(
          request(
            "POST",
            { enabled: true, expectedVersion: 0 },
            { origin: "https://elsewhere.invalid" },
          ),
          context,
        )
      ).status,
      403,
    );
    assert.equal(
      (await proxy.GET(request("GET", undefined, {}, "?tenant_id=forged"), context)).status,
      400,
    );
    for (const body of [
      { enabled: true, expectedVersion: 0, tenantId: "forged" },
      { enabled: 1, expectedVersion: 0 },
      { enabled: true, expectedVersion: -1 },
      { enabled: true, expectedVersion: 2147483647 },
    ]) {
      assert.equal((await proxy.POST(request("POST", body), context)).status, 400);
    }
    assert.equal((await proxy.PUT(request("PUT", {}), context)).status, 404);
    assert.equal(calls, 0);
  }));
test("institution proxy preserves conflict and rejects malformed success without leaking payload", async () =>
  environment(async () => {
    globalThis.fetch = async () =>
      Response.json({ error: { code: "CONFLICT_STATE", message: "private" } }, { status: 409 });
    const conflict = await proxy.POST(
      request("POST", { enabled: true, expectedVersion: 0 }),
      context,
    );
    assert.equal(conflict.status, 409);
    assert.doesNotMatch(JSON.stringify(await conflict.json()), /private/u);
    for (const data of [
      { enabled: true, version: 0 },
      { enabled: false, version: -1 },
      { enabled: false, version: 1.5 },
    ]) {
      globalThis.fetch = async () => Response.json({ data });
      assert.equal((await proxy.GET(request(), context)).status, 502);
    }
  }));
