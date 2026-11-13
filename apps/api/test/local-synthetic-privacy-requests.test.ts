import assert from "node:assert/strict";
import test from "node:test";
import { buildLocalSyntheticServer } from "../src/local-synthetic/server.js";

type App = Awaited<ReturnType<typeof buildLocalSyntheticServer>>;
type PrivacyRequest = {
  id: string;
  version: number;
  type: "ACCESS" | "CORRECT" | "COPY" | "DELETE";
  status: string;
  dataChanged: boolean;
  history: { action: string; actorId: string; version: number }[];
};
type Response = { statusCode: number; body: string; json(): unknown };

async function call(app: App, actor: string, method: "GET" | "POST", url: string, body?: unknown) {
  return app.inject({
    method,
    url,
    headers: { host: "127.0.0.1:4317", ...(actor ? { authorization: `Bearer ${actor}` } : {}) },
    ...(body === undefined ? {} : { payload: body as object }),
  } as never) as unknown as Promise<Response>;
}

async function session(app: App, profile: string) {
  const response = await call(app, "", "POST", "/local/sessions", { profile });
  assert.equal(response.statusCode, 201, response.body);
  return (response.json() as { handle: string }).handle;
}

async function approvedBinding(app: App, parent: string, owner: string) {
  const created = await call(app, parent, "POST", "/local/binding-applications", {
    student: "student-alpha",
    relationship: "GUARDIAN",
  });
  assert.equal(created.statusCode, 201, created.body);
  const pending = created.json() as { id: string; version: number };
  const approved = await call(
    app,
    owner,
    "POST",
    `/local/binding-applications/${pending.id}/review`,
    { version: pending.version, action: "approve" },
  );
  assert.equal(approved.statusCode, 200, approved.body);
  return pending.id;
}

async function request(app: App, parent: string, bindingId: string, type: PrivacyRequest["type"]) {
  return call(app, parent, "POST", "/local/privacy-requests", { bindingId, type });
}

test("privacy requests require an approved guardian relationship and stay within each actor scope", async () => {
  const app = await buildLocalSyntheticServer({ mode: "local-synthetic" });
  try {
    const parent = await session(app, "parent-alpha");
    const otherParent = await session(app, "parent-beta");
    const owner = await session(app, "owner-east");
    const otherCampusOwner = await session(app, "owner-west");
    const platform = await session(app, "platform-admin");

    const pendingBinding = await call(app, parent, "POST", "/local/binding-applications", {
      student: "student-alpha",
      relationship: "GUARDIAN",
    });
    assert.equal(pendingBinding.statusCode, 201, pendingBinding.body);
    const pending = pendingBinding.json() as { id: string; version: number };
    assert.equal((await request(app, parent, pending.id, "ACCESS")).statusCode, 403);

    const approved = await call(
      app,
      owner,
      "POST",
      `/local/binding-applications/${pending.id}/review`,
      { version: pending.version, action: "approve" },
    );
    assert.equal(approved.statusCode, 200, approved.body);

    const created = await request(app, parent, pending.id, "ACCESS");
    assert.equal(created.statusCode, 201, created.body);
    const row = created.json() as PrivacyRequest;
    assert.equal(row.type, "ACCESS");
    assert.equal(row.status, "SUBMITTED");
    assert.equal(row.dataChanged, false);
    assert.equal(row.history[0]?.action, "SUBMIT");
    const guardianResponse = created.json() as Record<string, unknown>;
    for (const field of ["studentId", "studentAlias", "studentLabel"]) {
      assert.equal(field in guardianResponse, false);
    }
    assert.equal((await request(app, parent, pending.id, "ACCESS")).statusCode, 409);
    assert.equal((await request(app, otherParent, pending.id, "COPY")).statusCode, 403);
    assert.deepEqual((await call(app, otherParent, "GET", "/local/privacy-requests")).json(), []);
    assert.deepEqual(
      (await call(app, otherCampusOwner, "GET", "/local/privacy-requests")).json(),
      [],
    );
    assert.equal((await call(app, platform, "GET", "/local/privacy-requests")).statusCode, 403);
  } finally {
    await app.close();
  }
});

test("the four fixed request types are accepted without collecting free text or client scope claims", async () => {
  const app = await buildLocalSyntheticServer({ mode: "local-synthetic" });
  try {
    const parent = await session(app, "parent-alpha");
    const owner = await session(app, "owner-east");
    const bindingId = await approvedBinding(app, parent, owner);

    for (const type of ["ACCESS", "CORRECT", "COPY", "DELETE"] as const) {
      const response = await request(app, parent, bindingId, type);
      assert.equal(response.statusCode, 201, response.body);
      assert.equal((response.json() as PrivacyRequest).type, type);
    }
    for (const body of [
      { bindingId, type: "DELETE", detail: "real student information" },
      { bindingId, type: "DELETE", studentId: "forged-student" },
      { bindingId, type: "DELETE", tenantId: "forged-tenant" },
      { bindingId, type: "UNKNOWN" },
    ]) {
      const response = await call(app, parent, "POST", "/local/privacy-requests", body);
      assert.equal(response.statusCode, 400, response.body);
    }
    const requests = (
      await call(app, owner, "GET", "/local/privacy-requests")
    ).json() as PrivacyRequest[];
    assert.equal(requests.length, 4);
    assert.equal(JSON.stringify(requests).includes("real student information"), false);
    for (const field of ["studentId", "studentAlias", "studentLabel"]) {
      assert.equal(field in (requests[0] as unknown as Record<string, unknown>), false);
    }
  } finally {
    await app.close();
  }
});

test("authorized review records an explicitly simulated result and rejects stale state", async () => {
  const app = await buildLocalSyntheticServer({ mode: "local-synthetic" });
  try {
    const parent = await session(app, "parent-alpha");
    const owner = await session(app, "owner-east");
    const otherCampusOwner = await session(app, "owner-west");
    const teacher = await session(app, "teacher-east");
    const bindingId = await approvedBinding(app, parent, owner);
    const created = await request(app, parent, bindingId, "DELETE");
    assert.equal(created.statusCode, 201, created.body);
    const row = created.json() as PrivacyRequest;

    assert.equal(
      (
        await call(app, owner, "POST", `/local/privacy-requests/${row.id}/review`, {
          version: row.version,
          action: "COMPLETE",
        })
      ).statusCode,
      409,
    );
    const started = await call(app, owner, "POST", `/local/privacy-requests/${row.id}/review`, {
      version: row.version,
      action: "START",
    });
    assert.equal(started.statusCode, 200, started.body);
    const inReview = started.json() as PrivacyRequest;
    assert.equal(inReview.status, "IN_REVIEW");
    assert.equal(
      (
        await call(app, owner, "POST", `/local/privacy-requests/${row.id}/review`, {
          version: row.version,
          action: "COMPLETE",
        })
      ).statusCode,
      409,
    );
    assert.equal(
      (
        await call(app, teacher, "POST", `/local/privacy-requests/${row.id}/review`, {
          version: inReview.version,
          action: "COMPLETE",
        })
      ).statusCode,
      403,
    );
    assert.equal(
      (
        await call(app, otherCampusOwner, "POST", `/local/privacy-requests/${row.id}/review`, {
          version: inReview.version,
          action: "COMPLETE",
        })
      ).statusCode,
      403,
    );
    const completed = await call(app, owner, "POST", `/local/privacy-requests/${row.id}/review`, {
      version: inReview.version,
      action: "COMPLETE",
    });
    assert.equal(completed.statusCode, 200, completed.body);
    const result = completed.json() as PrivacyRequest;
    assert.equal(result.status, "SIMULATED_COMPLETE");
    assert.equal(result.dataChanged, false);
    assert.deepEqual(
      result.history.map(({ action }) => action),
      ["SUBMIT", "START", "SIMULATED_COMPLETE"],
    );
    assert.equal(
      (
        await call(app, parent, "POST", `/local/privacy-requests/${row.id}/withdraw`, {
          version: result.version,
        })
      ).statusCode,
      409,
    );
  } finally {
    await app.close();
  }
});

test("a guardian may withdraw a request before simulated completion only", async () => {
  const app = await buildLocalSyntheticServer({ mode: "local-synthetic" });
  try {
    const parent = await session(app, "parent-alpha");
    const owner = await session(app, "owner-east");
    const bindingId = await approvedBinding(app, parent, owner);
    const created = await request(app, parent, bindingId, "CORRECT");
    assert.equal(created.statusCode, 201, created.body);
    const row = created.json() as PrivacyRequest;
    const withdrawn = await call(
      app,
      parent,
      "POST",
      `/local/privacy-requests/${row.id}/withdraw`,
      { version: row.version },
    );
    assert.equal(withdrawn.statusCode, 200, withdrawn.body);
    assert.equal((withdrawn.json() as PrivacyRequest).status, "WITHDRAWN");

    const inReviewCreated = await request(app, parent, bindingId, "COPY");
    const inReviewRow = inReviewCreated.json() as PrivacyRequest;
    const started = await call(
      app,
      owner,
      "POST",
      `/local/privacy-requests/${inReviewRow.id}/review`,
      { version: inReviewRow.version, action: "START" },
    );
    assert.equal(started.statusCode, 200, started.body);
    const withdrawnInReview = await call(
      app,
      parent,
      "POST",
      `/local/privacy-requests/${inReviewRow.id}/withdraw`,
      { version: (started.json() as PrivacyRequest).version },
    );
    assert.equal(withdrawnInReview.statusCode, 200, withdrawnInReview.body);
    assert.equal((withdrawnInReview.json() as PrivacyRequest).status, "WITHDRAWN");
  } finally {
    await app.close();
  }
});
