import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const meals = await import("../src/public/visitor-meals.ts").catch((error) => {
  if (error?.code === "ERR_MODULE_NOT_FOUND") return null;
  throw error;
});

const requestId = "00000000-0000-4000-8000-000000000336";
const meal = {
  id: "00000000-0000-4000-8000-000000000337",
  meal_date: "2026-10-25",
  meal_type: "LUNCH",
  items: ["香菇青菜面", "清炒时蔬"],
  notes: "餐单以机构当天安排为准。",
  media_ref: "private-media-reference-not-rendered",
  published_at: "2026-10-24T09:00:00.000Z",
};

async function load(options) {
  assert.equal(
    typeof meals?.loadPublicMeals,
    "function",
    "visitor meal client must validate and load the configured public menu",
  );
  return meals.loadPublicMeals(options);
}

test("public meal client sends only date and configured public reference without invitation auth", async () => {
  const calls = [];
  const result = await load({
    baseUrl: "https://api.example.test",
    publicReference: "public-campus-01",
    date: "2026-10-25",
    allowLocalHttp: false,
    request: async (url, options) => {
      calls.push({ url, options });
      return { statusCode: 200, data: { data: [meal], request_id: requestId } };
    },
  });

  assert.equal(calls.length, 1);
  const url = new URL(calls[0].url);
  assert.equal(url.origin, "https://api.example.test");
  assert.equal(url.pathname, "/public/meals");
  assert.deepEqual(
    [...url.searchParams.entries()],
    [
      ["date", "2026-10-25"],
      ["public_ref", "public-campus-01"],
    ],
  );
  assert.deepEqual(calls[0].options, { method: "GET", timeout: 8000 });
  assert.deepEqual(result, [
    {
      id: meal.id,
      date: meal.meal_date,
      mealType: "LUNCH",
      items: meal.items,
      notes: meal.notes,
      publishedAt: meal.published_at,
    },
  ]);
});

test("public meal client fails closed for missing scope, invalid dates, and unsafe origins", async () => {
  let requests = 0;
  const request = async () => {
    requests += 1;
    return { statusCode: 200, data: { data: [], request_id: requestId } };
  };
  const base = {
    baseUrl: "https://api.example.test",
    publicReference: "public-campus-01",
    date: "2026-10-25",
    allowLocalHttp: false,
    request,
  };

  await assert.rejects(load({ ...base, publicReference: "" }), /餐食/u);
  await assert.rejects(load({ ...base, publicReference: "bad reference" }), /餐食/u);
  await assert.rejects(load({ ...base, date: "2026-02-30" }), /餐食/u);
  await assert.rejects(
    load({ ...base, baseUrl: "http://api.example.test", allowLocalHttp: true }),
    /餐食/u,
  );
  assert.equal(requests, 0);
});

test("public meal client rejects malformed or private response fields and non-success responses", async () => {
  const options = {
    baseUrl: "https://api.example.test",
    publicReference: "public-campus-01",
    date: "2026-10-25",
    allowLocalHttp: false,
    request: async (_url, response) => response,
  };

  await assert.rejects(
    load({ ...options, request: async () => ({ statusCode: 403, data: {} }) }),
    /餐食/u,
  );
  await assert.rejects(
    load({
      ...options,
      request: async () => ({
        statusCode: 200,
        data: { data: [{ ...meal, tenant_id: "private-tenant" }], request_id: requestId },
      }),
    }),
    /餐食/u,
  );
  await assert.rejects(
    load({
      ...options,
      request: async () => ({
        statusCode: 200,
        data: { data: [{ ...meal, meal_date: "2026-10-24" }], request_id: requestId },
      }),
    }),
    /餐食/u,
  );
});

test("Taro visitor meal page is registered, date-filtered, read-only, and has clear states", async () => {
  const read = async (path) => {
    try {
      return await readFile(new URL(path, import.meta.url), "utf8");
    } catch (error) {
      if (error?.code === "ENOENT") return "";
      throw error;
    }
  };
  const [appConfig, buildConfig, pageConfig, page, style, home] = await Promise.all([
    read("../src/app.config.ts"),
    read("../config/index.ts"),
    read("../src/pages/visitor/meals/index.config.ts"),
    read("../src/pages/visitor/meals/index.tsx"),
    read("../src/pages/visitor/meals/index.css"),
    read("../src/pages/visitor/home/index.tsx"),
  ]);
  const pageSource = `${pageConfig}${page}${style}`;

  assert.match(appConfig, /pages\/visitor\/meals\/index/u);
  assert.match(buildConfig, /TARO_APP_PUBLIC_REFERENCE/u);
  assert.match(buildConfig, /__TARO_PUBLIC_REFERENCE__/u);
  assert.match(pageConfig, /餐食安排/u);
  assert.match(page, /loadPublicMeals/u);
  assert.match(page, /Picker/u);
  assert.match(page, /重新加载/u);
  assert.match(page, /暂无已发布餐单/u);
  assert.match(page, /暂时无法读取/u);
  assert.match(page, /返回访客首页/u);
  assert.match(home, /餐食安排/u);
  assert.doesNotMatch(pageSource, /tenant_id|campus_id|student_id|Authorization|Bearer/u);
  assert.doesNotMatch(pageSource, /模拟数据|示例餐单|虚构菜单/u);
});
