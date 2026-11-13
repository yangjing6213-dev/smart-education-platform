import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import test from "node:test";
import type { TrustedAuthResult } from "@student-care/auth";
import {
  InMemoryPartnerLinkRepository,
  PartnerLinkService,
  type PartnerLinkRecord,
} from "../src/modules/partner-links/partner-link.service.js";
import { createApiApp } from "../src/nest/api-app.js";
import { buildServer } from "../src/server.js";

const ACTOR_ID = "00000000-0000-4000-8000-000000000003";
const TENANT_ID = "00000000-0000-4000-8000-000000000001";
const CAMPUS_ID = "00000000-0000-4000-8000-000000000002";
const FOREIGN_CAMPUS_ID = "00000000-0000-4000-8000-000000000004";

const STAFF_AUTH: TrustedAuthResult = {
  trusted: true,
  session: {
    trusted: true,
    status: "ACTIVE",
    actor_id: ACTOR_ID,
    expires_at: "2099-01-01T00:00:00.000Z",
  },
  identity: { actor_id: ACTOR_ID, display_name: "合成员工一号" },
  memberships: [
    {
      tenant_id: TENANT_ID,
      campus_ids: [CAMPUS_ID],
      status: "ACTIVE",
      capabilities: ["content:write"],
    },
  ],
};

const STAFF_WITHOUT_CONTENT_CAPABILITY: TrustedAuthResult = {
  ...STAFF_AUTH,
  memberships: [
    {
      ...STAFF_AUTH.memberships[0]!,
      capabilities: ["memberships:read"],
    },
  ],
};

const records = [
  {
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
    description: "仅用于本机测试的虚构伙伴入口。",
    version: 3,
    synthetic_data: true,
  },
  {
    id: "partner-link-draft",
    tenant_id: TENANT_ID,
    campus_id: CAMPUS_ID,
    symbolic_destination: "PARTNER_CLOUD_SYNTHETIC_DRAFT",
    normalized_host: "synthetic.partner.invalid",
    normalized_path: "/approved/draft",
    allowed_roles: ["content:write"],
    required_capability: "content:write",
    publication_status: "DRAFT",
    enabled_status: "ENABLED",
    allowlist_policy_version: "policy-v1",
    title: "模拟草稿入口",
    description: "不得出现在工作入口列表。",
    version: 1,
    synthetic_data: true,
  },
  {
    id: "partner-link-disabled",
    tenant_id: TENANT_ID,
    campus_id: CAMPUS_ID,
    symbolic_destination: "PARTNER_CLOUD_SYNTHETIC_DISABLED",
    normalized_host: "synthetic.partner.invalid",
    normalized_path: "/approved/disabled",
    allowed_roles: ["content:write"],
    required_capability: "content:write",
    publication_status: "PUBLISHED",
    enabled_status: "DISABLED",
    allowlist_policy_version: "policy-v1",
    title: "模拟停用入口",
    description: "不得签发进入凭证。",
    version: 1,
    synthetic_data: true,
  },
  {
    id: "partner-link-foreign-campus",
    tenant_id: TENANT_ID,
    campus_id: FOREIGN_CAMPUS_ID,
    symbolic_destination: "PARTNER_CLOUD_SYNTHETIC_FOREIGN",
    normalized_host: "synthetic.partner.invalid",
    normalized_path: "/approved/foreign",
    allowed_roles: ["content:write"],
    required_capability: "content:write",
    publication_status: "PUBLISHED",
    enabled_status: "ENABLED",
    allowlist_policy_version: "policy-v1",
    title: "模拟外校区入口",
    description: "不得跨校区显示或签发。",
    version: 1,
    synthetic_data: true,
  },
] as const satisfies readonly PartnerLinkRecord[];

function makeService(): PartnerLinkService {
  return new PartnerLinkService(new InMemoryPartnerLinkRepository(records), {
    now: () => new Date("2026-10-16T08:00:00.000Z"),
  });
}

async function withServers(
  auth: TrustedAuthResult | undefined,
  run: (nestBase: string, fastifyBase: string) => Promise<void>,
): Promise<void> {
  const options = { getTrustedAuthResult: () => auth };
  const nest = await createApiApp({ ...options, partnerLinkService: makeService() });
  const fastify = buildServer({ ...options, partnerLinkService: makeService() });

  try {
    await nest.listen(0, "127.0.0.1");
    await fastify.listen({ port: 0, host: "127.0.0.1" });
    const nestAddress = nest.getHttpServer().address() as AddressInfo;
    const fastifyAddress = fastify.server.address() as AddressInfo;
    assert.equal(nestAddress.address, "127.0.0.1");
    assert.equal(fastifyAddress.address, "127.0.0.1");
    await run(
      `http://127.0.0.1:${nestAddress.port}`,
      `http://127.0.0.1:${fastifyAddress.port}`,
    );
  } finally {
    await Promise.all([nest.close(), fastify.close()]);
  }

  assert.equal(nest.getHttpServer().address(), null);
  assert.equal(fastify.server.address(), null);
}

async function getJson(base: string, path: string) {
  const response = await fetch(`${base}${path}`, { headers: { connection: "close" } });
  return {
    status: response.status,
    redirected: response.redirected,
    location: response.headers.get("location"),
    body: (await response.json()) as Record<string, unknown>,
  };
}

function errorCode(body: Record<string, unknown>): string | undefined {
  const error = body.error as Record<string, unknown> | undefined;
  return typeof error?.code === "string" ? error.code : undefined;
}

test("Nest partner-link requests fail closed like Fastify without trusted staff access", async () => {
  await withServers(undefined, async (nestBase, fastifyBase) => {
    for (const path of [
      "/staff/partner-cloud-links",
      "/staff/partner-cloud-links/partner-link-1/entry-check",
    ]) {
      const [nest, fastify] = await Promise.all([
        getJson(nestBase, path),
        getJson(fastifyBase, path),
      ]);
      assert.equal(nest.status, 401);
      assert.equal(nest.status, fastify.status);
      assert.equal(errorCode(nest.body), errorCode(fastify.body));
    }
  });
});

test("Nest partner-link search and entry checks match Fastify scoped projections", async () => {
  await withServers(STAFF_AUTH, async (nestBase, fastifyBase) => {
    const path = "/staff/partner-cloud-links?query=%E6%A8%A1%E6%8B%9F";
    const [nestSearch, fastifySearch] = await Promise.all([
      getJson(nestBase, path),
      getJson(fastifyBase, path),
    ]);
    assert.equal(nestSearch.status, 200);
    assert.equal(nestSearch.status, fastifySearch.status);
    assert.deepEqual(nestSearch.body.data, fastifySearch.body.data);
    const searchData = nestSearch.body.data as Record<string, unknown>[];
    assert.deepEqual(searchData.map((item) => item.id), ["partner-link-1"]);
    assert.deepEqual(Object.keys(searchData[0]!).sort(), [
      "description",
      "enabledStatus",
      "id",
      "normalizedHost",
      "normalizedPath",
      "policyVersion",
      "publicationStatus",
      "symbolicDestination",
      "title",
      "version",
    ]);
    assert.equal(searchData[0]?.normalizedHost, "synthetic.partner.invalid");

    const entryPath = "/staff/partner-cloud-links/partner-link-1/entry-check";
    const [nestEntry, fastifyEntry] = await Promise.all([
      getJson(nestBase, entryPath),
      getJson(fastifyBase, entryPath),
    ]);
    assert.equal(nestEntry.status, 200);
    assert.equal(nestEntry.status, fastifyEntry.status);
    assert.deepEqual(nestEntry.body.data, fastifyEntry.body.data);
    assert.equal(nestEntry.redirected, false);
    assert.equal(nestEntry.location, null);
    const entryData = nestEntry.body.data as Record<string, unknown>;
    assert.equal(typeof entryData.handoffToken, "string");
    assert.equal(typeof entryData.expiresAt, "string");
  });
});

test("Nest partner-link routes match Fastify validation and campus denials", async () => {
  await withServers(STAFF_AUTH, async (nestBase, fastifyBase) => {
    const paths = [
      "/staff/partner-cloud-links?tenant_id=00000000-0000-4000-8000-000000000001",
      "/staff/partner-cloud-links?campus_id=00000000-0000-4000-8000-000000000004",
      "/staff/partner-cloud-links?query=bad&unexpected=value",
      "/staff/partner-cloud-links?limit=26",
      "/staff/partner-cloud-links?actor_id=00000000-0000-4000-8000-000000000003",
      "/staff/partner-cloud-links/not%20a%20valid%20id/entry-check",
      "/staff/partner-cloud-links/partner-link-draft/entry-check",
      "/staff/partner-cloud-links/partner-link-disabled/entry-check",
      "/staff/partner-cloud-links/partner-link-foreign-campus/entry-check",
    ];
    for (const path of paths) {
      const [nest, fastify] = await Promise.all([
        getJson(nestBase, path),
        getJson(fastifyBase, path),
      ]);
      assert.equal(nest.status, fastify.status, path);
      assert.equal(errorCode(nest.body), errorCode(fastify.body), path);
      assert.notEqual(nest.status, 200, path);
    }
  });
});

test("Nest partner-link routes require the same content capability as Fastify", async () => {
  await withServers(STAFF_WITHOUT_CONTENT_CAPABILITY, async (nestBase, fastifyBase) => {
    const [nest, fastify] = await Promise.all([
      getJson(nestBase, "/staff/partner-cloud-links"),
      getJson(fastifyBase, "/staff/partner-cloud-links"),
    ]);
    assert.equal(nest.status, 403);
    assert.equal(nest.status, fastify.status);
    assert.equal(errorCode(nest.body), errorCode(fastify.body));
  });
});
