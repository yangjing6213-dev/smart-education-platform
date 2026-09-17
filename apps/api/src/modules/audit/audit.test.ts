import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import test from "node:test";
import { fileURLToPath } from "node:url";
import type { TrustedAuthResult } from "@student-care/auth";
import fastify from "fastify";
import * as ts from "typescript";
import type {
  AuditService as AuditServiceType,
  AuditActorContext,
  AuditEventInput,
  AuditReadContext,
} from "./audit.service.js";

const serviceModulePath = "./audit.service.ts";
const routeModulePath = "../../routes/admin-audit.route.ts";
const pageModulePath = "../../../../admin-web/src/pages/audit-logs.tsx";
const apiSourceRoot = new URL("../../", import.meta.url).href;
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (
      specifier.startsWith(".") &&
      specifier.endsWith(".js") &&
      context.parentURL?.startsWith(apiSourceRoot)
    ) {
      const sourceSpecifier = `${specifier.slice(0, -3)}.ts`;
      if (existsSync(fileURLToPath(new URL(sourceSpecifier, context.parentURL)))) {
        return nextResolve(sourceSpecifier, context);
      }
    }
    return nextResolve(specifier, context);
  },
});
const { AUDIT_ACTIONS, AUDIT_ADMIN_PERMISSION_MATRIX, AuditService, InMemoryAuditStore } =
  (await import(serviceModulePath)) as typeof import("./audit.service.js");
const { registerAdminAuditRoute } = await import(routeModulePath);
const { buildServer } = await import("../../server.js");
const pageSource = readFileSync(new URL(pageModulePath, import.meta.url), "utf8");
const pageJavaScript = ts.transpileModule(pageSource, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  fileName: "audit-logs.tsx",
}).outputText;
const pageDataUrl = `data:text/javascript;base64,${Buffer.from(pageJavaScript).toString("base64")}`;
const { AuditLogsPage } = await import(pageDataUrl);

const ACTOR_ID = "00000000-0000-4000-8000-000000000003";
const TENANT_ID = "00000000-0000-4000-8000-000000000001";
const CAMPUS_ID = "00000000-0000-4000-8000-000000000002";
const FOREIGN_TENANT_ID = "00000000-0000-4000-8000-000000000004";
const FOREIGN_CAMPUS_ID = "00000000-0000-4000-8000-000000000005";

const actorContext = {
  trusted: true,
  actorId: ACTOR_ID,
  activeMembership: true,
  scope: { tenantId: TENANT_ID, campusId: CAMPUS_ID },
  capabilities: ["content:write"],
} as const satisfies AuditActorContext;

const readerContext = {
  ...actorContext,
  capabilities: ["memberships:read"],
} as const satisfies AuditReadContext;

const eventInput = {
  action: "CONTENT_PUBLISHED",
  target: { type: "ACTIVITY", id: "synthetic-activity-001" },
  correlationId: "correlation-synthetic-001",
  traceId: "trace-synthetic-001",
  metadata: {
    result: "SUCCESS",
    version: 2,
    channel: "ADMIN_WEB",
    synthetic_reference: "synthetic-audit-001",
  },
} as const satisfies AuditEventInput;

function createService() {
  let eventSequence = 0;
  return new AuditService(new InMemoryAuditStore(), {
    now: () => new Date("2026-09-17T02:00:00.000Z"),
    createEventId: () => `audit-event-${++eventSequence}`,
  });
}

function trustedAuthResult(
  capabilities: TrustedAuthResult["memberships"][number]["capabilities"],
): TrustedAuthResult {
  return {
    trusted: true,
    session: {
      trusted: true,
      status: "ACTIVE",
      actor_id: ACTOR_ID,
      expires_at: "2099-01-01T00:00:00.000Z",
    },
    identity: { actor_id: ACTOR_ID, display_name: "模拟审计管理员" },
    memberships: [
      {
        tenant_id: TENANT_ID,
        campus_ids: [CAMPUS_ID],
        status: "ACTIVE",
        capabilities,
      },
    ],
  };
}

function recordSyntheticSuccess(
  service: AuditServiceType,
  context: AuditActorContext = actorContext,
) {
  return service.executeProtectedCommand(context, eventInput, (transaction) => {
    const current = transaction.getState("synthetic-activity-version");
    transaction.setState(
      "synthetic-activity-version",
      typeof current === "number" ? current + 1 : 1,
    );
    return { ok: true, data: { status: "PUBLISHED" as const } };
  });
}

test("audit taxonomy and administrator permission matrix are explicit and immutable", () => {
  assert.deepEqual(AUDIT_ACTIONS, [
    "CONTENT_DRAFT_CREATED",
    "CONTENT_DRAFT_UPDATED",
    "CONTENT_PUBLISHED",
    "CONTENT_UNPUBLISHED",
    "FILE_INTENT_CREATED",
    "PARTNER_LINK_HANDOFF_CREATED",
  ]);
  assert.deepEqual(AUDIT_ADMIN_PERMISSION_MATRIX, {
    read: "memberships:read",
    append: "SERVICE_ONLY",
    update: "DENIED",
    delete: "DENIED",
  });
  assert.equal(Object.isFrozen(AUDIT_ACTIONS), true);
  assert.equal(Object.isFrozen(AUDIT_ADMIN_PERMISSION_MATRIX), true);
});

test("a successful protected command commits state and exactly one traceable event", () => {
  const service = createService();

  const result = recordSyntheticSuccess(service);

  assert.deepEqual(result, { ok: true, data: { status: "PUBLISHED" } });
  assert.equal(service.store.getProtectedState("synthetic-activity-version"), 1);
  const events = service.store.listEvents();
  assert.equal(events.length, 1);
  assert.deepEqual(events[0], {
    event_id: "audit-event-1",
    actor_id: ACTOR_ID,
    tenant_id: TENANT_ID,
    campus_id: CAMPUS_ID,
    action: "CONTENT_PUBLISHED",
    target_type: "ACTIVITY",
    target_id: "synthetic-activity-001",
    occurred_at: "2026-09-17T02:00:00.000Z",
    correlation_id: "correlation-synthetic-001",
    trace_id: "trace-synthetic-001",
    metadata: {
      result: "SUCCESS",
      version: 2,
      channel: "ADMIN_WEB",
      synthetic_reference: "synthetic-audit-001",
    },
    synthetic_data: true,
  });
});

test("failed and rolled-back commands commit neither protected state nor success events", () => {
  const service = createService();

  const denied = service.executeProtectedCommand(actorContext, eventInput, (transaction) => {
    transaction.setState("synthetic-activity-version", 1);
    return {
      ok: false,
      error: { code: "PROTECTED_COMMAND_REJECTED", message: "Synthetic command rejected." },
    };
  });
  const rolledBack = service.executeProtectedCommand(actorContext, eventInput, (transaction) => {
    transaction.setState("synthetic-activity-version", 2);
    throw new Error("synthetic rollback");
  });

  assert.deepEqual(denied, {
    ok: false,
    error: { code: "COMMAND_FAILED", message: "Protected command did not complete." },
  });
  assert.deepEqual(rolledBack, {
    ok: false,
    error: { code: "COMMAND_FAILED", message: "Protected command did not complete." },
  });
  assert.equal(service.store.getProtectedState("synthetic-activity-version"), undefined);
  assert.deepEqual(service.store.listEvents(), []);
});

test("event creation fails closed without trusted actor, tenant, or campus scope", () => {
  const invalidContexts: readonly AuditActorContext[] = [
    { ...actorContext, trusted: false } as unknown as AuditActorContext,
    { ...actorContext, actorId: "" } as AuditActorContext,
    {
      ...actorContext,
      scope: { tenantId: "", campusId: CAMPUS_ID },
    } as AuditActorContext,
    {
      ...actorContext,
      scope: { tenantId: TENANT_ID, campusId: "" },
    } as AuditActorContext,
    {
      ...actorContext,
      scope: { tenantId: TENANT_ID },
    } as unknown as AuditActorContext,
  ];

  for (const context of invalidContexts) {
    const service = createService();
    const result = service.executeProtectedCommand(context, eventInput, () => ({
      ok: true,
      data: "should-not-run",
    }));
    assert.deepEqual(result, {
      ok: false,
      error: { code: "FORBIDDEN_SCOPE", message: "Audit scope access is not permitted." },
    });
    assert.deepEqual(service.store.listEvents(), []);
  }
});

test("event metadata rejects minor data, business text, credentials, and raw request bodies", () => {
  const unsafeMetadata: readonly Record<string, unknown>[] = [
    { student_name: "Synthetic Child" },
    { contact: "10000000000" },
    { address: "Synthetic address" },
    { health: "Synthetic health detail" },
    { attendance: "Present" },
    { pickup: "Synthetic guardian" },
    { grade: "A" },
    { family_relationship: "Guardian" },
    { free_text: "Synthetic business body" },
    { credential: "synthetic-secret" },
    { raw_request_body: "{}" },
    { result: "contains free form text" },
    { status: "10000000000" },
    { channel: "UNAPPROVED_CHANNEL" },
    { synthetic_reference: "identifying-reference" },
  ];

  for (const metadata of unsafeMetadata) {
    const service = createService();
    const result = service.executeProtectedCommand(
      actorContext,
      { ...eventInput, metadata } as AuditEventInput,
      () => ({ ok: true, data: "should-not-run" }),
    );
    assert.deepEqual(result, {
      ok: false,
      error: { code: "VALIDATION_FAILED", message: "Audit event input is invalid." },
    });
    assert.deepEqual(service.store.listEvents(), []);
  }
});

test("stored events expose no mutation or deletion surface and returned records are immutable", () => {
  const service = createService();
  assert.equal(recordSyntheticSuccess(service).ok, true);

  const store = service.store as unknown as Record<string, unknown>;
  assert.equal("updateEvent" in store, false);
  assert.equal("deleteEvent" in store, false);
  const event = service.store.listEvents()[0]!;
  assert.equal(Object.isFrozen(event), true);
  assert.equal(Object.isFrozen(event.metadata), true);
  assert.throws(() => Object.assign(event, { action: "CONTENT_UNPUBLISHED" }), TypeError);
  assert.equal(service.store.listEvents()[0]!.action, "CONTENT_PUBLISHED");
});

test("audit reads require administrator capability and reject foreign scope claims", () => {
  const service = createService();
  assert.equal(recordSyntheticSuccess(service).ok, true);
  assert.equal(
    recordSyntheticSuccess(service, {
      ...actorContext,
      scope: { tenantId: FOREIGN_TENANT_ID, campusId: FOREIGN_CAMPUS_ID },
    }).ok,
    true,
  );

  assert.deepEqual(service.listEvents({ ...readerContext, capabilities: [] }, {}), {
    ok: false,
    error: { code: "FORBIDDEN_SCOPE", message: "Audit scope access is not permitted." },
  });
  assert.deepEqual(service.listEvents(readerContext, { tenantId: FOREIGN_TENANT_ID } as never), {
    ok: false,
    error: { code: "VALIDATION_FAILED", message: "Audit query is invalid." },
  });
  assert.deepEqual(service.listEvents(readerContext, { campusId: FOREIGN_CAMPUS_ID } as never), {
    ok: false,
    error: { code: "VALIDATION_FAILED", message: "Audit query is invalid." },
  });

  const result = service.listEvents(readerContext, { action: "CONTENT_PUBLISHED", limit: 20 });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.data.length, 1);
  assert.equal(result.data[0]!.tenant_id, TENANT_ID);
  assert.equal(result.data[0]!.campus_id, CAMPUS_ID);
  assert.equal(result.data[0]!.metadata.synthetic_reference, "synthetic-audit-001");
});

test("admin audit route derives scope and capability from trusted request context", async () => {
  const service = createService();
  assert.equal(recordSyntheticSuccess(service).ok, true);
  const app = fastify({ logger: false });
  app.decorateRequest("authContext", undefined);
  app.decorateRequest("scopeContext", undefined);
  let mode: "AUTHORIZED" | "NO_CAPABILITY" | "FOREIGN_SCOPE" = "AUTHORIZED";
  app.addHook("preHandler", async (request) => {
    const scope =
      mode === "FOREIGN_SCOPE"
        ? { actorId: ACTOR_ID, tenantId: FOREIGN_TENANT_ID, campusId: FOREIGN_CAMPUS_ID }
        : { actorId: ACTOR_ID, tenantId: TENANT_ID, campusId: CAMPUS_ID };
    request.scopeContext = scope;
    request.authContext = {
      identity: { actor_id: ACTOR_ID },
      memberships: [
        {
          tenant_id: TENANT_ID,
          campus_ids: [CAMPUS_ID],
          status: "ACTIVE",
          capabilities: mode === "NO_CAPABILITY" ? [] : ["memberships:read"],
        },
      ],
    } as never;
  });
  registerAdminAuditRoute(app, service);

  try {
    const authorized = await app.inject({
      method: "GET",
      url: "/admin/audit-logs?action=CONTENT_PUBLISHED&limit=20",
    });
    assert.equal(authorized.statusCode, 200);
    assert.deepEqual(Object.keys(authorized.json().data[0]).sort(), [
      "action",
      "actor_id",
      "campus_id",
      "correlation_id",
      "event_id",
      "metadata",
      "occurred_at",
      "synthetic_data",
      "target_id",
      "target_type",
      "tenant_id",
      "trace_id",
    ]);

    const forged = await app.inject({
      method: "GET",
      url: `/admin/audit-logs?tenant_id=${FOREIGN_TENANT_ID}`,
    });
    assert.equal(forged.statusCode, 400);

    mode = "NO_CAPABILITY";
    const missingCapability = await app.inject({
      method: "GET",
      url: "/admin/audit-logs",
    });
    assert.equal(missingCapability.statusCode, 403);
    assert.equal(missingCapability.json().error.code, "FORBIDDEN_SCOPE");

    mode = "FOREIGN_SCOPE";
    const foreignScope = await app.inject({
      method: "GET",
      url: "/admin/audit-logs",
    });
    assert.equal(foreignScope.statusCode, 403);
  } finally {
    await app.close();
  }
});

test("buildServer registers the scoped administrator audit entrypoint", async () => {
  const service = createService();
  assert.equal(recordSyntheticSuccess(service).ok, true);
  let capabilities: TrustedAuthResult["memberships"][number]["capabilities"] = ["memberships:read"];
  const app = buildServer({
    auditService: service,
    getTrustedAuthResult: () => trustedAuthResult(capabilities),
  });

  try {
    const authorized = await app.inject({
      method: "GET",
      url: "/admin/audit-logs?action=CONTENT_PUBLISHED&limit=20",
    });
    assert.equal(authorized.statusCode, 200);
    assert.equal(authorized.json().data.length, 1);
    assert.equal(authorized.json().data[0].event_id, "audit-event-1");

    capabilities = [];
    const missingCapability = await app.inject({
      method: "GET",
      url: "/admin/audit-logs",
    });
    assert.equal(missingCapability.statusCode, 403);

    capabilities = ["memberships:read"];
    const forgedTenantScope = await app.inject({
      method: "GET",
      url: `/admin/audit-logs?tenant_id=${FOREIGN_TENANT_ID}`,
    });
    assert.equal(forgedTenantScope.statusCode, 403);
    assert.equal(forgedTenantScope.json().error.code, "FORBIDDEN_SCOPE");

    const forgedCampusScope = await app.inject({
      method: "GET",
      url: `/admin/audit-logs?campus_id=${FOREIGN_CAMPUS_ID}`,
    });
    assert.equal(forgedCampusScope.statusCode, 403);
    assert.equal(forgedCampusScope.json().error.code, "FORBIDDEN_SCOPE");
  } finally {
    await app.close();
  }
});

test("audit log page presents read-only redacted states without mutation controls", () => {
  const service = createService();
  assert.equal(recordSyntheticSuccess(service).ok, true);
  const result = service.listEvents(readerContext, {});
  assert.equal(result.ok, true);
  if (!result.ok) return;

  const populated = AuditLogsPage({ status: "READY", events: result.data });
  assert.equal(populated.route, "/admin/audit-logs");
  assert.equal(populated.rows.length, 1);
  assert.deepEqual(populated.availableActions, ["REFRESH"]);
  assert.equal("updateAction" in populated, false);
  assert.equal("deleteAction" in populated, false);
  assert.equal("exportAction" in populated, false);
  assert.deepEqual(AuditLogsPage({ status: "LOADING", events: [] }).rows, []);
  assert.equal(AuditLogsPage({ status: "EMPTY", events: [] }).message, "NO_AUDIT_EVENTS");
  assert.equal(AuditLogsPage({ status: "DENIED", events: [] }).message, "ACCESS_DENIED");
  assert.equal(AuditLogsPage({ status: "ERROR", events: [] }).message, "AUDIT_LOGS_UNAVAILABLE");
});
