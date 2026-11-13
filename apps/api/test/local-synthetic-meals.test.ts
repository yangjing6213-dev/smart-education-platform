import assert from "node:assert/strict";
import test from "node:test";
import { buildLocalSyntheticServer } from "../src/local-synthetic/server.js";

type App = Awaited<ReturnType<typeof buildLocalSyntheticServer>>;
type Meal = {
  id: string;
  status: string;
  version: number;
  meal_date: string;
  meal_type: string;
  items: string[];
  notes: string;
  private_notes: string;
  updated_at: string;
};

async function call(
  app: App,
  handle: string,
  method: "GET" | "POST" | "PUT",
  path: string,
  body?: object,
) {
  return app.inject({
    method,
    url: path,
    headers: {
      host: "127.0.0.1:4317",
      ...(handle ? { authorization: `Bearer ${handle}` } : {}),
    },
    ...(body ? { payload: body } : {}),
  });
}

async function identity(app: App, profile: string) {
  const response = await call(app, "", "POST", "/local/sessions", { profile });
  assert.equal(response.statusCode, 201, response.body);
  return response.json<{ handle: string }>().handle;
}

test("local meal management is scoped and public reads reveal published fields only", async () => {
  const app = await buildLocalSyntheticServer({
    mode: "local-synthetic",
    now: () => Date.parse("2026-10-14T04:00:00.000Z"),
  });
  try {
    const owner = await identity(app, "owner-east");
    const otherCampusOwner = await identity(app, "owner-west");
    const parent = await identity(app, "parent-alpha");
    const payload = {
      meal_date: "2026-10-14",
      meal_type: "LUNCH",
      items: ["模拟米饭", "模拟时蔬"],
      notes: "仅供本机开发测试。",
    };

    const initialList = await call(app, owner, "GET", "/local/meals");
    assert.equal(initialList.statusCode, 200, initialList.body);
    assert.deepEqual(initialList.json(), []);
    assert.deepEqual((await call(app, otherCampusOwner, "GET", "/local/meals")).json(), []);
    assert.equal((await call(app, parent, "GET", "/local/meals")).statusCode, 403);

    const created = await call(app, owner, "POST", "/local/meals", payload);
    assert.equal(created.statusCode, 201, created.body);
    let meal = created.json<Meal>();
    assert.equal(meal.status, "DRAFT");
    assert.equal(meal.version, 1);
    assert.equal((await call(app, otherCampusOwner, "GET", "/local/meals")).json<Meal[]>().length, 0);

    const saved = await call(app, owner, "PUT", `/local/meals/${meal.id}/draft`, {
      payload: { ...payload, items: ["模拟米饭", "模拟青菜"] },
      expected_version: meal.version,
    });
    assert.equal(saved.statusCode, 200, saved.body);
    meal = saved.json<Meal>();
    assert.equal(meal.version, 2);

    const published = await call(app, owner, "POST", `/local/meals/${meal.id}/publish`, {
      expected_version: meal.version,
    });
    assert.equal(published.statusCode, 200, published.body);
    meal = published.json<Meal>();
    assert.equal(meal.status, "PUBLISHED");
    assert.equal(
      (await call(app, owner, "PUT", `/local/meals/${meal.id}/draft`, {
        payload,
        expected_version: 1,
      })).statusCode,
      409,
    );

    const publicRead = await call(app, "", "GET", "/local/public-meals?date=2026-10-14");
    assert.equal(publicRead.statusCode, 200, publicRead.body);
    assert.deepEqual(publicRead.json(), [
      {
        id: meal.id,
        meal_date: meal.meal_date,
        meal_type: meal.meal_type,
        items: ["模拟米饭", "模拟青菜"],
        notes: payload.notes,
        published_at: meal.updated_at,
      },
    ]);
    assert.equal(JSON.stringify(publicRead.json()).includes("private_notes"), false);
    assert.equal(JSON.stringify(publicRead.json()).includes("tenant_id"), false);
    assert.equal(JSON.stringify(publicRead.json()).includes("version"), false);

    const unpublished = await call(app, owner, "POST", `/local/meals/${meal.id}/unpublish`, {
      expected_version: meal.version,
    });
    assert.equal(unpublished.statusCode, 200, unpublished.body);
    assert.equal(unpublished.json<Meal>().status, "UNPUBLISHED");
    assert.deepEqual(
      (await call(app, "", "GET", "/local/public-meals?date=2026-10-14")).json(),
      [],
    );
    assert.equal((await call(app, "", "GET", "/local/public-meals?date=2026-02-30")).statusCode, 400);
    assert.equal((await call(app, "", "GET", "/local/public-meals?date=2026-10-14&tenant_id=x")).statusCode, 400);
  } finally {
    await app.close();
  }
});
