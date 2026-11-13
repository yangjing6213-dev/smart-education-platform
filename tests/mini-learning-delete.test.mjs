import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { createRequire, registerHooks } from "node:module";
import { resolve, sep } from "node:path";
import process from "node:process";
import { fileURLToPath, URL } from "node:url";
import test, { after } from "node:test";
import { setImmediate } from "node:timers/promises";
import ts from "typescript";

const require = createRequire(import.meta.url);
const miniRoot = resolve(fileURLToPath(new URL("../apps/mini-program/", import.meta.url))) + sep;
const hook =
  process.env.MINI_SHARED_RUNTIME === "generated"
    ? undefined
    : registerHooks({
        load(url, context, nextLoad) {
          if (url.startsWith("file:") && url.endsWith(".js")) {
            const path = fileURLToPath(url);
            const source = path.replace(/\.js$/u, ".ts");
            if (path.startsWith(miniRoot) && existsSync(source))
              return {
                format: "commonjs",
                shortCircuit: true,
                source: ts.transpileModule(readFileSync(source, "utf8"), {
                  compilerOptions: {
                    target: ts.ScriptTarget.ES2020,
                    module: ts.ModuleKind.CommonJS,
                  },
                }).outputText,
              };
          }
          return nextLoad(url, context);
        },
      });
after(() => hook?.deregister());

const uuid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const recordId = uuid(701);
const otherId = uuid(702);
const studentId = uuid(200);
const event = (id = recordId) => ({ currentTarget: { dataset: { id } } });
const session = (status = "CLOSED", id = recordId) => ({
  id,
  version: 2,
  status,
  studentId,
  studentLabel: "示例学生甲",
  durationMinutes: 10,
  startedAt: "2026-10-11T00:00:00.000Z",
  endsAt: "2026-10-11T00:10:00.000Z",
  mainAttempts: 1,
  lastHintAtAttempt: 0,
  mainCorrect: false,
  highestHintLevel: -1,
  visibleHint: null,
  needsTeacherFollowUp: false,
  question: {
    id: "math-grade-3-addition-01",
    grade: "三年级",
    subject: "数学",
    prompt: "238 + 165 = ？",
    knowledgePoint: "两位数加法与进位",
    choices: [{ id: "A", label: "393" }],
  },
  consolidation: [],
});
const summary = (status = "HANDED_OFF", id = recordId) => ({
  id,
  status,
  studentLabel: "示例学生甲",
  grade: "三年级",
  subject: "数学",
  knowledgePoint: "两位数加法与进位",
  mainAttempts: 1,
  highestHintLevel: -1,
  consolidationCompleted: 0,
  needsTeacherFollowUp: true,
  startedAt: "2026-10-11T00:00:00.000Z",
});
const deferred = () => {
  let resolvePromise;
  const promise = new Promise((resolveValue) => {
    resolvePromise = resolveValue;
  });
  return { promise, resolve: resolvePromise };
};

async function withPage(options, check) {
  const previousPage = Object.getOwnPropertyDescriptor(globalThis, "Page");
  const previousWx = Object.getOwnPropertyDescriptor(globalThis, "wx");
  const entry = resolve(miniRoot, "pages/parent/learning/index.js");
  const client = resolve(miniRoot, "src/local-synthetic/learning-client.js");
  const requests = [];
  const handles = new Map();
  const backend = {
    sessions: options.sessions ?? [session()],
    summaries: options.summaries ?? [],
    deleted: false,
    before: null,
    failReload: false,
  };
  let page;
  let writes = 0;
  const respond = async (request) => {
    const override = await backend.before?.(request);
    if (override) return override;
    const profile = handles.get(request.handle);
    if (request.path === "/local/sessions") {
      const handle = String(handles.size + 1).padStart(43, "A");
      handles.set(handle, request.body.profile);
      return { status: 201, data: { mode: "local-synthetic", handle } };
    }
    if (request.path === "/local/session")
      return {
        status: 200,
        data: {
          profile,
          actions: ["learning:enable", "learning:read", "learning:summary", "learning:delete"],
        },
      };
    if (request.path === "/local/binding-applications")
      return {
        status: 200,
        data: [
          {
            id: uuid(500),
            status: "APPROVED",
            studentId,
            studentLabel: "示例学生甲",
          },
        ],
      };
    if (request.path === "/local/student-options")
      return { status: 200, data: [{ id: studentId, label: "示例学生甲" }] };
    if (request.path === "/local/learning-sessions") {
      if (backend.deleted && backend.failReload) return { status: 503, data: {} };
      return { status: 200, data: globalThis.structuredClone(backend.sessions) };
    }
    if (request.path === "/local/learning-teacher-summary")
      return { status: 200, data: { sessions: globalThis.structuredClone(backend.summaries) } };
    if (request.path === "/local/learning-knowledge") return { status: 200, data: [] };
    if (request.path.endsWith("/delete")) {
      assert.equal(request.method, "POST");
      assert.deepEqual(request.body, {});
      const id = request.path.split("/").at(-2);
      backend.sessions = backend.sessions.filter((row) => row.id !== id);
      backend.summaries = backend.summaries.filter((row) => row.id !== id);
      backend.deleted = true;
      return { status: 200, data: { deleted: true } };
    }
    const row = backend.sessions.find(
      (item) => request.path === `/local/learning-sessions/${item.id}`,
    );
    if (row) return { status: 200, data: globalThis.structuredClone(row) };
    assert.fail(`Unexpected request: ${request.method} ${request.path}`);
  };
  try {
    delete require.cache[entry];
    delete require.cache[client];
    globalThis.Page = (definition) => {
      page = definition;
    };
    globalThis.wx = {
      redirectTo() {},
      request(options) {
        assert.ok(options.url.startsWith("http://127.0.0.1:4317/local/"));
        const request = {
          path: options.url.slice("http://127.0.0.1:4317".length),
          method: options.method,
          body: options.data,
          handle: options.header.Authorization?.slice(7),
        };
        requests.push(request);
        respond(request).then(
          (reply) => options.success({ statusCode: reply.status, data: reply.data }),
          options.fail,
        );
      },
    };
    require(entry);
    page.setData = function (patch) {
      writes++;
      Object.assign(this.data, patch);
    };
    page.onLoad({ profile: options.profile ?? "parent-alpha" });
    await page.handleRefresh();
    assert.equal(page.data.loading, false);
    assert.equal(typeof page.handleDelete, "function", "the real Page must expose deletion");
    await check({ page, backend, requests, writes: () => writes });
  } finally {
    page?.onUnload?.();
    delete require.cache[entry];
    delete require.cache[client];
    if (previousPage) Object.defineProperty(globalThis, "Page", previousPage);
    else delete globalThis.Page;
    if (previousWx) Object.defineProperty(globalThis, "wx", previousWx);
    else delete globalThis.wx;
  }
}
const deletions = (requests) => requests.filter((request) => request.path.endsWith("/delete"));

test("active records and unrelated ended records never issue a deletion", async () => {
  await withPage({ sessions: [session("ACTIVE")] }, async ({ page, requests }) => {
    await page.handleDelete(event());
    await page.handleDelete(event(otherId));
    assert.equal(deletions(requests).length, 0);
    assert.equal(page.data.sessions[0].status, "ACTIVE");
  });
});

test("an ended owned record is deleted from its list and open detail", async () => {
  await withPage({}, async ({ page, requests }) => {
    await page.handleOpenSession(event());
    assert.equal(page.data.activeSession.id, recordId);
    await page.handleDelete(event());
    assert.equal(deletions(requests).length, 1);
    assert.deepEqual(page.data.sessions, []);
    assert.equal(page.data.activeSession, null);
    assert.equal(page.data.message, "本机学习记录已删除。");
  });
});

test("a teacher deletes a handed-off class record but cannot delete a merely closed class record", async () => {
  await withPage(
    { profile: "teacher-east", sessions: [], summaries: [summary(), summary("CLOSED", otherId)] },
    async ({ page, requests }) => {
      await page.handleDelete(event(otherId));
      assert.equal(deletions(requests).length, 0);
      await page.handleDelete(event());
      assert.equal(deletions(requests).length, 1);
      assert.deepEqual(
        page.data.teacherSummaryRows.map((row) => row.id),
        [otherId],
      );
    },
  );
});

test("a second click during deletion sends no duplicate write", async () => {
  await withPage({}, async ({ page, backend, requests }) => {
    const started = deferred();
    const release = deferred();
    backend.before = async (request) => {
      if (request.path.endsWith("/delete")) {
        started.resolve();
        await release.promise;
      }
    };
    const first = page.handleDelete(event());
    await started.promise;
    await page.handleDelete(event());
    assert.equal(deletions(requests).length, 1);
    release.resolve();
    await first;
    assert.deepEqual(page.data.sessions, []);
  });
});

test("refresh during a pending deletion cannot unlock a second deletion", async () => {
  await withPage({}, async ({ page, backend, requests }) => {
    const started = deferred();
    const release = deferred();
    backend.before = async (request) => {
      if (request.path.endsWith("/delete")) {
        started.resolve();
        await release.promise;
      }
    };
    const first = page.handleDelete(event());
    await started.promise;
    await page.handleRefresh();
    const second = page.handleDelete(event());
    release.resolve();
    await Promise.all([first, second]);
    assert.equal(deletions(requests).length, 1);
  });
});

for (const reply of [
  { status: 403, data: { error: { code: "FORBIDDEN" } } },
  { status: 200, data: { deleted: false } },
]) {
  test(`a ${reply.status === 403 ? "denied" : "malformed"} deletion does not report success`, async () => {
    await withPage({}, async ({ page, backend, requests }) => {
      backend.before = (request) => (request.path.endsWith("/delete") ? reply : undefined);
      await page.handleDelete(event());
      assert.equal(deletions(requests).length, 1);
      assert.equal(backend.deleted, false);
      assert.equal(page.data.sessions.length, 1);
      assert.doesNotMatch(page.data.message, /已删除/u);
      assert.equal(page.data.loading, false);
    });
  });
}

test("a successful deletion stays cleared when the subsequent reload fails", async () => {
  await withPage({ profile: "teacher-east", summaries: [summary()] }, async ({ page, backend }) => {
    await page.handleOpenSession(event());
    backend.failReload = true;
    await page.handleDelete(event());
    assert.equal(backend.deleted, true);
    assert.deepEqual(page.data.sessions, []);
    assert.equal(page.data.activeSession, null);
    assert.deepEqual(page.data.teacherSummary, []);
    assert.deepEqual(page.data.teacherSummaryRows, []);
    assert.match(page.data.message, /已删除/u);
    assert.match(page.data.message, /刷新/u);
    assert.equal(page.data.loading, false);
  });
});

for (const change of ["hide", "profile"]) {
  test(`${change} while checking the session cancels the unsent delete`, async () => {
    await withPage({}, async ({ page, backend, requests, writes }) => {
      const started = deferred();
      const release = deferred();
      let intercepted = false;
      backend.before = async (request) => {
        if (!intercepted && request.path === "/local/session") {
          intercepted = true;
          started.resolve();
          await release.promise;
        }
      };
      const pending = page.handleDelete(event());
      await started.promise;
      if (change === "hide") page.onHide();
      else page.onLoad({ profile: "teacher-east" });
      const writeCount = writes();
      const before = globalThis.structuredClone(page.data);
      release.resolve();
      await pending;
      assert.equal(deletions(requests).length, 0);
      assert.equal(writes(), writeCount);
      assert.deepEqual(page.data, before);
    });
  });
}

test("a deletion response after leaving cannot refresh or mutate the hidden page", async () => {
  await withPage({}, async ({ page, backend, requests, writes }) => {
    const started = deferred();
    const release = deferred();
    backend.before = async (request) => {
      if (request.path.endsWith("/delete")) {
        started.resolve();
        await release.promise;
      }
    };
    const pending = page.handleDelete(event());
    await started.promise;
    page.onHide();
    const requestCount = requests.length;
    const writeCount = writes();
    release.resolve();
    await pending;
    assert.equal(requests.length, requestCount);
    assert.equal(writes(), writeCount);
    assert.equal(backend.deleted, true, "an already sent mutation is not claimed to be cancelled");
  });
});

test("returning to the same page waits for the delayed deletion and then refreshes once", async () => {
  await withPage({}, async ({ page, backend, requests }) => {
    await page.handleOpenSession(event());
    const started = deferred();
    const release = deferred();
    backend.before = async (request) => {
      if (request.path.endsWith("/delete")) {
        started.resolve();
        await release.promise;
      }
    };
    const pending = page.handleDelete(event());
    await started.promise;
    page.onHide();
    const requestCount = requests.length;
    page.onShow();
    await setImmediate();
    try {
      assert.equal(
        requests.length,
        requestCount,
        "returning must not read before deletion settles",
      );
      assert.equal(page.data.loading, true);
    } finally {
      release.resolve();
      await pending;
    }
    await setImmediate();
    assert.equal(backend.deleted, true);
    assert.equal(deletions(requests).length, 1);
    assert.equal(
      requests.slice(requestCount).filter((request) => request.path === "/local/learning-sessions")
        .length,
      1,
    );
    assert.deepEqual(page.data.sessions, []);
    assert.equal(page.data.activeSession, null);
    assert.equal(page.data.loading, false);
  });
});

test("a deletion settled while hidden stays isolated when the return refresh fails", async () => {
  await withPage(
    { profile: "teacher-east", summaries: [summary()] },
    async ({ page, backend, requests, writes }) => {
      await page.handleOpenSession(event());
      const started = deferred();
      const release = deferred();
      backend.before = async (request) => {
        if (request.path.endsWith("/delete")) {
          started.resolve();
          await release.promise;
        }
      };
      backend.failReload = true;
      const pending = page.handleDelete(event());
      await started.promise;
      page.onHide();
      const hiddenRequests = requests.length;
      const hiddenWrites = writes();
      release.resolve();
      await pending;
      assert.equal(backend.deleted, true);
      assert.equal(requests.length, hiddenRequests);
      assert.equal(writes(), hiddenWrites);
      page.onShow();
      await setImmediate();
      assert.equal(page.data.loading, false);
      assert.match(page.data.message, /服务暂不可用/u);
      assert.doesNotMatch(page.data.message, /已删除|删除失败/u);
      assert.deepEqual(page.data.sessions, []);
      assert.equal(page.data.activeSession, null);
      assert.deepEqual(page.data.teacherSummary, []);
      assert.deepEqual(page.data.teacherSummaryRows, []);
    },
  );
});

test("the template exposes deletion only for ended own records or handed-off class records", () => {
  const template = readFileSync(resolve(miniRoot, "pages/parent/learning/index.wxml"), "utf8");
  assert.equal((template.match(/bindtap="handleDelete"/gu) ?? []).length, 2);
  assert.match(
    template,
    /wx:if="\{\{item\.status === 'HANDED_OFF'\}\}"[\s\S]*?bindtap="handleDelete"/u,
  );
  assert.match(
    template,
    /wx:if="\{\{item\.status !== 'ACTIVE'\}\}"[\s\S]*?bindtap="handleDelete"/u,
  );
  assert.match(template, /wx:if="\{\{!knowledgeResources\.length\}\}"/u);
});
