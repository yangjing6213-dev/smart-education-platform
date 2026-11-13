import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import test from "node:test";
import type { DraftPayload } from "../src/modules/content/content.service.js";
import { InMemoryContentRepository } from "../src/modules/content/content.repository.js";
import { InstitutionService } from "../src/modules/institution/institution.service.js";
import { createApiApp } from "../src/nest/api-app.js";
import { buildServer } from "../src/server.js";

const TENANT_ID = "00000000-0000-4000-8000-000000000001";
const CAMPUS_ID = "00000000-0000-4000-8000-000000000002";
const WEST_CAMPUS_ID = "00000000-0000-4000-8000-000000000004";
const OTHER_TENANT_ID = "00000000-0000-4000-8000-000000000005";

const institutionPayload = {
  title: "合成机构介绍",
  type: "INSTITUTION",
  visibility: "PUBLIC",
  body: {
    summary: "仅用于本机接口对照的公开简介。",
    blocks: [{ kind: "TEXT", text: "这是虚构内容。" }],
  },
  editor_note: "不得出现在访客返回内容中。",
} as const satisfies DraftPayload;

const homePayload = {
  title: "合成首页公告",
  type: "HOME_BLOCK",
  visibility: "PUBLIC",
  body: {
    summary: "仅用于本机接口对照的首页内容。",
    blocks: [{ kind: "TEXT", text: "这也是虚构内容。" }],
  },
} as const satisfies DraftPayload;

function makeInstitutionService(): InstitutionService {
  const service = new InstitutionService(new InMemoryContentRepository());
  const tenantContext = {
    trusted: true,
    actorId: "synthetic-owner",
    activeMembership: true,
    scope: { tenantId: TENANT_ID },
    capabilities: ["content:write", "content:publish"],
  } as const;

  assert.equal(
    service.createInstitutionDraft(tenantContext, "synthetic-profile", institutionPayload).ok,
    true,
  );
  assert.equal(service.publishInstitution(tenantContext, "synthetic-profile", 1).ok, true);
  assert.equal(
    service.readInstitutionPublicForVisitor({ tenantId: TENANT_ID }, "synthetic-profile").ok,
    true,
  );
  const otherTenantContext = { ...tenantContext, scope: { tenantId: OTHER_TENANT_ID } };
  assert.equal(
    service.createInstitutionDraft(
      otherTenantContext,
      "synthetic-other-profile",
      institutionPayload,
    ).ok,
    true,
  );
  assert.equal(
    service.publishInstitution(otherTenantContext, "synthetic-other-profile", 1).ok,
    true,
  );
  const campusContext = { ...tenantContext, scope: { tenantId: TENANT_ID, campusId: CAMPUS_ID } };
  assert.equal(service.createHomeDraft(campusContext, "synthetic-home", homePayload).ok, true);
  assert.equal(service.publishHome(campusContext, "synthetic-home", 1).ok, true);
  assert.equal(
    service.readHomePublicForVisitor({ tenantId: TENANT_ID, campusId: CAMPUS_ID }, "synthetic-home")
      .ok,
    true,
  );
  const westCampusContext = {
    ...tenantContext,
    scope: { tenantId: TENANT_ID, campusId: WEST_CAMPUS_ID },
  };
  assert.equal(
    service.createHomeDraft(westCampusContext, "synthetic-west-home", homePayload).ok,
    true,
  );
  assert.equal(service.publishHome(westCampusContext, "synthetic-west-home", 1).ok, true);
  return service;
}

async function getJson(base: string, path: string) {
  const response = await fetch(`${base}${path}`, { headers: { connection: "close" } });
  return {
    status: response.status,
    body: (await response.json()) as Record<string, unknown>,
  };
}

function errorCode(body: Record<string, unknown>): string | undefined {
  const error = body.error as Record<string, unknown> | undefined;
  return typeof error?.code === "string" ? error.code : undefined;
}

test("Nest public institution reads match Fastify projection, scope, and errors", async () => {
  const institutionService = makeInstitutionService();
  const getPublicInstitutionScope = (_request: unknown, kind: "INSTITUTION" | "HOME_BLOCK") =>
    kind === "INSTITUTION" ? { tenantId: TENANT_ID } : { tenantId: TENANT_ID, campusId: CAMPUS_ID };
  const options = {
    institutionService,
    getPublicInstitutionScope,
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

    const compare = async (path: string) => {
      const [nestResult, fastifyResult] = await Promise.all([
        getJson(nestBase, path),
        getJson(fastifyBase, path),
      ]);
      assert.equal(nestResult.status, fastifyResult.status, path);
      if (nestResult.status === 200) {
        assert.deepEqual(nestResult.body.data, fastifyResult.body.data, path);
      } else {
        assert.equal(errorCode(nestResult.body), errorCode(fastifyResult.body), path);
      }
      return nestResult;
    };

    const profile = await compare(
      "/public/institution/profile/synthetic-profile?public_ref=synthetic-public-campus",
    );
    assert.equal(profile.status, 200, JSON.stringify(profile.body));
    const profileData = profile.body.data as Record<string, unknown>;
    assert.equal(profileData.title, institutionPayload.title);
    assert.equal("editor_note" in profileData, false);
    assert.equal("tenant_id" in profileData, false);
    assert.equal("campus_id" in profileData, false);

    const profileList = await getJson(
      nestBase,
      "/public/institution/profile?public_ref=synthetic-public-campus",
    );
    assert.equal(profileList.status, 200, JSON.stringify(profileList.body));
    const profileItems = profileList.body.data as readonly Record<string, unknown>[];
    assert.equal(profileItems.length, 1);
    assert.equal(profileItems[0]?.content_key, "synthetic-profile");
    assert.equal("editor_note" in profileItems[0]!, false);

    const forgedList = await getJson(
      nestBase,
      "/public/institution/profile?public_ref=synthetic-public-campus&campus_id=" + WEST_CAMPUS_ID,
    );
    assert.equal(forgedList.status, 400);

    const home = await compare("/public/institution/home/synthetic-home");
    assert.equal(home.status, 200, JSON.stringify(home.body));
    assert.equal((home.body.data as Record<string, unknown>).title, homePayload.title);

    for (const [path, expected] of [
      ["/public/institution/other/synthetic-profile", 400],
      ["/public/institution/profile/missing-profile", 404],
      ["/public/institution/profile/synthetic-other-profile", 404],
      ["/public/institution/home/synthetic-west-home", 404],
    ] as const) {
      const result = await compare(path);
      assert.equal(result.status, expected, path);
    }
  } finally {
    await Promise.all([nest.close(), fastify.close()]);
  }

  assert.equal(nest.getHttpServer().address(), null);
  assert.equal(fastify.server.address(), null);
});

test("Nest and Fastify public institution reads fail closed without server scope", async () => {
  const options = { institutionService: makeInstitutionService() } as Parameters<
    typeof createApiApp
  >[0] &
    Parameters<typeof buildServer>[0];
  const nest = await createApiApp(options);
  const fastify = buildServer(options);

  try {
    await nest.listen(0, "127.0.0.1");
    await fastify.listen({ port: 0, host: "127.0.0.1" });
    const nestAddress = nest.getHttpServer().address() as AddressInfo;
    const fastifyAddress = fastify.server.address() as AddressInfo;
    const [nestResult, fastifyResult] = await Promise.all([
      getJson(
        `http://127.0.0.1:${nestAddress.port}`,
        "/public/institution/profile/synthetic-profile",
      ),
      getJson(
        `http://127.0.0.1:${fastifyAddress.port}`,
        "/public/institution/profile/synthetic-profile",
      ),
    ]);
    assert.equal(nestResult.status, 403);
    assert.equal(fastifyResult.status, 403);
    assert.equal(errorCode(nestResult.body), "FORBIDDEN_SCOPE");
    assert.equal(errorCode(fastifyResult.body), "FORBIDDEN_SCOPE");
  } finally {
    await Promise.all([nest.close(), fastify.close()]);
  }

  assert.equal(nest.getHttpServer().address(), null);
  assert.equal(fastify.server.address(), null);
});

test("Nest public institution accepts an opaque reference and rejects client scope selectors", async () => {
  const nest = await createApiApp({
    institutionService: makeInstitutionService(),
    getPublicInstitutionScope: () => ({ tenantId: TENANT_ID, campusId: CAMPUS_ID }),
  });

  try {
    await nest.listen(0, "127.0.0.1");
    const address = nest.getHttpServer().address() as AddressInfo;
    const base = `http://127.0.0.1:${address.port}`;
    const valid = await getJson(
      base,
      "/public/institution/profile/synthetic-profile?public_ref=synthetic-campus-east",
    );
    const forged = await getJson(
      base,
      "/public/institution/profile/synthetic-profile?public_ref=synthetic-campus-east&campus_id=" +
        WEST_CAMPUS_ID,
    );
    assert.equal(valid.status, 200);
    assert.equal(forged.status, 400);
    assert.equal(errorCode(forged.body), "VALIDATION_FAILED");
  } finally {
    await nest.close();
  }
});
