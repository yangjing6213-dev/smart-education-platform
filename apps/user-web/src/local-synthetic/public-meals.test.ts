import assert from "node:assert/strict";
import test from "node:test";
import {
  PublicMealsClient,
  createPublicMealsTransport,
} from "./public-meals.js";

test("public meals client reads only a date-scoped projection and drops private fields", async () => {
  const calls: { url: string; method: string; credentials: RequestCredentials | undefined }[] = [];
  const client = new PublicMealsClient({
    baseUrl: "http://127.0.0.1:4319",
    fetcher: async (input, init = {}) => {
      calls.push({
        url: String(input),
        method: init.method ?? "GET",
        credentials: init.credentials,
      });
      return Response.json([
        {
          id: "meal-local-1",
          meal_date: "2026-10-14",
          meal_type: "LUNCH",
          items: ["模拟米饭"],
          notes: "本机测试菜单",
          published_at: "2026-10-14T04:00:00.000Z",
          private_notes: "不可公开",
          tenant_id: "private-tenant-id",
        },
      ]);
    },
  });

  assert.deepEqual(await client.forDate("2026-10-14"), [
    {
      id: "meal-local-1",
      meal_date: "2026-10-14",
      meal_type: "LUNCH",
      items: ["模拟米饭"],
      notes: "本机测试菜单",
      published_at: "2026-10-14T04:00:00.000Z",
    },
  ]);
  assert.deepEqual(calls, [
    {
      url: "http://127.0.0.1:4319/local/public-meals?date=2026-10-14",
      method: "GET",
      credentials: "omit",
    },
  ]);
});

test("public meals transport rejects altered dates, authority claims, and non-local targets", async () => {
  assert.throws(
    () => new PublicMealsClient({ baseUrl: "https://example.com", fetcher: globalThis.fetch }),
    /本机/u,
  );
  let forwarded = 0;
  const transport = createPublicMealsTransport("http://127.0.0.1:4319", async () => {
    forwarded += 1;
    return Response.json([]);
  });
  assert.equal(
    (
      await transport("http://127.0.0.1:4319/local/public-meals?date=2026-10-14&tenant_id=x")
    ).status,
    403,
  );
  assert.equal((await transport("https://example.com/local/public-meals?date=2026-10-14")).status, 403);
  assert.equal(forwarded, 0);
  await assert.rejects(
    new PublicMealsClient({ baseUrl: "http://127.0.0.1:4319", fetcher: globalThis.fetch }).forDate(
      "2026-02-30",
    ),
    /日期/u,
  );
});
