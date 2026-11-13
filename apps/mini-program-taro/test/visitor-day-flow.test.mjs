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

test("visitor home links to a registered Taro day-flow page", async () => {
  const [appConfig, home] = await Promise.all([
    read("../src/app.config.ts"),
    read("../src/pages/visitor/home/index.tsx"),
  ]);

  assert.match(appConfig, /pages\/visitor\/day-flow\/index/u);
  assert.match(home, /一日流程/u);
  assert.match(
    home,
    /navigateTo\(\{\s*url:\s*["']\/pages\/visitor\/day-flow\/index/u,
  );
});

test("day-flow page has selectable synthetic steps and a left-aligned home return", async () => {
  const [page, style] = await Promise.all([
    read("../src/pages/visitor/day-flow/index.tsx"),
    read("../src/pages/visitor/day-flow/index.css"),
  ]);

  assert.match(page, /模拟数据/u);
  assert.match(page, /不代表任何真实校区排班/u);
  assert.match(page, /setActiveStep\(index\)/u);
  assert.match(page, /返回访客首页/u);
  assert.match(page, /Taro\.redirectTo/u);
  assert.match(
    style,
    /\.day-flow-page\s*\{[^}]*display:\s*flex;[^}]*flex-direction:\s*column;/u,
  );
  assert.match(style, /return-button[\s\S]*?align-self:\s*flex-start/u);
  assert.doesNotMatch(page, /fetch\(|request\(|inviteSession|https?:/iu);
});
