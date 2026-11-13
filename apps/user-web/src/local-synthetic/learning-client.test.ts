import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

type Deferred<T> = {
  promise: Promise<T>;
  resolve(value: T): void;
};

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json" },
  });
}

let hooksRegistered = false;

async function loadClient(): Promise<typeof import("./learning.js")> {
  if (!hooksRegistered && import.meta.url.endsWith(".ts")) {
    const source = pathToFileURL(fileURLToPath(new URL("./learning.ts", import.meta.url))).href;
    registerHooks({
      resolve(specifier, context, nextResolve) {
        if (specifier === "./learning.js" && context.parentURL === import.meta.url)
          return nextResolve(source);
        return nextResolve(specifier);
      },
    });
    hooksRegistered = true;
  }
  return import("./learning.js");
}

function approvedBinding() {
  return [
    {
      status: "APPROVED",
      studentId: "student-synthetic-01",
      studentLabel: "模拟学生甲",
      classLabel: "三年级 A 班",
    },
  ];
}

function learningSession(id: string) {
  return { id, status: "ACTIVE" };
}

async function withAttemptClient(
  exhausted: boolean,
  run: (
    client: InstanceType<(typeof import("./learning.js"))["ParentLearningClient"]>,
    writes: string[],
  ) => Promise<void>,
) {
  const { ParentLearningClient } = await loadClient();
  const originalFetch = globalThis.fetch;
  const writes: string[] = [];
  let current = {
    id: "cap-synthetic",
    studentId: "student-synthetic-01",
    status: "ACTIVE",
    mainAttempts: exhausted ? 5 : 4,
    mainAttemptLimit: 5,
    mainAttemptLimitReached: exhausted,
    mainCorrect: false,
  };
  globalThis.fetch = async (input, init) => {
    const path = new URL(String(input), "http://127.0.0.1").pathname;
    if (path === "/local/sessions") return jsonResponse({ handle: "a".repeat(43) });
    if (path === "/local/session")
      return jsonResponse({
        profile: "parent-alpha",
        actions: ["learning:enable", "learning:read"],
      });
    if (path === "/local/binding-applications") return jsonResponse(approvedBinding());
    if (path === "/local/learning-sessions") return jsonResponse([current]);
    if (path === "/local/learning-parent-controls")
      return jsonResponse({
        students: [
          {
            studentId: current.studentId,
            studentLabel: "合成学生甲",
            enabled: true,
            maxDurationMinutes: 15,
            maxHintLevel: 3,
            contactStatus: "NOT_REQUESTED",
          },
        ],
      });
    if (path === "/local/learning-knowledge") return jsonResponse([]);
    if (path.startsWith("/local/learning-sessions/cap-synthetic/")) {
      const action = path.split("/").at(-1)!;
      writes.push(action);
      const body = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
      if (action === "answer" && body.itemId === "main")
        current = {
          ...current,
          mainAttempts: 5,
          mainCorrect: body.choice === "B",
          mainAttemptLimitReached: body.choice !== "B",
        };
      if (action === "close") current = { ...current, status: "CLOSED" };
      return jsonResponse(current);
    }
    throw new Error(`Unexpected request ${path}`);
  };
  try {
    const client = new ParentLearningClient();
    await client.connect();
    await run(client, writes);
  } finally {
    globalThis.fetch = originalFetch;
  }
}

test("exhausted web state blocks answer and hint requests but permits closing", async () => {
  await withAttemptClient(true, async (client, writes) => {
    await assert.rejects(client.answer("main", "A"), /上限.*教师/u);
    await assert.rejects(client.hint(0), /上限.*教师/u);
    assert.deepEqual(writes, []);
    assert.equal(client.snapshot.activeSession?.status, "ACTIVE");
    await client.close();
    assert.deepEqual(writes, ["close"]);
  });
});

test("a fifth wrong response explains the limit and blocks the next request", async () => {
  await withAttemptClient(false, async (client, writes) => {
    await client.answer("main", "A");
    assert.match(client.snapshot.message, /上限.*教师/u);
    assert.doesNotMatch(client.snapshot.message, /已接手/u);
    await assert.rejects(client.answer("main", "B"), /上限/u);
    assert.deepEqual(writes, ["answer"]);
  });
});

test("a fifth correct response permits consolidation rather than claiming hints are next", async () => {
  await withAttemptClient(false, async (client, writes) => {
    await client.answer("main", "B");
    assert.match(client.snapshot.message, /巩固/u);
    await client.answer("practice-1", "A");
    await client.answer("practice-2", "B");
    assert.deepEqual(writes, ["answer", "answer", "answer"]);
  });
});

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

test("disconnect during a pending refresh stops later requests and stale state writes", async () => {
  const { ParentLearningClient } = await loadClient();
  const originalFetch = globalThis.fetch;
  const bindingsResponse = deferred<Response>();
  const bindingsStarted = deferred<void>();
  const requests: Array<{ path: string; authorization: string | null }> = [];
  globalThis.fetch = async (input, init) => {
    const path = new URL(String(input), "http://127.0.0.1").pathname;
    const headers = new Headers(init?.headers);
    requests.push({ path, authorization: headers.get("authorization") });
    if (path === "/local/sessions" && init?.method === "POST")
      return jsonResponse({ handle: "a".repeat(43) });
    if (path === "/local/session")
      return jsonResponse({
        profile: "parent-alpha",
        actions: ["learning:enable", "learning:read"],
      });
    if (path === "/local/binding-applications") {
      bindingsStarted.resolve();
      return bindingsResponse.promise;
    }
    if (path === "/local/learning-sessions") return jsonResponse([]);
    if (path === "/local/learning-parent-controls") return jsonResponse({ students: [] });
    if (path === "/local/learning-knowledge")
      return jsonResponse({ error: "disconnected request must not be sent" }, 401);
    throw new Error(`Unexpected local request: ${path}`);
  };

  try {
    const client = new ParentLearningClient();
    const connecting = client.connect("parent-alpha");
    await bindingsStarted.promise;
    client.disconnect();
    bindingsResponse.resolve(
      jsonResponse([
        {
          status: "APPROVED",
          studentId: "student-synthetic-01",
          studentLabel: "模拟学生甲",
          classLabel: "三年级 A 班",
        },
      ]),
    );
    await connecting;

    assert.equal(
      requests.some((request) => request.path === "/local/learning-knowledge"),
      false,
      "a disconnected refresh must not make its next request",
    );
    assert.equal(
      client.snapshot.status,
      "IDLE",
      "stale refresh must not replace disconnected state",
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("an open request from the prior profile cannot write into the newly connected profile", async () => {
  const { ParentLearningClient } = await loadClient();
  const originalFetch = globalThis.fetch;
  const openResponse = deferred<Response>();
  const openStarted = deferred<void>();
  globalThis.fetch = async (input, init) => {
    const path = new URL(String(input), "http://127.0.0.1").pathname;
    const body = typeof init?.body === "string" ? (JSON.parse(init.body) as unknown) : {};
    const profile = isObject(body) && typeof body.profile === "string" ? body.profile : "";
    if (path === "/local/sessions" && init?.method === "POST")
      return jsonResponse({ handle: profile === "teacher-east" ? "b".repeat(43) : "a".repeat(43) });
    if (path === "/local/session") {
      const handle = new Headers(init?.headers).get("authorization");
      const teacher = handle === `Bearer ${"b".repeat(43)}`;
      return jsonResponse({
        profile: teacher ? "teacher-east" : "parent-alpha",
        actions: ["learning:enable", "learning:read", "learning:summary"],
      });
    }
    if (path === "/local/binding-applications") return jsonResponse(approvedBinding());
    if (path === "/local/student-options")
      return jsonResponse([
        { id: "student-synthetic-02", label: "模拟学生乙", classLabel: "三年级 A 班" },
      ]);
    if (path === "/local/learning-sessions" && init?.method === "GET") return jsonResponse([]);
    if (path === "/local/learning-parent-controls")
      return jsonResponse({
        students: [
          {
            studentId: "student-synthetic-01",
            studentLabel: "模拟学生甲",
            enabled: true,
            maxDurationMinutes: 15,
            maxHintLevel: 3,
            contactStatus: "NOT_REQUESTED",
          },
        ],
      });
    if (path === "/local/learning-sessions" && init?.method === "POST") {
      openStarted.resolve();
      return openResponse.promise;
    }
    if (path === "/local/learning-teacher-summary") return jsonResponse({ sessions: [] });
    if (path === "/local/learning-parent-contact-intents") return jsonResponse([]);
    if (path === "/local/learning-knowledge") return jsonResponse([]);
    throw new Error(`Unexpected local request: ${path}`);
  };

  try {
    const client = new ParentLearningClient();
    await client.connect("parent-alpha");
    assert.equal(client.snapshot.approvedStudents.length, 1, JSON.stringify(client.snapshot));
    const opening = client.open("student-synthetic-01", 5);
    await openStarted.promise;
    await client.connect("teacher-east");
    assert.equal(client.snapshot.profile, "teacher-east");
    assert.equal(client.snapshot.status, "READY");

    openResponse.resolve(jsonResponse(learningSession("stale-parent-session")));
    await opening;

    assert.equal(client.snapshot.profile, "teacher-east");
    assert.equal(client.snapshot.status, "READY");
    assert.deepEqual(client.snapshot.sessions, []);
    assert.equal(client.snapshot.activeSession, null);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("a pending delete cannot restore page state after disconnect", async () => {
  const { ParentLearningClient } = await loadClient();
  const originalFetch = globalThis.fetch;
  const deleteResponse = deferred<Response>();
  const deleteStarted = deferred<void>();
  globalThis.fetch = async (input, init) => {
    const path = new URL(String(input), "http://127.0.0.1").pathname;
    if (path === "/local/sessions" && init?.method === "POST")
      return jsonResponse({ handle: "a".repeat(43) });
    if (path === "/local/session")
      return jsonResponse({
        profile: "parent-alpha",
        actions: ["learning:enable", "learning:read"],
      });
    if (path === "/local/binding-applications") return jsonResponse(approvedBinding());
    if (path === "/local/learning-sessions" && init?.method === "GET")
      return jsonResponse([learningSession("session-to-delete")]);
    if (path === "/local/learning-parent-controls")
      return jsonResponse({
        students: [
          {
            studentId: "student-synthetic-01",
            studentLabel: "模拟学生甲",
            enabled: true,
            maxDurationMinutes: 15,
            maxHintLevel: 3,
            contactStatus: "NOT_REQUESTED",
          },
        ],
      });
    if (path === "/local/learning-knowledge") return jsonResponse([]);
    if (path === "/local/learning-sessions/session-to-delete/delete") {
      deleteStarted.resolve();
      return deleteResponse.promise;
    }
    throw new Error(`Unexpected local request: ${path}`);
  };

  try {
    const client = new ParentLearningClient();
    await client.connect("parent-alpha");
    const deleting = client.delete("session-to-delete");
    await deleteStarted.promise;
    client.disconnect();
    deleteResponse.resolve(jsonResponse({ deleted: true }));
    await deleting;

    assert.equal(client.snapshot.status, "IDLE");
    assert.deepEqual(client.snapshot.sessions, []);
    assert.equal(client.snapshot.activeSession, null);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("parent controls are loaded, saved and kept inside local learning endpoints", async () => {
  const { ParentLearningClient } = await loadClient();
  const originalFetch = globalThis.fetch;
  const requests: Array<{ path: string; method: string; body: unknown }> = [];
  let control = {
    studentId: "student-synthetic-01",
    studentLabel: "模拟学生甲",
    enabled: true,
    maxDurationMinutes: 15,
    maxHintLevel: 3,
    contactStatus: "NOT_REQUESTED",
  };
  globalThis.fetch = async (input, init) => {
    const path = new URL(String(input), "http://127.0.0.1").pathname;
    const method = init?.method ?? "GET";
    const body = typeof init?.body === "string" ? (JSON.parse(init.body) as unknown) : undefined;
    requests.push({ path, method, body });
    if (path === "/local/sessions" && method === "POST")
      return jsonResponse({ handle: "a".repeat(43) });
    if (path === "/local/session")
      return jsonResponse({
        profile: "parent-alpha",
        actions: ["learning:enable", "learning:read"],
      });
    if (path === "/local/binding-applications") return jsonResponse(approvedBinding());
    if (path === "/local/learning-sessions") return jsonResponse([]);
    if (path === "/local/learning-parent-controls") return jsonResponse({ students: [control] });
    if (path === "/local/learning-parent-controls/student-synthetic-01" && method === "POST") {
      if (isObject(body)) control = { ...control, ...body } as typeof control;
      return jsonResponse(control);
    }
    if (path === "/local/learning-parent-contact/student-synthetic-01")
      return jsonResponse({ studentId: control.studentId, status: "RECORDED_LOCAL" }, 201);
    if (path === "/local/learning-knowledge") return jsonResponse([]);
    throw new Error(`Unexpected local request: ${method} ${path}`);
  };

  try {
    const client = new ParentLearningClient();
    await client.connect("parent-alpha");
    const controls = Reflect.get(client.snapshot, "parentControls");
    assert.equal(Array.isArray(controls), true);
    assert.equal(Array.isArray(controls) ? Reflect.get(controls[0], "enabled") : undefined, true);

    const saveControls = Reflect.get(client, "updateParentControls") as
      ((studentId: string, value: unknown) => Promise<void>) | undefined;
    assert.equal(typeof saveControls, "function");
    if (!saveControls) return;
    await saveControls.call(client, "student-synthetic-01", {
      enabled: false,
      maxDurationMinutes: 5,
      maxHintLevel: 1,
    });
    const contactTeacher = Reflect.get(client, "contactTeacher") as
      ((studentId: string) => Promise<void>) | undefined;
    assert.equal(typeof contactTeacher, "function");
    if (!contactTeacher) return;
    await contactTeacher.call(client, "student-synthetic-01");

    assert.ok(
      requests.some(
        (request) =>
          request.path === "/local/learning-parent-controls/student-synthetic-01" &&
          request.method === "POST" &&
          isObject(request.body) &&
          request.body.enabled === false &&
          request.body.maxDurationMinutes === 5,
      ),
    );
    assert.ok(
      requests.some(
        (request) =>
          request.path === "/local/learning-parent-contact/student-synthetic-01" &&
          request.method === "POST",
      ),
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("a failed parent refresh clears previously displayed child learning data", async () => {
  const { ParentLearningClient } = await loadClient();
  const originalFetch = globalThis.fetch;
  let failControls = false;
  globalThis.fetch = async (input, init) => {
    const path = new URL(String(input), "http://127.0.0.1").pathname;
    if (path === "/local/sessions" && init?.method === "POST")
      return jsonResponse({ handle: "a".repeat(43) });
    if (path === "/local/session")
      return jsonResponse({
        profile: "parent-alpha",
        actions: ["learning:enable", "learning:read"],
      });
    if (path === "/local/binding-applications") return jsonResponse(approvedBinding());
    if (path === "/local/learning-sessions") return jsonResponse([learningSession("old-session")]);
    if (path === "/local/learning-parent-controls")
      return failControls
        ? jsonResponse({ error: "temporarily unavailable" }, 503)
        : jsonResponse({ students: [] });
    if (path === "/local/learning-knowledge") return jsonResponse([]);
    throw new Error(`Unexpected local request: ${path}`);
  };

  try {
    const client = new ParentLearningClient();
    await client.connect("parent-alpha");
    assert.equal(client.snapshot.approvedStudents.length, 1);
    assert.equal(client.snapshot.sessions.length, 1);

    failControls = true;
    await client.refresh();

    assert.equal(client.snapshot.status, "DENIED");
    assert.deepEqual(client.snapshot.approvedStudents, []);
    assert.deepEqual(client.snapshot.knowledgeResources, []);
    assert.deepEqual(client.snapshot.sessions, []);
    assert.deepEqual(client.snapshot.teacherSummary, []);
    assert.deepEqual(client.snapshot.parentControls, []);
    assert.deepEqual(client.snapshot.parentContactIntents, []);
    assert.equal(client.snapshot.activeSession, null);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("the most recent parent refresh wins when earlier requests finish later", async () => {
  const { ParentLearningClient } = await loadClient();
  const originalFetch = globalThis.fetch;
  const firstRefresh = deferred<Response>();
  const firstRefreshStarted = deferred<void>();
  let bindingReads = 0;
  globalThis.fetch = async (input, init) => {
    const path = new URL(String(input), "http://127.0.0.1").pathname;
    if (path === "/local/sessions" && init?.method === "POST")
      return jsonResponse({ handle: "a".repeat(43) });
    if (path === "/local/session")
      return jsonResponse({
        profile: "parent-alpha",
        actions: ["learning:enable", "learning:read"],
      });
    if (path === "/local/binding-applications") {
      bindingReads += 1;
      if (bindingReads === 2) {
        firstRefreshStarted.resolve();
        return firstRefresh.promise;
      }
      return jsonResponse([
        {
          status: "APPROVED",
          studentId: "student-synthetic-02",
          studentLabel: "模拟学生乙",
          classLabel: "三年级 A 班",
        },
      ]);
    }
    if (path === "/local/learning-sessions") return jsonResponse([]);
    if (path === "/local/learning-parent-controls") return jsonResponse({ students: [] });
    if (path === "/local/learning-knowledge") return jsonResponse([]);
    throw new Error(`Unexpected local request: ${path}`);
  };

  try {
    const client = new ParentLearningClient();
    await client.connect("parent-alpha");
    const earlier = client.refresh();
    await firstRefreshStarted.promise;
    await client.refresh();
    assert.equal(client.snapshot.approvedStudents[0]?.studentId, "student-synthetic-02");

    firstRefresh.resolve(jsonResponse(approvedBinding()));
    await earlier;

    assert.equal(
      client.snapshot.approvedStudents[0]?.studentId,
      "student-synthetic-02",
      "an older refresh must not replace the latest approved relationship list",
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("parent refresh loads only the approved-child learning summary projection", async () => {
  const { ParentLearningClient } = await loadClient();
  const originalFetch = globalThis.fetch;
  const requested: string[] = [];
  const summary = {
    students: [
      {
        studentId: "student-synthetic-01",
        studentLabel: "模拟学生甲",
        usedMinutes: 7,
        sessionCount: 2,
        completedSessions: 1,
        knowledgePoints: [{ label: "两位数加法与进位", sessionCount: 2, completedSessions: 1 }],
        attentionCount: 1,
      },
    ],
  };
  globalThis.fetch = async (input, init) => {
    const path = new URL(String(input), "http://127.0.0.1").pathname;
    requested.push(path);
    if (path === "/local/sessions" && init?.method === "POST")
      return jsonResponse({ handle: "a".repeat(43) });
    if (path === "/local/session")
      return jsonResponse({
        profile: "parent-alpha",
        actions: ["learning:enable", "learning:read"],
      });
    if (path === "/local/binding-applications") return jsonResponse(approvedBinding());
    if (path === "/local/learning-sessions") return jsonResponse([]);
    if (path === "/local/learning-parent-controls")
      return jsonResponse({
        students: [],
        parentSummary: summary.students,
        parentSummaryUpdatedAt: "2026-10-12T03:00:00.000Z",
      });
    if (path === "/local/learning-knowledge") return jsonResponse([]);
    throw new Error(`Unexpected local request: ${path}`);
  };

  try {
    const client = new ParentLearningClient();
    await client.connect("parent-alpha");
    assert.equal(client.snapshot.approvedStudents[0]?.studentId, "student-synthetic-01");
    assert.deepEqual(Reflect.get(client.snapshot, "parentSummary"), summary.students);
    assert.equal(
      Reflect.get(client.snapshot, "parentSummaryUpdatedAt"),
      "2026-10-12T03:00:00.000Z",
    );
    assert.ok(requested.includes("/local/learning-parent-controls"));
  } finally {
    globalThis.fetch = originalFetch;
  }
});
