import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import { buildLocalSyntheticServer } from "../../apps/api/dist/src/local-synthetic/server.js";

test("Mini learning page, client, and local API complete the same parent-teacher flow", async () => {
  const app = await buildLocalSyntheticServer({ mode: "local-synthetic" });
  const origin = "http://127.0.0.1:4317";
  const api = async (method, path, body, handle, expectedStatus = 200) => {
    const response = await app.inject({
      method,
      url: path,
      headers: {
        origin,
        ...(handle ? { authorization: `Bearer ${handle}` } : {}),
      },
      ...(body === undefined ? {} : { payload: body }),
    });
    assert.equal(response.statusCode, expectedStatus, `${method} ${path}: ${response.body}`);
    return response.statusCode === 204 ? null : response.json();
  };
  const connect = async (profile) =>
    (await api("POST", "/local/sessions", { profile }, undefined, 201)).handle;
  const previousPage = Object.getOwnPropertyDescriptor(globalThis, "Page");
  const previousWx = Object.getOwnPropertyDescriptor(globalThis, "wx");
  const requireFromTest = createRequire(import.meta.url);
  const pageModule = "../../apps/mini-program/pages/parent/learning/index.js";
  const resolvedPageModule = requireFromTest.resolve(pageModule);
  const cachedPageModule = requireFromTest.cache[resolvedPageModule];
  let pageOptions;

  try {
    const parentHandle = await connect("parent-alpha");
    const ownerHandle = await connect("owner-east");
    const student = (await api("GET", "/local/student-options", undefined, parentHandle))[0];
    const application = await api(
      "POST",
      "/local/binding-applications",
      { student: student.alias, relationship: "GUARDIAN" },
      parentHandle,
      201,
    );
    await api(
      "POST",
      `/local/binding-applications/${application.id}/review`,
      { version: application.version, action: "approve" },
      ownerHandle,
    );

    globalThis.Page = (options) => {
      pageOptions = options;
    };
    globalThis.wx = {
      request(options) {
        const path = new URL(options.url).pathname;
        void app
          .inject({
            method: options.method,
            url: path,
            headers: {
              origin,
              ...options.header,
            },
            ...(options.data === undefined ? {} : { payload: options.data }),
          })
          .then((response) =>
            options.success({
              statusCode: response.statusCode,
              data: response.statusCode === 204 ? null : response.json(),
            }),
          )
          .catch((error) => options.fail(error));
      },
    };

    delete requireFromTest.cache[resolvedPageModule];
    requireFromTest(pageModule);
    assert.ok(pageOptions, "the Mini learning page registers through the native Page API");

    const makePage = (profile) => {
      const page = {
        data: structuredClone(pageOptions.data),
        setData(patch) {
          this.data = { ...this.data, ...patch };
        },
        onLoad: (...args) => pageOptions.onLoad.call(page, ...args),
        handleRefresh: (...args) => pageOptions.handleRefresh.call(page, ...args),
        handleConsent: (...args) => pageOptions.handleConsent.call(page, ...args),
        handleStart: (...args) => pageOptions.handleStart.call(page, ...args),
        handleAnswer: (...args) => pageOptions.handleAnswer.call(page, ...args),
        handleClose: (...args) => pageOptions.handleClose.call(page, ...args),
        handleTeacherHandoff: (...args) =>
          pageOptions.handleTeacherHandoff.call(page, ...args),
      };
      page.onLoad({ profile });
      return page;
    };

    const parent = makePage("parent-alpha");
    await parent.handleRefresh();
    assert.equal(parent.data.students[0]?.id, student.id);
    parent.handleConsent({ detail: { value: ["confirmed"] } });
    await parent.handleStart();
    const completedSession = parent.data.activeSession;
    assert.equal(completedSession?.status, "ACTIVE");

    for (const [itemId, choice] of [
      ["main", "B"],
      ["practice-1", "A"],
      ["practice-2", "B"],
    ]) {
      await parent.handleAnswer({ currentTarget: { dataset: { itemId, choice } } });
    }
    assert.equal(parent.data.activeSession?.status, "COMPLETED");
    const completedResult = globalThis.structuredClone(parent.data.activeSession);
    await parent.handleRefresh();
    const completedSummary = globalThis.structuredClone(parent.data.parentSummary);
    assert.equal(completedSummary[0].completedSessions, 1);
    for (let attempt = 0; attempt < 2; attempt += 1) {
      await parent.handleClose();
      assert.equal(parent.data.message, "练习已结束。");
      assert.deepEqual(parent.data.activeSession, completedResult);
      await parent.handleRefresh();
      assert.deepEqual(parent.data.parentSummary, completedSummary);
    }

    parent.handleConsent({ detail: { value: ["confirmed"] } });
    await parent.handleStart();
    const handoffSessionId = parent.data.activeSession?.id;
    assert.ok(handoffSessionId);

    const teacher = makePage("teacher-east");
    await teacher.handleRefresh();
    assert.equal(
      teacher.data.teacherSummaryRows.find((row) => row.id === handoffSessionId)?.status,
      "ACTIVE",
    );
    await teacher.handleTeacherHandoff({ currentTarget: { dataset: { id: handoffSessionId } } });
    assert.equal(
      teacher.data.teacherSummaryRows.find((row) => row.id === handoffSessionId)?.status,
      "HANDED_OFF",
    );

    parent.onLoad({ profile: "parent-alpha" });
    await parent.handleRefresh();
    assert.equal(parent.data.parentSummary.length, 1);
    assert.equal(parent.data.parentSummary[0].studentId, student.id);
    assert.equal(parent.data.parentSummary[0].sessionCount, 2);
    assert.equal(parent.data.parentSummary[0].completedSessions, 1);
    assert.equal(parent.data.parentSummary[0].attentionCount, 1);
    assert.equal(parent.data.parentSummary[0].knowledgePoints[0].completedSessions, 1);
  } finally {
    if (cachedPageModule) requireFromTest.cache[resolvedPageModule] = cachedPageModule;
    else delete requireFromTest.cache[resolvedPageModule];
    if (previousPage) Object.defineProperty(globalThis, "Page", previousPage);
    else delete globalThis.Page;
    if (previousWx) Object.defineProperty(globalThis, "wx", previousWx);
    else delete globalThis.wx;
    await app.close();
  }
});
