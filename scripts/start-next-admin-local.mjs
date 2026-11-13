/* global fetch, AbortSignal */
import { createServer } from "node:http";
import { once } from "node:events";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { resolve } from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL, URL } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const servicePort = 4319;
const nextCli = resolve(root, "apps/admin-web/node_modules/next/dist/bin/next");

function validateOrigin(value) {
  const url = new URL(value);
  if (
    url.origin !== value ||
    url.protocol !== "http:" ||
    !["127.0.0.1", "localhost"].includes(url.hostname) ||
    !url.port ||
    url.username ||
    url.password
  )
    throw new Error("家长网页地址必须是带端口的完整本机来源，不能包含路径或账号。");
  return value;
}

export function parseArgs(args) {
  if (args[0] !== "--local-synthetic")
    throw new Error("请显式使用 --local-synthetic；此入口只使用本机合成资料。");
  if (args.length === 1) return {};
  if (args.length === 3 && args[1] === "--parent-origin")
    return { parentOrigin: validateOrigin(args[2]) };
  throw new Error("仅支持 --local-synthetic 和可选的 --parent-origin 本机网页地址。");
}

export async function startNextAdminLocal({ parentOrigin, now, buildLocalSyntheticServer } = {}) {
  if (parentOrigin !== undefined) validateOrigin(parentOrigin);
  if (now !== undefined && typeof now !== "function")
    throw new Error("本机合成时钟必须是测试函数。");
  let service;
  let child;
  let closePromise;
  let finish;
  const closed = new Promise((done) => {
    finish = done;
  });
  const close = () => {
    closePromise ??= (async () => {
      try {
        if (child?.pid && child.exitCode === null && child.signalCode === null) {
          const exited = once(child, "exit");
          if (child.connected) child.disconnect();
          else child.kill("SIGTERM");
          await Promise.race([exited, delay(8000)]);
          if (child.exitCode === null && child.signalCode === null) {
            if (process.platform === "win32") {
              const killer = spawn("taskkill", ["/PID", String(child.pid), "/T", "/F"], {
                windowsHide: true,
                stdio: "ignore",
              });
              await once(killer, "exit");
            } else child.kill("SIGKILL");
            await exited;
          }
        }
      } finally {
        try {
          await service?.close();
        } finally {
          finish();
        }
      }
    })();
    return closePromise;
  };

  try {
    const probe = createServer();
    probe.listen(0, "127.0.0.1");
    await once(probe, "listening");
    const port = probe.address().port;
    await new Promise((done, reject) => probe.close((error) => (error ? reject(error) : done())));
    const admin = `http://127.0.0.1:${port}`;
    const buildServer = buildLocalSyntheticServer ??
      (await import("../apps/api/dist/src/local-synthetic/server.js")).buildLocalSyntheticServer;
    service = await buildServer({
      mode: "local-synthetic",
      ...(now ? { now } : {}),
      allowedOrigins: [admin, ...(parentOrigin ? [parentOrigin] : [])],
    });
    let serviceBase;
    try {
      serviceBase = await service.start(servicePort);
    } catch (error) {
      if (error?.code === "EADDRINUSE")
        throw new Error("本机端口 4319 已被占用，本次启动已退出，没有关闭已有服务。");
      throw error;
    }
    child = spawn(
      process.execPath,
      [fileURLToPath(import.meta.url), "--next-worker", String(port)],
      {
        cwd: resolve(root, "apps/admin-web"),
        env: {
          ...process.env,
          NEXT_TELEMETRY_DISABLED: "1",
          TASK20_NEXT_ADMIN_SERVICE_PORT: String(servicePort),
        },
        windowsHide: true,
        stdio: ["ignore", "pipe", "pipe", "ipc"],
      },
    );
    child.stdout.resume();
    child.stderr.resume();
    let childError;
    child.once("error", (error) => {
      childError = error;
    });
    let ready = false;
    for (let attempt = 0; attempt < 120; attempt++) {
      if (childError || child.exitCode !== null || child.signalCode !== null)
        throw new Error("新版管理网页未能启动；本次创建的服务将关闭。");
      try {
        const response = await fetch(`${admin}/admin/institution`, {
          signal: AbortSignal.timeout(2000),
        });
        await response.body?.cancel();
        if (response.ok) {
          ready = true;
          break;
        }
      } catch {
        /* The isolated Next process may still be preparing the first page. */
      }
      await delay(250);
    }
    if (!ready) throw new Error("新版管理网页启动超时；本次创建的服务将关闭。");
    if (childError || child.exitCode !== null || child.signalCode !== null)
      throw new Error("新版管理网页在启动期间退出；本次创建的服务将关闭。");
    child.once("exit", () => {
      if (!closePromise) void close();
    });
    return { ready: { admin, service: serviceBase }, close, closed };
  } catch (error) {
    await close();
    throw error;
  }
}

async function main() {
  const app = await startNextAdminLocal(parseArgs(process.argv.slice(2)));
  process.stdout.write(JSON.stringify(app.ready) + "\n");
  process.stdout.write(
    `新版管理工作台：${app.ready.admin}/admin/institution\n仅本机合成资料；退出后清空。按回车或 Ctrl+C 关闭本次服务。\n`,
  );
  const stop = async () => {
    await app.close();
    process.stdin.pause();
  };
  process.once("SIGINT", () => void stop());
  process.once("SIGTERM", () => void stop());
  process.stdin.once("data", () => void stop());
  process.stdin.once("end", () => void stop());
  void app.closed.then(() => process.stdin.pause());
  process.stdin.resume();
}

if (process.argv[2] === "--next-worker" && process.send && process.connected) {
  const port = process.argv[3];
  if (!/^[1-9]\d{0,4}$/.test(port ?? "") || Number(port) > 65535)
    throw new Error("Invalid owned Next port");
  process.argv = [
    process.execPath,
    nextCli,
    "dev",
    "--webpack",
    "--hostname",
    "127.0.0.1",
    "--port",
    port,
  ];
  process.once("disconnect", () => {
    if (process.listenerCount("SIGTERM") > 0) process.emit("SIGTERM");
    else process.exit(0);
  });
  await import(pathToFileURL(nextCli).href);
} else if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  await main().catch((error) => {
    process.stderr.write((error instanceof Error ? error.message : "本机启动失败") + "\n");
    process.exitCode = 1;
  });
