import assert from "node:assert/strict";
import test from "node:test";
import fastify from "fastify";
import type { TrustedAuthResult } from "@student-care/auth";
import { type DraftPayload, type PublicationAuditEvent } from "../content/content.service.js";
import { InMemoryContentRepository } from "../content/content.repository.js";
import { registerAdminInstitutionRoute } from "../../routes/admin-institution.route.js";
import { buildServer } from "../../server.js";
import { InstitutionService, type InstitutionActorContext } from "./institution.service.js";

const ACTOR_ID = "00000000-0000-4000-8000-000000000003";
const TENANT_ID = "00000000-0000-4000-8000-000000000001";
const CAMPUS_ID = "00000000-0000-4000-8000-000000000002";
const FOREIGN_CAMPUS_ID = "00000000-0000-4000-8000-000000000005";

const institutionPayload = {
  title: "Synthetic institution profile",
  type: "INSTITUTION",
  visibility: "PUBLIC",
  body: {
    summary: "Synthetic institution summary",
    blocks: [{ kind: "TEXT", text: "Synthetic institution content" }],
  },
  editor_note: "Synthetic private editor note",
} as const satisfies DraftPayload;

const homePayload = {
  title: "Synthetic home announcement",
  type: "HOME_BLOCK",
  visibility: "PUBLIC",
  body: {
    summary: "Synthetic home summary",
    blocks: [{ kind: "TEXT", text: "Synthetic home content", href: "/synthetic" }],
  },
  moderation_state: "APPROVED",
} as const satisfies DraftPayload;

const ownerContext = {
  trusted: true,
  actorId: ACTOR_ID,
  activeMembership: true,
  scope: { tenantId: TENANT_ID, campusId: CAMPUS_ID },
  capabilities: ["content:write", "content:publish"],
} as const satisfies InstitutionActorContext;

const staffContext = {
  ...ownerContext,
  capabilities: ["content:write"],
} as const satisfies InstitutionActorContext;

function makeAuthResult(capabilities: readonly string[]): TrustedAuthResult {
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
        capabilities,
      },
    ],
  } as unknown as TrustedAuthResult;
}

function makeRouteApp(
  service: InstitutionService,
  authResult: TrustedAuthResult = makeAuthResult(["content:write", "content:publish"]),
  scope = { actorId: ACTOR_ID, tenantId: TENANT_ID, campusId: CAMPUS_ID },
) {
  const app = fastify({ logger: false });
  app.decorateRequest("authContext", undefined);
  app.decorateRequest("scopeContext", undefined);
  app.addHook("preHandler", async (request) => {
    request.authContext = authResult as never;
    request.scopeContext = scope;
  });
  registerAdminInstitutionRoute(app, service);
  return app;
}

test("staff without publish capability cannot publish institution or home content", () => {
  const service = new InstitutionService(new InMemoryContentRepository());
  assert.equal(
    service.createInstitutionDraft(staffContext, "profile", institutionPayload).ok,
    true,
  );
  assert.deepEqual(service.publishInstitution(staffContext, "profile", 1), {
    ok: false,
    error: { code: "FORBIDDEN_SCOPE", message: "Content scope access is not permitted." },
  });

  assert.equal(service.createHomeDraft(staffContext, "home", homePayload).ok, true);
  assert.deepEqual(service.publishHome(staffContext, "home", 1), {
    ok: false,
    error: { code: "FORBIDDEN_SCOPE", message: "Content scope access is not permitted." },
  });
});

test("institution and home content keys cannot cross resource types", () => {
  const service = new InstitutionService(new InMemoryContentRepository());
  const tenantContext = {
    ...ownerContext,
    scope: { tenantId: TENANT_ID },
  } as const;

  assert.equal(
    service.createInstitutionDraft(tenantContext, "shared-key", institutionPayload).ok,
    true,
  );
  assert.deepEqual(service.createHomeDraft(tenantContext, "shared-key", homePayload, 1), {
    ok: false,
    error: { code: "CONFLICT_STATE", message: "Content state transition is not permitted." },
  });
  assert.deepEqual(service.publishHome(tenantContext, "shared-key", 1), {
    ok: false,
    error: { code: "NOT_FOUND_SCOPED", message: "Published content was not found." },
  });

  const profile = service.readInstitutionDraft(tenantContext, "shared-key");
  assert.equal(profile.ok, true);
  if (!profile.ok) return;
  assert.equal(profile.data.type, "INSTITUTION");
  assert.equal(profile.data.status, "DRAFT");
  assert.equal(profile.data.version, 1);
});

test("institution profiles are tenant scoped while home content is campus scoped", () => {
  const service = new InstitutionService(new InMemoryContentRepository());
  assert.equal(
    service.createInstitutionDraft(ownerContext, "profile", institutionPayload).ok,
    true,
  );
  assert.equal(service.publishInstitution(ownerContext, "profile", 1).ok, true);

  const otherCampusContext = {
    ...ownerContext,
    scope: { tenantId: TENANT_ID, campusId: FOREIGN_CAMPUS_ID },
  } as const;
  assert.equal(service.readInstitutionPublic(otherCampusContext, "profile").ok, true);

  assert.equal(service.createHomeDraft(ownerContext, "home", homePayload).ok, true);
  assert.deepEqual(service.readHomePublic(otherCampusContext, "home"), {
    ok: false,
    error: { code: "NOT_FOUND_SCOPED", message: "Published content was not found." },
  });
});

test("stale versions preserve state and emit no successful publication audit", () => {
  const events: PublicationAuditEvent[] = [];
  const service = new InstitutionService(new InMemoryContentRepository(), {
    onPublicationAuditEvent: (event) => events.push(event),
  });
  assert.equal(service.createHomeDraft(ownerContext, "home", homePayload).ok, true);

  assert.deepEqual(
    service.updateHomeDraft(ownerContext, "home", { ...homePayload, title: "Stale update" }, 0),
    { ok: false, error: { code: "VERSION_MISMATCH", message: "Content version is stale." } },
  );
  assert.deepEqual(service.publishHome(ownerContext, "home", 0), {
    ok: false,
    error: { code: "VERSION_MISMATCH", message: "Content version is stale." },
  });
  const current = service.readHomeDraft(ownerContext, "home");
  assert.equal(current.ok, true);
  if (!current.ok) return;
  assert.equal(current.data.version, 1);
  assert.equal(current.data.status, "DRAFT");
  assert.equal(events.length, 0);
});

test("invalid content blocks are rejected before state changes", () => {
  const service = new InstitutionService(new InMemoryContentRepository());
  const invalidPayload = {
    ...homePayload,
    body: { ...homePayload.body, blocks: [{ kind: "UNKNOWN", text: "invalid" }] },
  } as unknown as DraftPayload;

  assert.deepEqual(service.createHomeDraft(ownerContext, "invalid-home", invalidPayload), {
    ok: false,
    error: { code: "VALIDATION_FAILED", message: "Content input is invalid." },
  });
  assert.deepEqual(service.readHomeDraft(ownerContext, "invalid-home"), {
    ok: false,
    error: { code: "NOT_FOUND_SCOPED", message: "Published content was not found." },
  });
});

test("visitor projection excludes drafts and internal fields", () => {
  const service = new InstitutionService(new InMemoryContentRepository());
  assert.deepEqual(service.readHomePublic(ownerContext, "home"), {
    ok: false,
    error: { code: "NOT_FOUND_SCOPED", message: "Published content was not found." },
  });
  assert.equal(service.createHomeDraft(ownerContext, "home", homePayload).ok, true);
  assert.deepEqual(service.readHomePublic(ownerContext, "home"), {
    ok: false,
    error: { code: "NOT_FOUND_SCOPED", message: "Published content was not found." },
  });
  assert.equal(service.publishHome(ownerContext, "home", 1).ok, true);

  const result = service.readHomePublic(ownerContext, "home");
  assert.equal(result.ok, true);
  if (!result.ok) return;
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
  assert.equal("editor_note" in result.data, false);
  assert.equal("moderation_state" in result.data, false);
});

test("admin route derives scope from trusted membership and rejects client scope claims", async () => {
  const service = new InstitutionService(new InMemoryContentRepository());
  const app = makeRouteApp(service);
  try {
    const created = await app.inject({
      method: "POST",
      url: "/admin/institution/home/home/draft",
      payload: { payload: homePayload },
    });
    assert.equal(created.statusCode, 201);

    const forged = await app.inject({
      method: "POST",
      url: "/admin/institution/home/forged/draft",
      payload: {
        payload: homePayload,
        tenant_id: "00000000-0000-4000-8000-000000000004",
        campus_id: FOREIGN_CAMPUS_ID,
      },
    });
    assert.equal(forged.statusCode, 400);
    assert.equal(forged.json().error.code, "VALIDATION_FAILED");
  } finally {
    await app.close();
  }
});

test("admin route fails closed when trusted membership does not cover resolved campus", async () => {
  const service = new InstitutionService(new InMemoryContentRepository());
  const app = makeRouteApp(service, makeAuthResult(["content:write", "content:publish"]), {
    actorId: ACTOR_ID,
    tenantId: TENANT_ID,
    campusId: FOREIGN_CAMPUS_ID,
  });
  try {
    const response = await app.inject({
      method: "POST",
      url: "/admin/institution/home/home/draft",
      payload: { payload: homePayload },
    });
    assert.equal(response.statusCode, 403);
    assert.equal(response.json().error.code, "FORBIDDEN_SCOPE");
  } finally {
    await app.close();
  }
});

test("buildServer registers the Task 06 institution management routes", async () => {
  const app = buildServer({
    getTrustedAuthResult: () => makeAuthResult(["content:write", "content:publish"]),
  });
  try {
    const response = await app.inject({
      method: "POST",
      url: `/admin/institution/home/home/draft?tenant_id=${TENANT_ID}&campus_id=${CAMPUS_ID}`,
      payload: { payload: homePayload },
    });
    assert.equal(response.statusCode, 201);
  } finally {
    await app.close();
  }
});

test("visitor public route uses a server-owned scope resolver without authentication", async () => {
  const service = new InstitutionService(new InMemoryContentRepository());
  const tenantContext = {
    ...ownerContext,
    scope: { tenantId: TENANT_ID },
  } as const;
  assert.equal(
    service.createInstitutionDraft(tenantContext, "profile", institutionPayload).ok,
    true,
  );
  assert.equal(service.publishInstitution(tenantContext, "profile", 1).ok, true);

  const app = buildServer({
    institutionService: service,
    getPublicInstitutionScope: (_request, kind) =>
      kind === "INSTITUTION" ? { tenantId: TENANT_ID } : undefined,
  });
  try {
    const response = await app.inject({
      method: "GET",
      url: `/public/institution/profile/profile?tenant_id=${FOREIGN_CAMPUS_ID}`,
    });
    assert.equal(response.statusCode, 200);
    assert.equal(response.json().data.title, institutionPayload.title);
    assert.equal("editor_note" in response.json().data, false);
  } finally {
    await app.close();
  }
});

test("visitor public route fails closed when no server-owned scope resolver exists", async () => {
  const app = buildServer();
  try {
    const response = await app.inject({
      method: "GET",
      url: "/public/institution/profile/profile",
    });
    assert.equal(response.statusCode, 403);
    assert.equal(response.json().error.code, "FORBIDDEN_SCOPE");
  } finally {
    await app.close();
  }
});

test("buildServer selects the membership that covers the requested campus", async () => {
  const base = makeAuthResult(["content:write", "content:publish"]);
  const membership = base.memberships[0];
  if (membership === undefined) throw new Error("Synthetic membership fixture is missing.");

  const app = buildServer({
    getTrustedAuthResult: () => ({
      ...base,
      memberships: [
        { ...membership, campus_ids: [CAMPUS_ID] },
        { ...membership, campus_ids: [FOREIGN_CAMPUS_ID] },
      ],
    }),
  });
  try {
    const response = await app.inject({
      method: "POST",
      url: `/admin/institution/home/second-campus/draft?tenant_id=${TENANT_ID}&campus_id=${FOREIGN_CAMPUS_ID}`,
      payload: { payload: homePayload },
    });
    assert.equal(response.statusCode, 201);
  } finally {
    await app.close();
  }
});
