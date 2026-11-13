import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL, URL } from "node:url";
import { chromium } from "playwright";

const projectRoot = fileURLToPath(new URL("../../../", import.meta.url));
const apiModule = pathToFileURL(
  resolve(projectRoot, "apps/api/dist/src/local-synthetic/server.js"),
);
const { buildLocalSyntheticServer } = await import(apiModule.href);
const service = await buildLocalSyntheticServer({ mode: "local-synthetic" });
const serviceUrl = new URL(await service.start(0));
const previews = [];
let browser;

async function startPreview(app) {
  const child = spawn(
    process.execPath,
    [resolve(projectRoot, `apps/${app}/preview.mjs`), "--local-service-port", serviceUrl.port],
    { cwd: projectRoot, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] },
  );
  previews.push(child);
  return new Promise((resolveUrl, reject) => {
    let output = "";
    const timeout = setTimeout(() => reject(new Error(`${app} 预览启动超时。`)), 10000);
    child.once("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.once("exit", (code) => {
      clearTimeout(timeout);
      reject(new Error(`${app} 预览提前退出：${code}; ${output}`));
    });
    child.stdout.on("data", (chunk) => {
      output += String(chunk);
      const line = output.split("\n").find((candidate) => candidate.includes('"baseUrl"'));
      if (line) {
        clearTimeout(timeout);
        resolveUrl(JSON.parse(line).baseUrl);
      }
    });
  });
}

function shanghaiDate() {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const value = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${value.year}-${value.month}-${value.day}`;
}

try {
  const webUrl = await startPreview("user-web");
  const adminUrl = await startPreview("admin-web");
  browser = await chromium.launch({ headless: true });
  const date = shanghaiDate();
  const adminPage = await browser.newPage({ timezoneId: "Asia/Shanghai" });
  await adminPage.goto(`${adminUrl}/admin/meals`);
  await adminPage.getByRole("heading", { name: "餐食内容管理" }).waitFor();
  await adminPage.getByRole("button", { name: "新建餐食" }).click();
  await adminPage.getByLabel("日期", { exact: true }).fill(date);
  await adminPage.getByLabel("餐次", { exact: true }).selectOption("LUNCH");
  await adminPage.getByLabel("菜品（每行一道）").fill("模拟菜单：米饭\n模拟菜单：时蔬");
  await adminPage.getByLabel("菜单说明").fill("仅供本机网页联调。");
  await adminPage.getByRole("button", { name: "保存草稿" }).click();
  await adminPage.getByRole("status").filter({ hasText: "餐食草稿已保存到本机共享服务" }).waitFor();
  await adminPage.getByRole("button", { name: "发布", exact: true }).click();
  await adminPage.getByLabel("餐食状态").filter({ hasText: "已发布" }).waitFor();

  const visitorPage = await browser.newPage({ timezoneId: "Asia/Shanghai" });
  await visitorPage.goto(`${webUrl}/visitor/content/meal-plan`);
  await visitorPage.getByText("模拟菜单：米饭", { exact: true }).waitFor();
  assert.match(await visitorPage.locator("main").innerText(), /模拟菜单：时蔬/u);
  assert.doesNotMatch(
    await visitorPage.locator("main").innerText(),
    /private_notes|tenant_id|synthetic-owner/u,
  );

  await adminPage.getByRole("button", { name: "下架", exact: true }).click();
  await adminPage.getByLabel("餐食状态").filter({ hasText: "已下架" }).waitFor();
  await visitorPage.reload();
  await visitorPage.getByText("本日暂无已发布餐食。", { exact: true }).waitFor();
  assert.doesNotMatch(await visitorPage.locator("main").innerText(), /模拟菜单：米饭/u);
} finally {
  await browser?.close();
  await Promise.all(
    previews.map(
      (child) =>
        new Promise((resolveExit) => {
          if (child.exitCode !== null) return resolveExit();
          child.once("exit", resolveExit);
          child.kill();
        }),
    ),
  );
  await service.close();
}
