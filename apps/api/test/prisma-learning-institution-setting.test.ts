import assert from "node:assert/strict";
import test from "node:test";
import type { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaLearningInstitutionSettingService } from "../src/modules/learning/prisma-learning-institution-setting.service.js";

const context = {
  actorId: "actor",
  tenantId: "tenant",
  campusId: "campus",
  capabilities: ["learning:institution-setting"],
};
function fixture() {
  const calls: { name: string; args: unknown }[] = [];
  let row: { enabled: boolean; version: number } | null = null;
  let members = [{ membershipId: "member" }];
  const database = {
    membershipCampus: {
      findMany: async (args: unknown) => {
        calls.push({ name: "member", args });
        return members;
      },
    },
    aIInstitutionSetting: {
      findUnique: async (args: unknown) => {
        calls.push({ name: "read", args });
        return row;
      },
      create: async (args: { data: { enabled: boolean; version: number } }) => {
        calls.push({ name: "create", args });
        row = { enabled: args.data.enabled, version: args.data.version };
        return row;
      },
      updateMany: async (args: { where: { version: number }; data: { enabled: boolean } }) => {
        calls.push({ name: "update", args });
        if (row?.version !== args.where.version) return { count: 0 };
        row = { enabled: args.data.enabled, version: row.version + 1 };
        return { count: 1 };
      },
    },
  };
  const prisma = {
    ...database,
    $transaction: async (run: (db: typeof database) => unknown) => run(database),
  };
  return {
    service: new PrismaLearningInstitutionSettingService(prisma as unknown as PrismaClient),
    calls,
    revoke: () => {
      members = [];
    },
  };
}

test("institution settings default closed, create version one and update with scoped compare-and-swap", async () => {
  const { service, calls } = fixture();
  assert.deepEqual(await service.read(context), { enabled: false, version: 0 });
  assert.deepEqual(await service.update(context, { enabled: true, expectedVersion: 0 }), {
    enabled: true,
    version: 1,
  });
  assert.deepEqual(await service.update(context, { enabled: false, expectedVersion: 1 }), {
    enabled: false,
    version: 2,
  });
  assert.deepEqual(calls.find((c) => c.name === "create")?.args, {
    data: {
      tenantId: "tenant",
      campusId: "campus",
      enabled: true,
      version: 1,
      updatedByMembershipId: "member",
    },
    select: { enabled: true, version: true },
  });
  assert.deepEqual(calls.find((c) => c.name === "update")?.args, {
    where: { tenantId: "tenant", campusId: "campus", version: 1 },
    data: { enabled: false, version: { increment: 1 }, updatedByMembershipId: "member" },
  });
  assert.deepEqual(calls.find((c) => c.name === "member")?.args, {
    where: {
      tenantId: "tenant",
      campusId: "campus",
      campus: { status: "ACTIVE" },
      membership: {
        userId: "actor",
        status: "ACTIVE",
        user: { status: "ACTIVE" },
        tenant: { status: "ACTIVE" },
      },
    },
    select: { membershipId: true },
  });
});

test("invalid fields, missing permission, inactive member and stale version cannot save", async () => {
  const { service, calls, revoke } = fixture();
  for (const body of [
    null,
    {},
    { enabled: "yes", expectedVersion: 0 },
    { enabled: true, expectedVersion: -1 },
    { enabled: true, expectedVersion: 0.5 },
    { enabled: true, expectedVersion: 2147483647 },
    { enabled: true, expectedVersion: 0, tenantId: "forged" },
  ]) {
    await assert.rejects(service.update(context, body), { statusCode: 400 });
  }
  assert.equal(calls.length, 0);
  await assert.rejects(service.read({ ...context, capabilities: [] }), { statusCode: 403 });
  await service.update(context, { enabled: true, expectedVersion: 0 });
  await assert.rejects(service.update(context, { enabled: false, expectedVersion: 5 }), {
    statusCode: 409,
  });
  revoke();
  await assert.rejects(service.read(context), { statusCode: 403 });
  await assert.rejects(service.update(context, { enabled: false, expectedVersion: 1 }), {
    statusCode: 403,
  });
});
