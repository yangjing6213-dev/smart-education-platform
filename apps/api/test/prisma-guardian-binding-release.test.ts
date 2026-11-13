import assert from "node:assert/strict";
import test from "node:test";
import type { PrismaClient } from "../src/generated/prisma/client.js";
import type { GuardianBindingContext } from "../src/modules/guardian-bindings/guardian-binding.service.js";
import { PrismaGuardianBindingService } from "../src/modules/guardian-bindings/prisma-guardian-binding.service.js";

const TENANT_ID = "00000000-0000-4000-8000-000000000064";
const CAMPUS_ID = "00000000-0000-4000-8000-000000000065";
const GUARDIAN_ID = "00000000-0000-4000-8000-000000000101";
const REVIEWER_ID = "00000000-0000-4000-8000-000000000102";
const RELATIONSHIP_ID = "00000000-0000-4000-8000-000000000501";

interface RelationshipRow {
  tenantId: string;
  campusId: string;
  id: string;
  bindingApplicationId: string;
  guardianUserId: string;
  studentId: string;
  status: "ACTIVE" | "RELEASED";
  version: number;
  approvedAt: Date;
  releasedAt: Date | null;
}

function guardianContext(actorId = GUARDIAN_ID, campusId = CAMPUS_ID): GuardianBindingContext {
  return {
    scopes: [{ actorId, tenantId: TENANT_ID, campusId }],
  };
}

function createHarness() {
  let current: RelationshipRow = {
    tenantId: TENANT_ID,
    campusId: CAMPUS_ID,
    id: RELATIONSHIP_ID,
    bindingApplicationId: "00000000-0000-4000-8000-000000000401",
    guardianUserId: GUARDIAN_ID,
    studentId: "00000000-0000-4000-8000-000000000301",
    status: "ACTIVE",
    version: 1,
    approvedAt: new Date("2026-10-20T09:00:00.000Z"),
    releasedAt: null,
  };
  const reads: Record<string, unknown>[] = [];
  const membershipChecks: Record<string, unknown>[] = [];
  const updates: { where: Record<string, unknown>; data: Record<string, unknown> }[] = [];
  const auditEvents: Record<string, unknown>[] = [];
  let transactionCount = 0;

  const transaction = {
    guardianRelationship: {
      findFirst: async ({ where }: { where: Record<string, unknown> }) => {
        reads.push(where);
        const scopePairs = where.OR as readonly Record<string, unknown>[] | undefined;
        const matchesScope =
          scopePairs === undefined ||
          scopePairs.some(
            (pair) => pair.tenantId === current.tenantId && pair.campusId === current.campusId,
          );
        return where.id === current.id &&
          where.guardianUserId === current.guardianUserId &&
          matchesScope
          ? { ...current }
          : null;
      },
      updateMany: async ({
        where,
        data,
      }: {
        where: Record<string, unknown>;
        data: Record<string, unknown>;
      }) => {
        updates.push({ where, data });
        if (
          where.id !== current.id ||
          where.guardianUserId !== current.guardianUserId ||
          where.tenantId !== current.tenantId ||
          where.campusId !== current.campusId ||
          where.status !== current.status ||
          where.version !== current.version
        ) {
          return { count: 0 };
        }
        const versionUpdate = data.version as { readonly increment?: number } | undefined;
        current = {
          ...current,
          status: data.status as RelationshipRow["status"],
          version: current.version + (versionUpdate?.increment ?? 0),
          releasedAt: data.releasedAt as Date,
        };
        return { count: 1 };
      },
    },
    membershipCampus: {
      findFirst: async ({ where }: { where: Record<string, unknown> }) => {
        membershipChecks.push(where);
        return { membershipId: "00000000-0000-4000-8000-000000000201" };
      },
    },
    guardianRelationshipAuditEvent: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        auditEvents.push(data);
        return { ...data, id: "00000000-0000-4000-8000-000000000601" };
      },
    },
  };
  const prisma = {
    $transaction: async <T>(run: (client: typeof transaction) => Promise<T>) => {
      transactionCount += 1;
      return run(transaction);
    },
  } as unknown as PrismaClient;

  return {
    service: new PrismaGuardianBindingService(prisma),
    current: () => current,
    reads,
    membershipChecks,
    updates,
    auditEvents,
    transactionCount: () => transactionCount,
  };
}

test("Prisma guardian release uses trusted ownership, active membership, and a versioned update", async () => {
  const harness = createHarness();
  const released = await harness.service.release(guardianContext(), RELATIONSHIP_ID, {
    version: 1,
  });

  assert.equal(released.ok, true);
  if (!released.ok)
    assert.fail("The current guardian should be able to release an active relationship.");
  assert.equal(released.data.status, "RELEASED");
  assert.equal(released.data.version, 2);
  assert.equal(harness.current().status, "RELEASED");
  assert.equal(harness.current().version, 2);
  assert.ok(harness.current().releasedAt instanceof Date);
  assert.equal(harness.reads[0]?.guardianUserId, GUARDIAN_ID);
  assert.deepEqual(harness.reads[0]?.OR, [{ tenantId: TENANT_ID, campusId: CAMPUS_ID }]);
  assert.equal(harness.membershipChecks.length, 1);
  assert.deepEqual(harness.updates[0]?.where, {
    tenantId: TENANT_ID,
    campusId: CAMPUS_ID,
    id: RELATIONSHIP_ID,
    guardianUserId: GUARDIAN_ID,
    status: "ACTIVE",
    version: 1,
  });
  assert.equal(harness.updates[0]?.data.status, "RELEASED");
  assert.deepEqual(harness.updates[0]?.data.version, { increment: 1 });
  assert.deepEqual(harness.auditEvents, [
    {
      tenantId: TENANT_ID,
      campusId: CAMPUS_ID,
      guardianRelationshipId: RELATIONSHIP_ID,
      actorMembershipId: "00000000-0000-4000-8000-000000000201",
      action: "RELEASED",
      relationshipVersion: 2,
    },
  ]);

  const staleRetry = await harness.service.release(guardianContext(), RELATIONSHIP_ID, {
    version: 1,
  });
  assert.equal(staleRetry.ok, false);
  if (staleRetry.ok) assert.fail("A repeated stale release must not succeed.");
  assert.equal(staleRetry.error.code, "VERSION_MISMATCH");
  assert.equal(harness.updates.length, 1);

  const alreadyReleased = await harness.service.release(guardianContext(), RELATIONSHIP_ID, {
    version: 2,
  });
  assert.equal(alreadyReleased.ok, false);
  if (alreadyReleased.ok) assert.fail("A released relationship cannot be released again.");
  assert.equal(alreadyReleased.error.code, "CONFLICT_STATE");
  assert.equal(harness.updates.length, 1);
});

test("Prisma guardian release rejects another campus and mixed actor scopes before mutation", async () => {
  const harness = createHarness();
  const foreignCampus = await harness.service.release(
    guardianContext(GUARDIAN_ID, "00000000-0000-4000-8000-000000000066"),
    RELATIONSHIP_ID,
    { version: 1 },
  );
  assert.equal(foreignCampus.ok, false);
  if (foreignCampus.ok) assert.fail("A foreign campus must not see the relationship.");
  assert.equal(foreignCampus.error.code, "NOT_FOUND_SCOPED");
  assert.equal(harness.updates.length, 0);

  const mixedActors = await harness.service.release(
    {
      scopes: [
        { actorId: GUARDIAN_ID, tenantId: TENANT_ID, campusId: CAMPUS_ID },
        {
          actorId: "00000000-0000-4000-8000-000000000102",
          tenantId: TENANT_ID,
          campusId: CAMPUS_ID,
        },
      ],
    },
    RELATIONSHIP_ID,
    { version: 1 },
  );
  assert.equal(mixedActors.ok, false);
  if (mixedActors.ok) assert.fail("Mixed actor scopes must be rejected.");
  assert.equal(mixedActors.error.code, "NOT_FOUND_SCOPED");
  assert.equal(harness.transactionCount(), 1);
  assert.equal(harness.updates.length, 0);
});

test("Prisma approval writes an immutable-event payload with the scoped reviewer and version", async () => {
  const applicationId = "00000000-0000-4000-8000-000000000401";
  const studentId = "00000000-0000-4000-8000-000000000301";
  const reviewerMembershipId = "00000000-0000-4000-8000-000000000201";
  const createdAt = new Date("2026-10-20T09:00:00.000Z");
  let application = {
    tenantId: TENANT_ID,
    campusId: CAMPUS_ID,
    id: applicationId,
    applicantUserId: GUARDIAN_ID,
    studentCandidateRef: studentId,
    status: "PENDING",
    version: 1,
    createdAt,
    reviewedAt: null as Date | null,
  };
  const auditEvents: Record<string, unknown>[] = [];
  const transaction = {
    bindingApplication: {
      findFirst: async () => ({ ...application }),
      updateMany: async ({ data }: { data: Record<string, unknown> }) => {
        const versionUpdate = data.version as { readonly increment: number };
        application = {
          ...application,
          status: data.status as string,
          version: application.version + versionUpdate.increment,
          reviewedAt: data.reviewedAt as Date,
        };
        return { count: 1 };
      },
    },
    membershipCampus: {
      findFirst: async () => ({ membershipId: reviewerMembershipId }),
    },
    guardianRelationship: {
      create: async ({ data }: { data: Record<string, unknown> }) => ({
        ...data,
        id: RELATIONSHIP_ID,
        version: 1,
      }),
    },
    guardianRelationshipAuditEvent: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        auditEvents.push(data);
        return { ...data };
      },
    },
  };
  const prisma = {
    $transaction: async <T>(run: (client: typeof transaction) => Promise<T>) => run(transaction),
  } as unknown as PrismaClient;
  const service = new PrismaGuardianBindingService(prisma);

  const result = await service.review(guardianContext(REVIEWER_ID), applicationId, {
    version: 1,
    action: "approve",
  });

  assert.equal(result.ok, true);
  assert.deepEqual(auditEvents, [
    {
      tenantId: TENANT_ID,
      campusId: CAMPUS_ID,
      guardianRelationshipId: RELATIONSHIP_ID,
      actorMembershipId: reviewerMembershipId,
      action: "ACTIVATED",
      relationshipVersion: 1,
    },
  ]);
});
