import assert from "node:assert/strict";
import test from "node:test";
import { ParentInviteConsentClient } from "./parent-consent.js";

const account = {
  actor_id: "00000000-0000-4000-8000-000000000001",
  display_name: "示例监护人甲",
  memberships: [
    {
      status: "ACTIVE",
      capabilities: ["binding:apply", "binding:read"],
    },
  ],
};
const studentId = "00000000-0000-4000-8000-0000000000c8";
const applicationId = "00000000-0000-4000-8000-000000000101";
const relationshipId = "00000000-0000-4000-8000-000000000111";
const consentId = "00000000-0000-4000-8000-000000000102";
const privacyId = "00000000-0000-4000-8000-000000000103";

function invitedFixture(
  options: { count?: number; policyStatus?: number; foreignRelationship?: boolean } = {},
) {
  const secondId = "00000000-0000-4000-8000-0000000000c9";
  const students = [studentId, secondId]
    .slice(0, options.count ?? 1)
    .map((id, index) => ({ id, alias: id, label: `合成学生 ${index + 1}` }));
  let application: Record<string, unknown> | undefined;
  let approved = false;
  const calls: string[] = [];
  const client = new ParentInviteConsentClient({
    baseUrl: "https://care.example.invalid",
    fetcher: async (input, init) => {
      const path = new URL(String(input)).pathname;
      calls.push(`${init?.method ?? "GET"} ${path}`);
      const reply = (data: unknown) => Response.json({ data });
      if (path === "/api-local/me") return reply(account);
      if (path === "/api-local/parent/student-options") return reply(students);
      if (path === "/api-local/consent-policies")
        return Response.json(
          { error: { code: "NOT_FOUND" } },
          { status: options.policyStatus ?? 404 },
        );
      if (path === "/api-local/guardian-binding/applications") {
        if (init?.method === "POST") {
          const body = JSON.parse(String(init.body)) as { student_candidate_ref: string };
          assert.ok(students.some((student) => student.id === body.student_candidate_ref));
          application = {
            id: applicationId,
            student_candidate_ref: body.student_candidate_ref,
            relationship: "GUARDIAN",
            status: "PENDING",
            version: 1,
            submitted_at: "2026-11-13T00:00:00.000Z",
            reviewed_at: null,
          };
          return Response.json({ data: application, request_id: consentId }, { status: 201 });
        }
        return reply(
          application ? [{ ...application, status: approved ? "APPROVED" : "PENDING" }] : [],
        );
      }
      if (path === "/api-local/guardian-relationships")
        return reply(
          approved && application
            ? [
                {
                  id: relationshipId,
                  student_id: options.foreignRelationship
                    ? secondId
                    : application.student_candidate_ref,
                  relationship: "GUARDIAN",
                  status: "ACTIVE",
                  source_application_id: applicationId,
                  version: 1,
                  approved_at: "2026-11-13T00:01:00.000Z",
                },
              ]
            : [],
        );
      assert.fail(`Unexpected endpoint ${path}`);
    },
  });
  return {
    client,
    calls,
    students,
    approve: () => {
      approved = true;
    },
  };
}

test("UUID student options remain usable when the separate consent module is not installed", async () => {
  const { client, calls, approve } = invitedFixture();
  await client.connect();
  assert.equal(client.snapshot.status, "READY");
  await client.applyBinding();
  assert.equal(client.snapshot.bindingStatus, "PENDING");
  approve();
  await client.refresh();
  assert.equal(client.snapshot.bindingStatus, "APPROVED");
  assert.equal(client.snapshot.relationship?.studentId, studentId);
  await client.submitPrivacyRequest("ACCESS");
  assert.ok(
    calls.every((call) => !call.includes("/privacy-requests") && !call.endsWith("/consents")),
  );
});

test("multiple invited students require selection and keep independent binding state", async () => {
  const { client, calls, students, approve } = invitedFixture({ count: 2 });
  await client.connect();
  assert.equal(client.snapshot.status, "READY");
  await client.applyBinding();
  assert.equal(calls.filter((call) => call.startsWith("POST")).length, 0);
  const selectable = client as unknown as { selectStudent(id: string): Promise<void> };
  await selectable.selectStudent(students[0]!.id);
  await client.applyBinding();
  assert.equal(client.snapshot.bindingStatus, "PENDING");
  approve();
  await client.refresh();
  assert.equal(client.snapshot.bindingStatus, "APPROVED");
  await selectable.selectStudent(students[1]!.id);
  assert.equal(client.snapshot.bindingStatus, "NONE");
  assert.equal(client.snapshot.relationship, null);
  await selectable.selectStudent("00000000-0000-4000-8000-000000000099");
  await client.applyBinding();
  assert.equal(
    calls.filter((call) => call.startsWith("POST")).length,
    1,
    "an invalid selection must not submit the previously selected child",
  );
});

for (const policyStatus of [401, 403, 500])
  test(`optional governance HTTP ${policyStatus} is not silently ignored`, async () => {
    const { client, calls } = invitedFixture({ policyStatus });
    await client.connect();
    assert.equal(client.snapshot.status, "ERROR");
    await client.applyBinding();
    assert.ok(calls.every((call) => !call.startsWith("POST")));
  });

test("a relationship belonging to another student is rejected", async () => {
  const { client, approve } = invitedFixture({ foreignRelationship: true });
  await client.connect();
  await client.applyBinding();
  approve();
  await client.refresh();
  assert.equal(client.snapshot.status, "ERROR");
});

test("invited parent uses the same-origin cookie client for binding, consent and privacy", async () => {
  const module = (await import("./parent-consent.js")) as unknown as Record<string, unknown>;
  const Client = module.ParentInviteConsentClient as
    | (new (options: { baseUrl: string; fetcher: typeof fetch }) => {
        connect(): Promise<void>;
        refresh(): Promise<void>;
        applyBinding(): Promise<void>;
        releaseRelationship(confirmed: boolean): Promise<void>;
        grant(key: "CARE_RECORD", confirmed: boolean): Promise<void>;
        revoke(index: number, confirmed: boolean): Promise<void>;
        submitPrivacyRequest(type: "ACCESS"): Promise<void>;
        withdrawPrivacyRequest(index: number): Promise<void>;
        readonly snapshot: {
          readonly status: string;
          readonly bindingStatus: string;
          readonly relationship: {
            readonly id: string;
            readonly status: string;
            readonly version: number;
          } | null;
          readonly consents: readonly { readonly status: string; readonly dataChanged: false }[];
          readonly privacyRequests: readonly {
            readonly status: string;
            readonly dataChanged: false;
          }[];
        };
      })
    | undefined;
  assert.equal(typeof Client, "function", "the invite-backed parent client must exist");
  if (!Client) throw new Error("The invite-backed parent client must exist.");

  let bindingStatus: "PENDING" | "APPROVED" | undefined;
  let relationshipStatus: "ACTIVE" | "RELEASED" | undefined;
  let relationshipVersion = 1;
  let consentStatus: "ACTIVE" | "REVOKED" | undefined;
  let privacyStatus: "SUBMITTED" | "WITHDRAWN" | undefined;
  const calls: {
    path: string;
    method: string;
    authorization: boolean;
    body?: unknown;
  }[] = [];
  const client = new Client({
    baseUrl: "https://care.example.invalid",
    fetcher: async (input, init) => {
      const url = new URL(String(input));
      assert.equal(url.origin, "https://care.example.invalid");
      assert.equal(init?.credentials, "same-origin");
      assert.equal(init?.cache, "no-store");
      assert.equal(init?.redirect, "error");
      const headers = new Headers(init?.headers);
      calls.push({
        path: url.pathname,
        method: init?.method ?? "GET",
        authorization: headers.has("authorization"),
        ...(typeof init?.body === "string" ? { body: JSON.parse(init.body) as unknown } : {}),
      });
      const reply = (data: unknown) => Response.json({ data });
      if (url.pathname === "/api-local/me") return reply(account);
      if (url.pathname === "/api-local/parent/student-options")
        return reply([{ id: studentId, alias: "student-alpha", label: "示例学生甲" }]);
      if (url.pathname === "/api-local/guardian-binding/applications") {
        if (init?.method === "POST") {
          bindingStatus = "PENDING";
          return Response.json(
            {
              data: {
                id: applicationId,
                student_candidate_ref: studentId,
                relationship: "GUARDIAN",
                status: "PENDING",
                version: 1,
                submitted_at: "2026-10-19T00:00:00.000Z",
                reviewed_at: null,
              },
              request_id: "00000000-0000-4000-8000-000000000104",
            },
            { status: 201 },
          );
        }
        return reply(
          bindingStatus
            ? [
                {
                  id: applicationId,
                  student_candidate_ref: studentId,
                  relationship: "GUARDIAN",
                  status: bindingStatus,
                  version: 1,
                  submitted_at: "2026-10-19T00:00:00.000Z",
                  reviewed_at: bindingStatus === "APPROVED" ? "2026-10-19T00:01:00.000Z" : null,
                },
              ]
            : [],
        );
      }
      if (url.pathname === "/api-local/guardian-relationships") {
        return reply(
          relationshipStatus
            ? [
                {
                  id: relationshipId,
                  student_id: studentId,
                  relationship: "GUARDIAN",
                  status: relationshipStatus,
                  source_application_id: applicationId,
                  version: relationshipVersion,
                  approved_at: "2026-10-19T00:01:00.000Z",
                },
              ]
            : [],
        );
      }
      if (url.pathname === `/api-local/guardian-relationships/${relationshipId}/release`) {
        assert.equal(relationshipStatus, "ACTIVE");
        assert.deepEqual(JSON.parse(String(init?.body)), { version: relationshipVersion });
        relationshipStatus = "RELEASED";
        relationshipVersion += 1;
        return reply({
          id: relationshipId,
          student_id: studentId,
          relationship: "GUARDIAN",
          status: "RELEASED",
          source_application_id: applicationId,
          version: relationshipVersion,
          approved_at: "2026-10-19T00:01:00.000Z",
        });
      }
      if (url.pathname === "/api-local/consent-policies")
        return reply(
          ["CARE_RECORD", "HEALTH_SUPPORT", "LEARNING_SUPPORT"].map((key) => ({
            key,
            title: key,
            noticeVersion: `${key}_NOTICE_V1`,
            necessity: "合成用途说明",
            dataClasses: ["合成成长记录"],
            retentionDays: 30,
            retentionNotice: "仅本地演示",
            impactReviewStatus: "DEMO_ONLY_PENDING_HUMAN_REVIEW",
          })),
        );
      if (url.pathname === "/api-local/consents" && init?.method === "POST") {
        consentStatus = "ACTIVE";
        return reply({
          id: consentId,
          bindingId: applicationId,
          version: 1,
          purposeKey: "CARE_RECORD",
          purposeTitle: "成长记录",
          noticeVersion: "CARE_RECORD_NOTICE_V1",
          status: consentStatus,
          retentionStatus: "WITHIN_PERIOD",
          retentionDays: 30,
          retainUntil: "2026-11-18T00:00:00.000Z",
          retentionOutcomeNotice: null,
          dataChanged: false,
        });
      }
      if (url.pathname === "/api-local/consents")
        return reply(
          consentStatus
            ? [
                {
                  id: consentId,
                  bindingId: applicationId,
                  version: consentStatus === "ACTIVE" ? 1 : 2,
                  purposeKey: "CARE_RECORD",
                  purposeTitle: "成长记录",
                  noticeVersion: "CARE_RECORD_NOTICE_V1",
                  status: consentStatus,
                  retentionStatus: "WITHIN_PERIOD",
                  retentionDays: 30,
                  retainUntil: "2026-11-18T00:00:00.000Z",
                  retentionOutcomeNotice: null,
                  dataChanged: false,
                },
              ]
            : [],
        );
      if (url.pathname === `/api-local/consents/${consentId}/revoke`) {
        consentStatus = "REVOKED";
        return reply({
          id: consentId,
          bindingId: applicationId,
          version: 2,
          purposeKey: "CARE_RECORD",
          purposeTitle: "成长记录",
          noticeVersion: "CARE_RECORD_NOTICE_V1",
          status: "REVOKED",
          retentionStatus: "WITHIN_PERIOD",
          retentionDays: 30,
          retainUntil: "2026-11-18T00:00:00.000Z",
          retentionOutcomeNotice: null,
          dataChanged: false,
        });
      }
      if (url.pathname === "/api-local/privacy-requests" && init?.method === "POST") {
        privacyStatus = "SUBMITTED";
        return reply({
          id: privacyId,
          version: 1,
          type: "ACCESS",
          status: privacyStatus,
          updatedAt: "2026-10-19T00:00:00.000Z",
          dataChanged: false,
        });
      }
      if (url.pathname === "/api-local/privacy-requests")
        return reply(
          privacyStatus
            ? [
                {
                  id: privacyId,
                  version: privacyStatus === "SUBMITTED" ? 1 : 2,
                  type: "ACCESS",
                  status: privacyStatus,
                  updatedAt: "2026-10-19T00:00:00.000Z",
                  dataChanged: false,
                },
              ]
            : [],
        );
      if (url.pathname === `/api-local/privacy-requests/${privacyId}/withdraw`) {
        privacyStatus = "WITHDRAWN";
        return reply({
          id: privacyId,
          version: 2,
          type: "ACCESS",
          status: privacyStatus,
          updatedAt: "2026-10-19T00:01:00.000Z",
          dataChanged: false,
        });
      }
      assert.fail(`unexpected same-origin route ${url.pathname}`);
    },
  });

  await client.connect();
  assert.equal(client.snapshot.status, "READY");
  assert.equal(client.snapshot.bindingStatus, "NONE");
  await client.applyBinding();
  assert.equal(client.snapshot.bindingStatus, "PENDING");
  assert.equal(client.snapshot.status, "READY");
  bindingStatus = "APPROVED";
  relationshipStatus = "ACTIVE";
  await client.refresh();
  assert.equal(client.snapshot.bindingStatus, "APPROVED");
  assert.equal(client.snapshot.relationship?.status, "ACTIVE");
  await client.grant("CARE_RECORD", true);
  assert.equal(client.snapshot.consents[0]?.status, "ACTIVE");
  await client.revoke(0, true);
  assert.equal(client.snapshot.consents[0]?.status, "REVOKED");
  await client.submitPrivacyRequest("ACCESS");
  assert.equal(client.snapshot.privacyRequests[0]?.status, "SUBMITTED");
  await client.withdrawPrivacyRequest(0);
  assert.equal(client.snapshot.privacyRequests[0]?.status, "WITHDRAWN");
  const readsBeforeRelease = calls.length;
  await client.releaseRelationship(false);
  assert.equal(client.snapshot.relationship?.status, "ACTIVE");
  await client.releaseRelationship(true);
  assert.equal(client.snapshot.bindingStatus, "ENDED");
  assert.deepEqual(client.snapshot.relationship, {
    id: relationshipId,
    studentId,
    sourceApplicationId: applicationId,
    status: "RELEASED",
    version: 2,
    approvedAt: "2026-10-19T00:01:00.000Z",
  });
  assert.equal(client.snapshot.consents.length, 0);
  assert.equal(client.snapshot.privacyRequests.length, 0);
  assert.deepEqual(
    calls.find(
      (call) => call.path === `/api-local/guardian-relationships/${relationshipId}/release`,
    )?.method,
    "POST",
  );
  assert.deepEqual(
    calls.find(
      (call) => call.path === `/api-local/guardian-relationships/${relationshipId}/release`,
    )?.body,
    { version: 1 },
  );
  assert.ok(
    calls
      .slice(readsBeforeRelease)
      .every(
        (call) =>
          call.path !== "/api-local/consents" && call.path !== "/api-local/privacy-requests",
      ),
    "解除后的读回不能再请求授权或个人信息申请数据。",
  );
  assert.ok(client.snapshot.consents.every((row) => row.dataChanged === false));
  assert.ok(client.snapshot.privacyRequests.every((row) => row.dataChanged === false));
  assert.ok(calls.every((call) => call.path.startsWith("/api-local/")));
  assert.ok(calls.every((call) => !call.authorization));
});
