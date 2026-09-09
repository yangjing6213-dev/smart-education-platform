import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import fastify from "fastify";
import { registerPartnerLinkRoutes } from "../../routes/partner-link.route.js";
import {
  InMemoryPartnerLinkRepository,
  PartnerLinkService,
  type PartnerLinkActorContext,
  type PartnerLinkAuditEvent,
  type PartnerLinkRepository,
  type PartnerLinkRecord,
} from "./partner-link.service.js";

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
  allowedScopes: [{ tenantId: TENANT_ID, campusId: CAMPUS_ID }],
  capabilities: ["content:write"],
  roles: ["content:write"],
} as const satisfies PartnerLinkActorContext;

const approvedLink = {
  id: "partner-link-1",
  tenant_id: TENANT_ID,
  campus_id: CAMPUS_ID,
  symbolic_destination: "PARTNER_CLOUD_SYNTHETIC_WORKSPACE",
  normalized_host: "synthetic.partner.invalid",
  normalized_path: "/approved/workspace",
  allowed_roles: ["content:write"],
  required_capability: "content:write",
  publication_status: "PUBLISHED",
  enabled_status: "ENABLED",
  allowlist_policy_version: "policy-v1",
  title: "模拟伙伴工作台",
  description: "仅用于测试的虚构伙伴入口。",
  version: 3,
  synthetic_data: true,
} as const satisfies PartnerLinkRecord;

const records = [
  approvedLink,
  {
    ...approvedLink,
    id: "partner-link-draft",
    publication_status: "DRAFT",
    title: "模拟草稿入口",
  },
  {
    ...approvedLink,
    id: "partner-link-disabled",
    enabled_status: "DISABLED",
    title: "模拟停用入口",
  },
  {
    ...approvedLink,
    id: "partner-link-foreign-campus",
    campus_id: FOREIGN_CAMPUS_ID,
    title: "模拟外校区入口",
  },
] as const satisfies readonly PartnerLinkRecord[];

function makeService(
  events: PartnerLinkAuditEvent[] = [],
  now = new Date("2026-09-09T08:00:00.000Z"),
) {
  return new PartnerLinkService(new InMemoryPartnerLinkRepository(records), {
    now: () => new Date(now),
    onAuditEvent: (event) => events.push(event),
  });
}

function makeRouteApp(
  service: PartnerLinkService,
  membership: {
    readonly tenant_id: string;
    readonly campus_ids: readonly string[];
    readonly status: "ACTIVE" | "SUSPENDED";
    readonly capabilities: readonly string[];
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
  registerPartnerLinkRoutes(app, service);
  return app;
}

test("authorized staff search returns only published enabled scoped projections", () => {
  const result = makeService().search(staffContext, { query: "工作台", limit: 10 });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(result.data, [
    {
      id: "partner-link-1",
      title: "模拟伙伴工作台",
      description: "仅用于测试的虚构伙伴入口。",
      symbolicDestination: "PARTNER_CLOUD_SYNTHETIC_WORKSPACE",
      normalizedHost: "synthetic.partner.invalid",
      normalizedPath: "/approved/workspace",
      publicationStatus: "PUBLISHED",
      enabledStatus: "ENABLED",
      policyVersion: "policy-v1",
      version: 3,
    },
  ]);
  assert.equal("tenant_id" in result.data[0]!, false);
  assert.equal("campus_id" in result.data[0]!, false);
});

test("visitor, wrong role, inactive membership, foreign scope, and unbounded search fail closed", () => {
  const service = makeService();
  const deniedContexts: readonly PartnerLinkActorContext[] = [
    { ...staffContext, trusted: false } as unknown as PartnerLinkActorContext,
    { ...staffContext, activeMembership: false } as unknown as PartnerLinkActorContext,
    { ...staffContext, capabilities: ["content:read"], roles: ["content:read"] },
    { ...staffContext, scope: { tenantId: FOREIGN_TENANT_ID, campusId: CAMPUS_ID } },
    { ...staffContext, scope: { tenantId: TENANT_ID, campusId: FOREIGN_CAMPUS_ID } },
  ];

  for (const context of deniedContexts) {
    assert.equal(service.search(context, { query: "工作台" }).ok, false);
  }
  assert.equal(service.search(staffContext, { query: "工作台", limit: 26 }).ok, false);
  assert.equal(service.search(staffContext, { query: "x".repeat(81) }).ok, false);
});

test("draft and disabled links never issue an entry", () => {
  const service = makeService();

  assert.deepEqual(service.issueEntry(staffContext, "partner-link-draft"), {
    ok: false,
    error: {
      code: "NOT_FOUND_SCOPED",
      message: "Partner link was not found in the allowed scope.",
    },
  });
  assert.deepEqual(service.issueEntry(staffContext, "partner-link-disabled"), {
    ok: false,
    error: {
      code: "NOT_FOUND_SCOPED",
      message: "Partner link was not found in the allowed scope.",
    },
  });
});

test("arbitrary destination claims and unsafe metadata are rejected", () => {
  const service = makeService();

  assert.deepEqual(
    service.issueEntry(staffContext, "partner-link-1", {
      destination: "https://evil.example.invalid/escape",
    }),
    {
      ok: false,
      error: { code: "VALIDATION_FAILED", message: "Partner link input is invalid." },
    },
  );

  const unsafe = new PartnerLinkService(
    new InMemoryPartnerLinkRepository([
      { ...approvedLink, normalized_host: "evil.example.invalid", normalized_path: "/../escape" },
    ]),
  );
  assert.deepEqual(unsafe.issueEntry(staffContext, "partner-link-1"), {
    ok: false,
    error: { code: "VALIDATION_FAILED", message: "Partner link input is invalid." },
  });
});

test("entry handoff is short lived, scope bound, single use, and audited", () => {
  const events: PartnerLinkAuditEvent[] = [];
  let now = new Date("2026-09-09T08:00:00.000Z");
  const service = new PartnerLinkService(new InMemoryPartnerLinkRepository(records), {
    now: () => now,
    onAuditEvent: (event) => events.push(event),
  });
  const issued = service.issueEntry(staffContext, "partner-link-1");

  assert.equal(issued.ok, true);
  if (!issued.ok) return;
  assert.equal(issued.data.symbolicDestination, "PARTNER_CLOUD_SYNTHETIC_WORKSPACE");
  assert.equal(issued.data.handoffToken.startsWith("handoff:"), true);
  assert.equal(issued.data.expiresAt, "2026-09-09T08:01:00.000Z");
  assert.equal("providerUrl" in issued.data, false);
  assert.equal(events.filter((event) => event.eventType === "ENTRY_ISSUED").length, 1);

  const foreign = {
    ...staffContext,
    scope: { tenantId: FOREIGN_TENANT_ID, campusId: CAMPUS_ID },
  } as const satisfies PartnerLinkActorContext;
  assert.equal(service.consumeHandoff(foreign, issued.data.handoffToken).ok, false);
  assert.equal(service.consumeHandoff(staffContext, issued.data.handoffToken).ok, true);
  assert.deepEqual(service.consumeHandoff(staffContext, issued.data.handoffToken), {
    ok: false,
    error: { code: "HANDOFF_REUSED", message: "Partner link handoff has already been used." },
  });

  now = new Date("2026-09-09T08:02:00.000Z");
  const issuedAtBoundary = service.issueEntry(staffContext, "partner-link-1");
  assert.equal(issuedAtBoundary.ok, true);
  if (!issuedAtBoundary.ok) return;
  now = new Date("2026-09-09T08:03:01.000Z");
  assert.deepEqual(service.consumeHandoff(staffContext, issuedAtBoundary.data.handoffToken), {
    ok: false,
    error: { code: "HANDOFF_EXPIRED", message: "Partner link handoff has expired." },
  });

  let currentRecord: PartnerLinkRecord = approvedLink;
  const changingRepository: PartnerLinkRepository = {
    get: (scope, linkId) =>
      scope.tenantId === TENANT_ID && scope.campusId === CAMPUS_ID && linkId === currentRecord.id
        ? currentRecord
        : undefined,
    list: () => [currentRecord],
  };
  const policyService = new PartnerLinkService(changingRepository, {
    now: () => new Date("2026-09-09T08:00:00.000Z"),
  });
  const policyIssued = policyService.issueEntry(staffContext, "partner-link-1");
  assert.equal(policyIssued.ok, true);
  if (!policyIssued.ok) return;
  currentRecord = { ...currentRecord, allowlist_policy_version: "policy-v2" };
  assert.deepEqual(policyService.consumeHandoff(staffContext, policyIssued.data.handoffToken), {
    ok: false,
    error: {
      code: "NOT_FOUND_SCOPED",
      message: "Partner link was not found in the allowed scope.",
    },
  });
});

test("staff route derives scope from active membership and rejects client claims", async () => {
  const app = makeRouteApp(makeService());
  try {
    const forged = await app.inject({
      method: "GET",
      url: `/staff/partner-cloud-links?query=工作台&tenant_id=${FOREIGN_TENANT_ID}`,
    });
    assert.equal(forged.statusCode, 400);

    const search = await app.inject({
      method: "GET",
      url: "/staff/partner-cloud-links?query=工作台&limit=10",
    });
    assert.equal(search.statusCode, 200);
    assert.equal(search.json().data[0].id, "partner-link-1");

    const entry = await app.inject({
      method: "GET",
      url: "/staff/partner-cloud-links/partner-link-1/entry-check",
    });
    assert.equal(entry.statusCode, 200);
    assert.equal(entry.json().data.symbolicDestination, "PARTNER_CLOUD_SYNTHETIC_WORKSPACE");
    assert.equal("providerUrl" in entry.json().data, false);
  } finally {
    await app.close();
  }
});

test("staff route denies suspended membership and arbitrary destination query", async () => {
  const app = makeRouteApp(makeService(), {
    tenant_id: TENANT_ID,
    campus_ids: [CAMPUS_ID],
    status: "SUSPENDED",
    capabilities: ["content:write"],
  });
  try {
    const denied = await app.inject({
      method: "GET",
      url: "/staff/partner-cloud-links?query=工作台",
    });
    assert.equal(denied.statusCode, 403);
  } finally {
    await app.close();
  }

  const claimApp = makeRouteApp(makeService());
  try {
    const arbitrary = await claimApp.inject({
      method: "GET",
      url: "/staff/partner-cloud-links/partner-link-1/entry-check?destination=https%3A%2F%2Fevil.example.invalid",
    });
    assert.equal(arbitrary.statusCode, 400);
  } finally {
    await claimApp.close();
  }
});

test("partner link page contract is local synthetic staff projection", () => {
  const source = readFileSync("apps/user-web/src/pages/partner-link.tsx", "utf8");

  assert.match(source, /PartnerLinkPage/);
  assert.match(source, /模拟数据/);
  assert.match(source, /过期|expired/i);
  assert.match(source, /拒绝|denied/i);
  assert.doesNotMatch(source, /fetch\(|axios|XMLHttpRequest/);
});
