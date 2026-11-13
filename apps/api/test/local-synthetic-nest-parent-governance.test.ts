import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import test from "node:test";
import {
  createInvitePasswordHash,
  InviteAuthService,
  type InviteAccountConfiguration,
} from "../src/nest/invite-auth.service.js";
import { createApiApp } from "../src/nest/api-app.js";
import { buildLocalSyntheticServer } from "../src/local-synthetic/server.js";

const tenantId = "00000000-0000-4000-8000-000000000064";
const campusId = "00000000-0000-4000-8000-000000000065";
const studentId = "00000000-0000-4000-8000-0000000000c8";
const actors = {
  parent: "00000000-0000-4000-8000-000000000001",
  wrongCampus: "00000000-0000-4000-8000-000000000002",
  staff: "00000000-0000-4000-8000-000000000004",
};
const syntheticPassword = "Local-synthetic-invite-92!";

async function inviteAccount(
  username: string,
  actorId: string,
  capabilities: readonly ("identity:read" | "binding:apply" | "binding:read" | "binding:review")[],
  memberCampus = campusId,
): Promise<InviteAccountConfiguration> {
  return {
    username,
    password_hash: await createInvitePasswordHash(syntheticPassword),
    identity: { actor_id: actorId, display_name: "示例邀请账号" },
    memberships: [
      {
        tenant_id: tenantId,
        campus_ids: [memberCampus],
        status: "ACTIVE",
        capabilities: [...capabilities],
      },
    ],
  };
}

async function withApi(
  run: (
    baseUrl: string,
    local: Awaited<ReturnType<typeof buildLocalSyntheticServer>>,
  ) => Promise<void>,
) {
  const local = await buildLocalSyntheticServer({ mode: "local-synthetic" });
  const inviteAuthService = new InviteAuthService([
    await inviteAccount("parent-demo", actors.parent, [
      "identity:read",
      "binding:apply",
      "binding:read",
    ]),
    await inviteAccount("staff-demo", actors.staff, ["identity:read", "binding:review"]),
    await inviteAccount(
      "other-campus",
      actors.wrongCampus,
      ["identity:read", "binding:apply", "binding:read"],
      "00000000-0000-4000-8000-000000000066",
    ),
  ]);
  const options = {
    inviteAuthService,
    guardianBindingOperations: local.guardianBindingOperations,
    parentGovernanceOperations: (
      local as unknown as { readonly parentGovernanceOperations?: unknown }
    ).parentGovernanceOperations,
  } as Parameters<typeof createApiApp>[0];
  const api = await createApiApp(options);
  await api.listen(0, "127.0.0.1");
  const address = api.getHttpServer().address() as AddressInfo | null;
  if (!address) throw new Error("Synthetic Nest API did not bind.");
  try {
    await run(`http://127.0.0.1:${address.port}`, local);
  } finally {
    await api.close();
    await local.close();
  }
}

async function login(baseUrl: string, username: string): Promise<string> {
  const response = await fetch(new URL("/identity/login", baseUrl), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username, password: syntheticPassword }),
  });
  assert.equal(response.status, 200);
  const body = (await response.json()) as { data: { access_token: string } };
  return body.data.access_token;
}

async function requestJson(
  baseUrl: string,
  path: string,
  token: string | undefined,
  method = "GET",
  body?: unknown,
  headers: Readonly<Record<string, string>> = {},
) {
  const requestHeaders = new Headers(headers);
  if (token) requestHeaders.set("authorization", `Bearer ${token}`);
  if (body !== undefined) requestHeaders.set("content-type", "application/json");
  const response = await fetch(new URL(path, baseUrl), {
    method,
    headers: requestHeaders,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return { status: response.status, body: (await response.json()) as Record<string, unknown> };
}

async function localSession(
  local: Awaited<ReturnType<typeof buildLocalSyntheticServer>>,
  profile: string,
): Promise<string> {
  const response = await local.inject({
    method: "POST",
    url: "/local/sessions",
    headers: { host: "127.0.0.1:4317" },
    payload: { profile },
  });
  assert.equal(response.statusCode, 201, response.body);
  return (response.json() as { handle: string }).handle;
}

async function localRequest(
  local: Awaited<ReturnType<typeof buildLocalSyntheticServer>>,
  method: "GET" | "POST",
  path: string,
  token: string,
  body?: unknown,
) {
  return local.inject({
    method,
    url: path,
    headers: { host: "127.0.0.1:4317", authorization: `Bearer ${token}` },
    ...(body === undefined ? {} : { payload: body as object }),
  });
}

test("invited parent binds, receives same-campus review, and manages synthetic consent/privacy", async (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: new Date("2026-10-12T01:00:00Z") });
  await withApi(async (baseUrl) => {
    const parentToken = await login(baseUrl, "parent-demo");
    const staffToken = await login(baseUrl, "staff-demo");
    const options = await requestJson(baseUrl, "/parent/student-options", parentToken);
    assert.equal(options.status, 200);
    const candidates = options.body.data as { id: string; alias: string }[];
    assert.deepEqual(
      candidates.map(({ id, alias }) => ({ id, alias })),
      [
        { id: studentId, alias: "student-alpha" },
        { id: "00000000-0000-4000-8000-0000000000c9", alias: "student-beta" },
      ],
    );

    const submitted = await requestJson(
      baseUrl,
      "/guardian-binding/applications",
      parentToken,
      "POST",
      { student_candidate_ref: studentId, relationship: "GUARDIAN", consent: true },
    );
    assert.equal(submitted.status, 201);
    const application = submitted.body.data as { id: string; version: number; status: string };
    assert.equal(application.status, "PENDING");

    const pendingFees = await requestJson(baseUrl, "/parent/fees", parentToken);
    assert.equal(pendingFees.status, 200, JSON.stringify(pendingFees.body));
    const pendingData = pendingFees.body.data as {
      bindingApplications: { status: string }[];
      documents: unknown[];
      ledger: { entries: unknown[] };
    };
    assert.equal(pendingData.bindingApplications[0]?.status, "PENDING");
    assert.deepEqual(pendingData.documents, []);
    assert.deepEqual(pendingData.ledger.entries, []);

    const reviewed = await requestJson(
      baseUrl,
      `/staff/guardian-binding/applications/${application.id}/review`,
      staffToken,
      "POST",
      { version: application.version, action: "approve" },
    );
    assert.equal(reviewed.status, 200);

    const approvedFees = await requestJson(baseUrl, "/parent/fees", parentToken);
    assert.equal(approvedFees.status, 200, JSON.stringify(approvedFees.body));
    const approvedData = approvedFees.body.data as {
      bindingApplications: { status: string }[];
      documents: { studentAlias: string; synthetic: boolean }[];
      ledger: { entries: { studentAlias: string; synthetic: boolean }[] };
    };
    assert.equal(approvedData.bindingApplications[0]?.status, "APPROVED");
    assert.ok(approvedData.documents.length > 0);
    assert.ok(
      approvedData.documents.every((row) => row.studentAlias === "student-alpha" && row.synthetic),
    );
    assert.ok(approvedData.ledger.entries.length > 0);
    assert.ok(
      approvedData.ledger.entries.every(
        (row) => row.studentAlias === "student-alpha" && row.synthetic,
      ),
    );

    const ownApplications = await requestJson(
      baseUrl,
      "/guardian-binding/applications",
      parentToken,
    );
    assert.equal((ownApplications.body.data as { status: string }[])[0]?.status, "APPROVED");

    const policies = await requestJson(baseUrl, "/consent-policies", parentToken);
    assert.equal(policies.status, 200, JSON.stringify(policies.body));
    const carePolicy = (policies.body.data as { key: string; noticeVersion: string }[]).find(
      ({ key }) => key === "CARE_RECORD",
    );
    assert.ok(carePolicy);
    const granted = await requestJson(baseUrl, "/consents", parentToken, "POST", {
      bindingId: application.id,
      purposeKey: carePolicy.key,
      noticeVersion: carePolicy.noticeVersion,
      confirmed: true,
    });
    assert.equal(granted.status, 201);
    const consent = granted.body.data as { id: string; version: number; dataChanged: false };
    assert.equal(consent.dataChanged, false);

    const revoked = await requestJson(
      baseUrl,
      `/consents/${consent.id}/revoke`,
      parentToken,
      "POST",
      { version: consent.version },
    );
    assert.equal(revoked.status, 200);
    assert.equal((revoked.body.data as { dataChanged: false }).dataChanged, false);

    const privacy = await requestJson(baseUrl, "/privacy-requests", parentToken, "POST", {
      bindingId: application.id,
      type: "ACCESS",
    });
    assert.equal(privacy.status, 201);
    const request = privacy.body.data as { id: string; version: number; dataChanged: false };
    assert.equal(request.dataChanged, false);
    const withdrawn = await requestJson(
      baseUrl,
      `/privacy-requests/${request.id}/withdraw`,
      parentToken,
      "POST",
      { version: request.version },
    );
    assert.equal(withdrawn.status, 200);
    assert.equal((withdrawn.body.data as { dataChanged: false }).dataChanged, false);
  });
});

test("invited parent manages pickup only through the shared approved-binding service", async () => {
  await withApi(async (baseUrl, local) => {
    const parentToken = await login(baseUrl, "parent-demo");
    const wrongCampusToken = await login(baseUrl, "other-campus");
    const staffToken = await login(baseUrl, "staff-demo");

    assert.equal((await requestJson(baseUrl, "/parent/pickup", undefined)).status, 401);
    assert.equal((await requestJson(baseUrl, "/parent/pickup", staffToken)).status, 403);
    assert.equal((await requestJson(baseUrl, "/parent/pickup", wrongCampusToken)).status, 403);
    assert.equal(
      (await requestJson(baseUrl, "/parent/pickup?student_id=other", parentToken)).status,
      400,
    );
    assert.equal(
      (
        await requestJson(baseUrl, "/parent/pickup", parentToken, "GET", undefined, {
          "x-campus-id": "00000000-0000-4000-8000-000000000066",
        })
      ).status,
      400,
    );

    const empty = await requestJson(baseUrl, "/parent/pickup", parentToken);
    assert.equal(empty.status, 200, JSON.stringify(empty.body));
    assert.deepEqual(
      (empty.body.data as { bindings: unknown[]; authorizations: unknown[]; records: unknown[] })
        .bindings,
      [],
    );

    const parentHandle = await localSession(local, "parent-alpha");
    const ownerHandle = await localSession(local, "owner-east");
    const teacherHandle = await localSession(local, "teacher-east");
    const pending = await localRequest(local, "POST", "/local/binding-applications", parentHandle, {
      student: "student-alpha",
      relationship: "GUARDIAN",
    });
    assert.equal(pending.statusCode, 201, pending.body);
    const binding = pending.json() as { id: string; version: number; status: string };
    const pendingView = await requestJson(baseUrl, "/parent/pickup", parentToken);
    assert.deepEqual(
      (pendingView.body.data as { bindings: unknown[] }).bindings,
      [],
      "pending relationships must not be exposed as pickup bindings",
    );
    const reviewed = await localRequest(
      local,
      "POST",
      `/local/binding-applications/${binding.id}/review`,
      ownerHandle,
      { version: binding.version, action: "approve" },
    );
    assert.equal(reviewed.statusCode, 200, reviewed.body);

    const todayParts = Object.fromEntries(
      new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Shanghai",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      })
        .formatToParts(new Date())
        .map(({ type, value }) => [type, value]),
    );
    const today = `${todayParts.year}-${todayParts.month}-${todayParts.day}`;
    const snapshot = await requestJson(baseUrl, "/parent/pickup", parentToken);
    const initialData = snapshot.body.data as {
      bindings: { id: string; status: string }[];
      authorizations: unknown[];
      records: unknown[];
    };
    assert.equal(initialData.bindings.length, 1);
    assert.equal(initialData.bindings[0]?.id, binding.id);
    assert.equal(initialData.bindings[0]?.status, "APPROVED");

    const created = await requestJson(
      baseUrl,
      "/parent/pickup/authorizations",
      parentToken,
      "POST",
      {
        bindingId: binding.id,
        recipient: "pickup-alpha",
        type: "TEMPORARY",
        startDate: today,
        endDate: today,
        startTime: "00:00",
        endTime: "23:59",
      },
    );
    assert.equal(created.status, 201, JSON.stringify(created.body));
    const draft = created.body.data as { id: string; version: number; status: string };
    assert.equal(draft.status, "DRAFT");
    const legacyRows = await localRequest(
      local,
      "GET",
      "/local/pickup-authorizations",
      parentHandle,
    );
    assert.equal(legacyRows.statusCode, 200);
    assert.equal((legacyRows.json() as { id: string }[]).length, 1);

    const attendance = await localRequest(
      local,
      "POST",
      "/local/attendance-records",
      teacherHandle,
      {
        student: "student-alpha",
        date: today,
        status: "NOT_ARRIVED",
        time: null,
      },
    );
    assert.equal(attendance.statusCode, 201, attendance.body);
    const attendanceRow = attendance.json() as { id: string; version: number };
    const arrived = await localRequest(
      local,
      "POST",
      `/local/attendance-records/${attendanceRow.id}/arrive`,
      teacherHandle,
      { version: attendanceRow.version, time: "00:00" },
    );
    assert.equal(arrived.statusCode, 200, arrived.body);

    const activated = await requestJson(
      baseUrl,
      `/parent/pickup/authorizations/${draft.id}/activate`,
      parentToken,
      "POST",
      { version: draft.version },
    );
    assert.equal(activated.status, 200, JSON.stringify(activated.body));
    const active = activated.body.data as { version: number; status: string };
    assert.equal(active.status, "ACTIVE");
    const issued = await requestJson(
      baseUrl,
      `/parent/pickup/authorizations/${draft.id}/credential`,
      parentToken,
      "POST",
      { version: active.version },
    );
    assert.equal(issued.status, 200, JSON.stringify(issued.body));
    const oneTime = issued.body.data as { credential: string; expiresAt: string };
    assert.match(oneTime.credential, /^[A-Za-z0-9_-]{43}$/u);
    assert.ok(Date.parse(oneTime.expiresAt) > Date.now());

    const verification = await localRequest(
      local,
      "POST",
      "/local/pickup-verifications",
      teacherHandle,
      { student: "student-alpha", credential: oneTime.credential },
    );
    assert.equal(verification.statusCode, 201, verification.body);
    const step = verification.json() as { id: string; version: number };
    const completed = await localRequest(
      local,
      "POST",
      `/local/pickup-verifications/${step.id}/confirm`,
      teacherHandle,
      {
        version: step.version,
        checks: { student: true, recipient: true, authorization: true },
      },
    );
    assert.equal(completed.statusCode, 200, completed.body);

    const visible = await requestJson(baseUrl, "/parent/pickup", parentToken);
    const visibleData = visible.body.data as {
      bindings: unknown[];
      authorizations: { id: string; status: string }[];
      records: Record<string, unknown>[];
    };
    assert.equal(visibleData.authorizations.length, 1);
    assert.equal(visibleData.authorizations[0]?.status, "ACTIVE");
    assert.equal(visibleData.records.length, 1);
    assert.deepEqual(Object.keys(visibleData.records[0]!).sort(), [
      "date",
      "id",
      "recipient",
      "status",
      "studentId",
      "studentLabel",
      "time",
    ]);
    assert.equal(visibleData.records[0]?.status, "COMPLETED");
    assert.equal("credential" in visibleData, false);
    assert.deepEqual(
      (await requestJson(baseUrl, "/parent/pickup", await login(baseUrl, "other-campus"))).body
        .data,
      undefined,
    );
  });
});

test("parent governance rejects staff, wrong-campus, forged-scope and anonymous requests", async () => {
  await withApi(async (baseUrl) => {
    const staffToken = await login(baseUrl, "staff-demo");
    const wrongCampusToken = await login(baseUrl, "other-campus");
    const parentToken = await login(baseUrl, "parent-demo");
    assert.equal((await requestJson(baseUrl, "/consents", staffToken)).status, 403);
    assert.equal((await requestJson(baseUrl, "/parent/fees", staffToken)).status, 403);
    assert.equal((await requestJson(baseUrl, "/parent/learning", staffToken)).status, 403);
    assert.equal((await requestJson(baseUrl, "/parent/fees", wrongCampusToken)).status, 403);
    assert.equal((await requestJson(baseUrl, "/parent/learning", wrongCampusToken)).status, 403);
    assert.equal(
      (await requestJson(baseUrl, "/parent/fees?student_id=other", parentToken)).status,
      400,
    );
    assert.equal(
      (await requestJson(baseUrl, "/parent/learning?student_id=other", parentToken)).status,
      400,
    );
    assert.equal(
      (await requestJson(baseUrl, "/parent/student-options", wrongCampusToken)).status,
      403,
    );
    assert.equal(
      (
        await requestJson(baseUrl, "/parent/student-options", parentToken, "GET", undefined, {
          "x-campus-id": campusId,
        })
      ).status,
      400,
    );
    const anonymous = await fetch(new URL("/parent/fees", baseUrl));
    assert.equal(anonymous.status, 401);
    assert.equal((await fetch(new URL("/parent/learning", baseUrl))).status, 401);
  });
});

test("invited parent sees only approved-child learning summary and can save local supervision", async () => {
  await withApi(async (baseUrl) => {
    const parentToken = await login(baseUrl, "parent-demo");
    const staffToken = await login(baseUrl, "staff-demo");
    const noRelationship = await requestJson(baseUrl, "/parent/learning", parentToken);
    assert.equal(noRelationship.status, 200, JSON.stringify(noRelationship.body));
    const emptyProjection = noRelationship.body.data as {
      approvedStudents: unknown[];
      parentControls: unknown[];
      parentSummary: unknown[];
      parentSummaryUpdatedAt: string;
    };
    assert.deepEqual(emptyProjection.approvedStudents, []);
    assert.deepEqual(emptyProjection.parentControls, []);
    assert.deepEqual(emptyProjection.parentSummary, []);

    const submitted = await requestJson(
      baseUrl,
      "/guardian-binding/applications",
      parentToken,
      "POST",
      { student_candidate_ref: studentId, relationship: "GUARDIAN", consent: true },
    );
    assert.equal(submitted.status, 201, JSON.stringify(submitted.body));
    const application = submitted.body.data as { id: string; version: number };
    assert.equal((await requestJson(baseUrl, "/parent/learning", parentToken)).status, 200);
    const pending = (await requestJson(baseUrl, "/parent/learning", parentToken)).body.data as {
      approvedStudents: unknown[];
    };
    assert.deepEqual(pending.approvedStudents, []);

    const reviewed = await requestJson(
      baseUrl,
      `/staff/guardian-binding/applications/${application.id}/review`,
      staffToken,
      "POST",
      { version: application.version, action: "approve" },
    );
    assert.equal(reviewed.status, 200, JSON.stringify(reviewed.body));
    const approved = await requestJson(baseUrl, "/parent/learning", parentToken);
    assert.equal(approved.status, 200, JSON.stringify(approved.body));
    const projection = approved.body.data as {
      approvedStudents: { studentId: string; studentLabel: string; classLabel: string }[];
      parentControls: {
        studentId: string;
        studentLabel: string;
        enabled: boolean;
        maxDurationMinutes: number;
        maxHintLevel: number;
        contactStatus: string;
      }[];
      parentSummary: Record<string, unknown>[];
      parentSummaryUpdatedAt: string;
    };
    assert.deepEqual(projection.approvedStudents, [
      {
        studentId,
        studentLabel: "示例学生甲",
        classLabel: "示例三年级甲班",
      },
    ]);
    assert.deepEqual(projection.parentSummary, [
      {
        studentId,
        studentLabel: "示例学生甲",
        usedMinutes: 0,
        sessionCount: 0,
        completedSessions: 0,
        knowledgePoints: [],
        attentionCount: 0,
      },
    ]);
    assert.equal(projection.parentControls[0]?.studentId, studentId);
    assert.equal(projection.parentControls[0]?.contactStatus, "NOT_REQUESTED");
    assert.deepEqual(Object.keys(projection.approvedStudents[0] ?? {}).sort(), [
      "classLabel",
      "studentId",
      "studentLabel",
    ]);
    assert.ok(
      !JSON.stringify(projection).match(/tenantId|campusId|classId|modelLog|teacherSummary/u),
    );

    const changed = await requestJson(
      baseUrl,
      `/parent/learning/${studentId}/controls`,
      parentToken,
      "POST",
      { enabled: false, maxDurationMinutes: 10, maxHintLevel: 2 },
    );
    assert.equal(changed.status, 200, JSON.stringify(changed.body));
    assert.deepEqual(changed.body.data, {
      studentId,
      studentLabel: "示例学生甲",
      enabled: false,
      maxDurationMinutes: 10,
      maxHintLevel: 2,
      contactStatus: "NOT_REQUESTED",
    });
    assert.notEqual(
      (
        await requestJson(baseUrl, `/parent/learning/${studentId}/controls`, parentToken, "POST", {
          enabled: true,
          maxDurationMinutes: 20,
          maxHintLevel: 2,
        })
      ).status,
      200,
    );
    assert.notEqual(
      (
        await requestJson(
          baseUrl,
          `/parent/learning/00000000-0000-4000-8000-0000000000c9/controls`,
          parentToken,
          "POST",
          { enabled: true, maxDurationMinutes: 10, maxHintLevel: 2 },
        )
      ).status,
      200,
    );

    const contact = await requestJson(
      baseUrl,
      `/parent/learning/${studentId}/contact`,
      parentToken,
      "POST",
      {},
    );
    assert.equal(contact.status, 201, JSON.stringify(contact.body));
    assert.equal((contact.body.data as { status: string }).status, "RECORDED_LOCAL");
    const refreshed = (await requestJson(baseUrl, "/parent/learning", parentToken)).body.data as {
      parentControls: { contactStatus: string }[];
    };
    assert.equal(refreshed.parentControls[0]?.contactStatus, "RECORDED_LOCAL");
  });
});

test("invited parent reads and acknowledges only the shared staff-published monthly feedback", async () => {
  await withApi(async (baseUrl, local) => {
    const parentToken = await login(baseUrl, "parent-demo");
    const staffToken = await login(baseUrl, "staff-demo");
    const wrongCampusToken = await login(baseUrl, "other-campus");

    assert.equal((await fetch(new URL("/parent/monthly-feedback", baseUrl))).status, 401);
    assert.equal((await requestJson(baseUrl, "/parent/monthly-feedback", staffToken)).status, 403);
    assert.equal(
      (await requestJson(baseUrl, "/parent/monthly-feedback", wrongCampusToken)).status,
      403,
    );
    assert.equal(
      (await requestJson(baseUrl, "/parent/monthly-feedback?student_id=other", parentToken)).status,
      400,
    );

    const empty = await requestJson(baseUrl, "/parent/monthly-feedback", parentToken);
    assert.equal(empty.status, 200, JSON.stringify(empty.body));
    assert.deepEqual(empty.body.data, []);

    const submitted = await requestJson(
      baseUrl,
      "/guardian-binding/applications",
      parentToken,
      "POST",
      { student_candidate_ref: studentId, relationship: "GUARDIAN", consent: true },
    );
    assert.equal(submitted.status, 201, JSON.stringify(submitted.body));
    const application = submitted.body.data as { id: string; version: number };
    const approved = await requestJson(
      baseUrl,
      `/staff/guardian-binding/applications/${application.id}/review`,
      staffToken,
      "POST",
      { version: application.version, action: "approve" },
    );
    assert.equal(approved.status, 200, JSON.stringify(approved.body));
    assert.deepEqual(
      (await requestJson(baseUrl, "/parent/monthly-feedback", parentToken)).body.data,
      [],
      "approved relationship alone must not reveal unpublished feedback",
    );

    const teacher = await localSession(local, "teacher-east");
    const owner = await localSession(local, "owner-east");
    const supplements = {
      learningParticipation: "PROGRESSING",
      dailyHabits: "KEEP_WATCHING",
      activityParticipation: "PROGRESSING",
      familySchoolCollaboration: "FOLLOW_UP",
    };
    const created = await localRequest(local, "POST", "/local/monthly-feedback", teacher, {
      month: "2026-10",
      supplements,
    });
    assert.equal(created.statusCode, 201, created.body);
    let row = created.json() as { id: string; version: number };
    const sent = await localRequest(
      local,
      "POST",
      `/local/monthly-feedback/${row.id}/submit`,
      teacher,
      { version: row.version },
    );
    assert.equal(sent.statusCode, 200, sent.body);
    row = sent.json() as typeof row;
    const confirmed = await localRequest(
      local,
      "POST",
      `/local/monthly-feedback/${row.id}/review`,
      owner,
      { version: row.version, action: "CONFIRM" },
    );
    assert.equal(confirmed.statusCode, 200, confirmed.body);
    row = confirmed.json() as typeof row;
    const published = await localRequest(
      local,
      "POST",
      `/local/monthly-feedback/${row.id}/publish`,
      owner,
      { version: row.version },
    );
    assert.equal(published.statusCode, 200, published.body);
    row = published.json() as typeof row;

    const visible = await requestJson(baseUrl, "/parent/monthly-feedback", parentToken);
    assert.equal(visible.status, 200, JSON.stringify(visible.body));
    const rows = visible.body.data as Record<string, unknown>[];
    assert.equal(rows.length, 1);
    assert.deepEqual(Object.keys(rows[0]!).sort(), [
      "acknowledged",
      "id",
      "items",
      "month",
      "status",
      "synthetic",
      "version",
    ]);
    assert.equal(rows[0]?.id, row.id);
    assert.equal(rows[0]?.status, "PUBLISHED");
    assert.equal(rows[0]?.synthetic, true);

    const acknowledged = await requestJson(
      baseUrl,
      `/parent/monthly-feedback/${row.id}/ack`,
      parentToken,
      "POST",
      { version: row.version },
    );
    assert.equal(acknowledged.status, 200, JSON.stringify(acknowledged.body));
    assert.equal((acknowledged.body.data as { acknowledged: boolean }).acknowledged, true);
    const refreshed = await requestJson(baseUrl, "/parent/monthly-feedback", parentToken);
    assert.equal((refreshed.body.data as { acknowledged: boolean }[])[0]?.acknowledged, true);
    assert.equal(
      (
        await requestJson(baseUrl, `/parent/monthly-feedback/${row.id}/ack`, parentToken, "POST", {
          version: row.version,
        })
      ).status,
      409,
      "stale acknowledgement version must be rejected",
    );
  });
});

test("invited parent reads and acknowledges only the shared staff-published notice", async () => {
  await withApi(async (baseUrl, local) => {
    const parentToken = await login(baseUrl, "parent-demo");
    const staffToken = await login(baseUrl, "staff-demo");
    const wrongCampusToken = await login(baseUrl, "other-campus");

    assert.equal((await fetch(new URL("/parent/notices", baseUrl))).status, 401);
    assert.equal((await requestJson(baseUrl, "/parent/notices", staffToken)).status, 403);
    assert.equal((await requestJson(baseUrl, "/parent/notices", wrongCampusToken)).status, 403);
    assert.equal(
      (
        await requestJson(baseUrl, "/parent/notices", parentToken, "GET", undefined, {
          "x-campus-id": campusId,
        })
      ).status,
      400,
    );
    assert.equal(
      (await requestJson(baseUrl, "/parent/notices?class_id=other", parentToken)).status,
      400,
    );
    const empty = await requestJson(baseUrl, "/parent/notices", parentToken);
    assert.equal(empty.status, 200, JSON.stringify(empty.body));
    assert.deepEqual(empty.body.data, []);

    const submitted = await requestJson(
      baseUrl,
      "/guardian-binding/applications",
      parentToken,
      "POST",
      { student_candidate_ref: studentId, relationship: "GUARDIAN", consent: true },
    );
    assert.equal(submitted.status, 201);
    const application = submitted.body.data as { id: string; version: number };

    const teacher = await localSession(local, "teacher-east");
    const owner = await localSession(local, "owner-east");
    const created = await localRequest(local, "POST", "/local/notices", teacher, {
      template: "CLASS_ACTIVITY",
    });
    assert.equal(created.statusCode, 201, created.body);
    let row = created.json() as { id: string; version: number };
    assert.deepEqual((await requestJson(baseUrl, "/parent/notices", parentToken)).body.data, []);

    const submittedNotice = await localRequest(
      local,
      "POST",
      `/local/notices/${row.id}/submit`,
      teacher,
      { version: row.version },
    );
    assert.equal(submittedNotice.statusCode, 200, submittedNotice.body);
    row = submittedNotice.json() as typeof row;
    const reviewedNotice = await localRequest(
      local,
      "POST",
      `/local/notices/${row.id}/review`,
      owner,
      { version: row.version, action: "CONFIRM" },
    );
    assert.equal(reviewedNotice.statusCode, 200, reviewedNotice.body);
    row = reviewedNotice.json() as typeof row;
    const publishedNotice = await localRequest(
      local,
      "POST",
      `/local/notices/${row.id}/publish`,
      owner,
      { version: row.version },
    );
    assert.equal(publishedNotice.statusCode, 200, publishedNotice.body);
    row = publishedNotice.json() as typeof row;

    const unapprovedParentView = await requestJson(baseUrl, "/parent/notices", parentToken);
    assert.deepEqual(unapprovedParentView.body.data, []);
    const approved = await requestJson(
      baseUrl,
      `/staff/guardian-binding/applications/${application.id}/review`,
      staffToken,
      "POST",
      { version: application.version, action: "approve" },
    );
    assert.equal(approved.status, 200);

    const secondDraft = await localRequest(local, "POST", "/local/notices", teacher, {
      template: "INSTITUTION_ANNOUNCEMENT",
    });
    assert.equal(secondDraft.statusCode, 201, secondDraft.body);
    let secondRow = secondDraft.json() as { id: string; version: number };
    const secondSubmitted = await localRequest(
      local,
      "POST",
      `/local/notices/${secondRow.id}/submit`,
      teacher,
      { version: secondRow.version },
    );
    assert.equal(secondSubmitted.statusCode, 200, secondSubmitted.body);
    secondRow = secondSubmitted.json() as typeof secondRow;
    const secondReviewed = await localRequest(
      local,
      "POST",
      `/local/notices/${secondRow.id}/review`,
      owner,
      { version: secondRow.version, action: "CONFIRM" },
    );
    assert.equal(secondReviewed.statusCode, 200, secondReviewed.body);
    secondRow = secondReviewed.json() as typeof secondRow;
    const beforeSecondPublish = await requestJson(baseUrl, "/parent/notices", parentToken);
    assert.deepEqual(
      (beforeSecondPublish.body.data as { id: string }[]).map(({ id }) => id),
      [row.id],
      "confirmed but unpublished notices must remain hidden",
    );
    const secondPublished = await localRequest(
      local,
      "POST",
      `/local/notices/${secondRow.id}/publish`,
      owner,
      { version: secondRow.version },
    );
    assert.equal(secondPublished.statusCode, 200, secondPublished.body);

    const visible = await requestJson(baseUrl, "/parent/notices", parentToken);
    assert.equal(visible.status, 200, JSON.stringify(visible.body));
    const notices = visible.body.data as Record<string, unknown>[];
    assert.equal(notices.length, 2);
    const notice = notices.find((candidate) => candidate.id === row.id);
    assert.ok(notice);
    assert.deepEqual(Object.keys(notice).sort(), [
      "body",
      "id",
      "published",
      "receiptStatus",
      "requiresAcknowledgment",
      "status",
      "synthetic",
      "target",
      "title",
      "version",
    ]);
    assert.equal(notice.id, row.id);
    assert.equal(notice.receiptStatus, "UNREAD");
    assert.equal("classId" in notice, false);
    assert.equal("authorId" in notice, false);

    assert.equal(
      (
        await requestJson(baseUrl, `/parent/notices/${row.id}/ack`, parentToken, "POST", {
          version: row.version,
        })
      ).status,
      409,
      "acknowledgement before reading must be rejected",
    );
    assert.equal(
      (
        await requestJson(
          baseUrl,
          "/parent/notices/00000000-0000-4000-8000-000000000199/read",
          parentToken,
          "POST",
          { version: 1 },
        )
      ).status,
      403,
      "unknown notices must fail closed",
    );

    const read = await requestJson(baseUrl, `/parent/notices/${row.id}/read`, parentToken, "POST", {
      version: row.version,
    });
    assert.equal(read.status, 200, JSON.stringify(read.body));
    assert.equal((read.body.data as { receiptStatus: string }).receiptStatus, "READ");
    const acknowledged = await requestJson(
      baseUrl,
      `/parent/notices/${row.id}/ack`,
      parentToken,
      "POST",
      { version: row.version },
    );
    assert.equal(acknowledged.status, 200, JSON.stringify(acknowledged.body));
    assert.equal(
      (acknowledged.body.data as { receiptStatus: string }).receiptStatus,
      "ACKNOWLEDGED",
    );
    const refreshed = await requestJson(baseUrl, "/parent/notices", parentToken);
    assert.equal(
      (refreshed.body.data as { id: string; receiptStatus: string }[]).find(
        ({ id }) => id === row.id,
      )?.receiptStatus,
      "ACKNOWLEDGED",
    );
    const stale = await requestJson(baseUrl, `/parent/notices/${row.id}/ack`, parentToken, "POST", {
      version: row.version - 1,
    });
    assert.equal(stale.status, 409);
  });
});

test("invited parent reads only the published safe health summary for an approved binding", async () => {
  await withApi(async (baseUrl, local) => {
    const parentToken = await login(baseUrl, "parent-demo");
    const staffToken = await login(baseUrl, "staff-demo");
    const wrongCampusToken = await login(baseUrl, "other-campus");

    assert.equal((await fetch(new URL("/parent/health-incidents", baseUrl))).status, 401);
    assert.equal((await requestJson(baseUrl, "/parent/health-incidents", staffToken)).status, 403);
    assert.equal(
      (await requestJson(baseUrl, "/parent/health-incidents", wrongCampusToken)).status,
      403,
    );
    assert.equal(
      (
        await requestJson(baseUrl, "/parent/health-incidents", parentToken, "GET", undefined, {
          "x-campus-id": campusId,
        })
      ).status,
      400,
    );
    assert.equal(
      (await requestJson(baseUrl, "/parent/health-incidents?class_id=other", parentToken)).status,
      400,
    );
    assert.equal(
      (await requestJson(baseUrl, "/parent/health-incidents?actor_id=forged", parentToken)).status,
      401,
    );

    const applicationResponse = await requestJson(
      baseUrl,
      "/guardian-binding/applications",
      parentToken,
      "POST",
      {
        student_candidate_ref: studentId,
        relationship: "GUARDIAN",
        consent: true,
      },
    );
    assert.equal(applicationResponse.status, 201);
    const application = applicationResponse.body.data as {
      id: string;
      version: number;
    };

    const teacher = await localSession(local, "teacher-east");
    const owner = await localSession(local, "owner-east");
    assert.deepEqual(
      (await requestJson(baseUrl, "/parent/health-incidents", parentToken)).body.data,
      [],
    );

    const approved = await requestJson(
      baseUrl,
      `/staff/guardian-binding/applications/${application.id}/review`,
      staffToken,
      "POST",
      { version: application.version, action: "approve" },
    );
    assert.equal(approved.status, 200);
    assert.deepEqual(
      (await requestJson(baseUrl, "/parent/health-incidents", parentToken)).body.data,
      [],
    );

    const pendingDraft = await localRequest(local, "POST", "/local/health-incidents", teacher, {
      student: "student-alpha",
      observationCode: "NEEDS_FOLLOW_UP",
      dispositionCode: "GUARDIAN_SUMMARY_PREPARED",
    });
    assert.equal(pendingDraft.statusCode, 201, pendingDraft.body);
    const pendingRow = pendingDraft.json() as { id: string; version: number };
    assert.deepEqual(
      (await requestJson(baseUrl, "/parent/health-incidents", parentToken)).body.data,
      [],
    );

    const submitted = await localRequest(
      local,
      "POST",
      `/local/health-incidents/${pendingRow.id}/submit`,
      teacher,
      { version: pendingRow.version },
    );
    assert.equal(submitted.statusCode, 200, submitted.body);
    const reviewed = await localRequest(
      local,
      "POST",
      `/local/health-incidents/${pendingRow.id}/review`,
      owner,
      {
        version: (submitted.json() as { version: number }).version,
        action: "CONFIRM",
      },
    );
    assert.equal(reviewed.statusCode, 200, reviewed.body);
    const published = await localRequest(
      local,
      "POST",
      `/local/health-incidents/${pendingRow.id}/publish`,
      owner,
      {
        version: (reviewed.json() as { version: number }).version,
        summaryCode: "FOLLOW_UP_IN_PROGRESS",
      },
    );
    assert.equal(published.statusCode, 200, published.body);
    const publishedRow = published.json() as { id: string; version: number };

    const visible = await requestJson(baseUrl, "/parent/health-incidents", parentToken);
    assert.equal(visible.status, 200, JSON.stringify(visible.body));
    const rows = visible.body.data as Record<string, unknown>[];
    assert.equal(rows.length, 1);
    const row = rows[0]!;
    assert.deepEqual(Object.keys(row).sort(), [
      "date",
      "id",
      "parentSummary",
      "published",
      "receiptStatus",
      "status",
      "synthetic",
      "title",
      "version",
    ]);
    assert.equal(row.id, publishedRow.id);
    assert.equal(row.status, "PUBLISHED");
    assert.equal(row.published, true);
    assert.equal(row.receiptStatus, "UNREAD");
    assert.equal(row.parentSummary, "后续跟进正在进行。");
    assert.equal("studentId" in row, false);
    assert.equal("bindingId" in row, false);
    assert.equal("classId" in row, false);
    assert.equal("observationCode" in row, false);
    assert.equal("reviewedBy" in row, false);

    assert.equal(
      (
        await requestJson(baseUrl, `/parent/health-incidents/${row.id}/ack`, parentToken, "POST", {
          version: row.version,
        })
      ).status,
      409,
      "health summary acknowledgement requires a prior read",
    );
    const read = await requestJson(
      baseUrl,
      `/parent/health-incidents/${row.id}/read`,
      parentToken,
      "POST",
      { version: row.version },
    );
    assert.equal(read.status, 200, JSON.stringify(read.body));
    assert.equal((read.body.data as { receiptStatus: string }).receiptStatus, "READ");
    const acknowledged = await requestJson(
      baseUrl,
      `/parent/health-incidents/${row.id}/ack`,
      parentToken,
      "POST",
      { version: row.version },
    );
    assert.equal(acknowledged.status, 200, JSON.stringify(acknowledged.body));
    assert.equal(
      (acknowledged.body.data as { receiptStatus: string }).receiptStatus,
      "ACKNOWLEDGED",
    );
    assert.equal(
      (
        await requestJson(baseUrl, `/parent/health-incidents/${row.id}/ack`, parentToken, "POST", {
          version: Number(row.version) - 1,
        })
      ).status,
      409,
      "stale health summary versions must be rejected",
    );
    assert.deepEqual(
      (
        (await requestJson(baseUrl, "/parent/health-incidents", parentToken)).body.data as {
          receiptStatus: string;
        }[]
      ).map(({ receiptStatus }) => receiptStatus),
      ["ACKNOWLEDGED"],
    );
  });
});
