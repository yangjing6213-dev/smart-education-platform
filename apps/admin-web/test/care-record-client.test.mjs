import assert from "node:assert/strict";
import { resolve } from "node:path";
import process from "node:process";
import test from "node:test";
import { fileURLToPath, pathToFileURL, URL } from "node:url";

async function startServer() {
  const root =
    process.env.LOCAL_SYNTHETIC_CORE_ROOT ?? fileURLToPath(new URL("../../..", import.meta.url));
  const moduleUrl = pathToFileURL(
    resolve(root, "apps/api/dist/src/local-synthetic/server.js"),
  ).href;
  const { buildLocalSyntheticServer } = await import(moduleUrl);
  const server = await buildLocalSyntheticServer({ mode: "local-synthetic" });
  return { server, baseUrl: await server.start(0) };
}

async function request(baseUrl, profile, path, method = "GET", body) {
  const session = await globalThis.fetch(`${baseUrl}/local/sessions`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ profile }),
  });
  assert.equal(session.status, 201);
  const { handle } = await session.json();
  const response = await globalThis.fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      authorization: `Bearer ${handle}`,
      ...(body ? { "content-type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return { response, data: await response.json() };
}

test("Admin client reviews, publishes, revokes and scopes the same service record", async (t) => {
  const { server, baseUrl } = await startServer();
  t.after(() => server.close());
  const values = {
    arrival: "ARRIVED_AS_PLANNED",
    homework: "COMPLETED",
    meal: "FINISHED",
    rest: "RESTED",
    activity: "PARTICIPATED",
    wellbeing: "ROUTINE",
  };
  const created = await request(baseUrl, "teacher-east", "/local/care-records", "POST", {
    student: "student-alpha",
    date: "2026-10-10",
    values,
  });
  assert.equal(created.response.status, 201);
  const draft = created.data;
  const submitted = await request(
    baseUrl,
    "teacher-east",
    `/local/care-records/${draft.id}/submit`,
    "POST",
    { version: draft.version },
  );
  assert.equal(submitted.response.status, 200);

  const pendingBinding = await request(
    baseUrl,
    "parent-alpha",
    "/local/binding-applications",
    "POST",
    { student: "student-alpha", relationship: "GUARDIAN" },
  );
  assert.equal(pendingBinding.response.status, 201);
  const approvedBinding = await request(
    baseUrl,
    "owner-east",
    `/local/binding-applications/${pendingBinding.data.id}/review`,
    "POST",
    { version: pendingBinding.data.version, action: "approve" },
  );
  assert.equal(approvedBinding.response.status, 200);

  const { CareRecordReviewClient } = await import("../dist/local-review/care-record-client.js");
  const client = new CareRecordReviewClient({ baseUrl });
  await client.connect("owner-east");
  assert.equal(client.snapshot.status, "READY");
  assert.equal(
    client.snapshot.records.find((record) => record.id === draft.id)?.status,
    "SUBMITTED",
  );
  await client.review(draft.id, submitted.data.version, "CONFIRM");
  assert.equal(
    client.snapshot.records.find((record) => record.id === draft.id)?.status,
    "CONFIRMED",
  );
  await client.publish(
    draft.id,
    client.snapshot.records.find((record) => record.id === draft.id).version,
  );
  assert.equal(client.snapshot.records.find((record) => record.id === draft.id)?.published, true);

  const parent = await request(baseUrl, "parent-alpha", "/local/care-records");
  assert.equal(parent.data[0]?.id, draft.id);
  await client.revoke(
    draft.id,
    client.snapshot.records.find((record) => record.id === draft.id).version,
  );
  const hidden = await request(baseUrl, "parent-alpha", "/local/care-records");
  assert.deepEqual(hidden.data, []);

  const west = new CareRecordReviewClient({ baseUrl });
  await west.connect("owner-west");
  assert.equal(
    west.snapshot.records.some((record) => record.id === draft.id),
    false,
  );
});

test("Admin client only accepts fixed synthetic owner profiles", async () => {
  const { CareRecordReviewClient, createCareRecordReviewTransport } =
    await import("../dist/local-review/care-record-client.js");
  const client = new CareRecordReviewClient({ baseUrl: "http://127.0.0.1:4317" });
  await client.connect("teacher-east");
  assert.equal(client.snapshot.status, "DENIED");
  assert.deepEqual(client.snapshot.records, []);

  let sent = 0;
  const transport = createCareRecordReviewTransport("http://127.0.0.1:4317", async () => {
    sent += 1;
    return globalThis.Response.json([]);
  });
  const response = await transport("/local/leave-requests", { method: "GET" });
  assert.equal(response.status, 403);
  assert.equal(sent, 0);
});

const careValues = {
  arrival: "ARRIVED_AS_PLANNED",
  homework: "COMPLETED",
  meal: "FINISHED",
  rest: "RESTED",
  activity: "PARTICIPATED",
  wellbeing: "ROUTINE",
};

async function seedSubmitted(baseUrl, student = "student-alpha") {
  const created = await request(baseUrl, "teacher-east", "/local/care-records", "POST", {
    student,
    date: "2026-10-12",
    values: careValues,
  });
  assert.equal(created.response.status, 201);
  const submitted = await request(
    baseUrl,
    "teacher-east",
    `/local/care-records/${created.data.id}/submit`,
    "POST",
    { version: created.data.version },
  );
  assert.equal(submitted.response.status, 200);
  return submitted.data;
}

test("Admin records retain distinct student labels for the same date", async (t) => {
  const { server, baseUrl } = await startServer();
  t.after(() => server.close());
  const alpha = await seedSubmitted(baseUrl);
  const beta = await seedSubmitted(baseUrl, "student-beta");
  const { CareRecordReviewClient } = await import("../dist/local-review/care-record-client.js");
  const client = new CareRecordReviewClient({ baseUrl });
  await client.connect("owner-east");
  assert.equal(client.snapshot.status, "READY");
  assert.deepEqual(
    client.snapshot.records.map(({ id, date, studentLabel }) => [id, date, studentLabel]),
    [
      [alpha.id, "2026-10-12", "示例学生甲"],
      [beta.id, "2026-10-12", "示例学生乙"],
    ],
  );
});

test("Admin rejects blank or oversized student labels and clears old identity", async (t) => {
  const { server, baseUrl } = await startServer();
  t.after(() => server.close());
  await seedSubmitted(baseUrl);
  const { CareRecordReviewClient } = await import("../dist/local-review/care-record-client.js");
  let invalidLabel;
  const client = new CareRecordReviewClient({
    baseUrl,
    fetcher: async (input, init) => {
      const response = await globalThis.fetch(input, init);
      if (new URL(input).pathname === "/local/care-records" && invalidLabel !== undefined) {
        const rows = await response.json();
        rows[0].studentLabel = invalidLabel;
        return globalThis.Response.json(rows);
      }
      return response;
    },
  });
  for (const label of ["   ", "示".repeat(81)]) {
    invalidLabel = undefined;
    await client.connect("owner-east");
    assert.equal(client.snapshot.records.length, 1);
    invalidLabel = label;
    await client.refresh();
    assert.equal(client.snapshot.status, "ERROR");
    assert.deepEqual(client.snapshot.records, []);
    assert.equal(client.snapshot.actor, null);
    invalidLabel = undefined;
    await client.refresh();
    assert.equal(client.snapshot.status, "READY");
  }
});

test("Admin pending review cannot be bypassed by refresh or repeated writes", async (t) => {
  const { server, baseUrl } = await startServer();
  t.after(() => server.close());
  const row = await seedSubmitted(baseUrl);
  const { CareRecordReviewClient } = await import("../dist/local-review/care-record-client.js");
  const gate = Promise.withResolvers();
  const entered = Promise.withResolvers();
  const calls = [];
  let hold = true;
  const client = new CareRecordReviewClient({
    baseUrl,
    fetcher: async (input, init) => {
      const path = new URL(input).pathname;
      calls.push([init.method, path]);
      if (path.endsWith("/review") && hold) {
        hold = false;
        entered.resolve();
        await gate.promise;
      }
      return globalThis.fetch(input, init);
    },
  });
  await client.connect("owner-east");
  const pending = client.review(row.id, row.version, "CONFIRM");
  await entered.promise;
  const busySnapshot = client.snapshot;
  const count = calls.length;
  try {
    await client.refresh();
    await client.review(row.id, row.version, "CONFIRM");
    assert.equal(calls.length, count, "pending review must block refresh and duplicate review");
    assert.equal(busySnapshot.status, "BUSY");
    assert.deepEqual(busySnapshot.records, []);
  } finally {
    gate.resolve();
    await pending;
  }
  assert.equal(client.snapshot.status, "READY");
  assert.equal(client.snapshot.records[0].status, "CONFIRMED");
});

test("Admin pending list refresh clears old rows and blocks another refresh", async (t) => {
  const { server, baseUrl } = await startServer();
  t.after(() => server.close());
  const row = await seedSubmitted(baseUrl);
  const { CareRecordReviewClient } = await import("../dist/local-review/care-record-client.js");
  const gate = Promise.withResolvers();
  const entered = Promise.withResolvers();
  let hold = false;
  let reads = 0;
  let writes = 0;
  const client = new CareRecordReviewClient({
    baseUrl,
    fetcher: async (input, init) => {
      const path = new URL(input).pathname;
      if (path.endsWith("/review")) writes += 1;
      if (path === "/local/care-records") {
        reads += 1;
        if (hold) {
          hold = false;
          entered.resolve();
          await gate.promise;
        }
      }
      return globalThis.fetch(input, init);
    },
  });
  await client.connect("owner-east");
  hold = true;
  const pending = client.refresh();
  await entered.promise;
  const busySnapshot = client.snapshot;
  try {
    await client.refresh();
    await client.review(row.id, row.version, "CONFIRM");
    assert.equal(reads, 2, "a pending refresh must not send a second list request");
    assert.equal(writes, 0);
    assert.equal(busySnapshot.status, "BUSY");
    assert.deepEqual(busySnapshot.records, []);
  } finally {
    gate.resolve();
    await pending;
  }
  assert.equal(client.snapshot.records[0].status, "SUBMITTED");
});

test("Admin failures require a new session and never replay a failed review", async (t) => {
  const { server, baseUrl } = await startServer();
  t.after(() => server.close());
  const row = await seedSubmitted(baseUrl);
  const { CareRecordReviewClient } = await import("../dist/local-review/care-record-client.js");
  let failure = null;
  let sessions = 0;
  let reviews = 0;
  const client = new CareRecordReviewClient({
    baseUrl,
    fetcher: async (input, init) => {
      const path = new URL(input).pathname;
      if (path === "/local/sessions") sessions += 1;
      if (path.endsWith("/review")) reviews += 1;
      if (failure && path === failure.path) {
        const response = globalThis.Response.json(
          { error: { code: failure.code } },
          { status: failure.status },
        );
        failure = null;
        return response;
      }
      return globalThis.fetch(input, init);
    },
  });
  await client.connect("owner-east");
  for (const scenario of [
    { path: "/local/care-records", code: "REQUEST_FAILED", status: 503, state: "ERROR" },
    {
      path: `/local/care-records/${row.id}/review`,
      code: "REQUEST_FAILED",
      status: 503,
      state: "ERROR",
    },
    { path: "/local/care-records", code: "UNAVAILABLE", status: 403, state: "DENIED" },
  ]) {
    failure = scenario;
    if (scenario.path.endsWith("/review")) await client.review(row.id, row.version, "CONFIRM");
    else await client.refresh();
    const failed = client.snapshot;
    const previousSessions = sessions;
    const previousReviews = reviews;
    await client.refresh();
    assert.equal(sessions, previousSessions + 1, "retry must establish a fresh session");
    assert.equal(failed.status, scenario.state);
    assert.deepEqual(failed.records, []);
    assert.equal(failed.actor, null);
    assert.equal(client.snapshot.status, "READY");
    assert.equal(client.snapshot.records[0].status, "SUBMITTED");
    assert.equal(reviews, previousReviews, "reconnect must not replay a write");
  }
});

test("Admin late bootstrap cannot read identity after disconnect or a new connection", async (t) => {
  const { server, baseUrl } = await startServer();
  t.after(() => server.close());
  const { CareRecordReviewClient } = await import("../dist/local-review/care-record-client.js");
  for (const reconnect of [false, true]) {
    const gate = Promise.withResolvers();
    const entered = Promise.withResolvers();
    const calls = [];
    let hold = true;
    const client = new CareRecordReviewClient({
      baseUrl,
      fetcher: async (input, init) => {
        const path = new URL(input).pathname;
        calls.push(path);
        const response = await globalThis.fetch(input, init);
        if (path === "/local/sessions" && hold) {
          hold = false;
          entered.resolve();
          await gate.promise;
        }
        return response;
      },
    });
    const pending = client.connect("owner-east");
    await entered.promise;
    if (reconnect) await client.connect("owner-west");
    else client.disconnect();
    const snapshot = client.snapshot;
    const count = calls.length;
    gate.resolve();
    await pending;
    assert.equal(calls.length, count, "late bootstrap must not read its old session");
    assert.deepEqual(client.snapshot, snapshot);
  }
});
