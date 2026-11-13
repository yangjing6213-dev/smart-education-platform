import assert from "node:assert/strict";
import test from "node:test";
import type { BindingLeaveService } from "../src/local-synthetic/binding-leave.service.js";
import { ConsentService } from "../src/local-synthetic/consent.service.js";
import { LOCAL_STUDENT, type LocalMember } from "../src/local-synthetic/sessions.js";
import { buildLocalSyntheticServer } from "../src/local-synthetic/server.js";

type App = Awaited<ReturnType<typeof buildLocalSyntheticServer>>;
type DemoSession = { handle: string; actorId: string };
type ConsentRecord = {
  id: string;
  version: number;
  bindingId: string;
  purposeKey: "CARE_RECORD" | "HEALTH_SUPPORT" | "LEARNING_SUPPORT";
  noticeVersion: string;
  consentVersion: "LEARNING_DEMO_V2" | null;
  policyVersion: "AI_LEARNING_POLICY_SYNTHETIC_V1" | null;
  authorizedByActorId: string;
  authorizedAt: string;
  revokedAt: string | null;
  retentionDays: number;
  retainUntil: string;
  retentionStatus: "WITHIN_PERIOD" | "REVIEW_DUE" | "REQUIRED_HOLD" | "SIMULATED_EXPIRED";
  retentionOutcomeNotice: string | null;
  status: "ACTIVE" | "REVOKED";
  dataChanged: false;
  history: { action: string; actorId: string; version: number; dataChanged: false }[];
};
type Response = { statusCode: number; body: string; json(): unknown };

async function call(app: App, actor: string, method: "GET" | "POST", url: string, body?: unknown) {
  return app.inject({
    method,
    url,
    headers: {
      host: "127.0.0.1:4317",
      ...(actor ? { authorization: `Bearer ${actor}` } : {}),
    },
    ...(body === undefined ? {} : { payload: body as object }),
  } as never) as unknown as Promise<Response>;
}

async function session(app: App, profile: string): Promise<DemoSession> {
  const response = await call(app, "", "POST", "/local/sessions", { profile });
  assert.equal(response.statusCode, 201, response.body);
  const created = response.json() as { handle: string };
  const identity = await call(app, created.handle, "GET", "/local/session");
  assert.equal(identity.statusCode, 200, identity.body);
  return { handle: created.handle, actorId: (identity.json() as { actorId: string }).actorId };
}

async function approvedBinding(app: App, parent: string, owner: string) {
  const created = await call(app, parent, "POST", "/local/binding-applications", {
    student: "student-alpha",
    relationship: "GUARDIAN",
  });
  assert.equal(created.statusCode, 201, created.body);
  const pending = created.json() as { id: string; version: number };
  const reviewed = await call(
    app,
    owner,
    "POST",
    `/local/binding-applications/${pending.id}/review`,
    { version: pending.version, action: "approve" },
  );
  assert.equal(reviewed.statusCode, 200, reviewed.body);
  return pending.id;
}

async function createConsent(
  app: App,
  parent: string,
  bindingId: string,
  purposeKey: ConsentRecord["purposeKey"],
  noticeVersion: string,
) {
  const response = await call(app, parent, "POST", "/local/consents", {
    bindingId,
    purposeKey,
    noticeVersion,
    confirmed: true,
  });
  assert.equal(response.statusCode, 201, response.body);
  return response.json() as ConsentRecord;
}

async function callLoopback(
  baseUrl: string,
  actor: string,
  method: "GET" | "POST",
  url: string,
  body?: unknown,
) {
  if (new URL(baseUrl).hostname !== "127.0.0.1") throw new Error("Loopback tests must stay local");
  const response = await fetch(new URL(url, baseUrl), {
    method,
    headers: {
      ...(actor ? { authorization: `Bearer ${actor}` } : {}),
      ...(body === undefined ? {} : { "content-type": "application/json" }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const responseBody = await response.text();
  return {
    statusCode: response.status,
    body: responseBody,
    json: () => JSON.parse(responseBody) as unknown,
  };
}

async function loopbackSession(baseUrl: string, profile: string): Promise<DemoSession> {
  const created = await callLoopback(baseUrl, "", "POST", "/local/sessions", { profile });
  assert.equal(created.statusCode, 201, created.body);
  const identity = await callLoopback(
    baseUrl,
    (created.json() as { handle: string }).handle,
    "GET",
    "/local/session",
  );
  assert.equal(identity.statusCode, 200, identity.body);
  return {
    handle: (created.json() as { handle: string }).handle,
    actorId: (identity.json() as { actorId: string }).actorId,
  };
}

test("consent uses the fixed notice version and approved guardian scope", async () => {
  const app = await buildLocalSyntheticServer({ mode: "local-synthetic" });
  try {
    const parent = await session(app, "parent-alpha");
    const otherParent = await session(app, "parent-beta");
    const owner = await session(app, "owner-east");
    const otherCampusOwner = await session(app, "owner-west");
    const teacher = await session(app, "teacher-east");
    const platform = await session(app, "platform-admin");
    const bindingId = await approvedBinding(app, parent.handle, owner.handle);

    const catalog = await call(app, parent.handle, "GET", "/local/consent-policies");
    assert.equal(catalog.statusCode, 200, catalog.body);
    assert.deepEqual(
      (catalog.json() as { key: string }[]).map(({ key }) => key),
      ["CARE_RECORD", "HEALTH_SUPPORT", "LEARNING_SUPPORT"],
    );
    const created = await createConsent(
      app,
      parent.handle,
      bindingId,
      "CARE_RECORD",
      "CARE_RECORD_NOTICE_V1",
    );
    assert.equal(created.status, "ACTIVE");
    assert.equal(created.authorizedByActorId, parent.actorId);
    assert.equal(created.noticeVersion, "CARE_RECORD_NOTICE_V1");
    assert.equal(created.dataChanged, false);
    assert.deepEqual(
      created.history.map(({ action }) => action),
      ["GRANT"],
    );
    assert.deepEqual(
      created.history.map(({ version }) => version),
      [created.version],
    );
    const visible = created as unknown as Record<string, unknown>;
    for (const field of ["studentId", "tenantId", "campusId", "classId"]) {
      assert.equal(field in visible, false);
    }
    assert.equal(
      (
        await call(app, parent.handle, "POST", "/local/consents", {
          bindingId,
          purposeKey: "CARE_RECORD",
          noticeVersion: "CARE_RECORD_NOTICE_V1",
          confirmed: true,
        })
      ).statusCode,
      409,
    );

    assert.equal(
      (
        await call(app, parent.handle, "POST", "/local/consents", {
          bindingId,
          purposeKey: "CARE_RECORD",
          noticeVersion: "FUTURE_VERSION",
          confirmed: true,
        })
      ).statusCode,
      409,
    );
    assert.equal(
      (
        await call(app, parent.handle, "POST", "/local/consents", {
          bindingId,
          purposeKey: "CARE_RECORD",
          noticeVersion: "CARE_RECORD_NOTICE_V1",
          confirmed: false,
        })
      ).statusCode,
      400,
    );
    assert.equal(
      (
        await call(app, parent.handle, "POST", "/local/consents", {
          bindingId,
          purposeKey: "CARE_RECORD",
          noticeVersion: "CARE_RECORD_NOTICE_V1",
          confirmed: true,
          studentId: "client-supplied",
        })
      ).statusCode,
      400,
    );
    assert.deepEqual((await call(app, otherParent.handle, "GET", "/local/consents")).json(), []);
    assert.equal((await call(app, teacher.handle, "GET", "/local/consents")).statusCode, 403);
    assert.equal((await call(app, platform.handle, "GET", "/local/consents")).statusCode, 403);

    const ownerRows = (
      await call(app, owner.handle, "GET", "/local/consents")
    ).json() as ConsentRecord[];
    assert.equal(ownerRows.length, 1);
    assert.equal(ownerRows[0]?.id, created.id);
    assert.deepEqual(
      (await call(app, otherCampusOwner.handle, "GET", "/local/consents")).json(),
      [],
    );
  } finally {
    await app.close();
  }
});

test("loopback HTTP shares consent state across guardian and scoped owner roles", async () => {
  let now = Date.now();
  const app = await buildLocalSyntheticServer({ mode: "local-synthetic", now: () => now });
  let baseUrl = "";
  try {
    baseUrl = await app.start(0);
    const parent = await loopbackSession(baseUrl, "parent-alpha");
    const otherParent = await loopbackSession(baseUrl, "parent-beta");
    const owner = await loopbackSession(baseUrl, "owner-east");
    const otherCampusOwner = await loopbackSession(baseUrl, "owner-west");
    const teacher = await loopbackSession(baseUrl, "teacher-east");
    const pending = await callLoopback(
      baseUrl,
      parent.handle,
      "POST",
      "/local/binding-applications",
      {
        student: "student-alpha",
        relationship: "GUARDIAN",
      },
    );
    assert.equal(pending.statusCode, 201, pending.body);
    const binding = pending.json() as { id: string; version: number };
    const approved = await callLoopback(
      baseUrl,
      owner.handle,
      "POST",
      `/local/binding-applications/${binding.id}/review`,
      { version: binding.version, action: "approve" },
    );
    assert.equal(approved.statusCode, 200, approved.body);

    const granted = await callLoopback(baseUrl, parent.handle, "POST", "/local/consents", {
      bindingId: binding.id,
      purposeKey: "CARE_RECORD",
      noticeVersion: "CARE_RECORD_NOTICE_V1",
      confirmed: true,
    });
    assert.equal(granted.statusCode, 201, granted.body);
    const record = granted.json() as ConsentRecord;
    assert.equal(record.authorizedByActorId, parent.actorId);
    assert.equal(record.noticeVersion, "CARE_RECORD_NOTICE_V1");
    assert.equal(record.version, 1);
    assert.equal(record.dataChanged, false);
    assert.deepEqual(
      record.history.map(({ action }) => action),
      ["GRANT"],
    );
    assert.deepEqual(
      record.history.map(({ version }) => version),
      [record.version],
    );
    const holdGrantResponse = await callLoopback(
      baseUrl,
      parent.handle,
      "POST",
      "/local/consents",
      {
        bindingId: binding.id,
        purposeKey: "HEALTH_SUPPORT",
        noticeVersion: "HEALTH_SUPPORT_NOTICE_V1",
        confirmed: true,
      },
    );
    assert.equal(holdGrantResponse.statusCode, 201, holdGrantResponse.body);
    const holdRecord = holdGrantResponse.json() as ConsentRecord;
    assert.equal(holdRecord.authorizedByActorId, parent.actorId);
    assert.equal(holdRecord.noticeVersion, "HEALTH_SUPPORT_NOTICE_V1");
    assert.equal(holdRecord.version, 1);
    assert.equal(holdRecord.dataChanged, false);
    assert.deepEqual(
      holdRecord.history.map(({ action }) => action),
      ["GRANT"],
    );
    assert.deepEqual(
      holdRecord.history.map(({ version }) => version),
      [holdRecord.version],
    );
    assert.deepEqual(
      (await callLoopback(baseUrl, otherParent.handle, "GET", "/local/consents")).json(),
      [],
    );
    const ownerRows = await callLoopback(baseUrl, owner.handle, "GET", "/local/consents");
    assert.equal(ownerRows.statusCode, 200, ownerRows.body);
    assert.deepEqual(
      (ownerRows.json() as ConsentRecord[]).map(({ id }) => id),
      [record.id, holdRecord.id],
    );
    assert.deepEqual(
      (await callLoopback(baseUrl, otherCampusOwner.handle, "GET", "/local/consents")).json(),
      [],
    );
    assert.equal(
      (await callLoopback(baseUrl, teacher.handle, "GET", "/local/consents")).statusCode,
      403,
    );

    const revoked = await callLoopback(
      baseUrl,
      parent.handle,
      "POST",
      `/local/consents/${record.id}/revoke`,
      { version: record.version },
    );
    assert.equal(revoked.statusCode, 200, revoked.body);
    const updated = revoked.json() as ConsentRecord;
    assert.equal(updated.status, "REVOKED");
    assert.equal(updated.version, record.version + 1);
    assert.equal(updated.dataChanged, false);
    assert.deepEqual(
      updated.history.map(({ action }) => action),
      ["GRANT", "REVOKE"],
    );
    assert.deepEqual(
      updated.history.map(({ version }) => version),
      [record.version, updated.version],
    );

    now = Date.parse(updated.retainUntil) + 1;
    const expiryReviewer = await loopbackSession(baseUrl, "owner-east");
    const dueRows = await callLoopback(baseUrl, expiryReviewer.handle, "GET", "/local/consents");
    assert.equal(dueRows.statusCode, 200, dueRows.body);
    const dueRecord = (dueRows.json() as ConsentRecord[]).find(({ id }) => id === record.id);
    assert.equal(dueRecord?.retentionStatus, "REVIEW_DUE");
    const dueHoldRecord = (dueRows.json() as ConsentRecord[]).find(
      ({ id }) => id === holdRecord.id,
    );
    assert.equal(dueHoldRecord?.retentionStatus, "REVIEW_DUE");

    const requiredHold = await callLoopback(
      baseUrl,
      expiryReviewer.handle,
      "POST",
      `/local/consents/${holdRecord.id}/retention-review`,
      { version: holdRecord.version, action: "REQUIRED_HOLD" },
    );
    assert.equal(requiredHold.statusCode, 200, requiredHold.body);
    const held = requiredHold.json() as ConsentRecord;
    assert.equal(held.retentionStatus, "REQUIRED_HOLD");
    assert.equal(held.status, "ACTIVE");
    assert.equal(held.version, holdRecord.version + 1);
    assert.equal(held.dataChanged, false);
    assert.deepEqual(
      held.history.map(({ action }) => action),
      ["GRANT", "REQUIRED_HOLD"],
    );
    assert.deepEqual(
      held.history.map(({ version }) => version),
      [holdRecord.version, held.version],
    );

    const simulatedExpiry = await callLoopback(
      baseUrl,
      expiryReviewer.handle,
      "POST",
      `/local/consents/${record.id}/retention-review`,
      { version: updated.version, action: "SIMULATE_EXPIRY" },
    );
    assert.equal(simulatedExpiry.statusCode, 200, simulatedExpiry.body);
    const expired = simulatedExpiry.json() as ConsentRecord;
    assert.equal(expired.retentionStatus, "SIMULATED_EXPIRED");
    assert.equal(expired.retentionOutcomeNotice, "仅为演示到期状态，尚未删除任何数据。");
    assert.equal(expired.version, updated.version + 1);
    assert.equal(expired.dataChanged, false);
    assert.deepEqual(
      expired.history.map(({ action }) => action),
      ["GRANT", "REVOKE", "SIMULATE_EXPIRY"],
    );
    assert.deepEqual(
      expired.history.map(({ version }) => version),
      [record.version, updated.version, expired.version],
    );
  } finally {
    await app.close();
  }
});

test("guardian revocation is versioned and never deletes data in the demo", async () => {
  const app = await buildLocalSyntheticServer({ mode: "local-synthetic" });
  try {
    const parent = await session(app, "parent-alpha");
    const owner = await session(app, "owner-east");
    const bindingId = await approvedBinding(app, parent.handle, owner.handle);
    const created = await createConsent(
      app,
      parent.handle,
      bindingId,
      "LEARNING_SUPPORT",
      "LEARNING_SUPPORT_NOTICE_V1",
    );
    assert.equal(created.consentVersion, "LEARNING_DEMO_V2");
    assert.equal(created.policyVersion, "AI_LEARNING_POLICY_SYNTHETIC_V1");
    const revoked = await call(app, parent.handle, "POST", `/local/consents/${created.id}/revoke`, {
      version: created.version,
    });
    assert.equal(revoked.statusCode, 200, revoked.body);
    const result = revoked.json() as ConsentRecord;
    assert.equal(result.status, "REVOKED");
    assert.ok(result.revokedAt);
    assert.equal(result.version, created.version + 1);
    assert.equal(result.dataChanged, false);
    assert.deepEqual(
      result.history.map(({ action }) => action),
      ["GRANT", "REVOKE"],
    );
    assert.deepEqual(
      result.history.map(({ version }) => version),
      [created.version, result.version],
    );
    for (const event of result.history) assert.equal(event.dataChanged, false);
    assert.equal(
      (
        await call(app, parent.handle, "POST", `/local/consents/${created.id}/revoke`, {
          version: created.version,
        })
      ).statusCode,
      409,
    );
    assert.equal((await call(app, parent.handle, "GET", "/local/consents")).statusCode, 200);
  } finally {
    await app.close();
  }
});

test("retention review records a hold or a simulated expiry without deleting data", async () => {
  let now = Date.now();
  const app = await buildLocalSyntheticServer({ mode: "local-synthetic", now: () => now });
  try {
    const parent = await session(app, "parent-alpha");
    const owner = await session(app, "owner-east");
    const bindingId = await approvedBinding(app, parent.handle, owner.handle);
    const holdRecord = await createConsent(
      app,
      parent.handle,
      bindingId,
      "CARE_RECORD",
      "CARE_RECORD_NOTICE_V1",
    );
    assert.equal(holdRecord.consentVersion, null);
    assert.equal(holdRecord.policyVersion, null);
    const expiryRecord = await createConsent(
      app,
      parent.handle,
      bindingId,
      "HEALTH_SUPPORT",
      "HEALTH_SUPPORT_NOTICE_V1",
    );
    assert.equal(expiryRecord.consentVersion, null);
    assert.equal(expiryRecord.policyVersion, null);
    const revokedRecord = await createConsent(
      app,
      parent.handle,
      bindingId,
      "LEARNING_SUPPORT",
      "LEARNING_SUPPORT_NOTICE_V1",
    );
    const revokedResponse = await call(
      app,
      parent.handle,
      "POST",
      `/local/consents/${revokedRecord.id}/revoke`,
      { version: revokedRecord.version },
    );
    assert.equal(revokedResponse.statusCode, 200, revokedResponse.body);
    const revoked = revokedResponse.json() as ConsentRecord;
    now =
      Math.max(
        Date.parse(holdRecord.retainUntil),
        Date.parse(expiryRecord.retainUntil),
        Date.parse(revoked.retainUntil),
      ) + 1;
    const reviewer = await session(app, "owner-east");
    const otherCampusReviewer = await session(app, "owner-west");

    const dueResponse = await call(app, reviewer.handle, "GET", "/local/consents");
    assert.equal(dueResponse.statusCode, 200, dueResponse.body);
    const dueRows = dueResponse.json() as ConsentRecord[];
    assert.equal(dueRows.find(({ id }) => id === holdRecord.id)?.retentionStatus, "REVIEW_DUE");
    assert.equal(dueRows.find(({ id }) => id === revoked.id)?.retentionStatus, "REVIEW_DUE");
    assert.equal(
      (
        await call(
          app,
          otherCampusReviewer.handle,
          "POST",
          `/local/consents/${holdRecord.id}/retention-review`,
          { version: holdRecord.version, action: "REQUIRED_HOLD" },
        )
      ).statusCode,
      403,
    );

    const heldResponse = await call(
      app,
      reviewer.handle,
      "POST",
      `/local/consents/${holdRecord.id}/retention-review`,
      { version: holdRecord.version, action: "REQUIRED_HOLD" },
    );
    assert.equal(heldResponse.statusCode, 200, heldResponse.body);
    const held = heldResponse.json() as ConsentRecord;
    assert.equal(held.retentionStatus, "REQUIRED_HOLD");
    assert.equal(held.status, "ACTIVE");
    assert.equal(held.version, holdRecord.version + 1);
    assert.equal(held.dataChanged, false);
    assert.equal(held.history.at(-1)?.version, held.version);

    const expiryResponse = await call(
      app,
      reviewer.handle,
      "POST",
      `/local/consents/${expiryRecord.id}/retention-review`,
      { version: expiryRecord.version, action: "SIMULATE_EXPIRY" },
    );
    assert.equal(expiryResponse.statusCode, 200, expiryResponse.body);
    const expired = expiryResponse.json() as ConsentRecord;
    assert.equal(expired.retentionStatus, "SIMULATED_EXPIRED");
    assert.equal(expired.status, "ACTIVE");
    assert.equal(expired.version, expiryRecord.version + 1);
    assert.equal(expired.dataChanged, false);
    assert.equal(expired.retentionOutcomeNotice, "仅为演示到期状态，尚未删除任何数据。");
    assert.equal(expired.history.at(-1)?.action, "SIMULATE_EXPIRY");
    assert.equal(expired.history.at(-1)?.version, expired.version);
    const expiredRevokedResponse = await call(
      app,
      reviewer.handle,
      "POST",
      `/local/consents/${revoked.id}/retention-review`,
      { version: revoked.version, action: "SIMULATE_EXPIRY" },
    );
    assert.equal(expiredRevokedResponse.statusCode, 200, expiredRevokedResponse.body);
    const expiredRevoked = expiredRevokedResponse.json() as ConsentRecord;
    assert.equal(expiredRevoked.status, "REVOKED");
    assert.equal(expiredRevoked.retentionStatus, "SIMULATED_EXPIRED");
    assert.equal(expiredRevoked.version, revoked.version + 1);
    assert.equal(expiredRevoked.retentionOutcomeNotice, "仅为演示到期状态，尚未删除任何数据。");
    assert.equal(expiredRevoked.dataChanged, false);
    assert.equal(
      (
        await call(
          app,
          reviewer.handle,
          "POST",
          `/local/consents/${expiryRecord.id}/retention-review`,
          {
            version: expiryRecord.version,
            action: "SIMULATE_EXPIRY",
          },
        )
      ).statusCode,
      409,
    );
  } finally {
    await app.close();
  }
});

test("consent rejects non-guardian bindings and filters class and tenant scope", () => {
  const parent: LocalMember = {
    actorId: "synthetic-parent",
    profile: "parent-synthetic",
    label: "示例监护人",
    tenantId: LOCAL_STUDENT.tenantId,
    campusId: LOCAL_STUDENT.campusId,
    classIds: [LOCAL_STUDENT.classId],
    actions: ["consent:manage"],
  };
  const binding = {
    id: "synthetic-binding",
    status: "APPROVED",
    relationship: "PICKUP_CONTACT",
    studentId: LOCAL_STUDENT.id,
  };
  const relationships = {
    bindings: () => [binding],
  } as unknown as Pick<BindingLeaveService, "bindings">;
  const service = new ConsentService(relationships);
  const request = {
    bindingId: binding.id,
    purposeKey: "CARE_RECORD",
    noticeVersion: "CARE_RECORD_NOTICE_V1",
    confirmed: true,
  };

  assert.throws(
    () => service.create(parent, request),
    (error: unknown) =>
      typeof error === "object" &&
      error !== null &&
      "statusCode" in error &&
      error.statusCode === 403,
  );

  binding.relationship = "GUARDIAN";
  const created = service.create(parent, request);
  const owner: LocalMember = {
    actorId: "synthetic-owner",
    profile: "owner-synthetic",
    label: "示例负责人",
    tenantId: parent.tenantId,
    campusId: parent.campusId,
    classIds: ["00000000-0000-4000-8000-000000000104"],
    actions: ["consent:review"],
  };
  assert.deepEqual(service.list(owner), []);
  assert.deepEqual(
    service.list({ ...owner, classIds: parent.classIds, tenantId: "other-tenant" }),
    [],
  );
  assert.equal(created.dataChanged, false);
});
