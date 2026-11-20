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

test("both visitor pages show the institution's approved introduction and culture", async () => {
  const home = await read("../src/pages/visitor/home/index.tsx");
  const institution = await read("../src/pages/visitor/institution/index.tsx");
  for (const page of [home, institution]) {
    assert.match(page, /\{INSTITUTION_INTRODUCTION\}/u);
    assert.doesNotMatch(page, /机构介绍示例|课后托管、兴趣探索与温暖陪伴/u);
  }
  const { INSTITUTION_INTRODUCTION, INSTITUTION_CULTURE } =
    await import("../src/public/institution-profile.ts");
  assert.equal(
    INSTITUTION_INTRODUCTION,
    "一家和别的学习机构不一样、崇尚个性化的学习中心。我们注重培养孩子的学习能力、学习习惯与学习兴趣，做有温度的教育，温暖孩子成长之路。",
  );
  assert.deepEqual(INSTITUTION_CULTURE, [
    { title: "愿景", description: "做家长最信任的托育平台，成为最有爱最具影响力的教育企业。" },
    { title: "理念", description: "做有温度的教育，温暖孩子成长路。" },
    {
      title: "使命",
      description:
        "成就每一个同芯学园人精神和物质双向幸福的同时，为更多学子成长赋能，让每一个家庭因为我们的存在变得更加幸福和快乐！",
    },
    {
      title: "价值观",
      description: "向善向上，学生至上。至诚守信，谦虚感恩。创新协作，修己达人。",
    },
  ]);
  assert.match(institution, /INSTITUTION_CULTURE\.map\(/u);
});

test("public detail pages keep local navigation and mark the home-school example", async () => {
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
  assert.match(institution, /企业文化/u);
  assert.doesNotMatch(institution, /模拟数据|访客介绍示例/u);
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
