/* global Response, URL */
import assert from "node:assert/strict";
import test from "node:test";
import { AdminMealsClient, createAdminMealsTransport } from "../dist/local-review/meals-client.js";

const handle = "s".repeat(43);
const row = {
  id: "meal-local-1",
  tenant_id: "synthetic-tenant",
  campus_id: "synthetic-campus",
  status: "DRAFT",
  version: 1,
  meal_date: "2026-10-14",
  meal_type: "LUNCH",
  items: ["模拟米饭"],
  notes: "本机开发测试",
  media_ref: null,
  private_notes: "",
  published_at: null,
  synthetic_data: true,
  updated_by: "synthetic-owner",
  updated_at: "2026-10-14T04:00:00.000Z",
};

test("admin meals client uses only the scoped local-session meal routes", async () => {
  const calls = [];
  let current = row;
  const fetcher = async (input, init = {}) => {
    const url = new URL(input);
    calls.push({ url: `${url.pathname}${url.search}`, method: init.method, headers: init.headers });
    if (url.pathname === "/local/sessions")
      return Response.json({ handle }, { status: 201 });
    if (url.pathname === "/local/meals" && init.method === "GET") return Response.json([current]);
    if (url.pathname === "/local/meals" && init.method === "POST") {
      current = { ...current, ...JSON.parse(init.body), id: "meal-local-2", version: 1 };
      return Response.json(current, { status: 201 });
    }
    if (url.pathname.endsWith("/draft") && init.method === "PUT") {
      const body = JSON.parse(init.body);
      current = { ...current, ...body.payload, version: current.version + 1 };
      return Response.json(current);
    }
    if (url.pathname.endsWith("/publish") && init.method === "POST") {
      current = { ...current, status: "PUBLISHED", version: current.version + 1 };
      return Response.json(current);
    }
    if (url.pathname.endsWith("/unpublish") && init.method === "POST") {
      current = { ...current, status: "UNPUBLISHED", version: current.version + 1 };
      return Response.json(current);
    }
    return new Response(null, { status: 404 });
  };

  const client = new AdminMealsClient({ baseUrl: "http://127.0.0.1:4318", fetcher });
  assert.deepEqual(await client.connect(), [row]);
  const created = await client.createDraft({
    meal_date: "2026-10-15",
    meal_type: "SNACK",
    items: ["模拟水果"],
    notes: "仅供开发测试",
  });
  assert.equal(created.id, "meal-local-2");
  const saved = await client.updateDraft(created.id, 1, {
    meal_date: "2026-10-15",
    meal_type: "SNACK",
    items: ["模拟梨"],
    notes: "仅供开发测试",
  });
  assert.equal(saved.version, 2);
  assert.equal((await client.publish(saved.id, saved.version)).status, "PUBLISHED");
  assert.equal((await client.unpublish(saved.id, 3)).status, "UNPUBLISHED");

  assert.deepEqual(calls.map(({ url, method }) => [method, url]), [
    ["POST", "/local/sessions"],
    ["GET", "/local/meals"],
    ["POST", "/local/meals"],
    ["PUT", "/local/meals/meal-local-2/draft"],
    ["POST", "/local/meals/meal-local-2/publish"],
    ["POST", "/local/meals/meal-local-2/unpublish"],
  ]);
  assert.ok(calls.slice(1).every((call) => call.headers.authorization === `Bearer ${handle}`));
  assert.equal(calls.every((call) => !call.url.includes("tenant") && !call.url.includes("campus")), true);
});

test("admin meals client rejects non-loopback targets and out-of-contract routes", async () => {
  assert.throws(
    () => new AdminMealsClient({ baseUrl: "https://example.com", fetcher: globalThis.fetch }),
    /本机/u,
  );
  let forwarded = 0;
  const transport = createAdminMealsTransport("http://127.0.0.1:4318", async () => {
    forwarded += 1;
    return Response.json([]);
  });
  assert.equal((await transport("http://127.0.0.1:4318/local/meals?tenant_id=forged")).status, 403);
  assert.equal((await transport("https://example.com/local/meals")).status, 403);
  assert.equal(forwarded, 0);
});
