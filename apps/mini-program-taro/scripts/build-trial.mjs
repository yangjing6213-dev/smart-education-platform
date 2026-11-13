import { spawnSync } from "node:child_process";
import {
  copyFile,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  rename,
  rm,
  rmdir,
  stat,
  writeFile,
} from "node:fs/promises";
import { constants } from "node:fs";
import { createRequire } from "node:module";
import { isIP } from "node:net";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { copyLicenseNotices } from "./copy-license-notices.mjs";

const appRoot = fileURLToPath(new URL("../", import.meta.url));
const require = createRequire(import.meta.url);
const reserved =
  /(?:^|\.)(?:localhost|localdomain|local|test|invalid|example|internal|intranet|lan|home|corp|onion|arpa|alt|private|example\.(?:com|net|org))$/i;

export function validateTrialEnv(env) {
  const {
    MINI_TRIAL_APP_ID: appid,
    TARO_APP_API_BASE_URL: address,
    TARO_APP_PUBLIC_REFERENCE: reference,
  } = env;
  if (
    typeof appid !== "string" ||
    appid.length !== 18 ||
    !/^wx[0-9a-f]{16}$/i.test(appid) ||
    !appid.startsWith("wx")
  ) {
    throw new Error("MINI_TRIAL_APP_ID must be an explicit public WeChat AppID.");
  }
  const dnsOrigin = /^https:\/\/([a-z0-9.-]+)(?::443)?\/?$/i;
  const hostname =
    typeof address === "string" && address.trim() === address && dnsOrigin.exec(address)?.[1];
  if (
    !hostname ||
    hostname.length > 253 ||
    reserved.test(hostname) ||
    !hostname.includes(".") ||
    hostname.split(".").some((label) => !/^[a-z0-9](?:[-a-z0-9]{0,61}[a-z0-9])?$/i.test(label)) ||
    !/^[a-z][a-z0-9-]*$/i.test(hostname.split(".").at(-1)) ||
    !URL.canParse(address) ||
    isIP(new URL(address).hostname)
  ) {
    throw new Error("TARO_APP_API_BASE_URL must be a public HTTPS DNS origin on the default port.");
  }
  if (
    typeof reference !== "string" ||
    reference.trim() !== reference ||
    !/^[a-z0-9._~-]{1,128}$/i.test(reference)
  ) {
    throw new Error(
      "TARO_APP_PUBLIC_REFERENCE must be an explicit public reference of 1 to 128 URL-safe characters.",
    );
  }
  if (env.TARO_APP_ALLOW_LOCAL_HTTP && env.TARO_APP_ALLOW_LOCAL_HTTP !== "false") {
    throw new Error("TARO_APP_ALLOW_LOCAL_HTTP must be disabled for a trial.");
  }
  return { appid, origin: new URL(address).origin, reference };
}

function compileTaro(output, config) {
  const outputRoot = relative(appRoot, output);
  if (isAbsolute(outputRoot))
    throw new Error("The trial output must be on the same volume as the Mini package.");
  const taro = join(dirname(require.resolve("@tarojs/cli/package.json")), "bin/taro");
  const result = spawnSync(process.execPath, [taro, "build", "--type", "weapp"], {
    cwd: appRoot,
    stdio: "inherit",
    env: {
      ...process.env,
      NODE_ENV: "production",
      TARO_APP_OUTPUT_ROOT: outputRoot.split(sep).join("/"),
      TARO_APP_API_BASE_URL: config.origin,
      TARO_APP_PUBLIC_REFERENCE: config.reference,
      TARO_APP_ALLOW_LOCAL_HTTP: "false",
    },
  });
  if (result.error || result.status !== 0) throw new Error("Trial Taro compilation failed.");
}

async function verifyMini(output, notices, config) {
  const { pages } = JSON.parse(await readFile(join(output, "app.json"), "utf8"));
  if (!Array.isArray(pages) || !pages.length) throw new Error("Missing compiled Mini routes.");
  const required = [
    "app.js",
    "common.js",
    "vendors.js",
    "taro.js",
    "runtime.js",
    "base.wxml",
    "comp.js",
    "comp.json",
    "comp.wxml",
    "utils.wxs",
    "app.js.LICENSE.txt",
    "vendors.js.LICENSE.txt",
    ...notices.map((x) => x.target),
  ];
  for (const route of pages) {
    if (typeof route !== "string" || !/^(?:[a-z0-9_-]+\/)*[a-z0-9_-]+$/i.test(route))
      throw new Error("Invalid compiled Mini route.");
    for (const extension of ["js", "json", "wxml"]) required.push(route + "." + extension);
  }
  for (const path of required) {
    const file = await stat(join(output, path));
    if (!file.isFile() || !file.size) throw new Error("Incomplete Mini package: " + path);
  }
  // Check the production clients emitted by the pinned Taro compiler before publishing.
  const baseUrl = "baseUrl:" + JSON.stringify(config.origin) + ",";
  const common = await readFile(join(output, "common.js"), "utf8");
  const meals = await readFile(join(output, "pages/visitor/meals/index.js"), "utf8");
  const mealOptions = baseUrl + "publicReference:" + JSON.stringify(config.reference) + ",";
  if (
    !common.includes(baseUrl + "allowLocalHttp:!1") ||
    !meals
      .split(mealOptions)
      .slice(1)
      .some((options) => /^(?:[^{}]*?,)?allowLocalHttp:!1\b/.test(options))
  ) {
    throw new Error("Compiled Mini clients do not match the requested trial settings.");
  }
}

export async function buildTrial(output, env, compile = compileTaro) {
  const config = validateTrialEnv(env);
  if (typeof output !== "string" || !output.trim())
    throw new Error("Supply --output with a new project directory.");
  const target = resolve(output);
  const existing = await lstat(target).catch((error) => {
    if (error.code !== "ENOENT") throw error;
  });
  if (existing) throw new Error("Trial output already exists. Choose a new directory.");
  const staging = await mkdtemp(join(dirname(target), ".mini-trial-"));
  const mini = join(staging, "miniprogram");
  try {
    await compile(mini, config);
    await verifyMini(mini, await copyLicenseNotices(mini), config);
    await writeFile(
      join(staging, "project.config.json"),
      JSON.stringify(
        {
          projectname: "student-care-trial",
          appid: config.appid,
          compileType: "miniprogram",
          miniprogramRoot: "miniprogram/",
          setting: { urlCheck: true },
        },
        null,
        2,
      ) + "\n",
    );
    // Claim the final name exclusively even if another process created it during compilation.
    await mkdir(target);
    let miniMoved = false;
    try {
      await rename(mini, join(target, "miniprogram"));
      miniMoved = true;
      await copyFile(
        join(staging, "project.config.json"),
        join(target, "project.config.json"),
        constants.COPYFILE_EXCL,
      );
    } catch (error) {
      if (miniMoved) await rename(join(target, "miniprogram"), mini);
      await rmdir(target);
      throw error;
    }
  } finally {
    await rm(staging, { recursive: true, force: true });
  }
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try {
    const [flag, target, ...extra] = process.argv.slice(2);
    if (flag !== "--output" || !target || extra.length)
      throw new Error("Usage: build:weapp:trial --output <new-project-directory>");
    await buildTrial(target, process.env);
    console.log("WeChat trial project is ready.");
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
