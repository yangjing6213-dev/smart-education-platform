import assert from "node:assert/strict";
import test from "node:test";
import { buildLocalSyntheticServer } from "../src/local-synthetic/server.js";

type App = Awaited<ReturnType<typeof buildLocalSyntheticServer>>;
type Json = {
  [key: string]: unknown;
  id: string;
  version: number;
  handle: string;
  credential: string;
  attendanceId: string;
  attendanceVersion: number;
  recipient: string;
  status: string;
};
type InjectResponse = {
  statusCode: number;
  body: string;
  json(): unknown;
};
const attendance = "/local/attendance-records";
const authorizations = "/local/pickup-authorizations";
const verifications = "/local/pickup-verifications";
const records = "/local/pickup-records";
const exceptions = "/local/pickup-exceptions";

async function call(app: App, actor: string, method: "GET" | "POST", url: string, body?: unknown) {
  return app.inject({
    method,
    url,
    headers: { host: "127.0.0.1:4317", ...(actor ? { authorization: `Bearer ${actor}` } : {}) },
    ...(body === undefined ? {} : { payload: body as object }),
  } as never) as unknown as Promise<InjectResponse>;
}
async function session(app: App, profile: string) {
  const response = await call(app, "", "POST", "/local/sessions", { profile });
  assert.equal(response.statusCode, 201, response.body);
  return (response.json() as { handle: string }).handle;
}
async function json(app: App, actor: string, method: "GET" | "POST", url: string, body?: unknown) {
  const response = await call(app, actor, method, url, body);
  assert.ok(response.statusCode < 500, `${url}: ${response.body}`);
  return { response, value: response.json() as Json | Json[] };
}
async function bind(app: App, parent: string, owner: string, student = "student-alpha") {
  const applied = await json(app, parent, "POST", "/local/binding-applications", {
    student,
    relationship: "GUARDIAN",
  });
  assert.equal(applied.response.statusCode, 201, applied.response.body);
  const reviewed = await json(
    app,
    owner,
    "POST",
    `/local/binding-applications/${(applied.value as Json).id}/review`,
    { version: (applied.value as Json).version, action: "approve" },
  );
  assert.equal(reviewed.response.statusCode, 200, reviewed.response.body);
  return reviewed.value as Json;
}
async function arrived(app: App, teacher: string, date = "2026-10-12") {
  const created = await json(app, teacher, "POST", attendance, {
    student: "student-alpha",
    date,
    status: "NOT_ARRIVED",
    time: null,
  });
  assert.equal(created.response.statusCode, 201, created.response.body);
  const row = await json(
    app,
    teacher,
    "POST",
    `${attendance}/${(created.value as Json).id}/arrive`,
    {
      version: (created.value as Json).version,
      time: "08:00",
    },
  );
  assert.equal(row.response.statusCode, 200, row.response.body);
  return row.value as Json;
}
async function activeAuthorization(app: App, parent: string, bindingId: string) {
  const draft = await json(app, parent, "POST", authorizations, {
    bindingId,
    recipient: "pickup-alpha",
    type: "TEMPORARY",
    startDate: "2026-10-12",
    endDate: "2026-10-12",
    startTime: "08:00",
    endTime: "18:00",
  });
  assert.equal(draft.response.statusCode, 201, draft.response.body);
  const active = await json(
    app,
    parent,
    "POST",
    `${authorizations}/${(draft.value as Json).id}/activate`,
    {
      version: (draft.value as Json).version,
    },
  );
  assert.equal(active.response.statusCode, 200, active.response.body);
  return active.value as Json;
}

test("pickup closes the authorization, human verification, parent result and immutable same-day guard", async () => {
  const app = await buildLocalSyntheticServer({
    mode: "local-synthetic",
    now: () => Date.parse("2026-10-12T01:00:00.000Z"),
  });
  try {
    const parent = await session(app, "parent-alpha");
    const teacher = await session(app, "teacher-east");
    const owner = await session(app, "owner-east");
    const binding = await bind(app, parent, owner);
    const attendanceRow = await arrived(app, teacher);
    const authorization = await activeAuthorization(app, parent, binding.id);
    const issued = await json(
      app,
      parent,
      "POST",
      `${authorizations}/${authorization.id}/credential`,
      {
        version: authorization.version,
      },
    );
    assert.equal(issued.response.statusCode, 200, issued.response.body);
    assert.equal(typeof (issued.value as Json).credential, "string");
    const listed = await json(app, parent, "GET", authorizations);
    assert.equal(JSON.stringify(listed.value).includes((issued.value as Json).credential), false);

    const step = await json(app, teacher, "POST", verifications, {
      student: "student-alpha",
      credential: (issued.value as Json).credential,
    });
    assert.equal(step.response.statusCode, 201, step.response.body);
    assert.equal(Object.hasOwn(step.value as Json, "credential"), false);
    const confirmed = await json(
      app,
      teacher,
      "POST",
      `${verifications}/${(step.value as Json).id}/confirm`,
      {
        version: (step.value as Json).version,
        checks: { student: true, recipient: true, authorization: true },
      },
    );
    assert.equal(confirmed.response.statusCode, 200, confirmed.response.body);
    assert.equal((confirmed.value as Json).recipient, "示例接送人甲");
    assert.equal(Object.hasOwn(confirmed.value as Json, "teacherId"), false);
    assert.equal(
      ((await json(app, teacher, "GET", `${attendance}/${attendanceRow.id}`)).value as Json).status,
      "DEPARTED",
    );
    const parentRecords = await json(app, parent, "GET", records);
    assert.equal((parentRecords.value as Json[]).length, 1);
    assert.equal(Object.hasOwn((parentRecords.value as Json[])[0]!, "authorizationId"), false);
    assert.equal(
      (
        await call(app, teacher, "POST", `${verifications}/${(step.value as Json).id}/confirm`, {
          version: (step.value as Json).version,
          checks: { student: true, recipient: true, authorization: true },
        })
      ).statusCode,
      403,
    );
    const secondCredential = await json(
      app,
      parent,
      "POST",
      `${authorizations}/${authorization.id}/credential`,
      {
        version: authorization.version,
      },
    );
    assert.equal(
      (
        await call(app, teacher, "POST", verifications, {
          student: "student-alpha",
          credential: (secondCredential.value as Json).credential,
        })
      ).statusCode,
      409,
    );
  } finally {
    await app.close();
  }
});

test("time windows, credential rotation and atomic attendance conflict do not create a pickup", async () => {
  let clock = Date.parse("2026-10-12T01:00:00.000Z");
  const app = await buildLocalSyntheticServer({ mode: "local-synthetic", now: () => clock });
  try {
    const parent = await session(app, "parent-alpha");
    const teacher = await session(app, "teacher-east");
    const owner = await session(app, "owner-east");
    const binding = await bind(app, parent, owner);
    await arrived(app, teacher);
    const authorization = await activeAuthorization(app, parent, binding.id);
    const first = await json(
      app,
      parent,
      "POST",
      `${authorizations}/${authorization.id}/credential`,
      {
        version: authorization.version,
      },
    );
    const second = await json(
      app,
      parent,
      "POST",
      `${authorizations}/${authorization.id}/credential`,
      {
        version: authorization.version,
      },
    );
    assert.equal(
      (
        await call(app, teacher, "POST", verifications, {
          student: "student-alpha",
          credential: (first.value as Json).credential,
        })
      ).statusCode,
      409,
    );
    const step = await json(app, teacher, "POST", verifications, {
      student: "student-alpha",
      credential: (second.value as Json).credential,
    });
    const correction = await json(
      app,
      teacher,
      "POST",
      `${attendance}/${(step.value as Json).attendanceId}/correction`,
      {
        version: (step.value as Json).attendanceVersion,
        reason: "TIME_ENTRY_ERROR",
        proposed: { status: "ARRIVED", arrivalTime: "08:05", departureTime: null },
      },
    );
    assert.equal(correction.response.statusCode, 200, correction.response.body);
    const confirmed = await call(
      app,
      teacher,
      "POST",
      `${verifications}/${(step.value as Json).id}/confirm`,
      {
        version: (step.value as Json).version,
        checks: { student: true, recipient: true, authorization: true },
      },
    );
    assert.equal(confirmed.statusCode, 409, confirmed.body);
    assert.equal(((await json(app, teacher, "GET", records)).value as Json[]).length, 0);
    assert.equal(
      (
        (await json(app, teacher, "GET", `${attendance}/${(step.value as Json).attendanceId}`))
          .value as Json
      ).status,
      "ARRIVED",
    );
    clock = Date.parse("2026-10-12T01:06:00.000Z");
    const expired = await call(app, teacher, "POST", verifications, {
      student: "student-alpha",
      credential: (second.value as Json).credential,
    });
    assert.equal(expired.statusCode, 409);
  } finally {
    await app.close();
  }
});

test("exceptions are separate from successful pickup and only owner resolves fixed outcomes", async () => {
  const app = await buildLocalSyntheticServer({
    mode: "local-synthetic",
    now: () => Date.parse("2026-10-12T01:00:00.000Z"),
  });
  try {
    const teacher = await session(app, "teacher-east");
    const owner = await session(app, "owner-east");
    const created = await json(app, teacher, "POST", exceptions, {
      student: "student-alpha",
      date: "2026-10-12",
      category: "NO_AUTHORIZATION",
    });
    assert.equal(created.response.statusCode, 201, created.response.body);
    const followed = await json(
      app,
      owner,
      "POST",
      `${exceptions}/${(created.value as Json).id}/review`,
      {
        version: (created.value as Json).version,
        action: "follow",
        outcome: "CONTACT_GUARDIAN",
      },
    );
    assert.equal(followed.response.statusCode, 200, followed.response.body);
    const resolved = await json(
      app,
      owner,
      "POST",
      `${exceptions}/${(followed.value as Json).id}/review`,
      {
        version: (followed.value as Json).version,
        action: "resolve",
        outcome: "ARRANGEMENT_CONFIRMED",
      },
    );
    assert.equal(resolved.response.statusCode, 200, resolved.response.body);
    assert.equal((resolved.value as Json).status, "RESOLVED");
    assert.equal((await json(app, teacher, "GET", records)).value instanceof Array, true);
    assert.equal(
      (
        await call(app, teacher, "POST", `${exceptions}/${(resolved.value as Json).id}/review`, {
          version: (resolved.value as Json).version,
          action: "resolve",
          outcome: "ARRANGEMENT_CONFIRMED",
        })
      ).statusCode,
      403,
    );
  } finally {
    await app.close();
  }
});

test("forged client scope and unknown aliases cannot probe or create pickup state", async () => {
  const app = await buildLocalSyntheticServer({
    mode: "local-synthetic",
    now: () => Date.parse("2026-10-12T01:00:00.000Z"),
  });
  try {
    const parent = await session(app, "parent-alpha");
    const otherTeacher = await session(app, "teacher-other-class");
    const invalids = [
      [{ student: "unknown", date: "2026-10-12", category: "NO_AUTHORIZATION" }, 403],
      [{ student: "student-alpha", date: "2026-10-12", category: "free-text" }, 400],
      [
        {
          student: "student-alpha",
          date: "2026-10-12",
          category: "NO_AUTHORIZATION",
          tenantId: "other",
        },
        400,
      ],
    ] as const;
    for (const [body, status] of invalids)
      assert.equal((await call(app, otherTeacher, "POST", exceptions, body)).statusCode, status);
    assert.equal((await call(app, parent, "GET", authorizations)).statusCode, 200);
    assert.equal((await call(app, otherTeacher, "GET", records)).statusCode, 200);
  } finally {
    await app.close();
  }
});

test("pickup confirmation rejects a departure earlier than the recorded arrival", async () => {
  const app = await buildLocalSyntheticServer({
    mode: "local-synthetic",
    now: () => Date.parse("2026-10-12T01:00:00.000Z"),
  });
  try {
    const parent = await session(app, "parent-alpha");
    const teacher = await session(app, "teacher-east");
    const owner = await session(app, "owner-east");
    const binding = await bind(app, parent, owner);
    const arrivedLate = await json(app, teacher, "POST", attendance, {
      student: "student-alpha",
      date: "2026-10-12",
      status: "ARRIVED",
      time: "23:00",
    });
    assert.equal(arrivedLate.response.statusCode, 201, arrivedLate.response.body);
    const authorization = await activeAuthorization(app, parent, binding.id);
    const issued = await json(
      app,
      parent,
      "POST",
      `${authorizations}/${authorization.id}/credential`,
      { version: authorization.version },
    );
    const step = await json(app, teacher, "POST", verifications, {
      student: "student-alpha",
      credential: (issued.value as Json).credential,
    });
    const confirmed = await call(
      app,
      teacher,
      "POST",
      `${verifications}/${(step.value as Json).id}/confirm`,
      {
        version: (step.value as Json).version,
        checks: { student: true, recipient: true, authorization: true },
      },
    );
    assert.equal(confirmed.statusCode, 409, confirmed.body);
    assert.equal(((await json(app, teacher, "GET", records)).value as Json[]).length, 0);
  } finally {
    await app.close();
  }
});

test("regular authorization applies its daily window on every Shanghai date", async () => {
  let clock = Date.parse("2026-10-12T01:00:00.000Z");
  const app = await buildLocalSyntheticServer({ mode: "local-synthetic", now: () => clock });
  try {
    let parent = await session(app, "parent-alpha");
    const owner = await session(app, "owner-east");
    const binding = await bind(app, parent, owner);
    const draft = await json(app, parent, "POST", authorizations, {
      bindingId: binding.id,
      recipient: "pickup-alpha",
      type: "REGULAR",
      startDate: "2026-10-12",
      endDate: "2026-10-14",
      startTime: "08:00",
      endTime: "18:00",
    });
    assert.equal(draft.response.statusCode, 201, draft.response.body);
    const active = await json(
      app,
      parent,
      "POST",
      `${authorizations}/${(draft.value as Json).id}/activate`,
      { version: (draft.value as Json).version },
    );
    assert.equal(active.response.statusCode, 200, active.response.body);
    const isValid = async () =>
      ((await json(app, parent, "GET", authorizations)).value as Json[])[0]?.currentlyValid;
    assert.equal(await isValid(), true);
    clock = Date.parse("2026-10-12T23:59:00.000Z"); // 07:59 Shanghai, middle day
    parent = await session(app, "parent-alpha");
    assert.equal(await isValid(), false);
    clock = Date.parse("2026-10-13T00:00:00.000Z"); // 08:00 Shanghai
    parent = await session(app, "parent-alpha");
    assert.equal(await isValid(), true);
    clock = Date.parse("2026-10-13T10:00:00.000Z"); // 18:00 Shanghai
    parent = await session(app, "parent-alpha");
    assert.equal(await isValid(), true);
    clock = Date.parse("2026-10-13T10:01:00.000Z"); // 18:01 Shanghai, middle day
    parent = await session(app, "parent-alpha");
    assert.equal(await isValid(), false);
    clock = Date.parse("2026-10-14T10:01:00.000Z"); // end date after daily window
    parent = await session(app, "parent-alpha");
    assert.equal(await isValid(), false);
  } finally {
    await app.close();
  }
});

test("platform pickup summary returns aggregate counts only with summary permission", async () => {
  const app = await buildLocalSyntheticServer({ mode: "local-synthetic" });
  try {
    const teacher = await session(app, "teacher-east");
    const owner = await session(app, "owner-east");
    const platform = await session(app, "platform-admin");
    const created = await json(app, teacher, "POST", exceptions, {
      student: "student-alpha",
      date: "2026-10-12",
      category: "NO_AUTHORIZATION",
    });
    assert.equal(created.response.statusCode, 201, created.response.body);
    const followed = await json(
      app,
      owner,
      "POST",
      `${exceptions}/${(created.value as Json).id}/review`,
      {
        version: (created.value as Json).version,
        action: "follow",
        outcome: "CONTACT_GUARDIAN",
      },
    );
    assert.equal(followed.response.statusCode, 200, followed.response.body);

    const result = await json(app, platform, "GET", "/local/pickup-summary");
    assert.equal(result.response.statusCode, 200, result.response.body);
    assert.deepEqual(result.value, {
      synthetic: true,
      counts: {
        activeAuthorizations: 0,
        completedRecords: 0,
        openExceptions: 0,
        followingExceptions: 1,
        resolvedExceptions: 0,
      },
    });
    assert.equal(JSON.stringify(result.value).includes("student"), false);
    assert.equal(JSON.stringify(result.value).includes((created.value as Json).id), false);
    assert.equal((await call(app, owner, "GET", "/local/pickup-summary")).statusCode, 403);
    assert.equal((await call(app, teacher, "GET", "/local/pickup-summary")).statusCode, 403);
  } finally {
    await app.close();
  }
});
