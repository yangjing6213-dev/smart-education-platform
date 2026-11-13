import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import test from "node:test";
import type { TrustedAuthResult } from "@student-care/auth";
import type { AdminAuditMetadata } from "@student-care/contracts";
import {
  AuditService,
  InMemoryAuditStore,
  type AuditAction,
} from "../src/modules/audit/audit.service.js";
import { createApiApp } from "../src/nest/api-app.js";
import { buildServer } from "../src/server.js";

const ACTOR_ID = "00000000-0000-4000-8000-000000000003";
const TENANT_ID = "00000000-0000-4000-8000-000000000001";
const EAST_CAMPUS_ID = "00000000-0000-4000-8000-000000000002";
const WEST_CAMPUS_ID = "00000000-0000-4000-8000-000000000004";
const OTHER_TENANT_ID = "00000000-0000-4000-8000-000000000005";
const OTHER_CAMPUS_ID = "00000000-0000-4000-8000-000000000006";

const OWNER_AUTH: TrustedAuthResult = {
  trusted: true,
  session: {
    trusted: true,
    status: "ACTIVE",
    actor_id: ACTOR_ID,
    expires_at: "2099-01-01T00:00:00.000Z",
  },
  identity: { actor_id: ACTOR_ID, display_name: "合成负责人" },
  memberships: [
    {
      tenant_id: TENANT_ID,
      campus_ids: [EAST_CAMPUS_ID, WEST_CAMPUS_ID],
      status: "ACTIVE",
      capabilities: ["memberships:read"],
    },
  ],
};

function makeAuditService(): AuditService {
  const timestamps = [
    "2026-09-15T12:00:00.000Z",
    "2026-09-16T12:00:00.000Z",
    "2026-09-15T13:00:00.000Z",
  ];
  let timeIndex = 0;
  let eventIndex = 0;
  const service = new AuditService(new InMemoryAuditStore(), {
    now: () => new Date(timestamps[timeIndex++] ?? timestamps.at(-1)!),
    createEventId: () => `synthetic-audit-${++eventIndex}`,
  });
  const events: readonly {
    readonly action: AuditAction;
    readonly tenantId?: string;
    readonly campusId: string;
    readonly targetId: string;
    readonly operation: NonNullable<AdminAuditMetadata["operation"]>;
    readonly status: NonNullable<AdminAuditMetadata["status"]>;
  }[] = [
    {
      action: "CONTENT_PUBLISHED",
      campusId: EAST_CAMPUS_ID,
      targetId: "synthetic-content-east-1",
      operation: "PUBLISH",
      status: "PUBLISHED",
    },
    {
      action: "CONTENT_DRAFT_UPDATED",
      campusId: EAST_CAMPUS_ID,
      targetId: "synthetic-content-east-2",
      operation: "UPDATE",
      status: "UPDATED",
    },
    {
      action: "CONTENT_PUBLISHED",
      tenantId: OTHER_TENANT_ID,
      campusId: OTHER_CAMPUS_ID,
      targetId: "synthetic-content-other-tenant",
      operation: "PUBLISH",
      status: "PUBLISHED",
    },
    {
      action: "CONTENT_PUBLISHED",
      campusId: WEST_CAMPUS_ID,
      targetId: "synthetic-content-west-1",
      operation: "PUBLISH",
      status: "PUBLISHED",
    },
  ];

  for (const event of events) {
    const result = service.executeProtectedCommand(
      {
        trusted: true,
        actorId: ACTOR_ID,
        activeMembership: true,
        scope: { tenantId: event.tenantId ?? TENANT_ID, campusId: event.campusId },
        capabilities: ["memberships:read"],
      },
      {
        action: event.action,
        target: { type: "CONTENT", id: event.targetId },
        correlationId: "synthetic-correlation-001",
        traceId: "synthetic-trace-001",
        metadata: {
          channel: "ADMIN_WEB",
          operation: event.operation,
          status: event.status,
          synthetic_reference: event.targetId,
        },
      },
      () => ({ ok: true, data: true }),
    );
    assert.equal(result.ok, true);
  }

  return service;
}

async function getJson(base: string, path: string, headers?: Record<string, string>) {
  const response = await fetch(`${base}${path}`, {
    headers: { connection: "close", ...headers },
  });
  return {
    status: response.status,
    body: (await response.json()) as Record<string, unknown>,
  };
}

function errorCode(body: Record<string, unknown>): string | undefined {
  const error = body.error as Record<string, unknown> | undefined;
  return typeof error?.code === "string" ? error.code : undefined;
}

test("Nest admin audit reads match Fastify scoping, filters, and access errors", async () => {
  let auth: TrustedAuthResult | undefined = OWNER_AUTH;
  const auditService = makeAuditService();
  const options = {
    getTrustedAuthResult: () => auth,
    auditService,
  } as Parameters<typeof createApiApp>[0] & Parameters<typeof buildServer>[0];
  const nest = await createApiApp(options);
  const fastify = buildServer(options);

  try {
    await nest.listen(0, "127.0.0.1");
    await fastify.listen({ port: 0, host: "127.0.0.1" });
    const nestAddress = nest.getHttpServer().address() as AddressInfo;
    const fastifyAddress = fastify.server.address() as AddressInfo;
    assert.equal(nestAddress.address, "127.0.0.1");
    assert.equal(fastifyAddress.address, "127.0.0.1");
    const nestBase = `http://127.0.0.1:${nestAddress.port}`;
    const fastifyBase = `http://127.0.0.1:${fastifyAddress.port}`;

    const compare = async (path: string, headers?: Record<string, string>) => {
      const [nestResult, fastifyResult] = await Promise.all([
        getJson(nestBase, path, headers),
        getJson(fastifyBase, path, headers),
      ]);
      assert.equal(nestResult.status, fastifyResult.status, path);
      if (nestResult.status === 200) {
        assert.deepEqual(nestResult.body.data, fastifyResult.body.data, path);
      } else {
        assert.equal(errorCode(nestResult.body), errorCode(fastifyResult.body), path);
      }
      return nestResult;
    };

    const unfiltered = await compare("/admin/audit-logs");
    const scopedEvents = unfiltered.body.data as readonly Record<string, unknown>[];
    assert.equal(scopedEvents.length, 2);
    assert.ok(scopedEvents.every((event) => event.tenant_id === TENANT_ID));
    assert.ok(scopedEvents.every((event) => event.campus_id === EAST_CAMPUS_ID));

    const filtered = await compare(
      "/admin/audit-logs?action=CONTENT_PUBLISHED&actor_ref=" +
        ACTOR_ID +
        "&target_type=CONTENT&target_ref=synthetic-content-east-1&correlation_id=synthetic-correlation-001&trace_id=synthetic-trace-001&from=2026-09-15T12%3A00%3A00.000Z&to=2026-09-15T12%3A00%3A00.000Z&limit=1",
    );
    const events = filtered.body.data as readonly Record<string, unknown>[];
    assert.equal(events.length, 1);
    assert.equal(events[0]?.campus_id, EAST_CAMPUS_ID);
    assert.equal(events[0]?.target_id, "synthetic-content-east-1");
    assert.equal(events[0]?.synthetic_data, true);

    for (const path of [
      "/admin/audit-logs?tenant_id=" + TENANT_ID,
      "/admin/audit-logs?campus_id=" + EAST_CAMPUS_ID,
      "/admin/audit-logs?unexpected=value",
      "/admin/audit-logs?action=NOT_AN_ACTION",
      "/admin/audit-logs?limit=101",
      "/admin/audit-logs?from=2026-09-16T00%3A00%3A00.000Z&to=2026-09-15T00%3A00%3A00.000Z",
    ]) {
      const result = await compare(path);
      assert.equal(result.status, 400, path);
      assert.equal(errorCode(result.body), "VALIDATION_FAILED", path);
    }

    for (const path of [
      "/admin/audit-logs?tenant_id=" + OTHER_TENANT_ID,
      "/admin/audit-logs?campus_id=" + OTHER_CAMPUS_ID,
    ]) {
      const result = await compare(path);
      assert.equal(result.status, 403, path);
      assert.equal(errorCode(result.body), "FORBIDDEN_SCOPE", path);
    }

    const forged = await compare("/admin/audit-logs?actor_id=" + ACTOR_ID);
    assert.equal(forged.status, 401);
    assert.equal(errorCode(forged.body), "UNAUTHENTICATED");

    auth = undefined;
    const unauthenticated = await compare("/admin/audit-logs");
    assert.equal(unauthenticated.status, 401);
    assert.equal(errorCode(unauthenticated.body), "UNAUTHENTICATED");

    auth = { ...OWNER_AUTH, memberships: [] };
    const noMembership = await compare("/admin/audit-logs");
    assert.equal(noMembership.status, 403);
    assert.equal(errorCode(noMembership.body), "FORBIDDEN_SCOPE");

    auth = {
      ...OWNER_AUTH,
      memberships: [{ ...OWNER_AUTH.memberships[0]!, status: "SUSPENDED" }],
    };
    const inactiveMembership = await compare("/admin/audit-logs");
    assert.equal(inactiveMembership.status, 403);
    assert.equal(errorCode(inactiveMembership.body), "FORBIDDEN_SCOPE");

    auth = {
      ...OWNER_AUTH,
      memberships: [{ ...OWNER_AUTH.memberships[0]!, capabilities: ["content:write"] }],
    };
    const unauthorized = await compare("/admin/audit-logs");
    assert.equal(unauthorized.status, 403);
    assert.equal(errorCode(unauthorized.body), "FORBIDDEN_SCOPE");
  } finally {
    await Promise.all([nest.close(), fastify.close()]);
  }

  assert.equal(nest.getHttpServer().address(), null);
  assert.equal(fastify.server.address(), null);
});

test("Nest meal publication audit is bounded and uses trusted membership scope", async () => {
  let auth: TrustedAuthResult | undefined = OWNER_AUTH;
  const calls: { readonly tenantId: string; readonly campusId: string; readonly limit: number }[] =
    [];
  const mealPublicationAuditService = {
    async list(
      context: {
        scope: { tenantId: string; campusId: string };
        capabilities: readonly string[];
      },
      limit = 50,
    ) {
      if (!context.capabilities.includes("memberships:read")) {
        return { ok: false as const, error: { code: "FORBIDDEN_SCOPE" as const } };
      }
      calls.push({
        tenantId: context.scope.tenantId,
        campusId: context.scope.campusId,
        limit,
      });
      return {
        ok: true as const,
        data: [
          {
            event_id: "synthetic-publication-event",
            tenant_id: context.scope.tenantId,
            campus_id: context.scope.campusId,
            meal_id: "synthetic-meal-plan",
            action: "PUBLISHED" as const,
            resulting_version: 2,
            actor_membership_id: "00000000-0000-4000-8000-000000000007",
            occurred_at: "2026-10-22T10:00:00.000Z",
          },
        ],
      };
    },
  };
  const nest = await createApiApp({
    getTrustedAuthResult: () => auth,
    auditService: makeAuditService(),
    mealPublicationAuditService,
  });

  try {
    await nest.listen(0, "127.0.0.1");
    const address = nest.getHttpServer().address() as AddressInfo;
    const base = `http://127.0.0.1:${address.port}`;
    const result = await getJson(
      base,
      `/admin/audit-logs/meal-publications?campus_id=${WEST_CAMPUS_ID}&limit=5`,
    );
    const events = result.body.data as readonly Record<string, unknown>[];
    assert.equal(result.status, 200);
    assert.equal(events.length, 1);
    assert.equal(events[0]?.campus_id, WEST_CAMPUS_ID);
    assert.equal("student_id" in events[0]!, false);
    assert.deepEqual(calls, [{ tenantId: TENANT_ID, campusId: WEST_CAMPUS_ID, limit: 5 }]);

    const invalid = await getJson(base, "/admin/audit-logs/meal-publications?limit=101");
    assert.equal(invalid.status, 400);
    assert.equal(errorCode(invalid.body), "VALIDATION_FAILED");

    const outOfScope = await getJson(
      base,
      `/admin/audit-logs/meal-publications?campus_id=${OTHER_CAMPUS_ID}`,
    );
    assert.equal(outOfScope.status, 403);
    assert.equal(errorCode(outOfScope.body), "FORBIDDEN_SCOPE");

    auth = {
      ...OWNER_AUTH,
      memberships: [{ ...OWNER_AUTH.memberships[0]!, capabilities: ["content:write"] }],
    };
    const unauthorized = await getJson(base, "/admin/audit-logs/meal-publications");
    assert.equal(unauthorized.status, 403);
    assert.equal(errorCode(unauthorized.body), "FORBIDDEN_SCOPE");
  } finally {
    await nest.close();
  }
});
