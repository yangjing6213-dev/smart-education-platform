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

test("Taro visitor home exposes institution and home-school public pages", async () => {
  const [appConfig, home, homeStyle] = await Promise.all([
    read("../src/app.config.ts"),
    read("../src/pages/visitor/home/index.tsx"),
    read("../src/pages/visitor/home/index.css"),
  ]);

  assert.match(appConfig, /pages\/visitor\/institution\/index/u);
  assert.match(appConfig, /pages\/visitor\/home-school\/index/u);
  assert.match(appConfig, /pages\/visitor\/meals\/index/u);
  assert.match(home, /了解同芯学园/u);
  assert.match(home, /navigateTo\(\{\s*url:\s*["']\/pages\/visitor\/institution\/index/u);
  assert.match(home, /家校共育/u);
  assert.match(home, /navigateTo\(\{\s*url:\s*["']\/pages\/visitor\/home-school\/index/u);
  assert.match(home, /aria-label=["']打开家校共育/u);
  assert.match(home, /餐食安排/u);
  assert.match(home, /navigateTo\(\{\s*url:\s*["']\/pages\/visitor\/meals\/index/u);
  assert.match(homeStyle, /service-card-link[\s\S]*?text-align:\s*left/u);
});

test("public detail pages keep synthetic content local and return to visitor home", async () => {
  const files = await Promise.all([
    read("../src/pages/visitor/institution/index.tsx"),
    read("../src/pages/visitor/institution/index.css"),
    read("../src/pages/visitor/institution/index.config.ts"),
    read("../src/pages/visitor/home-school/index.tsx"),
    read("../src/pages/visitor/home-school/index.css"),
    read("../src/pages/visitor/home-school/index.config.ts"),
    read("../src/pages/visitor/public-info.css"),
  ]);
  const [
    institution,
    institutionStyle,
    institutionConfig,
    homeSchool,
    homeSchoolStyle,
    homeSchoolConfig,
    sharedStyle,
  ] = files;
  const pages = `${institution}${homeSchool}`;
  const styles = `${institutionStyle}${homeSchoolStyle}${sharedStyle}`;

  assert.match(institution, /机构介绍/u);
  assert.match(institution, /服务原则/u);
  assert.match(institution, /模拟数据/u);
  assert.match(institutionConfig, /navigationBarTitleText:\s*["']机构介绍/u);
  assert.match(homeSchool, /家校共育/u);
  assert.match(homeSchool, /沟通方式/u);
  assert.match(homeSchool, /模拟数据/u);
  assert.match(homeSchoolConfig, /navigationBarTitleText:\s*["']家校共育/u);
  assert.equal((pages.match(/返回访客首页/gu) ?? []).length, 2);
  assert.equal(
    (pages.match(/Taro\.redirectTo\(\{\s*url:\s*["']\/pages\/visitor\/home\/index/gu) ?? []).length,
    2,
  );
  assert.match(pages, /pages\/visitor\/day-flow\/index/u);
  assert.match(pages, /pages\/visitor\/institution\/index/u);
  assert.match(styles, /align-self:\s*flex-start/u);
  assert.match(styles, /justify-content:\s*flex-start/u);
  assert.match(styles, /\.public-info-actions[\s\S]*?flex-direction:\s*row/u);
  assert.match(styles, /flex-wrap:\s*wrap/u);
  assert.doesNotMatch(`${pages}${styles}`, /fetch\(|Taro\.request|request\(|wx\.request|https?:/iu);
});
