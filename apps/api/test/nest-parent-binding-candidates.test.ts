import assert from "node:assert/strict";
import { test } from "node:test";
import type { AddressInfo } from "node:net";
import type { TrustedAuthResult } from "@student-care/auth";
import type { PrismaClient } from "../src/generated/prisma/client.js";
import { GuardianBindingService } from "../src/modules/guardian-bindings/guardian-binding.service.js";
import { PrismaGuardianBindingService } from "../src/modules/guardian-bindings/prisma-guardian-binding.service.js";
import { createApiApp } from "../src/nest/api-app.js";
import { createProductionApiOptions } from "../src/nest/production-api-options.js";
import {
  createInvitePasswordHash,
  parseInviteAccountsJson,
} from "../src/nest/invite-auth.service.js";

const actorId = "00000000-0000-4000-8000-000000000101";
const tenantId = "00000000-0000-4000-8000-000000000064";
const campusId = "00000000-0000-4000-8000-000000000065";
const studentId = "00000000-0000-4000-8000-0000000000c8";
const otherStudent = "00000000-0000-4000-8000-0000000000c9";
const context = { scopes: [{ actorId, tenantId, campusId }] };
const input = {
  student_candidate_ref: studentId,
  relationship: "GUARDIAN",
  consent: true,
} as const;
const membership = {
  tenant_id: tenantId,
  campus_ids: [campusId],
  status: "ACTIVE",
  capabilities: ["binding:apply"],
} as const;

async function account() {
  return {
    username: "synthetic.parent",
    password_hash: await createInvitePasswordHash("Synthetic-189-only!"),
    identity: { actor_id: actorId, display_name: "虚构家长" },
    memberships: [membership],
    binding_student_ids: [studentId],
  };
}

test("server invitation candidates are bounded, unique UUIDs and copied without accepting extra fields", async () => {
  const value = await account();
  assert.deepEqual(parseInviteAccountsJson(JSON.stringify([value])), [value]);
  for (const ids of [["invalid"], [studentId, studentId], Array(101).fill(studentId), "all"]) {
    assert.throws(
      () => parseInviteAccountsJson(JSON.stringify([{ ...value, binding_student_ids: ids }])),
      /invalid/,
    );
  }
  assert.throws(
    () => parseInviteAccountsJson(JSON.stringify([{ ...value, any_student: true }])),
    /invalid/,
  );
});

test("missing invitations and mixed actors fail closed before reading or writing students", async () => {
  const prisma = {} as PrismaClient;
  const unconfigured = new PrismaGuardianBindingService(prisma);
  assert.deepEqual(await unconfigured.listStudentOptions(context), []);
  assert.equal((await unconfigured.submit(context, input)).ok, false);
  const service = new PrismaGuardianBindingService(prisma, new Map([[actorId, [studentId]]]));
  assert.equal(
    (await service.submit(context, { ...input, student_candidate_ref: otherStudent })).ok,
    false,
  );
  const mixed = { scopes: [...context.scopes, { actorId: otherStudent, tenantId, campusId }] };
  assert.deepEqual(await service.listStudentOptions(mixed), []);
  assert.equal((await service.submit(mixed, input)).ok, false);
});

test("production candidate query intersects account invitations with trusted active campus scope", async () => {
  const queries: unknown[] = [];
  const prisma = {
    student: {
      findMany: async (query: unknown) => {
        queries.push(query);
        return [{ id: studentId, displayRef: "虚构学生甲" }];
      },
    },
  } as unknown as PrismaClient;
  const options = createProductionApiOptions(
    prisma,
    parseInviteAccountsJson(JSON.stringify([await account()])),
  );
  assert.deepEqual(await options.guardianBindingOperations!.listStudentOptions!(context), [
    { id: studentId, alias: studentId, label: "虚构学生甲" },
  ]);
  assert.deepEqual(queries, [
    {
      where: { id: { in: [studentId] }, status: "ACTIVE", OR: [{ tenantId, campusId }] },
      select: { id: true, displayRef: true },
      orderBy: { id: "asc" },
      take: 100,
    },
  ]);
  assert.deepEqual(
    await options.guardianBindingOperations!.listStudentOptions!({
      scopes: [{ actorId: otherStudent, tenantId, campusId }],
    }),
    [],
  );
  assert.equal(queries.length, 1);
});

test("candidate endpoint requires binding permission, rejects forged scope and returns only permitted labels", async () => {
  const queries: unknown[] = [];
  const service = new PrismaGuardianBindingService(
    {
      student: {
        findMany: async (query: unknown) => {
          queries.push(query);
          return [{ id: studentId, displayRef: "虚构学生甲" }];
        },
      },
      $disconnect: async () => {},
    } as unknown as PrismaClient,
    new Map([[actorId, [studentId]]]),
  );
  const auth = (canApply: boolean): TrustedAuthResult => ({
    trusted: true,
    session: {
      trusted: true,
      status: "ACTIVE",
      actor_id: actorId,
      expires_at: "2099-01-01T00:00:00.000Z",
    },
    identity: { actor_id: actorId, display_name: "虚构家长" },
    memberships: [
      { ...membership, capabilities: canApply ? ["binding:apply"] : ["identity:read"] },
    ],
  });
  const app = await createApiApp({
    guardianBindingOperations: service,
    getTrustedAuthResult: async (request) =>
      request.headers.authorization === "Bearer parent"
        ? auth(true)
        : request.headers.authorization === "Bearer reader"
          ? auth(false)
          : undefined,
  });
  try {
    await app.listen(0, "127.0.0.1");
    const base = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}/parent/student-options`;
    assert.equal((await fetch(base)).status, 401);
    assert.equal((await fetch(base, { headers: { authorization: "Bearer reader" } })).status, 403);
    assert.equal(
      (
        await fetch(`${base}?campus_id=${campusId}`, {
          headers: { authorization: "Bearer parent" },
        })
      ).status,
      400,
    );
    assert.equal(
      (await fetch(base, { headers: { authorization: "Bearer parent", "x-campus-id": campusId } }))
        .status,
      400,
    );
    const response = await fetch(base, { headers: { authorization: "Bearer parent" } });
    assert.equal(response.status, 200);
    const body = (await response.json()) as { data: unknown };
    assert.deepEqual(body.data, [{ id: studentId, alias: studentId, label: "虚构学生甲" }]);
    assert.equal(queries.length, 1);
  } finally {
    await app.close();
  }
});

test("default synthetic candidate endpoint returns only options in the trusted tenant and campus scope", async () => {
  const eastMembership = membership;
  const westMembership = {
    tenant_id: "00000000-0000-4000-8000-00000000006e",
    campus_ids: ["00000000-0000-4000-8000-00000000006f"],
    status: "ACTIVE",
    capabilities: ["binding:apply"],
  } as const;
  const readerMembership = { ...membership, capabilities: ["identity:read"] } as const;
  const westActorId = "00000000-0000-4000-8000-000000000102";
  const makeAuth = (
    trustedActorId: string,
    memberships: readonly (typeof eastMembership | typeof westMembership | typeof readerMembership)[],
  ): TrustedAuthResult => ({
    trusted: true,
    session: {
      trusted: true,
      status: "ACTIVE",
      actor_id: trustedActorId,
      expires_at: "2099-01-01T00:00:00.000Z",
    },
    identity: { actor_id: trustedActorId, display_name: "虚构家长" },
    memberships,
  });
  const authByToken = new Map<string, TrustedAuthResult>([
    ["Bearer east-parent", makeAuth(actorId, [eastMembership])],
    ["Bearer west-parent", makeAuth(westActorId, [westMembership])],
    ["Bearer read-only", makeAuth(actorId, [readerMembership])],
  ]);
  const service = new GuardianBindingService();
  assert.deepEqual(service.listStudentOptions({ scopes: [] }), []);
  assert.deepEqual(
    service.listStudentOptions({
      scopes: [
        { actorId, tenantId, campusId },
        {
          actorId: westActorId,
          tenantId: westMembership.tenant_id,
          campusId: westMembership.campus_ids[0],
        },
      ],
    }),
    [],
  );
  const app = await createApiApp({
    getTrustedAuthResult: async (request) => {
      const authorization = request.headers.authorization;
      return typeof authorization === "string" ? authByToken.get(authorization) : undefined;
    },
  });
  try {
    await app.listen(0, "127.0.0.1");
    const base = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}/parent/student-options`;
    const eastResponse = await fetch(base, {
      headers: { authorization: "Bearer east-parent" },
    });
    assert.equal(eastResponse.status, 200);
    assert.deepEqual(
      (await eastResponse.json() as { data: unknown }).data,
      [
        { id: studentId, alias: studentId, label: "示例学生甲" },
        { id: otherStudent, alias: otherStudent, label: "示例学生乙" },
      ],
    );

    const westResponse = await fetch(base, {
      headers: { authorization: "Bearer west-parent" },
    });
    assert.equal(westResponse.status, 200);
    assert.deepEqual(
      (await westResponse.json() as { data: unknown }).data,
      [
        {
          id: "00000000-0000-4000-8000-000000000030",
          alias: "00000000-0000-4000-8000-000000000030",
          label: "示例学生丙",
        },
      ],
    );
    assert.equal(
      (await fetch(base, { headers: { authorization: "Bearer read-only" } })).status,
      403,
    );
  } finally {
    await app.close();
  }
});
