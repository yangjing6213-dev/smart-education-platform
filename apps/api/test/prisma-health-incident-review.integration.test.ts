import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { AddressInfo } from "node:net";
import test from "node:test";
import type { TrustedAuthResult } from "@student-care/auth";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaHealthIncidentReviewService } from "../src/modules/health-incidents/prisma-health-incident-review.service.js";
import { createApiApp } from "../src/nest/api-app.js";
import type { ApiHttpRequest } from "../src/nest/api-tokens.js";
import { listenOnFetchSafePort } from "./support/fetch-safe-port.js";

const databaseUrl = process.env.DATABASE_URL;
const capabilities = [
  "health:create",
  "health:submit",
  "health:review",
  "health:supplement",
  "health:publish",
  "health:revoke",
] as const;

function createClient(): PrismaClient {
  if (databaseUrl === undefined) throw new Error("DATABASE_URL is required for this test.");
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
}

function trustedAuth(
  actorId: string,
  campusId: string,
  tenantId: string,
  grantedCapabilities: readonly string[] = capabilities,
): TrustedAuthResult {
  return {
    trusted: true,
    session: {
      trusted: true,
      status: "ACTIVE",
      actor_id: actorId,
      expires_at: "2099-01-01T00:00:00.000Z",
    },
    identity: { actor_id: actorId, display_name: "合成员工" },
    memberships: [
      {
        tenant_id: tenantId,
        campus_ids: [campusId],
        status: "ACTIVE",
        capabilities:
          grantedCapabilities as TrustedAuthResult["memberships"][number]["capabilities"],
      },
    ],
  };
}

async function startApi(
  prisma: PrismaClient,
  sessions: Readonly<Record<string, TrustedAuthResult>>,
): Promise<{ readonly baseUrl: string; close(): Promise<void> }> {
  const app = await createApiApp({
    staffHealthIncidentReviewOperations: new PrismaHealthIncidentReviewService(prisma),
    parentHealthIncidentOperations: new PrismaHealthIncidentReviewService(prisma),
    getTrustedAuthResult: (request: ApiHttpRequest) => {
      const authorization = request.headers.authorization;
      const token =
        typeof authorization === "string"
          ? /^Bearer ([a-z-]+)$/u.exec(authorization)?.[1]
          : undefined;
      return token === undefined ? undefined : sessions[token];
    },
  });
  await listenOnFetchSafePort((port) => app.listen(port, "127.0.0.1"));
  const address = app.getHttpServer().address() as AddressInfo | null;
  if (address === null) throw new Error("Synthetic API did not bind to loopback.");
  return { baseUrl: `http://127.0.0.1:${address.port}`, close: () => app.close() };
}

async function requestJson(
  baseUrl: string,
  path: string,
  token: string,
  method: "GET" | "POST" = "GET",
  body?: unknown,
): Promise<{ readonly status: number; readonly body: Record<string, unknown> }> {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      ...(body === undefined ? {} : { "content-type": "application/json" }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return { status: response.status, body: (await response.json()) as Record<string, unknown> };
}

test(
  "health review persists fixed-code transitions and only exposes assigned synthetic students",
  { skip: databaseUrl === undefined },
  async () => {
    const parsedUrl = new URL(databaseUrl!);
    assert.equal(parsedUrl.hostname, "127.0.0.1");
    assert.equal(parsedUrl.port, "55436");

    const tenantOne = randomUUID();
    const tenantTwo = randomUUID();
    const campusOne = randomUUID();
    const campusTwo = randomUUID();
    const campusThree = randomUUID();
    const scopes = [
      { key: "main", tenantId: tenantOne, campusId: campusOne, classRef: "class-synthetic-a" },
      {
        key: "otherclass",
        tenantId: tenantOne,
        campusId: campusOne,
        classRef: "class-synthetic-b",
      },
      {
        key: "othercampus",
        tenantId: tenantOne,
        campusId: campusTwo,
        classRef: "class-synthetic-a",
      },
      {
        key: "othertenant",
        tenantId: tenantTwo,
        campusId: campusThree,
        classRef: "class-synthetic-a",
      },
      {
        key: "unassigned",
        tenantId: tenantOne,
        campusId: campusOne,
        classRef: "class-synthetic-unassigned",
      },
    ].map((scope) => ({
      ...scope,
      actorId: randomUUID(),
      membershipId: randomUUID(),
    }));
    const incidents = [
      ...["confirm-publish", "return", "escalate"].map((key) => ({ key, scopeKey: "main" })),
      { key: "otherclass", scopeKey: "otherclass" },
      { key: "othercampus", scopeKey: "othercampus" },
      { key: "othertenant", scopeKey: "othertenant" },
    ].map((incident) => {
      const scope = scopes.find(({ key }) => key === incident.scopeKey);
      assert.ok(scope);
      return {
        ...incident,
        tenantId: scope.tenantId,
        campusId: scope.campusId,
        classRef: scope.classRef,
        createdByMembershipId: scope.membershipId,
        studentId: randomUUID(),
        guardianId: randomUUID(),
        applicationId: randomUUID(),
        relationshipId: randomUUID(),
        incidentId: randomUUID(),
        onboardingScopeRef: randomUUID(),
        studentCandidateRef: randomUUID(),
      };
    });
    const parentSource = incidents.find(({ key }) => key === "confirm-publish");
    assert.ok(parentSource);
    const otherParentSource = incidents.find(({ key }) => key === "return");
    assert.ok(otherParentSource);
    const otherStaffId = randomUUID();
    const otherStaffMembershipId = randomUUID();
    const sessions = {
      ...Object.fromEntries(
        scopes.map((scope) => [
          scope.key,
          trustedAuth(scope.actorId, scope.campusId, scope.tenantId),
        ]),
      ),
      parent: trustedAuth(parentSource.guardianId, campusOne, tenantOne, ["binding:read"]),
      otherparent: trustedAuth(otherParentSource.guardianId, campusOne, tenantOne, [
        "binding:read",
      ]),
      otherstaff: trustedAuth(otherStaffId, campusOne, tenantOne, ["health:submit"]),
      peercreator: trustedAuth(otherStaffId, campusOne, tenantOne, ["health:create"]),
      reviewer: trustedAuth(otherStaffId, campusOne, tenantOne, ["health:review"]),
    } as Readonly<Record<string, TrustedAuthResult>>;
    const prisma = createClient();
    let connected = false;
    let api: Awaited<ReturnType<typeof startApi>> | undefined;

    try {
      await prisma.$connect();
      connected = true;
      await prisma.tenant.createMany({
        data: [
          { id: tenantOne, name: "合成机构甲", slug: `synthetic-${tenantOne}`, status: "ACTIVE" },
          { id: tenantTwo, name: "合成机构乙", slug: `synthetic-${tenantTwo}`, status: "ACTIVE" },
        ],
      });
      await prisma.campus.createMany({
        data: [
          { id: campusOne, tenantId: tenantOne, name: "合成东校区", status: "ACTIVE" },
          { id: campusTwo, tenantId: tenantOne, name: "合成西校区", status: "ACTIVE" },
          { id: campusThree, tenantId: tenantTwo, name: "合成外部校区", status: "ACTIVE" },
        ],
      });
      await prisma.user.createMany({
        data: [
          ...scopes.map(({ actorId }) => actorId),
          ...incidents.map(({ guardianId }) => guardianId),
          otherStaffId,
        ].map((id) => ({
          id,
          status: "ACTIVE",
        })),
      });
      await prisma.membership.createMany({
        data: scopes.map(({ tenantId, actorId, membershipId }) => ({
          id: membershipId,
          tenantId,
          userId: actorId,
          status: "ACTIVE" as const,
        })),
      });
      const parentMemberships = incidents.map(({ tenantId, guardianId }) => ({
        id: randomUUID(),
        tenantId,
        userId: guardianId,
        status: "ACTIVE" as const,
      }));
      await prisma.membership.createMany({ data: parentMemberships });
      await prisma.membershipCampus.createMany({
        data: incidents.map(({ tenantId, campusId }, index) => ({
          tenantId,
          campusId,
          membershipId: parentMemberships[index]!.id,
        })),
      });
      await prisma.membership.create({
        data: {
          id: otherStaffMembershipId,
          tenantId: tenantOne,
          userId: otherStaffId,
          status: "ACTIVE",
        },
      });
      await prisma.membershipCampus.create({
        data: {
          tenantId: tenantOne,
          campusId: campusOne,
          membershipId: otherStaffMembershipId,
        },
      });
      await prisma.membershipClass.create({
        data: {
          tenantId: tenantOne,
          campusId: campusOne,
          membershipId: otherStaffMembershipId,
          classRef: "class-synthetic-a",
        },
      });
      await prisma.membershipCampus.createMany({
        data: scopes.map(({ tenantId, campusId, membershipId }) => ({
          tenantId,
          campusId,
          membershipId,
        })),
      });
      await prisma.membershipClass.createMany({
        data: scopes
          .filter(({ key }) => key !== "unassigned")
          .map(({ tenantId, campusId, membershipId, classRef }) => ({
            tenantId,
            campusId,
            membershipId,
            classRef,
          })),
      });
      await prisma.student.createMany({
        data: [
          ...incidents.map(({ tenantId, campusId, classRef, studentId }, index) => ({
            id: studentId,
            tenantId,
            campusId,
            classRef,
            status: "ACTIVE",
            displayRef: `模拟学生-${index + 1}`,
          })),
          {
            id: randomUUID(),
            tenantId: tenantOne,
            campusId: campusOne,
            classRef: "class-synthetic-a",
            status: "ACTIVE",
            displayRef: "模拟学生-无有效关联",
          },
        ],
      });
      await prisma.bindingApplication.createMany({
        data: incidents.map(
          ({
            tenantId,
            campusId,
            applicationId,
            guardianId,
            onboardingScopeRef,
            studentCandidateRef,
            createdByMembershipId,
          }) => ({
            id: applicationId,
            tenantId,
            campusId,
            applicantUserId: guardianId,
            onboardingScopeRef,
            studentCandidateRef,
            status: "APPROVED" as const,
            reviewedByMembershipId: createdByMembershipId,
            reviewedAt: new Date("2026-10-19T00:00:00.000Z"),
          }),
        ),
      });
      await prisma.guardianRelationship.createMany({
        data: incidents.map(
          ({
            tenantId,
            campusId,
            relationshipId,
            applicationId,
            guardianId,
            studentId,
            createdByMembershipId,
          }) => ({
            id: relationshipId,
            tenantId,
            campusId,
            bindingApplicationId: applicationId,
            guardianUserId: guardianId,
            studentId,
            status: "ACTIVE" as const,
            version: 1,
            approvedByMembershipId: createdByMembershipId,
            approvedAt: new Date("2026-10-19T00:00:00.000Z"),
          }),
        ),
      });
      await prisma.healthIncident.createMany({
        data: incidents.map(
          ({
            tenantId,
            campusId,
            incidentId,
            studentId,
            relationshipId,
            guardianId,
            createdByMembershipId,
          }) => ({
            id: incidentId,
            tenantId,
            campusId,
            studentId,
            guardianRelationshipId: relationshipId,
            guardianUserId: guardianId,
            guardianRelationshipVersion: 1,
            observationCode: "NEEDS_FOLLOW_UP" as const,
            dispositionCode: "FOLLOW_UP_SCHEDULED" as const,
            status: "SUBMITTED" as const,
            published: false,
            version: 1,
            createdByMembershipId,
            updatedByMembershipId: createdByMembershipId,
          }),
        ),
      });
      const primary = incidents.filter(({ scopeKey }) => scopeKey === "main");
      const first = primary.find(({ key }) => key === "confirm-publish");
      assert.ok(first);
      await prisma.healthIncidentReceipt.create({
        data: {
          tenantId: first.tenantId,
          campusId: first.campusId,
          incidentId: first.incidentId,
          version: 1,
          status: "READ",
        },
      });

      api = await startApi(prisma, sessions);
      const unassigned = await requestJson(api.baseUrl, "/staff/health-incidents", "unassigned");
      assert.equal(unassigned.status, 403);
      const eligibleStudents = await requestJson(
        api.baseUrl,
        "/staff/health-incidents/students",
        "main",
      );
      assert.equal(eligibleStudents.status, 200, JSON.stringify(eligibleStudents.body));
      const studentOptions = eligibleStudents.body.data as {
        id: string;
        studentLabel: string;
      }[];
      assert.deepEqual(
        new Set(studentOptions.map(({ id }) => id)),
        new Set(primary.map(({ studentId }) => studentId)),
      );
      assert.ok(studentOptions.every(({ studentLabel }) => studentLabel.startsWith("模拟学生-")));
      assert.ok(
        studentOptions.every(
          (option) => !("tenantId" in option) && !("campusId" in option) && !("guardianId" in option),
        ),
      );
      assert.equal(
        (
          await requestJson(
            api.baseUrl,
            "/staff/health-incidents/students",
            "otherstaff",
          )
        ).status,
        403,
      );
      assert.equal(
        (
          await requestJson(
            api.baseUrl,
            "/staff/health-incidents/students?campusId=forged",
            "main",
          )
        ).status,
        400,
      );
      const listed = await requestJson(api.baseUrl, "/staff/health-incidents", "main");
      assert.equal(listed.status, 200, JSON.stringify(listed.body));
      const queue = listed.body.data as { id: string; studentLabel: string }[];
      assert.deepEqual(
        new Set(queue.map(({ id }) => id)),
        new Set(primary.map(({ incidentId }) => incidentId)),
      );
      assert.ok(queue.every(({ studentLabel }) => studentLabel.startsWith("模拟学生-")));

      const confirmed = await requestJson(
        api.baseUrl,
        `/staff/health-incidents/${first.incidentId}/review`,
        "main",
        "POST",
        { version: 1, action: "CONFIRM" },
      );
      assert.equal(confirmed.status, 200, JSON.stringify(confirmed.body));
      assert.equal(
        (confirmed.body.data as { status: string; version: number }).status,
        "CONFIRMED",
      );
      assert.equal((confirmed.body.data as { status: string; version: number }).version, 2);
      assert.equal("guardianUserId" in (confirmed.body.data as object), false);

      const stale = await requestJson(
        api.baseUrl,
        `/staff/health-incidents/${first.incidentId}/review`,
        "main",
        "POST",
        { version: 1, action: "RETURN" },
      );
      assert.equal(stale.status, 409);

      const supplemented = await requestJson(
        api.baseUrl,
        `/staff/health-incidents/${first.incidentId}/supplement`,
        "main",
        "POST",
        { version: 2, dispositionCode: "OBSERVATION_RECHECKED" },
      );
      assert.equal(supplemented.status, 200);
      assert.equal((supplemented.body.data as { version: number }).version, 3);

      const published = await requestJson(
        api.baseUrl,
        `/staff/health-incidents/${first.incidentId}/publish`,
        "main",
        "POST",
        { version: 3, summaryCode: "FOLLOW_UP_COMPLETED" },
      );
      assert.equal(published.status, 200);
      assert.equal(
        (published.body.data as { status: string; version: number }).status,
        "PUBLISHED",
      );
      assert.equal((published.body.data as { status: string; version: number }).version, 4);
      assert.equal(
        await prisma.healthIncidentReceipt.count({
          where: {
            tenantId: first.tenantId,
            campusId: first.campusId,
            incidentId: first.incidentId,
          },
        }),
        0,
      );
      const parentList = await requestJson(api.baseUrl, "/parent/health-incidents", "parent");
      assert.equal(parentList.status, 200, JSON.stringify(parentList.body));
      const parentRows = parentList.body.data as {
        id: string;
        receiptStatus: string;
        parentSummary: string;
      }[];
      assert.equal(parentRows.length, 1);
      assert.equal(parentRows[0]?.id, first.incidentId);
      assert.equal(parentRows[0]?.receiptStatus, "UNREAD");
      assert.equal("guardianUserId" in (parentRows[0] as object), false);

      const ackBeforeRead = await requestJson(
        api.baseUrl,
        `/parent/health-incidents/${first.incidentId}/ack`,
        "parent",
        "POST",
        { version: 4 },
      );
      assert.equal(ackBeforeRead.status, 409);
      const wrongGuardianList = await requestJson(
        api.baseUrl,
        "/parent/health-incidents",
        "otherparent",
      );
      assert.equal(wrongGuardianList.status, 200);
      assert.deepEqual(wrongGuardianList.body.data, []);
      const wrongGuardianRead = await requestJson(
        api.baseUrl,
        `/parent/health-incidents/${first.incidentId}/read`,
        "otherparent",
        "POST",
        { version: 4 },
      );
      assert.equal(wrongGuardianRead.status, 404);

      const read = await requestJson(
        api.baseUrl,
        `/parent/health-incidents/${first.incidentId}/read`,
        "parent",
        "POST",
        { version: 4 },
      );
      assert.equal(read.status, 200, JSON.stringify(read.body));
      assert.equal((read.body.data as { receiptStatus: string }).receiptStatus, "READ");
      const acknowledged = await requestJson(
        api.baseUrl,
        `/parent/health-incidents/${first.incidentId}/ack`,
        "parent",
        "POST",
        { version: 4 },
      );
      assert.equal(acknowledged.status, 200, JSON.stringify(acknowledged.body));
      assert.equal(
        (acknowledged.body.data as { receiptStatus: string }).receiptStatus,
        "ACKNOWLEDGED",
      );
      const reread = await requestJson(
        api.baseUrl,
        `/parent/health-incidents/${first.incidentId}/read`,
        "parent",
        "POST",
        { version: 4 },
      );
      assert.equal(reread.status, 200);
      assert.equal((reread.body.data as { receiptStatus: string }).receiptStatus, "ACKNOWLEDGED");
      const relisted = await requestJson(api.baseUrl, "/parent/health-incidents", "parent");
      assert.equal(
        (relisted.body.data as { receiptStatus: string }[])[0]?.receiptStatus,
        "ACKNOWLEDGED",
      );

      const revoked = await requestJson(
        api.baseUrl,
        `/staff/health-incidents/${first.incidentId}/revoke`,
        "main",
        "POST",
        { version: 4 },
      );
      assert.equal(revoked.status, 200);
      assert.equal((revoked.body.data as { status: string; version: number }).status, "REVOKED");
      assert.equal((revoked.body.data as { status: string; version: number }).version, 5);
      assert.equal(
        await prisma.healthIncidentReceipt.count({
          where: {
            tenantId: first.tenantId,
            campusId: first.campusId,
            incidentId: first.incidentId,
          },
        }),
        0,
      );

      for (const [key, action, expected] of [
        ["return", "RETURN", "RETURNED"],
        ["escalate", "ESCALATE", "EXCEPTION_PENDING"],
      ] as const) {
        const incident = primary.find((item) => item.key === key);
        assert.ok(incident);
        const reviewed = await requestJson(
          api.baseUrl,
          `/staff/health-incidents/${incident.incidentId}/review`,
          "main",
          "POST",
          { version: 1, action },
        );
        assert.equal(reviewed.status, 200);
        assert.equal((reviewed.body.data as { status: string }).status, expected);
      }

      for (const key of ["otherclass", "othercampus", "othertenant"] as const) {
        const foreign = incidents.find((item) => item.key === key);
        assert.ok(foreign);
        const denied = await requestJson(
          api.baseUrl,
          `/staff/health-incidents/${foreign.incidentId}/review`,
          "main",
          "POST",
          { version: 1, action: "CONFIRM" },
        );
        assert.equal(denied.status, 404);
        assert.equal((denied.body.error as { code: string }).code, "NOT_FOUND_SCOPED");
      }

      const unassignedCreate = await requestJson(
        api.baseUrl,
        "/staff/health-incidents",
        "unassigned",
        "POST",
        {
          studentId: first.studentId,
          observationCode: "ROUTINE_OBSERVATION",
          dispositionCode: "FOLLOW_UP_SCHEDULED",
        },
      );
      assert.equal(unassignedCreate.status, 403);

      const baseUrl = api.baseUrl;
      const draftsPath = "/staff/health-incidents/drafts";
      async function loadDrafts(token = "main") {
        const response = await requestJson(baseUrl, draftsPath, token);
        assert.equal(response.status, 200, JSON.stringify(response.body));
        return response.body.data;
      }
      assert.deepEqual(await loadDrafts(), []);
      for (const token of ["parent", "otherstaff", "unassigned"]) {
        assert.equal((await requestJson(baseUrl, draftsPath, token)).status, 403);
      }
      const created = await requestJson(api.baseUrl, "/staff/health-incidents", "main", "POST", {
        studentId: first.studentId,
        observationCode: "ROUTINE_OBSERVATION",
        dispositionCode: "FOLLOW_UP_SCHEDULED",
      });
      assert.equal(created.status, 201, JSON.stringify(created.body));
      const draft = created.body.data as { id: string; status: string; version: number };
      assert.equal(draft.status, "DRAFT");
      assert.equal(draft.version, 1);
      const expectedDraft = {
        id: draft.id,
        version: 1,
        status: "DRAFT",
        statusLabel: "草稿",
        studentId: first.studentId,
        observationCode: "ROUTINE_OBSERVATION",
        dispositionCode: "FOLLOW_UP_SCHEDULED",
        synthetic: true,
      };
      assert.deepEqual(await loadDrafts(), [expectedDraft]);
      for (const token of ["peercreator", "otherclass", "othercampus", "othertenant"]) {
        assert.deepEqual(await loadDrafts(token), []);
      }
      const secondDraft = await requestJson(baseUrl, "/staff/health-incidents", "main", "POST", {
        studentId: first.studentId,
        observationCode: "NEEDS_FOLLOW_UP",
        dispositionCode: "FOLLOW_UP_SCHEDULED",
      });
      assert.equal(secondDraft.status, 201, JSON.stringify(secondDraft.body));
      const second = {
        ...expectedDraft,
        id: (secondDraft.body.data as { id: string }).id,
        observationCode: "NEEDS_FOLLOW_UP",
      };
      const scope = { tenantId: tenantOne, campusId: campusOne };
      const tiedTime = new Date("2026-10-19T09:00:00Z");
      await prisma.healthIncident.updateMany({
        where: { ...scope, id: { in: [draft.id, second.id] } },
        data: { updatedAt: tiedTime },
      });
      const byId = draft.id < second.id ? [expectedDraft, second] : [second, expectedDraft];
      assert.deepEqual(await loadDrafts(), byId);
      await prisma.healthIncident.update({
        where: { tenantId_campusId_id: { ...scope, id: byId[1]!.id } },
        data: { updatedAt: new Date(tiedTime.getTime() + 1000) },
      });
      assert.deepEqual(await loadDrafts(), [byId[1], byId[0]]);
      const unpublishedRead = await requestJson(
        api.baseUrl,
        `/parent/health-incidents/${draft.id}/read`,
        "parent",
        "POST",
        { version: 1 },
      );
      assert.equal(unpublishedRead.status, 404);
      const nonAuthorSubmit = await requestJson(
        api.baseUrl,
        `/staff/health-incidents/${draft.id}/submit`,
        "otherstaff",
        "POST",
        { version: 1 },
      );
      assert.equal(nonAuthorSubmit.status, 403);
      const submitted = await requestJson(
        api.baseUrl,
        `/staff/health-incidents/${draft.id}/submit`,
        "main",
        "POST",
        { version: 1 },
      );
      assert.equal(submitted.status, 200, JSON.stringify(submitted.body));
      assert.equal(
        (submitted.body.data as { status: string; version: number }).status,
        "SUBMITTED",
      );
      assert.equal((submitted.body.data as { status: string; version: number }).version, 2);
      assert.deepEqual(await loadDrafts(), [second]);
      const staleSubmit = await requestJson(
        api.baseUrl,
        `/staff/health-incidents/${draft.id}/submit`,
        "main",
        "POST",
        { version: 1 },
      );
      assert.equal(staleSubmit.status, 409);

      const returned = await requestJson(
        baseUrl,
        `/staff/health-incidents/${draft.id}/review`,
        "reviewer",
        "POST",
        { version: 2, action: "RETURN" },
      );
      assert.equal(returned.status, 200);
      const cached = [
        { id: second.id, version: 1, status: "DRAFT" },
        { id: draft.id, version: 3, status: "RETURNED" },
      ];
      const cachedWhere = { ...scope, id: { in: cached.map(({ id }) => id) } };
      const readCachedRows = () => prisma.healthIncident.findMany({
        where: cachedWhere,
        orderBy: { id: "asc" },
      });
      const originalRows = await readCachedRows();
      for (const { id, status, version } of cached) {
        const row = originalRows.find((item) => item.id === id);
        assert.ok(row);
        assert.equal(row.status, status);
        assert.equal(row.version, version);
      }
      async function assertCachedSubmitDenied(reason: string) {
        for (const { id, status, version } of cached) {
          const response = await requestJson(
            baseUrl, `/staff/health-incidents/${id}/submit`, "main", "POST", { version },
          );
          assert.equal(response.status, 404, `CACHED_DRAFT_SUBMIT_MUST_BE_DENIED ${status} ${reason}`);
          assert.equal((response.body.error as { code: string }).code, "NOT_FOUND_SCOPED");
        }
        assert.deepEqual(await readCachedRows(), originalRows);
        const queue = await requestJson(baseUrl, "/staff/health-incidents", "reviewer");
        assert.equal(queue.status, 200);
        assert.ok(
          (queue.body.data as { id: string }[]).every((entry) =>
            cached.every(({ id }) => id !== entry.id),
          ),
        );
      }

      // Recheck the existing draft after changes to the student's scope or binding.
      const studentWhere = { tenantId_campusId_id: { ...scope, id: first.studentId } };
      await prisma.student.update({ where: studentWhere, data: { status: "INACTIVE" } });
      assert.deepEqual(await loadDrafts(), []);
      await assertCachedSubmitDenied("inactive student");
      await prisma.student.update({
        where: studentWhere,
        data: { status: "ACTIVE", classRef: "class-synthetic-b" },
      });
      assert.deepEqual(await loadDrafts(), []);
      await assertCachedSubmitDenied("outside assigned class");
      await prisma.student.update({ where: studentWhere, data: { classRef: first.classRef } });
      const relationshipWhere = { tenantId_campusId_id: { ...scope, id: first.relationshipId } };
      await prisma.guardianRelationship.update({ where: relationshipWhere, data: { version: 2 } });
      assert.deepEqual(await loadDrafts(), []);
      await assertCachedSubmitDenied("binding version changed");
      await prisma.guardianRelationship.update({ where: relationshipWhere, data: { version: 1 } });
      const applicationWhere = { tenantId_campusId_id: { ...scope, id: first.applicationId } };
      await prisma.bindingApplication.update({ where: applicationWhere, data: { status: "REJECTED" } });
      assert.deepEqual(await loadDrafts(), []);
      await assertCachedSubmitDenied("binding approval withdrawn");
      await prisma.bindingApplication.update({ where: applicationWhere, data: { status: "APPROVED" } });
      assert.deepEqual(await loadDrafts(), [second]);
      const replacement = await prisma.bindingApplication.create({
        data: {
          ...scope,
          applicantUserId: otherParentSource.guardianId,
          onboardingScopeRef: randomUUID(),
          studentCandidateRef: randomUUID(),
          status: "APPROVED",
          reviewedByMembershipId: first.createdByMembershipId,
          reviewedAt: tiedTime,
        },
      });
      await prisma.guardianRelationship.create({
        data: {
          ...scope,
          bindingApplicationId: replacement.id,
          guardianUserId: otherParentSource.guardianId,
          studentId: first.studentId,
          approvedByMembershipId: first.createdByMembershipId,
          approvedAt: tiedTime,
        },
      });
      assert.deepEqual(await loadDrafts(), [], "two eligible bindings");
      await assertCachedSubmitDenied("two eligible bindings");
      await prisma.guardianRelationship.update({
        where: relationshipWhere,
        data: { status: "RELEASED", releasedAt: tiedTime },
      });
      assert.deepEqual(await loadDrafts(), [], "eligible binding replaced since the draft");
      await assertCachedSubmitDenied("original binding replaced");

      const resubmitPath = `/staff/health-incidents/${otherParentSource.incidentId}/submit`;
      const resubmissions = await Promise.all([
        requestJson(baseUrl, resubmitPath, "main", "POST", { version: 2 }),
        requestJson(baseUrl, resubmitPath, "main", "POST", { version: 2 }),
      ]);
      assert.deepEqual(resubmissions.map(({ status }) => status).sort(), [200, 409]);
      const successful = resubmissions.find(({ status }) => status === 200)!;
      assert.equal((successful.body.data as { status: string }).status, "SUBMITTED");
      assert.equal((successful.body.data as { version: number }).version, 3);

      const ambiguousMembershipId = randomUUID();
      const mainStaff = scopes.find(({ key }) => key === "main");
      assert.ok(mainStaff);
      await prisma.membership.create({
        data: {
          id: ambiguousMembershipId,
          tenantId: tenantOne,
          userId: mainStaff.actorId,
          status: "ACTIVE",
        },
      });
      await prisma.membershipCampus.create({
        data: { tenantId: tenantOne, campusId: campusTwo, membershipId: ambiguousMembershipId },
      });
      await prisma.membershipClass.create({
        data: {
          tenantId: tenantOne,
          campusId: campusTwo,
          membershipId: ambiguousMembershipId,
          classRef: "class-synthetic-a",
        },
      });
      const ambiguous = await requestJson(api.baseUrl, "/staff/health-incidents", "main");
      assert.equal(ambiguous.status, 403);
      assert.equal((await requestJson(baseUrl, draftsPath, "main")).status, 403);
    } finally {
      if (api) await api.close();
      if (connected) await prisma.$disconnect();
    }
  },
);
