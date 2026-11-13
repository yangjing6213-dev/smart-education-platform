import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { buildTrial, validateTrialEnv } from "../scripts/build-trial.mjs";

const env = {
  MINI_TRIAL_APP_ID: "wx" + "a1".repeat(8),
  TARO_APP_API_BASE_URL: "https://API.campus-demo.cn:443/",
  TARO_APP_PUBLIC_REFERENCE: "campus-public_a.1~2",
};
async function workspace(t) {
  const dir = await mkdtemp(join(tmpdir(), "mini-trial-test-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  return dir;
}
async function compile(output) {
  await mkdir(join(output, "pages/home"), { recursive: true });
  await mkdir(join(output, "pages/visitor/meals"), { recursive: true });
  await writeFile(join(output, "app.json"), JSON.stringify({ pages: ["pages/home/index"] }));
  for (const name of [
    "app.js",
    "runtime.js",
    "taro.js",
    "vendors.js",
    "base.wxml",
    "comp.js",
    "comp.json",
    "comp.wxml",
    "utils.wxs",
    "app.js.LICENSE.txt",
    "vendors.js.LICENSE.txt",
    "pages/home/index.js",
    "pages/home/index.json",
    "pages/home/index.wxml",
  ]) {
    await writeFile(join(output, name), "fixture");
  }
  const baseUrl = 'baseUrl:"https://api.campus-demo.cn"';
  await writeFile(join(output, "common.js"), "new Client({" + baseUrl + ",allowLocalHttp:!1})");
  await writeFile(
    join(output, "pages/visitor/meals/index.js"),
    "getMeals({" + baseUrl + ',publicReference:"campus-public_a.1~2",date:r,allowLocalHttp:!1})',
  );
}
test("the ordinary build is preserved alongside the opt-in trial command", async () => {
  const { scripts } = JSON.parse(await readFile(new URL("../package.json", import.meta.url)));
  assert.equal(
    scripts["build:weapp"],
    "taro build --type weapp && node ./scripts/copy-license-notices.mjs",
  );
  assert.equal(scripts["build:weapp:trial"], "node ./scripts/build-trial.mjs");
});
test("release configuration requires explicit AppID, HTTPS DNS origin and a public meal reference", () => {
  assert.equal(validateTrialEnv(env).origin, "https://api.campus-demo.cn");
  for (const [key, inputs] of Object.entries({
    MINI_TRIAL_APP_ID: [
      undefined,
      "",
      "touristappid",
      "wx123",
      "wx" + "g".repeat(16),
      env.MINI_TRIAL_APP_ID + "\n",
    ],
    TARO_APP_PUBLIC_REFERENCE: [undefined, "", " ", "/other", "a".repeat(129), "abc\n"],
    TARO_APP_API_BASE_URL: [
      undefined,
      "",
      "http://api.campus-demo.cn",
      "https://127.1",
      "https://0x7f000001",
      "https://[::1]",
      "https://localhost",
      "https://host.localhost",
      "https://api.intranet",
      "https://host.local",
      "https://mini-api.example.invalid",
      "https://mini.example.com",
      "https://app.test",
      "https://badlabel-.org",
      "https://api.campus-demo.cn:9443",
      "https://api.campus-demo.cn/private",
      "https://usr:fake-secret@api.campus-demo.cn",
      "https://api.campus-demo.cn?",
      "https://api.campus-demo.cn#",
      "https://api.campus-demo.cn\\",
      "https://api.campus-demo.cn\n",
    ],
    TARO_APP_ALLOW_LOCAL_HTTP: ["true", "1", "yes"],
  })) {
    for (const value of inputs) {
      assert.throws(
        () => validateTrialEnv({ ...env, [key]: value }),
        (error) => error.message.includes(key) && !error.message.includes("fake-secret"),
      );
    }
  }
});
test("the importable project is published only after compilation and notice restoration", async (t) => {
  const dir = await workspace(t);
  const target = join(dir, "project");
  await buildTrial(target, env, compile);
  const config = JSON.parse(await readFile(join(target, "project.config.json")));
  assert.equal(config.appid, env.MINI_TRIAL_APP_ID);
  assert.equal(config.setting.urlCheck, true);
  assert.equal(config.compileType, "miniprogram");
  assert.equal(config.miniprogramRoot, "miniprogram/");
  for (const path of [
    "pages/auth/login/index.js.LICENSE.txt",
    "pages/visitor/home/index.js.LICENSE.txt",
  ]) {
    assert.deepEqual(
      await readFile(join(target, "miniprogram", path)),
      await readFile(new URL("../licenses/" + path, import.meta.url)),
    );
  }
  assert.deepEqual(await readdir(dir), ["project"]);
});
test("invalid config, failed compilation and incomplete route or license leave no deliverable", async (t) => {
  const dir = await workspace(t);
  const target = join(dir, "project");
  await assert.rejects(buildTrial(target, { ...env, MINI_TRIAL_APP_ID: "" }, compile));
  for (const failure of ["compile", "pages/home/index.wxml", "vendors.js.LICENSE.txt"]) {
    await assert.rejects(
      buildTrial(target, env, async (out) => {
        await compile(out);
        if (failure === "compile") throw new Error("compiler failed");
        await rm(join(out, failure));
      }),
    );
    assert.deepEqual(await readdir(dir), []);
  }
});
test("missing Taro runtime chunks and template components block delivery", async (t) => {
  const dir = await workspace(t);
  for (const file of [
    "common.js",
    "vendors.js",
    "taro.js",
    "runtime.js",
    "base.wxml",
    "comp.js",
    "comp.json",
    "comp.wxml",
    "utils.wxs",
  ]) {
    await assert.rejects(
      buildTrial(join(dir, "project"), env, async (out) => {
        await compile(out);
        await rm(join(out, file));
      }),
    );
    assert.deepEqual(await readdir(dir), []);
  }
});
test("compiled signed-in and visitor clients must use the requested origin, reference and safe HTTP setting", async (t) => {
  const dir = await workspace(t);
  for (const [file, original, wrong] of [
    ["common.js", "api.campus-demo.cn", "old.campus-demo.cn"],
    ["common.js", "allowLocalHttp:!1", "allowLocalHttp:!0"],
    ["pages/visitor/meals/index.js", "api.campus-demo.cn", "old.campus-demo.cn"],
    ["pages/visitor/meals/index.js", "campus-public_a.1~2", "wrong-campus"],
    ["pages/visitor/meals/index.js", "allowLocalHttp:!1", "allowLocalHttp:!0"],
  ]) {
    await assert.rejects(
      buildTrial(join(dir, "project"), env, async (out) => {
        await compile(out);
        const path = join(out, file);
        await writeFile(path, (await readFile(path, "utf8")).replace(original, wrong));
      }),
    );
    assert.deepEqual(await readdir(dir), []);
  }
});
test("a preexisting or concurrently claimed output is preserved", async (t) => {
  const dir = await workspace(t);
  const target = join(dir, "project");
  await mkdir(target);
  let compiled = false;
  await assert.rejects(
    buildTrial(target, env, async () => {
      compiled = true;
    }),
  );
  assert.equal(compiled, false);
  assert.deepEqual(await readdir(target), []);
  await rm(target, { recursive: true });
  await assert.rejects(
    buildTrial(target, env, async (out) => {
      await compile(out);
      await mkdir(target);
      await writeFile(join(target, "owner.txt"), "original");
    }),
  );
  assert.deepEqual(await readdir(target), ["owner.txt"]);
  assert.equal(await readFile(join(target, "owner.txt"), "utf8"), "original");
});
