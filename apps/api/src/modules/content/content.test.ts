import assert from "node:assert/strict";
import test from "node:test";
import type { TrustedAuthResult } from "@student-care/auth";
import fastify from "fastify";
import type { AuditService } from "../audit/audit.service.js";
import { buildServer } from "../../server.js";
import {
  ContentService,
  type ContentActorContext,
  type DraftPayload,
  type PublicationAuditEvent,
} from "./content.service.js";
import { InMemoryContentRepository } from "./content.repository.js";
import { registerPublicContentRoute } from "../../routes/public-content.route.js";

const ACTOR_ID = "00000000-0000-4000-8000-000000000003";
const TENANT_ID = "00000000-0000-4000-8000-000000000001";
const CAMPUS_ID = "00000000-0000-4000-8000-000000000002";
const FOREIGN_TENANT_ID = "00000000-0000-4000-8000-000000000004";
const FOREIGN_CAMPUS_ID = "00000000-0000-4000-8000-000000000005";

const draftPayload = {
  title: "Synthetic demo bulletin",
  type: "HOME_BLOCK",
  visibility: "PUBLIC",
  body: {
    summary: "Synthetic public summary",
    blocks: [
      {
        kind: "TEXT",
        text: "Synthetic public content",
        file_id: "internal-file-ref",
        href: "/public-reference",
      },
      {
        kind: "TEXT",
        text: "Synthetic secondary content",
        href: null,
      },
    ],
  },
  editor_note: "Internal synthetic editor note",
  moderation_state: "APPROVED",
  tenant_admin_note: "Internal synthetic tenant note",
  campus_admin_note: "Internal synthetic campus note",
} as const satisfies DraftPayload;

const contentWriterContext = {
  trusted: true,
  actorId: "actor-demo-001",
  activeMembership: true,
  scope: { tenantId: "tenant-demo-a", campusId: "campus-demo-1" },
  capabilities: ["content:write", "content:publish"],
} as const satisfies ContentActorContext;

function makeAuthResult(): TrustedAuthResult {
  return {
    trusted: true,
    session: {
      trusted: true,
      status: "ACTIVE",
      actor_id: ACTOR_ID,
      expires_at: "2099-01-01T00:00:00.000Z",
    },
    identity: { actor_id: ACTOR_ID, display_name: "模拟员工一号" },
    memberships: [
      {
        tenant_id: TENANT_ID,
        campus_ids: [CAMPUS_ID],
        status: "ACTIVE",
        capabilities: ["identity:read", "memberships:read"],
      },
    ],
  };
}

function makeRouteContext(): ContentActorContext {
  return {
    trusted: true,
    actorId: ACTOR_ID,
    activeMembership: true,
    scope: { tenantId: TENANT_ID, campusId: CAMPUS_ID },
    capabilities: ["content:write", "content:publish"],
  };
}

test("content commands require trusted active membership and minimum capability", () => {
  const service = new ContentService(new InMemoryContentRepository());
  const inactiveContext = {
    ...contentWriterContext,
    activeMembership: false,
  } as unknown as ContentActorContext;
  const missingCapability = {
    ...contentWriterContext,
    capabilities: ["content:read"],
  } as unknown as ContentActorContext;

  assert.equal(service.createDraft(inactiveContext, "content-demo-001", draftPayload).ok, false);
  assert.equal(service.createDraft(missingCapability, "content-demo-001", draftPayload).ok, false);
  assert.deepEqual(
    service.createDraft(contentWriterContext, "content-demo-001", draftPayload).ok,
    true,
  );
  assert.equal(service.publish(missingCapability, "content-demo-001", 1).ok, false);
  assert.equal(service.unpublish(missingCapability, "content-demo-001", 1).ok, false);
  assert.equal(
    service.updateDraft(missingCapability, "content-demo-001", draftPayload, 1).ok,
    false,
  );
  assert.equal(service.readPublic(inactiveContext, "content-demo-001").ok, false);
});

test("content audit scope failures map to a content permission failure", () => {
  const auditService = {
    executeProtectedCommand: () => ({
      ok: false as const,
      error: { code: "FORBIDDEN_SCOPE", message: "Synthetic audit scope denial." },
    }),
  } as unknown as AuditService;
  const service = new ContentService(new InMemoryContentRepository(), { auditService });
  const auditedContext = {
    ...contentWriterContext,
    auditCampusId: "campus-demo-audit",
    requestCorrelationId: "correlation-demo-001",
    traceId: "trace-demo-001",
  } satisfies ContentActorContext;

  assert.deepEqual(service.createDraft(auditedContext, "audit-forbidden-content", draftPayload), {
    ok: false,
    error: { code: "FORBIDDEN_SCOPE", message: "Content scope access is not permitted." },
  });
  assert.equal(service.repository.get(auditedContext.scope, "audit-forbidden-content"), undefined);

  const noCampusContext = {
    ...contentWriterContext,
    scope: { tenantId: "tenant-demo-audit" },
  } as unknown as ContentActorContext;
  assert.deepEqual(service.createDraft(noCampusContext, "audit-no-campus-content", draftPayload), {
    ok: false,
    error: { code: "FORBIDDEN_SCOPE", message: "Content scope access is not permitted." },
  });

  const conflictAuditService = {
    executeProtectedCommand: () => ({
      ok: false as const,
      error: { code: "COMMAND_FAILED", message: "Synthetic audit command failure." },
    }),
  } as unknown as AuditService;
  const conflictService = new ContentService(new InMemoryContentRepository(), {
    auditService: conflictAuditService,
  });
  assert.deepEqual(
    conflictService.createDraft(contentWriterContext, "audit-conflict-content", draftPayload),
    {
      ok: false,
      error: { code: "CONFLICT_STATE", message: "Content state transition is not permitted." },
    },
  );
});

test("content policy rejects malformed authorization contexts and payloads", () => {
  const service = new ContentService(new InMemoryContentRepository());
  const invalidContexts: readonly unknown[] = [
    undefined,
    "not-an-object",
    null,
    [],
    { trusted: false },
    { trusted: true, activeMembership: false },
    { trusted: true, activeMembership: true, actorId: 1 },
    { trusted: true, activeMembership: true, actorId: "actor", scope: 1 },
    { trusted: true, activeMembership: true, actorId: "actor", scope: null },
    { trusted: true, activeMembership: true, actorId: "actor", scope: [] },
    { trusted: true, activeMembership: true, actorId: "actor", scope: {} },
    {
      trusted: true,
      activeMembership: true,
      actorId: "actor",
      scope: { tenantId: "tenant", campusId: 1 },
      capabilities: [],
    },
    {
      trusted: true,
      activeMembership: true,
      actorId: "actor",
      scope: { tenantId: "tenant" },
      capabilities: "content:write",
    },
  ];
  for (const context of invalidContexts) {
    assert.equal(
      service.createDraft(context as ContentActorContext, "content-demo-001", draftPayload).ok,
      false,
    );
  }

  const invalidPayloads: readonly unknown[] = [
    1,
    null,
    [],
    { ...draftPayload, title: 1 },
    { ...draftPayload, title: "" },
    { ...draftPayload, type: "UNKNOWN" },
    { ...draftPayload, visibility: "PRIVATE" },
    { ...draftPayload, body: 1 },
    { ...draftPayload, body: null },
    { ...draftPayload, body: { ...draftPayload.body, summary: 1 } },
    { ...draftPayload, body: { ...draftPayload.body, blocks: {} } },
    { ...draftPayload, body: { ...draftPayload.body, blocks: [null] } },
    { ...draftPayload, body: { ...draftPayload.body, blocks: [{}] } },
    {
      ...draftPayload,
      body: { ...draftPayload.body, blocks: [{ kind: "TEXT", text: 1 }] },
    },
  ];
  for (const payload of invalidPayloads) {
    assert.equal(
      service.createDraft(contentWriterContext, "content-demo-001", payload as DraftPayload).ok,
      false,
    );
  }
  const invalidKey = service.createDraft(contentWriterContext, "", draftPayload);
  assert.equal(invalidKey.ok, false);
  if (invalidKey.ok) return;
  assert.equal(invalidKey.error.code, "VALIDATION_FAILED");
});

test("content policy reaches each authorization and payload denial branch", () => {
  const service = new ContentService(new InMemoryContentRepository());
  const validAuthorizationContext = {
    trusted: true,
    activeMembership: true,
    actorId: "actor-demo-branch",
    scope: { tenantId: "tenant-demo-branch", campusId: "campus-demo-branch" },
    capabilities: ["content:write"],
  };
  const invalidAuthorizationContexts: readonly unknown[] = [
    { ...validAuthorizationContext, trusted: false },
    { ...validAuthorizationContext, activeMembership: false },
    { ...validAuthorizationContext, actorId: 42 },
    { ...validAuthorizationContext, scope: 42 },
    { ...validAuthorizationContext, scope: null },
    { ...validAuthorizationContext, scope: [] },
    { ...validAuthorizationContext, scope: { campusId: "campus-demo-branch" } },
    {
      ...validAuthorizationContext,
      scope: { tenantId: "tenant-demo-branch", campusId: 42 },
    },
    {
      ...validAuthorizationContext,
      capabilities: "content:write",
    },
  ];
  for (const context of invalidAuthorizationContexts) {
    assert.equal(
      service.createDraft(context as ContentActorContext, "branch-content", draftPayload).ok,
      false,
    );
  }

  const invalidPayloads: readonly unknown[] = [
    { ...draftPayload, body: { ...draftPayload.body, blocks: [1] } },
    { ...draftPayload, body: { ...draftPayload.body, blocks: [{ kind: 42, text: "text" }] } },
    { ...draftPayload, body: { ...draftPayload.body, blocks: [{ kind: "TEXT" }] } },
  ];
  for (const payload of invalidPayloads) {
    assert.equal(
      service.createDraft(
        { ...contentWriterContext, capabilities: ["content:write"] },
        "branch-content",
        payload as DraftPayload,
      ).ok,
      false,
    );
  }
});

test("content policy covers stale versions, optional defaults, and publication read states", () => {
  const repository = new InMemoryContentRepository();
  const service = new ContentService(repository, {
    now: () => new Date("2026-09-02T00:00:00.000Z"),
  });
  const minimalPayload = {
    title: "Synthetic minimal bulletin",
    type: "HOME_BLOCK",
    visibility: "PUBLIC",
    body: { summary: "Synthetic summary", blocks: [] },
  } as const satisfies DraftPayload;

  assert.equal(
    service.createDraft(contentWriterContext, "version-content", minimalPayload).ok,
    true,
  );
  assert.deepEqual(service.createDraft(contentWriterContext, "version-content", minimalPayload), {
    ok: false,
    error: { code: "VERSION_MISMATCH", message: "Content version is stale." },
  });
  assert.deepEqual(
    service.createDraft(contentWriterContext, "version-content", minimalPayload, 0),
    {
      ok: false,
      error: { code: "VERSION_MISMATCH", message: "Content version is stale." },
    },
  );

  assert.deepEqual(service.publish(contentWriterContext, "version-content", -1), {
    ok: false,
    error: { code: "VALIDATION_FAILED", message: "Content input is invalid." },
  });
  assert.deepEqual(
    service.updateDraft(
      contentWriterContext,
      "version-content",
      minimalPayload,
      "stale" as unknown as number,
    ),
    {
      ok: false,
      error: { code: "VERSION_MISMATCH", message: "Content version is stale." },
    },
  );

  const created = repository.get(contentWriterContext.scope, "version-content");
  assert.ok(created);
  if (!created) return;
  const publishedWithoutTimestamp = {
    ...created,
    status: "PUBLISHED",
    published_at: null,
  } as const;
  const readStateService = new ContentService(
    new InMemoryContentRepository([publishedWithoutTimestamp]),
  );
  assert.deepEqual(readStateService.readPublic(contentWriterContext, "version-content"), {
    ok: false,
    error: { code: "NOT_FOUND_SCOPED", message: "Published content was not found." },
  });

  const callbackOnlyEvents: PublicationAuditEvent[] = [];
  const callbackOnlyService = new ContentService(new InMemoryContentRepository(), {
    onPublicationAuditEvent: (event) => callbackOnlyEvents.push(event),
  });
  callbackOnlyService.createDraft(contentWriterContext, "callback-content", minimalPayload);
  callbackOnlyService.publish(contentWriterContext, "callback-content", 1);
  assert.equal(callbackOnlyEvents.length, 1);
});

test("content updates require an existing draft and advance its version", () => {
  const service = new ContentService(new InMemoryContentRepository());
  assert.deepEqual(service.updateDraft(contentWriterContext, "missing-content", draftPayload, 1), {
    ok: false,
    error: { code: "NOT_FOUND_SCOPED", message: "Published content was not found." },
  });
  service.createDraft(contentWriterContext, "content-demo-001", draftPayload);
  assert.deepEqual(service.createDraft(contentWriterContext, "content-demo-001", draftPayload, 1), {
    ok: false,
    error: { code: "CONFLICT_STATE", message: "Content state transition is not permitted." },
  });
  const updated = service.updateDraft(
    contentWriterContext,
    "content-demo-001",
    { ...draftPayload, title: "Synthetic updated bulletin" },
    1,
  );
  assert.equal(updated.ok, true);
  assert.equal(service.repository.get(contentWriterContext.scope, "content-demo-001")?.version, 2);
});

test("content updates apply optional field defaults", () => {
  const service = new ContentService(new InMemoryContentRepository());
  const minimalPayload = {
    title: "Synthetic defaulted update",
    type: "HOME_BLOCK",
    visibility: "PUBLIC",
    body: { summary: "Synthetic summary", blocks: [] },
  } as const satisfies DraftPayload;
  service.createDraft(contentWriterContext, "defaulted-update-content", draftPayload);
  const updated = service.updateDraft(
    contentWriterContext,
    "defaulted-update-content",
    minimalPayload,
    1,
  );
  assert.equal(updated.ok, true);
  if (!updated.ok) return;
  assert.equal(updated.data.version, 2);
  assert.equal(updated.data.editor_note, "");
  assert.equal(updated.data.moderation_state, "UNREVIEWED");
  assert.equal(updated.data.tenant_admin_note, "");
  assert.equal(updated.data.campus_admin_note, "");
});

test("content updates reject invalid payloads before reading the repository", () => {
  const service = new ContentService(new InMemoryContentRepository());
  service.createDraft(contentWriterContext, "invalid-update-content", draftPayload);
  assert.deepEqual(service.updateDraft(contentWriterContext, "", draftPayload, 1), {
    ok: false,
    error: { code: "VALIDATION_FAILED", message: "Content input is invalid." },
  });
  assert.deepEqual(
    service.updateDraft(
      contentWriterContext,
      "invalid-update-content",
      { ...draftPayload, title: "" },
      1,
    ),
    {
      ok: false,
      error: { code: "VALIDATION_FAILED", message: "Content input is invalid." },
    },
  );
});

test("content transitions reject invalid inputs and conflicting states", () => {
  const service = new ContentService(new InMemoryContentRepository());
  assert.deepEqual(service.publish(contentWriterContext, "bad key", 1), {
    ok: false,
    error: { code: "VALIDATION_FAILED", message: "Content input is invalid." },
  });
  assert.deepEqual(service.publish(contentWriterContext, "missing-content", 1), {
    ok: false,
    error: { code: "NOT_FOUND_SCOPED", message: "Published content was not found." },
  });
  assert.deepEqual(service.publish(contentWriterContext, "missing-content", NaN), {
    ok: false,
    error: { code: "VALIDATION_FAILED", message: "Content input is invalid." },
  });
  service.createDraft(contentWriterContext, "content-demo-001", draftPayload);
  assert.deepEqual(service.unpublish(contentWriterContext, "content-demo-001", 1), {
    ok: false,
    error: { code: "CONFLICT_STATE", message: "Content state transition is not permitted." },
  });
  service.publish(contentWriterContext, "content-demo-001", 1);
  assert.deepEqual(service.publish(contentWriterContext, "content-demo-001", 2), {
    ok: false,
    error: { code: "CONFLICT_STATE", message: "Content state transition is not permitted." },
  });
});

test("repository clones initial records and emits global-scope audit events", () => {
  const initialService = new ContentService(new InMemoryContentRepository());
  const created = initialService.createDraft(
    contentWriterContext,
    "content-demo-001",
    draftPayload,
  );
  assert.equal(created.ok, true);
  if (!created.ok) return;

  const repository = new InMemoryContentRepository([created.data]);
  const cloned = repository.get(contentWriterContext.scope, "content-demo-001");
  assert.equal(cloned?.content_key, "content-demo-001");
  assert.notEqual(cloned, created.data);

  const events: PublicationAuditEvent[] = [];
  const globalContext = {
    ...contentWriterContext,
    scope: { tenantId: "tenant-demo-a" },
  } as const;
  const service = new ContentService(repository, {
    now: () => new Date("2026-09-02T00:00:00.000Z"),
    onPublicationAuditEvent: (event) => events.push(event),
  });
  service.createDraft(globalContext, "global-content", draftPayload);
  service.publish(globalContext, "global-content", 1);
  assert.deepEqual(events[0], {
    eventType: "PUBLISHED",
    tenantId: "tenant-demo-a",
    contentKey: "global-content",
    resultingVersion: 2,
    actorReference: "actor-demo-001",
    eventTime: "2026-09-02T00:00:00.000Z",
  });
});

test("stale updates and publication commands preserve state and emit no success event", () => {
  const events: PublicationAuditEvent[] = [];
  const service = new ContentService(new InMemoryContentRepository(), {
    now: () => new Date("2026-09-02T00:00:00.000Z"),
    onPublicationAuditEvent: (event) => events.push(event),
  });
  service.createDraft(contentWriterContext, "content-demo-001", draftPayload);

  const staleUpdate = service.updateDraft(
    contentWriterContext,
    "content-demo-001",
    { ...draftPayload, title: "Stale update" },
    0,
  );
  const stalePublish = service.publish(contentWriterContext, "content-demo-001", 0);

  assert.deepEqual(staleUpdate, {
    ok: false,
    error: { code: "VERSION_MISMATCH", message: "Content version is stale." },
  });
  assert.deepEqual(stalePublish, {
    ok: false,
    error: { code: "VERSION_MISMATCH", message: "Content version is stale." },
  });
  assert.equal(service.repository.get(contentWriterContext.scope, "content-demo-001")?.version, 1);
  assert.equal(
    service.repository.get(contentWriterContext.scope, "content-demo-001")?.status,
    "DRAFT",
  );
  assert.equal(events.length, 0);
});

test("publish and unpublish increment versions and emit exactly one audit event each", () => {
  const events: PublicationAuditEvent[] = [];
  const service = new ContentService(new InMemoryContentRepository(), {
    now: () => new Date("2026-09-02T00:00:00.000Z"),
    onPublicationAuditEvent: (event) => events.push(event),
  });
  service.createDraft(contentWriterContext, "content-demo-001", draftPayload);

  const published = service.publish(contentWriterContext, "content-demo-001", 1);
  const unpublished = service.unpublish(contentWriterContext, "content-demo-001", 2);

  assert.equal(published.ok, true);
  assert.equal(unpublished.ok, true);
  assert.deepEqual(events, [
    {
      eventType: "PUBLISHED",
      tenantId: "tenant-demo-a",
      campusId: "campus-demo-1",
      contentKey: "content-demo-001",
      resultingVersion: 2,
      actorReference: "actor-demo-001",
      eventTime: "2026-09-02T00:00:00.000Z",
    },
    {
      eventType: "UNPUBLISHED",
      tenantId: "tenant-demo-a",
      campusId: "campus-demo-1",
      contentKey: "content-demo-001",
      resultingVersion: 3,
      actorReference: "actor-demo-001",
      eventTime: "2026-09-02T00:00:00.000Z",
    },
  ]);
});

test("public reads expose only the current published projection", () => {
  const service = new ContentService(new InMemoryContentRepository());

  assert.deepEqual(service.readPublic(contentWriterContext, "content-demo-001"), {
    ok: false,
    error: { code: "NOT_FOUND_SCOPED", message: "Published content was not found." },
  });
  service.createDraft(contentWriterContext, "content-demo-001", draftPayload);
  assert.deepEqual(service.readPublic(contentWriterContext, "content-demo-001"), {
    ok: false,
    error: { code: "NOT_FOUND_SCOPED", message: "Published content was not found." },
  });
  service.publish(contentWriterContext, "content-demo-001", 1);

  const result = service.readPublic(contentWriterContext, "content-demo-001");
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(result.data, {
    id: "content-demo-001",
    content_key: "content-demo-001",
    type: "HOME_BLOCK",
    title: "Synthetic demo bulletin",
    version: 2,
    visibility: "PUBLIC",
    summary: "Synthetic public summary",
    blocks: [
      {
        kind: "TEXT",
        text: "Synthetic public content",
        href: "/public-reference",
      },
      {
        kind: "TEXT",
        text: "Synthetic secondary content",
      },
    ],
    published_at: result.data.published_at,
  });
  assert.deepEqual(Object.keys(result.data).sort(), [
    "blocks",
    "content_key",
    "id",
    "published_at",
    "summary",
    "title",
    "type",
    "version",
    "visibility",
  ]);
  assert.equal("file_id" in result.data.blocks[0]!, false);
});

test("public projection omits absent block href values", () => {
  const service = new ContentService(new InMemoryContentRepository());
  const payload = {
    ...draftPayload,
    body: {
      ...draftPayload.body,
      blocks: [{ kind: "TEXT", text: "Synthetic href omission" }],
    },
  } as const satisfies DraftPayload;
  service.createDraft(contentWriterContext, "href-omission-content", payload);
  service.publish(contentWriterContext, "href-omission-content", 1);
  const result = service.readPublic(contentWriterContext, "href-omission-content");
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(result.data.blocks, [{ kind: "TEXT", text: "Synthetic href omission" }]);
});

test("public reads reject published non-public visibility", () => {
  const service = new ContentService(new InMemoryContentRepository());
  const privateDraft = { ...draftPayload, visibility: "MEMBERS" } as const;

  assert.equal(service.createDraft(contentWriterContext, "members-content", privateDraft).ok, true);
  assert.equal(service.publish(contentWriterContext, "members-content", 1).ok, true);
  assert.deepEqual(service.readPublic(contentWriterContext, "members-content"), {
    ok: false,
    error: { code: "NOT_FOUND_SCOPED", message: "Published content was not found." },
  });
});

test("public reads reject invalid content keys before repository access", () => {
  const service = new ContentService(new InMemoryContentRepository());
  assert.deepEqual(service.readPublic(contentWriterContext, ""), {
    ok: false,
    error: { code: "VALIDATION_FAILED", message: "Content input is invalid." },
  });
});

test("foreign tenant and campus scope fail closed without public data leakage", () => {
  const service = new ContentService(new InMemoryContentRepository());
  service.createDraft(contentWriterContext, "content-demo-001", draftPayload);
  service.publish(contentWriterContext, "content-demo-001", 1);

  const foreignTenant = {
    ...contentWriterContext,
    scope: { tenantId: "tenant-demo-foreign", campusId: "campus-demo-1" },
  } as const;
  const foreignCampus = {
    ...contentWriterContext,
    scope: { tenantId: "tenant-demo-a", campusId: "campus-demo-foreign" },
  } as const;

  assert.deepEqual(service.readPublic(foreignTenant, "content-demo-001").ok, false);
  assert.deepEqual(service.readPublic(foreignCampus, "content-demo-001").ok, false);
});

test("public content route resolves server scope and rejects client publication claims", async () => {
  const service = new ContentService(new InMemoryContentRepository());
  const routeContext = makeRouteContext();
  service.createDraft(routeContext, "content-demo-001", draftPayload);
  service.publish(routeContext, "content-demo-001", 1);
  const app = buildServer({
    getTrustedAuthResult: () => makeAuthResult(),
    contentService: service,
  });

  try {
    const response = await app.inject({
      method: "GET",
      url: `/public-content/content-demo-001?tenant_id=${TENANT_ID}&campus_id=${CAMPUS_ID}`,
    });
    assert.equal(response.statusCode, 200);
    assert.equal(response.json().data.content_key, "content-demo-001");

    const forged = await app.inject({
      method: "GET",
      url: `/public-content/content-demo-001?tenant_id=${TENANT_ID}&campus_id=${CAMPUS_ID}&version=2`,
    });
    assert.equal(forged.statusCode, 400);
    assert.equal(forged.json().error.code, "VALIDATION_FAILED");

    const foreign = await app.inject({
      method: "GET",
      url: `/public-content/content-demo-001?tenant_id=${FOREIGN_TENANT_ID}&campus_id=${FOREIGN_CAMPUS_ID}`,
    });
    assert.equal(foreign.statusCode, 403);
    assert.equal(foreign.json().error.code, "FORBIDDEN_SCOPE");
  } finally {
    await app.close();
  }
});

test("public content route remains unauthenticated-safe", async () => {
  const app = buildServer({ getTrustedAuthResult: () => undefined });
  try {
    const response = await app.inject({
      method: "GET",
      url: "/public-content/content-demo-001",
    });
    assert.equal(response.statusCode, 401);
    assert.equal(response.json().error.code, "UNAUTHENTICATED");
  } finally {
    await app.close();
  }
});

test("public content route maps missing scope, membership, and service errors safely", async () => {
  const missingScopeApp = fastify({ logger: false });
  missingScopeApp.decorateRequest("authContext", undefined);
  missingScopeApp.decorateRequest("scopeContext", undefined);
  missingScopeApp.addHook("preHandler", async (request) => {
    request.authContext = {
      identity: { actor_id: ACTOR_ID, display_name: "模拟员工一号" },
      memberships: [],
    };
  });
  registerPublicContentRoute(missingScopeApp, new ContentService());
  try {
    const response = await missingScopeApp.inject({
      method: "GET",
      url: "/public-content/content-demo-001",
    });
    assert.equal(response.statusCode, 403);
    assert.equal(response.json().error.code, "FORBIDDEN_SCOPE");
  } finally {
    await missingScopeApp.close();
  }

  const membershipDeniedApp = fastify({ logger: false });
  membershipDeniedApp.decorateRequest("authContext", undefined);
  membershipDeniedApp.decorateRequest("scopeContext", undefined);
  membershipDeniedApp.addHook("preHandler", async (request) => {
    request.authContext = {
      identity: { actor_id: ACTOR_ID, display_name: "模拟员工一号" },
      memberships: [
        {
          tenant_id: FOREIGN_TENANT_ID,
          campus_ids: [FOREIGN_CAMPUS_ID],
          status: "ACTIVE",
          capabilities: [],
        },
      ],
    };
    request.scopeContext = { actorId: ACTOR_ID, tenantId: TENANT_ID };
  });
  registerPublicContentRoute(membershipDeniedApp, new ContentService());
  try {
    const response = await membershipDeniedApp.inject({
      method: "GET",
      url: "/public-content/content-demo-001",
    });
    assert.equal(response.statusCode, 403);
    assert.equal(response.json().error.code, "FORBIDDEN_SCOPE");
  } finally {
    await membershipDeniedApp.close();
  }

  const serviceErrorApp = fastify({ logger: false });
  serviceErrorApp.decorateRequest("authContext", undefined);
  serviceErrorApp.decorateRequest("scopeContext", undefined);
  serviceErrorApp.addHook("preHandler", async (request) => {
    request.authContext = {
      identity: { actor_id: ACTOR_ID, display_name: "模拟员工一号" },
      memberships: [
        {
          tenant_id: TENANT_ID,
          campus_ids: [CAMPUS_ID],
          status: "ACTIVE",
          capabilities: [],
        },
      ],
    };
    request.scopeContext = { actorId: ACTOR_ID, tenantId: TENANT_ID, campusId: CAMPUS_ID };
  });
  registerPublicContentRoute(serviceErrorApp, {
    readPublic: () => ({ ok: false, error: { code: "FORBIDDEN_SCOPE", message: "denied" } }),
  } as never);
  try {
    const response = await serviceErrorApp.inject({
      method: "GET",
      url: "/public-content/content-demo-001",
    });
    assert.equal(response.statusCode, 403);
    assert.equal(response.json().error.code, "FORBIDDEN_SCOPE");
  } finally {
    await serviceErrorApp.close();
  }
});

test("public content route fails closed for missing auth and every membership scope mismatch", async () => {
  const missingAuthApp = fastify({ logger: false });
  missingAuthApp.decorateRequest("authContext", undefined);
  missingAuthApp.decorateRequest("scopeContext", undefined);
  missingAuthApp.addHook("preHandler", async (request) => {
    request.scopeContext = { actorId: ACTOR_ID, tenantId: TENANT_ID, campusId: CAMPUS_ID };
  });
  registerPublicContentRoute(missingAuthApp, new ContentService());
  try {
    const response = await missingAuthApp.inject({
      method: "GET",
      url: "/public-content/content-demo-001",
    });
    assert.equal(response.statusCode, 403);
    assert.equal(response.json().error.code, "FORBIDDEN_SCOPE");
  } finally {
    await missingAuthApp.close();
  }

  const mismatchedMembershipApp = fastify({ logger: false });
  mismatchedMembershipApp.decorateRequest("authContext", undefined);
  mismatchedMembershipApp.decorateRequest("scopeContext", undefined);
  mismatchedMembershipApp.addHook("preHandler", async (request) => {
    request.authContext = {
      identity: { actor_id: ACTOR_ID, display_name: "模拟员工一号" },
      memberships: [
        {
          tenant_id: TENANT_ID,
          campus_ids: [CAMPUS_ID],
          status: "SUSPENDED",
          capabilities: [],
        },
        {
          tenant_id: FOREIGN_TENANT_ID,
          campus_ids: [CAMPUS_ID],
          status: "ACTIVE",
          capabilities: [],
        },
        {
          tenant_id: TENANT_ID,
          campus_ids: [FOREIGN_CAMPUS_ID],
          status: "ACTIVE",
          capabilities: [],
        },
      ],
    };
    request.scopeContext = { actorId: ACTOR_ID, tenantId: TENANT_ID, campusId: CAMPUS_ID };
  });
  registerPublicContentRoute(mismatchedMembershipApp, new ContentService());
  try {
    const response = await mismatchedMembershipApp.inject({
      method: "GET",
      url: "/public-content/content-demo-001",
    });
    assert.equal(response.statusCode, 403);
    assert.equal(response.json().error.code, "FORBIDDEN_SCOPE");
  } finally {
    await mismatchedMembershipApp.close();
  }
});

test("public content route supports server-derived global scope and maps public misses to 404", async () => {
  const app = fastify({ logger: false });
  app.decorateRequest("authContext", undefined);
  app.decorateRequest("scopeContext", undefined);
  app.addHook("preHandler", async (request) => {
    request.authContext = {
      identity: { actor_id: ACTOR_ID, display_name: "模拟员工一号" },
      memberships: [
        {
          tenant_id: TENANT_ID,
          campus_ids: [CAMPUS_ID],
          status: "ACTIVE",
          capabilities: [],
        },
      ],
    };
    request.scopeContext = { actorId: ACTOR_ID, tenantId: TENANT_ID };
  });
  registerPublicContentRoute(app, new ContentService());
  try {
    const response = await app.inject({
      method: "GET",
      url: "/public-content/missing-global-content",
    });
    assert.equal(response.statusCode, 404);
    assert.equal(response.json().error.code, "NOT_FOUND_SCOPED");
  } finally {
    await app.close();
  }
});
