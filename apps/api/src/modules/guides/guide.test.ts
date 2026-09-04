import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import fastify from "fastify";
import { buildServer } from "../../server.js";
import { registerStaffGuideRoutes } from "../../routes/staff-guides.route.js";
import {
  GuideService,
  InMemoryGuideFileAccessPort,
  InMemoryGuideRepository,
  type GuideActorContext,
  type GuideReadAuditEvent,
  type GuideRecord,
} from "./guide.service.js";

const ACTOR_ID = "00000000-0000-4000-8000-000000000003";
const TENANT_ID = "00000000-0000-4000-8000-000000000001";
const CAMPUS_ID = "00000000-0000-4000-8000-000000000002";
const FOREIGN_TENANT_ID = "00000000-0000-4000-8000-000000000004";
const FOREIGN_CAMPUS_ID = "00000000-0000-4000-8000-000000000005";

const trustedStaffAuthResult = {
  trusted: true as const,
  session: {
    trusted: true as const,
    status: "ACTIVE" as const,
    actor_id: ACTOR_ID,
    expires_at: "2099-01-01T00:00:00.000Z",
  },
  identity: { actor_id: ACTOR_ID, display_name: "模拟员工一号" },
  memberships: [
    {
      tenant_id: TENANT_ID,
      campus_ids: [CAMPUS_ID],
      status: "ACTIVE" as const,
      capabilities: ["content:write"] as const,
    },
  ],
} as const;

const staffContext = {
  trusted: true,
  actorId: ACTOR_ID,
  activeMembership: true,
  scope: { tenantId: TENANT_ID, campusId: CAMPUS_ID },
  capabilities: ["content:write"],
} as const satisfies GuideActorContext;

const records = [
  {
    id: "guide-orientation",
    tenant_id: TENANT_ID,
    campus_id: CAMPUS_ID,
    status: "PUBLISHED",
    version: 2,
    title: "模拟新员工入职指南",
    summary: "仅用于测试的虚构入职流程摘要。",
    body: "请先阅读模拟校区制度，再完成虚构培训清单。",
    category: "ORIENTATION",
    tags: ["模拟入职", "虚构流程"],
    file_ref: "file-ref:/synthetic/guide-orientation.pdf",
    synthetic_data: true,
    updated_by: ACTOR_ID,
    updated_at: "2026-09-04T00:00:00.000Z",
  },
  {
    id: "guide-draft",
    tenant_id: TENANT_ID,
    campus_id: CAMPUS_ID,
    status: "DRAFT",
    version: 1,
    title: "模拟未发布指南",
    summary: "不得被检索。",
    body: "模拟草稿。",
    category: "POLICY",
    tags: ["模拟"],
    file_ref: null,
    synthetic_data: true,
    updated_by: ACTOR_ID,
    updated_at: "2026-09-04T00:00:00.000Z",
  },
  {
    id: "guide-foreign-campus",
    tenant_id: TENANT_ID,
    campus_id: FOREIGN_CAMPUS_ID,
    status: "PUBLISHED",
    version: 1,
    title: "模拟外校区指南",
    summary: "不得跨校区读取。",
    body: "模拟外校区内容。",
    category: "ORIENTATION",
    tags: ["模拟"],
    file_ref: null,
    synthetic_data: true,
    updated_by: ACTOR_ID,
    updated_at: "2026-09-04T00:00:00.000Z",
  },
] as const satisfies readonly GuideRecord[];

function makeService(events: GuideReadAuditEvent[] = []) {
  return new GuideService(
    new InMemoryGuideRepository(records),
    new InMemoryGuideFileAccessPort([
      {
        tenant_id: TENANT_ID,
        campus_id: CAMPUS_ID,
        reference: "file-ref:/synthetic/guide-orientation.pdf",
        display_name: "模拟入职指南附件.pdf",
      },
    ]),
    { onReadAuditEvent: (event) => events.push(event) },
  );
}

function makeRouteApp(
  service: GuideService,
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
  registerStaffGuideRoutes(app, service);
  return app;
}

test("authorized staff search is bounded and returns only scoped published projections", () => {
  const result = makeService().search(staffContext, {
    query: "模拟入职",
    category: "ORIENTATION",
    limit: 10,
  });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(result.data, [
    {
      id: "guide-orientation",
      title: "模拟新员工入职指南",
      summary: "仅用于测试的虚构入职流程摘要。",
      category: "ORIENTATION",
      tags: ["模拟入职", "虚构流程"],
      version: 2,
    },
  ]);
  assert.equal("tenant_id" in result.data[0]!, false);
  assert.equal("campus_id" in result.data[0]!, false);
  assert.equal("body" in result.data[0]!, false);
  assert.equal("file_ref" in result.data[0]!, false);
});

test("visitor, inactive membership, missing capability, and unbounded search fail closed", () => {
  const service = makeService();
  const deniedContexts: readonly GuideActorContext[] = [
    { ...staffContext, trusted: false } as unknown as GuideActorContext,
    { ...staffContext, activeMembership: false } as unknown as GuideActorContext,
    { ...staffContext, capabilities: [] },
  ];

  for (const context of deniedContexts) {
    assert.equal(service.search(context, { query: "模拟" }).ok, false);
  }
  assert.deepEqual(service.search(staffContext, {}), {
    ok: false,
    error: { code: "VALIDATION_FAILED", message: "Guide request is invalid." },
  });
  assert.equal(service.search(staffContext, { query: "x".repeat(81) }).ok, false);
  assert.equal(service.search(staffContext, { query: "模拟", limit: 26 }).ok, false);
});

test("detail reads check scope, publication, version, and approved file before projection", () => {
  const result = makeService().readDetail(staffContext, "guide-orientation", 2);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(result.data, {
    id: "guide-orientation",
    title: "模拟新员工入职指南",
    summary: "仅用于测试的虚构入职流程摘要。",
    body: "请先阅读模拟校区制度，再完成虚构培训清单。",
    category: "ORIENTATION",
    tags: ["模拟入职", "虚构流程"],
    version: 2,
    file: {
      reference: "file-ref:/synthetic/guide-orientation.pdf",
      display_name: "模拟入职指南附件.pdf",
    },
  });
  for (const key of [
    "tenant_id",
    "campus_id",
    "status",
    "file_ref",
    "synthetic_data",
    "updated_by",
    "updated_at",
  ]) {
    assert.equal(key in result.data, false);
  }
});

test("foreign scope, draft, stale version, and unapproved file emit no success audit", () => {
  const events: GuideReadAuditEvent[] = [];
  const service = makeService(events);
  const foreignContext = {
    ...staffContext,
    scope: { tenantId: FOREIGN_TENANT_ID, campusId: CAMPUS_ID },
  } as const satisfies GuideActorContext;

  assert.equal(service.readDetail(foreignContext, "guide-orientation", 2).ok, false);
  assert.equal(service.readDetail(staffContext, "guide-draft", 1).ok, false);
  assert.equal(service.readDetail(staffContext, "guide-orientation", 1).ok, false);

  const deniedFileService = new GuideService(
    new InMemoryGuideRepository(records),
    new InMemoryGuideFileAccessPort(),
    { onReadAuditEvent: (event) => events.push(event) },
  );
  assert.equal(deniedFileService.readDetail(staffContext, "guide-orientation", 2).ok, false);
  assert.equal(events.length, 0);
});

test("staff guide routes derive trusted scope and reject client authorization claims", async () => {
  const app = makeRouteApp(makeService());
  try {
    const forged = await app.inject({
      method: "GET",
      url: `/staff/guides?query=模拟&tenant_id=${FOREIGN_TENANT_ID}`,
    });
    assert.equal(forged.statusCode, 400);

    const search = await app.inject({
      method: "GET",
      url: "/staff/guides?query=模拟入职&category=ORIENTATION&limit=10",
    });
    assert.equal(search.statusCode, 200);
    assert.equal(search.json().data[0].id, "guide-orientation");

    const detail = await app.inject({
      method: "GET",
      url: "/staff/guides/guide-orientation?version=2",
    });
    assert.equal(detail.statusCode, 200);

    const stale = await app.inject({
      method: "GET",
      url: "/staff/guides/guide-orientation?version=1",
    });
    assert.equal(stale.statusCode, 404);
  } finally {
    await app.close();
  }
});

test("staff guide routes deny suspended membership and missing capability", async () => {
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
        url: "/staff/guides?query=模拟",
      });
      assert.equal(response.statusCode, 403);
    } finally {
      await app.close();
    }
  }
});

test("buildServer registers staff guide routes with trusted active membership scope", async () => {
  const app = buildServer({ getTrustedAuthResult: () => trustedStaffAuthResult });
  try {
    const response = await app.inject({
      method: "GET",
      url: "/staff/guides?query=模拟",
    });
    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.json().data, []);
  } finally {
    await app.close();
  }
});

test("staff guides page is an internal synthetic route contract", () => {
  const fromRoot = path.resolve(process.cwd(), "apps/user-web/src/pages/staff-guides.tsx");
  const fromApi = path.resolve(process.cwd(), "../user-web/src/pages/staff-guides.tsx");
  const pagePath = existsSync(fromRoot) ? fromRoot : fromApi;
  const source = readFileSync(pagePath, "utf8");

  assert.match(source, /StaffGuidesPage/);
  assert.match(source, /\/staff\/guides/);
  assert.match(source, /AUTHORIZED_STAFF/);
  assert.match(source, /模拟数据/);
});
