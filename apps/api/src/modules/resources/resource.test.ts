import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import fastify from "fastify";
import { registerStaffResourceRoutes } from "../../routes/staff-resources.route.js";
import {
  InMemoryResourceFileAccessPort,
  InMemoryResourceRepository,
  ResourceService,
  type ResourceActorContext,
  type ResourceAuditEvent,
  type ResourceRecord,
} from "./resource.service.js";

const ACTOR_ID = "00000000-0000-4000-8000-000000000003";
const TENANT_ID = "00000000-0000-4000-8000-000000000001";
const CAMPUS_ID = "00000000-0000-4000-8000-000000000002";
const FOREIGN_TENANT_ID = "00000000-0000-4000-8000-000000000004";
const FOREIGN_CAMPUS_ID = "00000000-0000-4000-8000-000000000005";

const staffContext = {
  trusted: true,
  actorId: ACTOR_ID,
  activeMembership: true,
  scope: { tenantId: TENANT_ID, campusId: CAMPUS_ID },
  capabilities: ["content:write"],
  roles: ["content:write"],
} as const satisfies ResourceActorContext;

const records = [
  {
    id: "resource-lesson",
    tenant_id: TENANT_ID,
    campus_id: CAMPUS_ID,
    status: "PUBLISHED",
    version: 2,
    title: "Synthetic lesson resource",
    summary: "A fictional resource for scoped search tests.",
    body: "Synthetic lesson details for the authorized staff projection.",
    category: "LESSON",
    keywords: ["synthetic", "lesson"],
    role_scope: ["content:write"],
    file_ref: "file-ref:/synthetic/lesson.pdf",
    synthetic_data: true,
    updated_by: ACTOR_ID,
    updated_at: "2026-09-08T00:00:00.000Z",
  },
  {
    id: "resource-reference",
    tenant_id: TENANT_ID,
    campus_id: CAMPUS_ID,
    status: "PUBLISHED",
    version: 1,
    title: "Synthetic reference resource",
    summary: "Another fictional resource for pagination.",
    body: "Synthetic reference details.",
    category: "REFERENCE",
    keywords: ["synthetic", "reference"],
    role_scope: ["content:write"],
    file_ref: null,
    synthetic_data: true,
    updated_by: ACTOR_ID,
    updated_at: "2026-09-08T00:00:00.000Z",
  },
  {
    id: "resource-draft",
    tenant_id: TENANT_ID,
    campus_id: CAMPUS_ID,
    status: "DRAFT",
    version: 1,
    title: "Synthetic draft resource",
    summary: "This draft must not be returned.",
    body: "Synthetic draft details.",
    category: "LESSON",
    keywords: ["synthetic", "draft"],
    role_scope: ["content:write"],
    file_ref: null,
    synthetic_data: true,
    updated_by: ACTOR_ID,
    updated_at: "2026-09-08T00:00:00.000Z",
  },
  {
    id: "resource-foreign-campus",
    tenant_id: TENANT_ID,
    campus_id: FOREIGN_CAMPUS_ID,
    status: "PUBLISHED",
    version: 1,
    title: "Synthetic foreign campus resource",
    summary: "This resource must stay out of scope.",
    body: "Synthetic foreign campus details.",
    category: "LESSON",
    keywords: ["synthetic", "foreign"],
    role_scope: ["content:write"],
    file_ref: null,
    synthetic_data: true,
    updated_by: ACTOR_ID,
    updated_at: "2026-09-08T00:00:00.000Z",
  },
  {
    id: "resource-unsafe-file",
    tenant_id: TENANT_ID,
    campus_id: CAMPUS_ID,
    status: "PUBLISHED",
    version: 1,
    title: "Synthetic unsafe attachment",
    summary: "The unsafe file reference must fail closed.",
    body: "Synthetic unsafe attachment details.",
    category: "LESSON",
    keywords: ["synthetic", "unsafe"],
    role_scope: ["content:write"],
    file_ref: "https://provider.example/object",
    synthetic_data: true,
    updated_by: ACTOR_ID,
    updated_at: "2026-09-08T00:00:00.000Z",
  },
] as const satisfies readonly ResourceRecord[];

function makeService(events: ResourceAuditEvent[] = []): ResourceService {
  return new ResourceService(
    new InMemoryResourceRepository(records),
    new InMemoryResourceFileAccessPort([
      {
        tenant_id: TENANT_ID,
        campus_id: CAMPUS_ID,
        reference: "file-ref:/synthetic/lesson.pdf",
        display_name: "Synthetic lesson attachment.pdf",
      },
    ]),
    {
      now: () => new Date("2026-09-08T00:00:00.000Z"),
      onAuditEvent: (event) => events.push(event),
    },
  );
}

function makeRouteApp(
  service: ResourceService,
  membership: {
    readonly tenant_id: string;
    readonly campus_ids: readonly string[];
    readonly status: "ACTIVE" | "SUSPENDED";
    readonly capabilities: readonly ("content:write" | "content:publish")[];
  } = {
    tenant_id: TENANT_ID,
    campus_ids: [CAMPUS_ID],
    status: "ACTIVE",
    capabilities: ["content:write"],
  },
) {
  const app = fastify({ logger: false });
  app.decorateRequest("authContext", undefined);
  app.decorateRequest("scopeContext", undefined);
  app.addHook("preHandler", async (request) => {
    request.authContext = {
      identity: { actor_id: ACTOR_ID },
      memberships: [membership],
    } as never;
    request.scopeContext = { actorId: ACTOR_ID, tenantId: TENANT_ID, campusId: CAMPUS_ID };
  });
  registerStaffResourceRoutes(app, service);
  return app;
}

test("resource search is bounded, published, scoped, and cursor paginated", () => {
  const service = makeService();
  const first = service.search(staffContext, { query: "synthetic", limit: 1 });

  assert.equal(first.ok, true);
  if (!first.ok) return;
  assert.deepEqual(first.data.items, [
    {
      id: "resource-lesson",
      title: "Synthetic lesson resource",
      summary: "A fictional resource for scoped search tests.",
      category: "LESSON",
      keywords: ["synthetic", "lesson"],
      version: 2,
    },
  ]);
  assert.equal(typeof first.data.next_cursor, "string");
  assert.equal("tenant_id" in first.data.items[0]!, false);
  assert.equal("campus_id" in first.data.items[0]!, false);
  assert.equal("body" in first.data.items[0]!, false);
  assert.equal("file_ref" in first.data.items[0]!, false);
  assert.equal("provider_url" in first.data.items[0]!, false);

  const second = service.search(staffContext, {
    query: "synthetic",
    limit: 1,
    cursor: first.data.next_cursor!,
  });
  assert.equal(second.ok, true);
  if (!second.ok) return;
  assert.deepEqual(
    second.data.items.map((item) => item.id),
    ["resource-reference"],
  );
  assert.equal(second.data.next_cursor, null);
});

test("resource search rejects unsafe filters and unauthorized contexts without audit", () => {
  const events: ResourceAuditEvent[] = [];
  const service = makeService(events);
  const deniedContexts: readonly ResourceActorContext[] = [
    { ...staffContext, trusted: false } as unknown as ResourceActorContext,
    { ...staffContext, activeMembership: false } as unknown as ResourceActorContext,
    { ...staffContext, capabilities: [], roles: [] },
  ];

  for (const context of deniedContexts) {
    assert.equal(service.search(context, { query: "synthetic" }).ok, false);
  }
  assert.equal(service.search(staffContext, {}).ok, false);
  assert.equal(service.search(staffContext, { query: "synthetic", category: "UNKNOWN" }).ok, false);
  assert.equal(service.search(staffContext, { query: "synthetic", limit: 26 }).ok, false);
  assert.equal(service.search(staffContext, { query: "synthetic", cursor: "forged" }).ok, false);
  assert.equal(events.length, 0);

  const first = service.search(staffContext, { query: "synthetic", limit: 1 });
  assert.equal(first.ok, true);
  if (!first.ok) return;
  const otherCampus = {
    ...staffContext,
    scope: { tenantId: TENANT_ID, campusId: FOREIGN_CAMPUS_ID },
  } as const satisfies ResourceActorContext;
  assert.deepEqual(
    service.search(otherCampus, {
      query: "synthetic",
      limit: 1,
      cursor: first.data.next_cursor!,
    }),
    {
      ok: false,
      error: {
        code: "SCOPE_STALE",
        message: "Resource scope or search cursor is stale.",
      },
    },
  );
  assert.equal(events.length, 1);
});

test("resource detail requires publication, exact version, scope, role, and safe file intent", () => {
  const events: ResourceAuditEvent[] = [];
  const service = makeService(events);
  const detail = service.readDetail(staffContext, "resource-lesson", 2);

  assert.equal(detail.ok, true);
  if (!detail.ok) return;
  const file = detail.data.file;
  assert.ok(file);
  assert.match(file.read_intent, /^read-intent\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
  assert.deepEqual(
    {
      ...detail.data,
      file: { ...file, read_intent: "READ_INTENT" },
    },
    {
      id: "resource-lesson",
      title: "Synthetic lesson resource",
      summary: "A fictional resource for scoped search tests.",
      body: "Synthetic lesson details for the authorized staff projection.",
      category: "LESSON",
      keywords: ["synthetic", "lesson"],
      version: 2,
      file: {
        reference: "file-ref:/synthetic/lesson.pdf",
        display_name: "Synthetic lesson attachment.pdf",
        read_intent: "READ_INTENT",
        expires_at: "2026-09-08T00:05:00.000Z",
      },
    },
  );
  assert.equal("provider_url" in detail.data, false);
  assert.equal(events.length, 1);
  assert.equal(events[0]?.eventType, "READ");

  assert.equal(service.readDetail(staffContext, "resource-lesson", 1).ok, false);
  assert.equal(service.readDetail(staffContext, "resource-draft", 1).ok, false);
  assert.equal(service.readDetail(staffContext, "resource-foreign-campus", 1).ok, false);
  assert.equal(service.readDetail(staffContext, "resource-unsafe-file", 1).ok, false);
  assert.equal(events.length, 1);
});

test("staff resource routes derive trusted scope and reject client authorization claims", async () => {
  const app = makeRouteApp(makeService());
  try {
    const forged = await app.inject({
      method: "GET",
      url: `/staff/resources?query=synthetic&tenant_id=${FOREIGN_TENANT_ID}`,
    });
    assert.equal(forged.statusCode, 400);

    const search = await app.inject({
      method: "GET",
      url: "/staff/resources?query=synthetic&category=LESSON&limit=1",
    });
    assert.equal(search.statusCode, 200);
    assert.equal(search.json().data.items[0].id, "resource-lesson");

    const detail = await app.inject({
      method: "GET",
      url: "/staff/resources/resource-lesson?version=2",
    });
    assert.equal(detail.statusCode, 200);
    assert.equal(detail.json().data.file.provider_url, undefined);

    const stale = await app.inject({
      method: "GET",
      url: "/staff/resources/resource-lesson?version=1",
    });
    assert.equal(stale.statusCode, 409);
  } finally {
    await app.close();
  }
});

test("staff resource routes deny suspended membership and missing capability", async () => {
  for (const membership of [
    {
      tenant_id: TENANT_ID,
      campus_ids: [CAMPUS_ID],
      status: "SUSPENDED" as const,
      capabilities: ["content:write"] as const,
    },
    {
      tenant_id: TENANT_ID,
      campus_ids: [CAMPUS_ID],
      status: "ACTIVE" as const,
      capabilities: [] as const,
    },
  ]) {
    const app = makeRouteApp(makeService(), membership);
    try {
      const response = await app.inject({
        method: "GET",
        url: "/staff/resources?query=synthetic",
      });
      assert.equal(response.statusCode, 403);
    } finally {
      await app.close();
    }
  }
});

test("user resource page and toolchain are local synthetic contracts", () => {
  const fromRoot = path.resolve(process.cwd(), "apps/user-web/src/pages/resources.tsx");
  const fromApi = path.resolve(process.cwd(), "../user-web/src/pages/resources.tsx");
  const pagePath = existsSync(fromRoot) ? fromRoot : fromApi;
  const source = readFileSync(pagePath, "utf8");
  const packageJson = JSON.parse(
    readFileSync(path.resolve(process.cwd(), "apps/user-web/package.json"), "utf8"),
  ) as { scripts: Record<string, string> };
  const tsconfig = readFileSync(path.resolve(process.cwd(), "apps/user-web/tsconfig.json"), "utf8");

  assert.match(source, /TeachingResourcesPage/);
  assert.match(source, /\/web\/staff\/resources/);
  assert.match(source, /AUTHORIZED_STAFF/);
  assert.match(source, /模拟数据/);
  assert.equal(packageJson.scripts.typecheck, "tsc -p tsconfig.json --noEmit");
  assert.equal(packageJson.scripts.lint, "eslint src");
  assert.equal(packageJson.scripts.build, "tsc -p tsconfig.json");
  assert.match(tsconfig, /"extends"\s*:\s*"\.\.\/\.\.\/tsconfig\.base\.json"/);
});
