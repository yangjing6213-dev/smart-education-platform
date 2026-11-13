import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { existsSync } from "node:fs";
import { copyFile, mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { createServer } from "node:http";
import { resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath, URL } from "node:url";
import { clearTimeout, setTimeout } from "node:timers";
import process from "node:process";
import test from "node:test";
const { fetch } = globalThis;
import {
  assertCompiledOutput,
  defaultPaths,
  parseArgs,
  startLocalDemo,
  verifyMiniBuild,
} from "../../scripts/start-local-demo.mjs";

test("unified launcher requires explicit local mode and only a loopback test port override", () => {
  assert.throws(() => parseArgs([]), /--local-synthetic/u);
  assert.deepEqual(parseArgs(["--local-synthetic"]), { port: 4317 });
  assert.deepEqual(parseArgs(["--local-synthetic", "--port", "0"]), { port: 0 });
  for (const args of [
    ["--host", "0.0.0.0"],
    ["--port", "8080"],
    ["--port", "0", "extra"],
  ])
    assert.throws(() => parseArgs(["--local-synthetic", ...args]));
  assert.equal(defaultPaths.mini, resolve(defaultPaths.service, "apps/mini-program"));
  assert.equal(defaultPaths.admin, defaultPaths.service);
  assert.equal(existsSync(resolve(defaultPaths.admin, "apps/admin-web/preview.mjs")), true);
});

test("missing or stale compilation is rejected before starting services", () => {
  assert.throws(
    () =>
      assertCompiledOutput("entry.js", "current", () => {
        throw new Error("missing");
      }),
    /缺少/u,
  );
  assert.throws(() => assertCompiledOutput("entry.js", "current", () => "old"), /编译.*旧/u);
  assert.doesNotThrow(() => assertCompiledOutput("entry.js", "current", () => "current"));
});

test("Mini freshness compares compiled output and checks registered pages without writing", () => {
  const calls = [];
  const builds = [];
  verifyMiniBuild(
    (exe, args, options) => {
      calls.push({ exe, args, options });
      return { status: 0 };
    },
    (tree, app) => builds.push({ tree, app }),
  );
  assert.deepEqual(builds, [{ tree: resolve(defaultPaths.mini, "../.."), app: "mini-program" }]);
  assert.equal(calls[0].exe, process.execPath);
  assert.match(calls[0].args[0], /scripts[/\\]verify_mini_page_registration\.mjs$/u);
  assert.deepEqual(calls[0].args.slice(1), ["--require-generated-js"]);
  assert.equal(calls[0].options.windowsHide, true);
  assert.throws(
    () =>
      verifyMiniBuild(
        () => ({ status: 1 }),
        () => undefined,
      ),
    /verify_mini_page_registration\.mjs --require-generated-js/su,
  );
  assert.throws(
    () =>
      verifyMiniBuild(
        () => ({ status: 0 }),
        () => {
          throw new Error("stale output");
        },
      ),
    /stale output/u,
  );
});

async function canListen(port) {
  const server = createServer();
  try {
    server.listen(port, "127.0.0.1");
    await once(server, "listening");
    return true;
  } catch (error) {
    if (error?.code === "EADDRINUSE") return false;
    throw error;
  } finally {
    if (server.listening) await new Promise((resolveClose) => server.close(resolveClose));
  }
}

async function unusedLoopbackPort() {
  const server = createServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  await new Promise((resolveClose) => server.close(resolveClose));
  return address.port;
}

async function assertListenerReleased(base) {
  const port = Number(new URL(base).port);
  for (let attempt = 0; attempt < 30; attempt++) {
    if (await canListen(port)) return;
    await delay(100);
  }
  assert.fail(`Listener stayed open: ${base}`);
}

async function assertPreviewRejectsJunctionEscape(previewPath, routePrefix) {
  const root = await mkdtemp(resolve(tmpdir(), "student-care-preview-test-"));
  const appRoot = resolve(root, "app");
  const distRoot = resolve(appRoot, "dist");
  const outsideRoot = resolve(root, "outside");
  const previewTarget = resolve(appRoot, "preview.mjs");
  const junction = resolve(distRoot, "outside-link");
  let child;
  try {
    await mkdir(distRoot, { recursive: true });
    await mkdir(outsideRoot, { recursive: true });
    await copyFile(previewPath, previewTarget);
    const previewProxy = resolve(resolve(previewPath, ".."), "src/local-proxy.mjs");
    if (existsSync(previewProxy)) {
      await mkdir(resolve(appRoot, "src"), { recursive: true });
      await copyFile(previewProxy, resolve(appRoot, "src/local-proxy.mjs"));
    }
    await writeFile(resolve(appRoot, "index.html"), "<main>local preview</main>");
    await writeFile(resolve(distRoot, "main.js"), "window.localPreview = true;");
    await writeFile(resolve(outsideRoot, "secret.txt"), "outside the preview root");
    await symlink(outsideRoot, junction, "junction");
    child = spawn(process.execPath, [previewTarget], {
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const ready = await new Promise((resolveReady, reject) => {
      let output = "";
      const timer = setTimeout(() => reject(new Error("Preview timed out")), 10000);
      child.once("error", (error) => {
        clearTimeout(timer);
        reject(error);
      });
      child.once("exit", (code) => {
        clearTimeout(timer);
        reject(new Error(`Preview exited before startup: ${code}`));
      });
      child.stdout.on("data", (part) => {
        output += part.toString();
        for (const line of output.split(/\r?\n/u)) {
          try {
            const event = JSON.parse(line);
            if (event.event === "startup") {
              clearTimeout(timer);
              resolveReady(event);
              return;
            }
          } catch {
            // Wait for a complete JSON line.
          }
        }
      });
    });
    const response = await fetch(`${ready.baseUrl}${routePrefix}/outside-link/secret.txt`);
    assert.equal(response.status, 404);
    assert.doesNotMatch(await response.text(), /outside the preview root/u);
  } finally {
    if (child && child.exitCode === null) {
      child.kill();
      await once(child, "exit");
    }
    await rm(root, { recursive: true, force: true });
  }
}

test("Admin preview rejects a junction that points outside its dist directory", async () => {
  await assertPreviewRejectsJunctionEscape(
    resolve(defaultPaths.admin, "apps/admin-web/preview.mjs"),
    "/dist",
  );
});

test("User preview rejects a junction that points outside its dist directory", async () => {
  await assertPreviewRejectsJunctionEscape(
    resolve(defaultPaths.web, "apps/user-web/preview.mjs"),
    "",
  );
});

test("one launch serves shared records via both loopback previews and closes only owned listeners", async () => {
  const unrelated = createServer((_request, response) => response.end("preserved"));
  unrelated.listen(0, "127.0.0.1");
  await once(unrelated, "listening");
  const unrelatedUrl = `http://127.0.0.1:${unrelated.address().port}`;
  let app;
  try {
    for (let round = 0; round < 2; round++) {
      app = await startLocalDemo({ port: await unusedLoopbackPort() });
      const { service, web, admin, urls } = app.ready;
      for (const base of [service, web, admin]) assert.equal(new URL(base).hostname, "127.0.0.1");
      assert.match(urls.parent, /mode=shared&profile=parent-alpha/u);
      assert.match(urls.admin, /shared=1&profile=owner-east/u);
      assert.equal(new URL(urls.admin).searchParams.get("mediaServicePort"), new URL(service).port);
      assert.equal(new URL(urls.admin).searchParams.get("localServicePort"), new URL(service).port);
      for (const url of [urls.parent, urls.teacher, urls.owner, urls.admin])
        assert.equal((await fetch(url)).status, 200);
      const adminPage = await fetch(urls.admin);
      assert.match(await adminPage.text(), /首页内容管理/u);
      const staffRouteUrl = new URL("/admin/staff", admin);
      staffRouteUrl.search = new URL(urls.admin).search;
      const staffRoutePage = await fetch(staffRouteUrl);
      assert.equal(staffRoutePage.status, 200);
      assert.match(await staffRoutePage.text(), /首页内容管理/u);
      const adminScript = await fetch(`${admin}/dist/main.js`);
      assert.equal(adminScript.status, 200);
      assert.match(adminScript.headers.get("content-type"), /javascript/u);
      const adminScriptText = await adminScript.text();
      assert.match(adminScriptText, /mediaServicePort/u);
      assert.match(adminScriptText, /localServicePort/u);
      assert.match(adminScriptText, /membership-management\.js/u);
      const membershipModule = await fetch(`${admin}/dist/local-review/membership-management.js`);
      assert.equal(membershipModule.status, 200);
      assert.match(await membershipModule.text(), /员工成员管理/u);
      const mediaPage = await fetch(`${admin}/dist/pages/file-lifecycle.js`);
      assert.equal(mediaPage.status, 200);
      assert.match(await mediaPage.text(), /文件与引用管理/u);
      assert.equal((await fetch(`${admin}/dist/%2e%2e/%2e%2e/package.json`)).status, 404);
      async function api(origin, path, body, handle) {
        const response = await fetch(service + path, {
          method: body ? "POST" : "GET",
          headers: {
            Origin: origin,
            ...(body ? { "Content-Type": "application/json" } : {}),
            ...(handle ? { Authorization: `Bearer ${handle}` } : {}),
          },
          ...(body ? { body: JSON.stringify(body) } : {}),
        });
        assert.ok(response.ok);
        assert.equal(response.headers.get("access-control-allow-origin"), origin);
        return response.json();
      }
      async function proxied(origin, path, body, handle, expectedStatus = body ? 201 : 200) {
        const response = await fetch(new URL(path, origin), {
          method: body ? "POST" : "GET",
          headers: {
            Origin: origin,
            ...(body ? { "Content-Type": "application/json" } : {}),
            ...(handle ? { Authorization: `Bearer ${handle}` } : {}),
          },
          ...(body ? { body: JSON.stringify(body) } : {}),
        });
        assert.equal(response.status, expectedStatus, `${origin}${path}`);
        return response.json();
      }
      const resourceTeacher = await proxied(web, "/local/sessions", { profile: "teacher-east" });
      const sharedResources = await proxied(
        web,
        "/local/resources?grade=%E4%B8%89%E5%B9%B4%E7%BA%A7",
        undefined,
        resourceTeacher.handle,
      );
      assert.ok(sharedResources.length > 0);
      const resourceOwner = await proxied(admin, "/local/sessions", { profile: "owner-east" });
      const managedResources = await proxied(
        admin,
        "/local/resources-managed",
        undefined,
        resourceOwner.handle,
      );
      assert.ok(managedResources.length > 0);
      const parent = (await api(web, "/local/sessions", { profile: "parent-alpha" })).handle;
      const owner = (await api(admin, "/local/sessions", { profile: "owner-east" })).handle;
      const ownerSession = await api(admin, "/local/session", undefined, owner);
      const memberships = await api(admin, "/local/memberships", undefined, owner);
      assert.ok(memberships.length > 0);
      const targetMembership = memberships[0];
      assert.equal(targetMembership.campusId, ownerSession.campusId);
      const updateMembership = async (version) =>
        fetch(`${service}/local/memberships/${targetMembership.actorId}`, {
          method: "PATCH",
          headers: {
            Origin: admin,
            "Content-Type": "application/json",
            Authorization: `Bearer ${owner}`,
          },
          body: JSON.stringify({ status: "SUSPENDED", version }),
        });
      const updateResponse = await updateMembership(targetMembership.version);
      assert.equal(updateResponse.status, 200);
      assert.equal((await updateResponse.json()).version, targetMembership.version + 1);
      assert.equal((await updateMembership(targetMembership.version)).status, 409);
      assert.deepEqual(
        await api(admin, "/local/membership-events", undefined, owner).then((rows) => rows.length),
        1,
      );
      assert.deepEqual(await api(web, "/local/binding-applications", undefined, parent), []);
      const binding = await api(
        web,
        "/local/binding-applications",
        { student: "student-alpha", relationship: "GUARDIAN" },
        parent,
      );
      const pending = await api(admin, "/local/binding-applications", undefined, owner);
      assert.equal(pending[0].id, binding.id);
      await app.close();
      await Promise.all([service, web, admin].map(assertListenerReleased));
      assert.equal(await (await fetch(unrelatedUrl)).text(), "preserved");
    }
  } finally {
    await app?.close();
    unrelated.closeAllConnections();
    await new Promise((r) => unrelated.close(r));
  }
});

test("occupied service port is reported without replacing or killing its listener", async () => {
  const existing = createServer((_request, response) => response.end("existing"));
  existing.listen(0, "127.0.0.1");
  await once(existing, "listening");
  const port = existing.address().port;
  try {
    await assert.rejects(() => startLocalDemo({ port }), /端口.*占用/u);
    assert.equal(await (await fetch(`http://127.0.0.1:${port}`)).text(), "existing");
  } finally {
    existing.closeAllConnections();
    await new Promise((r) => existing.close(r));
  }
});

for (const abrupt of [false, true])
  test(
    abrupt
      ? "abrupt launcher exit closes its IPC-owned preview processes"
      : "default port CLI prints correct Mini folder and Enter closes all owned services",
    async (context) => {
      if (!abrupt && !(await canListen(4317))) {
        context.skip("127.0.0.1:4317 已被其他本机进程占用；不停止或替换该进程。");
        return;
      }
      const script = fileURLToPath(new URL("../../scripts/start-local-demo.mjs", import.meta.url));
      const child = spawn(
        process.execPath,
        [script, "--local-synthetic", ...(abrupt ? ["--port", "0"] : [])],
        {
          windowsHide: true,
          stdio: ["pipe", "pipe", "pipe"],
        },
      );
      try {
        let output = "";
        const ready = await new Promise((resolve, reject) => {
          const timer = setTimeout(() => reject(new Error("Launcher timed out")), 30000);
          child.once("exit", () => {
            clearTimeout(timer);
            reject(new Error("Launcher exited early"));
          });
          child.stdout.on("data", (part) => {
            output += part.toString();
            for (const line of output.split(/\r?\n/u))
              if (line.startsWith('{"status":"ready"')) {
                clearTimeout(timer);
                resolve(JSON.parse(line));
              }
          });
        });
        const exited = once(child, "exit");
        if (abrupt) child.kill("SIGKILL");
        else {
          assert.equal(ready.service, "http://127.0.0.1:4317");
          assert.equal(ready.miniAvailable, true);
          assert.match(output, /不要导入整个工作树/u);
          child.stdin.write("\n");
        }
        const [exitCode] = await exited;
        if (!abrupt) assert.equal(exitCode, 0);
        await Promise.all([ready.service, ready.web, ready.admin].map(assertListenerReleased));
      } finally {
        if (child.exitCode === null) child.kill();
      }
    },
  );
