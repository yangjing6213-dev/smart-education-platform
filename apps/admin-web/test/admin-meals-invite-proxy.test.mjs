/* global Headers, Request, Response, URL, process */
import assert from "node:assert/strict";
import test from "node:test";

const proxy = await import(
  new URL("../src/app/api/admin/[...path]/handler.ts", import.meta.url).href
);
const ID = "a1111111-1111-4111-8111-111111111111";
const TOKEN = "m".repeat(43);
const payload = {
  meal_date: "2026-10-22",
  meal_type: "LUNCH",
  items: ["合成主食"],
  notes: "本地合成菜单",
};
const row = {
  ...payload,
  id: ID,
  status: "DRAFT",
  version: 1,
  published_at: null,
  updated_at: "2026-10-22T02:00:00.000Z",
  actions: ["edit", "publish"],
};
function request(path, method = "GET", body, overrides = {}) {
  const headers = new Headers({
    origin: "http://127.0.0.1:3000",
    host: "127.0.0.1:3000",
    cookie: "student_care_admin_session=" + TOKEN,
    ...overrides,
  });
  if (body !== undefined) headers.set("content-type", "application/json");
  return new Request("http://127.0.0.1:3000/api/admin/" + path.join("/"), {
    method,
    headers,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}
function context(path) {
  return { params: Promise.resolve({ path }) };
}
async function environment(run) {
  const previous = {
    NODE_ENV: process.env.NODE_ENV,
    ADMIN_WEB_LOCAL_NEST_API: process.env.ADMIN_WEB_LOCAL_NEST_API,
  };
  const originalFetch = globalThis.fetch;
  process.env.NODE_ENV = "development";
  process.env.ADMIN_WEB_LOCAL_NEST_API = "http://127.0.0.1:4321";
  try {
    await run();
  } finally {
    globalThis.fetch = originalFetch;
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

test("same-origin meals proxy forwards only server-held identity and strips internal fields", async () => {
  await environment(async () => {
    const calls = [];
    globalThis.fetch = async (input, init) => {
      calls.push({ input: String(input), init });
      return Response.json({
        data: [
          {
            ...row,
            tenant_id: "hidden",
            campus_id: "hidden",
            updated_by: "hidden",
            private_notes: "hidden",
          },
        ],
      });
    };
    const response = await proxy.GET(request(["meals"]), context(["meals"]));
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { data: [row] });
    assert.equal(calls[0].input, "http://127.0.0.1:4321/admin/meals");
    assert.equal(new Headers(calls[0].init.headers).get("authorization"), "Bearer " + TOKEN);
    assert.equal(new Headers(calls[0].init.headers).has("cookie"), false);
    assert.equal(response.headers.get("cache-control"), "no-store");
  });
});

test("same-origin meals proxy supports exact versioned create update publish and withdrawal", async () => {
  await environment(async () => {
    const calls = [];
    globalThis.fetch = async (input, init) => {
      calls.push({ input: String(input), init });
      return Response.json({ data: row });
    };
    const cases = [
      ["POST", "draft", { payload, expected_version: null }],
      ["PUT", "draft", { payload, expected_version: 1 }],
      ["POST", "publish", { expected_version: 1 }],
      ["POST", "unpublish", { expected_version: 2 }],
    ];
    for (const [method, action, body] of cases) {
      assert.equal(typeof proxy[method], "function");
      const path = ["meals", ID, action];
      const response = await proxy[method](request(path, method, body), context(path));
      assert.equal(response.status, 200);
    }
    assert.equal(calls.length, 4);
    for (let i = 0; i < cases.length; i++) {
      assert.equal(calls[i].init.method, cases[i][0]);
      assert.deepEqual(JSON.parse(calls[i].init.body), cases[i][2]);
    }
  });
});

test("meal proxy denies missing sessions, foreign origins, scope injection and unsafe methods before forwarding", async () => {
  await environment(async () => {
    let calls = 0;
    globalThis.fetch = async () => {
      calls++;
      return Response.json({ data: row });
    };
    const draft = ["meals", ID, "draft"];
    assert.equal(
      (await proxy.GET(request(["meals"], "GET", undefined, { cookie: "" }), context(["meals"])))
        .status,
      401,
    );
    assert.equal(
      (
        await proxy.POST(
          request(draft, "POST", { payload }, { origin: "https://foreign.invalid" }),
          context(draft),
        )
      ).status,
      403,
    );
    for (const body of [
      { payload: { ...payload, campus_id: "forged" } },
      { payload, tenant_id: "forged" },
      { payload: { ...payload, meal_date: "2026-02-30" } },
      { payload: { ...payload, items: [] } },
      { payload: { ...payload, meal_type: { toString: "LUNCH" } } },
      { payload, expected_version: 0 },
    ])
      assert.equal((await proxy.POST(request(draft, "POST", body), context(draft))).status, 400);
    const publish = ["meals", ID, "publish"];
    assert.equal(
      (await proxy.POST(request(publish, "POST", { expected_version: "1" }), context(publish)))
        .status,
      400,
    );
    assert.equal((await proxy.GET(request(draft), context(draft))).status, 404);
    assert.equal(calls, 0);
  });
});

test("meal proxy rejects malformed duplicate and contradictory upstream menus", async () => {
  await environment(async () => {
    for (const data of [
      [row, row],
      [{ ...row, meal_date: "2026-02-30" }],
      [{ ...row, status: "PUBLISHED", published_at: null, actions: ["edit"] }],
      [{ ...row, actions: ["destroy"] }],
      [{ ...row, status: { toString: "DRAFT" } }],
    ]) {
      globalThis.fetch = async () => Response.json({ data });
      assert.equal((await proxy.GET(request(["meals"]), context(["meals"]))).status, 502);
    }
  });
});
