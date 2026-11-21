/* global Request, Response, URL, process */
import assert from "node:assert/strict";
import test from "node:test";

const { GET, POST, PATCH } = await import(
  new URL("../src/app/api/admin/[...path]/handler.ts", import.meta.url).href
);
const id = "10000000-0000-4000-8000-000000000001";
const fields = {
  kind: "GUIDE",
  title: "合成指南",
  summary: "介绍流程",
  body: "合成指南具体步骤",
  category: "ORIENTATION",
  grade: "",
  subject: "",
  tags: [],
  scope: "CAMPUS",
  classId: null,
  expiresOn: "2028-05-31",
};
const listFields = { ...fields };
delete listFields.body;
const row = { ...listFields, id, version: 1, status: "PUBLISHED" };
const origin = "http://127.0.0.1:3145";
function call(fn, path, method = "GET", body, overrides = {}) {
  const req = new Request(origin + "/api/admin/" + path, {
    method,
    headers: {
      origin,
      host: "127.0.0.1:3145",
      cookie: "student_care_admin_session=" + "x".repeat(43),
      "content-type": "application/json",
      ...overrides,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return fn(req, { params: Promise.resolve({ path: path.split("/") }) });
}
test("invited administrator library projects scoped fields and accepts only versioned operations", async (t) => {
  t.mock.method(globalThis, "fetch", async (url, options) => {
    assert.equal(new URL(url).hostname, "127.0.0.1");
    const path = new URL(url).pathname;
    assert.ok(path.startsWith("/admin/library/"));
    assert.equal(options.headers.get("cookie"), null);
    assert.match(options.headers.get("authorization"), /^Bearer /);
    return Response.json({
      data: path.endsWith("summary")
        ? { total: 2, expired: 0, revoked: 1, published: 1, internal: "hidden" }
        : options.method === "GET"
          ? { classIds: [id], items: [{ ...row, private_note: "hidden" }] }
          : { id, version: 1 },
    });
  });
  const mode = process.env.NODE_ENV;
  process.env.NODE_ENV = "development";
  t.after(() => {
    if (mode === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = mode;
  });
  const before = process.env.ADMIN_WEB_LOCAL_NEST_API;
  process.env.ADMIN_WEB_LOCAL_NEST_API = "http://127.0.0.1:4321";
  try {
    const result = await call(GET, "library/items");
    assert.equal(result.status, 200);
    assert.deepEqual(await result.json(), { data: { items: [row], classIds: [id] } });
    assert.deepEqual(await (await call(GET, "library/summary")).json(), {
      data: { total: 2, expired: 0, revoked: 1, published: 1 },
    });
    assert.equal((await call(POST, "library/items", "POST", fields)).status, 200);
    assert.equal(
      (
        await call(PATCH, "library/items/" + id, "PATCH", {
          version: 1,
          scope: "CLASS",
          classId: id,
          expiresOn: "2028-05-31",
        })
      ).status,
      200,
    );
    assert.equal(
      (await call(POST, "library/items/" + id + "/revoke", "POST", { version: 1 })).status,
      200,
    );
    assert.equal((await call(GET, "library/items", "GET", undefined, { cookie: "" })).status, 401);
    assert.equal(
      (await call(POST, "library/items", "POST", { ...fields, tenantId: id })).status,
      400,
    );
    assert.equal(
      (await call(POST, "library/items", "POST", fields, { origin: "https://foreign.invalid" }))
        .status,
      403,
    );
  } finally {
    if (before === undefined) delete process.env.ADMIN_WEB_LOCAL_NEST_API;
    else process.env.ADMIN_WEB_LOCAL_NEST_API = before;
  }
});
