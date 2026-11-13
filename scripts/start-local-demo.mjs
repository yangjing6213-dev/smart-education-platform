import { spawn, spawnSync } from "node:child_process";
import { once } from "node:events";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { createRequire } from "node:module";
import process from "node:process";
import { fileURLToPath, pathToFileURL, URL } from "node:url";
import { clearTimeout, setTimeout } from "node:timers";
import { createServer } from "node:http";

const root = fileURLToPath(new URL("../", import.meta.url));
export const defaultPaths = Object.freeze({
  service: root,
  web: root,
  admin: root,
  mini: resolve(root, "apps/mini-program"),
});

export function parseArgs(args) {
  if (args[0] !== "--local-synthetic")
    throw new Error("请显式使用 --local-synthetic；本入口只允许本机示例资料。");
  if (args.length === 1) return { port: 4317 };
  if (args.length === 3 && args[1] === "--port" && args[2] === "0") return { port: 0 };
  throw new Error("不支持此启动参数。默认端口为 4317；仅自动测试可使用 --port 0。");
}

export function assertCompiledOutput(path, expected, read = readFileSync) {
  let actual;
  try {
    actual = read(path, "utf8");
  } catch {
    throw new Error(`缺少编译文件：${path}`);
  }
  if (actual !== expected) throw new Error(`编译文件已旧，请先重新构建：${path}`);
}

function verifyBuild(tree, app) {
  const configPath = resolve(tree, "apps", app, "tsconfig.json");
  const command = `在 ${tree} 运行 node node_modules/typescript/bin/tsc -p apps/${app}/tsconfig.json`;
  try {
    const ts = createRequire(import.meta.url)("typescript");
    const config = ts.readConfigFile(configPath, ts.sys.readFile);
    if (config.error) throw new Error(`缺少编译配置：${configPath}`);
    const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, dirname(configPath));
    if (parsed.errors.length) throw new Error("编译配置无法读取。");
    const program = ts.createProgram(parsed.fileNames, parsed.options);
    if (ts.getPreEmitDiagnostics(program).length) throw new Error("源文件类型检查未通过。");
    let count = 0;
    program.emit(undefined, (path, text) => {
      if (path.endsWith(".js")) {
        assertCompiledOutput(path, text);
        count++;
      }
    });
    if (!count) throw new Error("未找到可验证的编译结果。");
  } catch (error) {
    throw new Error(`${error instanceof Error ? error.message : "无法核对编译文件。"}\n${command}`);
  }
}

export function verifyMiniBuild(run = spawnSync, build = verifyBuild) {
  const tree = resolve(defaultPaths.mini, "../..");
  build(tree, "mini-program");
  const result = run(
    process.execPath,
    [resolve(tree, "scripts/verify_mini_page_registration.mjs"), "--require-generated-js"],
    {
      cwd: tree,
      windowsHide: true,
      stdio: "pipe",
      encoding: "utf8",
      timeout: 30000,
    },
  );
  if (result.error || result.status !== 0)
    throw new Error(
      `小程序页面注册或生成文件检查失败，尚未启动服务。在 ${tree} 运行 node scripts/verify_mini_page_registration.mjs --require-generated-js 查看原因。本入口不会写入小程序文件。`,
    );
}

function preflight() {
  for (const file of ["app.json", "project.config.json"])
    if (!existsSync(resolve(defaultPaths.mini, file)))
      throw new Error(`小程序导入目录不完整：${resolve(defaultPaths.mini, file)}`);
  verifyMiniBuild();
  verifyBuild(defaultPaths.service, "api");
  verifyBuild(defaultPaths.web, "user-web");
  verifyBuild(defaultPaths.admin, "admin-web");
  const webRoot = resolve(defaultPaths.web, "apps/user-web");
  const copies = [
    ["index.html", "index.html"],
    ["src/styles/user-web.css", "styles/user-web.css"],
    ...[
      "childcare-hero.avif",
      "children-cutout.avif",
      "classroom-learning.avif",
      "playroom-discovery.avif",
      "tongxin-logo.png",
    ].map((name) => [`src/assets/${name}`, `assets/${name}`]),
  ];
  for (const [source, target] of copies) {
    try {
      if (
        !readFileSync(resolve(webRoot, source)).equals(
          readFileSync(resolve(webRoot, "dist", target)),
        )
      )
        throw new Error("旧页面文件");
    } catch {
      throw new Error(
        `网页构建内容缺失或已旧。在 ${defaultPaths.web} 运行 node apps/user-web/build.mjs`,
      );
    }
  }
}

function preview(tree, app, servicePort) {
  const path = resolve(tree, "apps", app, "preview.mjs");
  // An IPC disconnect also closes these owned previews after an abrupt parent exit.
  const bootstrap =
    'process.once("disconnect", () => process.exit(0)); await import(process.argv[1]);';
  const child = spawn(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      bootstrap,
      pathToFileURL(path).href,
      "--local-service-port",
      String(servicePort),
    ],
    {
      cwd: tree,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe", "ipc"],
    },
  );
  let stopping = false;
  const close = async () => {
    if (stopping || child.exitCode !== null || child.signalCode !== null) return;
    stopping = true;
    const exited = once(child, "exit");
    if (child.connected) child.disconnect();
    else child.kill();
    await exited;
  };
  const ready = new Promise((resolveReady, reject) => {
    let output = "";
    const timer = setTimeout(() => reject(new Error(`${app} 预览启动超时。`)), 10000);
    child.stderr.resume();
    child.once("error", () => {
      clearTimeout(timer);
      reject(new Error(`${app} 预览无法启动。`));
    });
    child.once("exit", () => {
      clearTimeout(timer);
      reject(new Error(`${app} 预览提前退出。`));
    });
    child.stdout.on("data", (part) => {
      output += part.toString();
      for (const line of output.split(/\r?\n/u)) {
        if (!line.startsWith("{")) continue;
        let info;
        try {
          info = JSON.parse(line);
        } catch {
          continue;
        }
        if (
          typeof info.baseUrl !== "string" ||
          !/^http:\/\/127\.0\.0\.1:[1-9]\d{0,4}$/u.test(info.baseUrl)
        )
          continue;
        clearTimeout(timer);
        resolveReady(info.baseUrl);
      }
    });
  });
  return { child, ready, close };
}

export async function startLocalDemo({ port = 4317 } = {}) {
  preflight();
  let servicePort = port;
  if (servicePort === 0) {
    const probe = createServer();
    probe.listen(0, "127.0.0.1");
    await once(probe, "listening");
    const address = probe.address();
    if (address === null || typeof address === "string")
      throw new Error("无法选择本机共享服务端口。");
    servicePort = address.port;
    await new Promise((resolveClose) => probe.close(resolveClose));
  }
  const children = [];
  let service;
  let stopping = false;
  let finish;
  const closed = new Promise((done) => {
    finish = done;
  });
  const close = async (unexpected = false) => {
    if (stopping) return;
    stopping = true;
    await Promise.all(children.map((child) => child.close()));
    await service?.close();
    finish(unexpected);
  };
  try {
    for (const [tree, app] of [
      [defaultPaths.web, "user-web"],
      [defaultPaths.admin, "admin-web"],
    ])
      children.push(preview(tree, app, servicePort));
    const [web, admin] = await Promise.all(children.map((child) => child.ready));
    const { buildLocalSyntheticServer } =
      await import("../apps/api/dist/src/local-synthetic/server.js");
    service = await buildLocalSyntheticServer({
      mode: "local-synthetic",
      allowedOrigins: [web, admin].map((base) => new URL(base).origin),
    });
    let base;
    try {
      base = await service.start(servicePort);
    } catch (error) {
      if (error?.code === "EADDRINUSE")
        throw new Error(
          `本机端口 ${servicePort} 已被占用。请关闭之前由你启动的示例服务后再试；本入口没有终止现有进程。`,
        );
      throw new Error("本机共享服务启动失败，尚未启动网页预览。");
    }
    servicePort = Number(new URL(base).port);
    for (const child of children)
      child.child.once("exit", () => {
        if (!stopping) void close(true);
      });
    return {
      close,
      closed,
      ready: {
        status: "ready",
        mode: "local-synthetic",
        service: base,
        web,
        admin,
        mini: defaultPaths.mini,
        miniAvailable: servicePort === 4317,
        urls: {
          parent: `${web}/web/parent/binding?mode=shared&profile=parent-alpha`,
          teacher: `${web}/staff/report?mode=shared&profile=teacher-east`,
          owner: `${web}/staff/workbench?mode=shared&profile=owner-east`,
          admin: `${admin}/admin/institution?shared=1&profile=owner-east&mediaServicePort=${servicePort}&localServicePort=${servicePort}`,
        },
      },
    };
  } catch (error) {
    await close();
    throw error;
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  process.stdout.write("正在核对本机编译文件；不会安装依赖或修改项目。\n");
  const app = await startLocalDemo(args);
  const { ready } = app;
  process.stdout.write(JSON.stringify(ready) + "\n");
  process.stdout.write(
    [
      "\n同芯学园本机协同已启动。仅示例资料，重启后清空，不是真实登录。",
      `家长提交与查看：${ready.urls.parent}`,
      `教师成长记录：${ready.urls.teacher}`,
      `负责人工作台：${ready.urls.owner}`,
      `机构管理审核：${ready.urls.admin}`,
      "请用不同浏览器窗口或独立浏览器身份打开家长与员工页面。",
      `微信开发者工具应导入此文件夹（不要导入整个工作树）：${ready.mini}`,
      ready.miniAvailable
        ? "小程序进入‘本机协同’，与以上网页处理同一份资料。"
        : "当前为随机测试端口，小程序不能连接；正常使用请去掉 --port 0。",
      "本窗口保持打开。按回车或 Ctrl+C 结束，只关闭本次创建的服务。\n",
    ].join("\n"),
  );
  const stop = async () => {
    await app.close();
    process.stdin.pause();
  };
  void app.closed.then((unexpected) => {
    if (unexpected) {
      process.stderr.write("网页预览意外停止，本次自建服务已关闭；重新运行本命令即可。\n");
      process.exitCode = 1;
    }
    process.stdin.pause();
  });
  process.once("SIGINT", () => {
    void stop();
  });
  process.once("SIGTERM", () => {
    void stop();
  });
  process.stdin.once("data", () => {
    void stop();
  });
  process.stdin.once("end", () => {
    void stop();
  });
  process.stdin.resume();
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  await main().catch((error) => {
    process.stderr.write((error instanceof Error ? error.message : "本机启动失败。") + "\n");
    process.exitCode = 1;
  });
