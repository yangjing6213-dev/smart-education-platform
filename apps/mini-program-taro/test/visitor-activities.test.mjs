import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = async (path) => {
  try {
    return await readFile(new URL(path, import.meta.url), "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") return "";
    throw error;
  }
};

test("visitor activity examples filter by date and return an empty list for no matches", async () => {
  const { filterVisitorActivities, VISITOR_ACTIVITIES } = await import(
    "../src/public/visitor-activities.ts"
  );

  assert.equal(VISITOR_ACTIVITIES.length, 3);
  assert.equal(filterVisitorActivities(VISITOR_ACTIVITIES, "").length, 3);
  assert.equal(
    filterVisitorActivities(VISITOR_ACTIVITIES, "2026-10-20").length,
    1,
  );
  assert.equal(
    filterVisitorActivities(VISITOR_ACTIVITIES, "2099-01-01").length,
    0,
  );
  assert.ok(VISITOR_ACTIVITIES.every((activity) => activity.isSynthetic));
});

test("visitor activity cards open known details and safely reject unknown ids", async () => {
  const { getVisitorActivity } = await import(
    "../src/public/visitor-activities.ts"
  );

  assert.equal(getVisitorActivity("sample-art-table")?.title, "一起动手做创作");
  assert.equal(getVisitorActivity("unknown-activity"), undefined);
});

test("visitor home and activity pages register list, date filtering, detail, and return actions", async () => {
  const [appConfig, home, list, detail] = await Promise.all([
    read("../src/app.config.ts"),
    read("../src/pages/visitor/home/index.tsx"),
    read("../src/pages/visitor/activities/index.tsx"),
    read("../src/pages/visitor/activity-detail/index.tsx"),
  ]);

  assert.match(appConfig, /pages\/visitor\/activities\/index/u);
  assert.match(appConfig, /pages\/visitor\/activity-detail\/index/u);
  assert.match(home, /活动分享/u);
  assert.match(
    home,
    /navigateTo\(\{\s*url:\s*["']\/pages\/visitor\/activities\/index/u,
  );
  assert.match(list, /mode="date"/u);
  assert.match(list, /filterVisitorActivities/u);
  assert.match(list, /清除筛选/u);
  assert.match(list, /pages\/visitor\/activity-detail\/index\?id=/u);
  assert.match(detail, /getVisitorActivity/u);
  assert.match(detail, /未找到这条活动/u);
  assert.match(detail, /Taro\.navigateBack/u);
  assert.doesNotMatch(`${list}${detail}`, /fetch\(|request\(|inviteSession|https?:/iu);
});
