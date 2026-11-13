import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import test from "node:test";
import type { TrustedAuthResult } from "@student-care/auth";
import type { DraftPayload } from "../src/modules/content/content.service.js";
import { InMemoryContentRepository } from "../src/modules/content/content.repository.js";
import { InstitutionService } from "../src/modules/institution/institution.service.js";
import { createApiApp } from "../src/nest/api-app.js";
import { buildServer } from "../src/server.js";

const ACTOR_ID = "00000000-0000-4000-8000-000000000003";
const TENANT_ID = "00000000-0000-4000-8000-000000000001";
const EAST_CAMPUS_ID = "00000000-0000-4000-8000-000000000002";
const WEST_CAMPUS_ID = "00000000-0000-4000-8000-000000000004";
const OTHER_TENANT_ID = "00000000-0000-4000-8000-000000000005";

const ownerAuth: TrustedAuthResult = {
  trusted: true,
  session: {
    trusted: true,
    status: "ACTIVE",
    actor_id: ACTOR_ID,
    expires_at: "2099-01-01T00:00:00.000Z",
  },
  identity: { actor_id: ACTOR_ID, display_name: "模拟机构负责人" },
  memberships: [
    {
      tenant_id: TENANT_ID,
      campus_ids: [EAST_CAMPUS_ID, WEST_CAMPUS_ID],
      status: "ACTIVE",
      capabilities: ["content:write", "content:publish"],
    },
  ],
};

const institutionPayload: DraftPayload = {
  title: "模拟机构介绍",
  type: "INSTITUTION",
  visibility: "PUBLIC",
  body: { summary: "只用于本机操作对照。", blocks: [{ kind: "TEXT", text: "虚构介绍" }] },
  editor_note: "模拟内部编辑备注",
};

const homePayload: DraftPayload = {
  title: "模拟首页内容",
  type: "HOME_BLOCK",
  visibility: "PUBLIC",
  body: { summary: "只用于本机操作对照。", blocks: [{ kind: "TEXT", text: "虚构公告" }] },
};

function makeInstitutionService(): InstitutionService {
  return new InstitutionService(new InMemoryContentRepository(), {
    now: () => new Date("2026-10-16T00:00:00.000Z"),
  });
}

async function requestJson(
  base: string,
  path: string,
  method: "GET" | "POST" | "PUT",
  body?: unknown,
) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: {
      connection: "close",
      ...(body === undefined ? {} : { "content-type": "application/json" }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return { status: response.status, body: (await response.json()) as Record<string, unknown> };
}

function withoutRequestId(body: Record<string, unknown>) {
  const result = { ...body };
  delete result.request_id;
  return result;
}

function errorCode(body: Record<string, unknown>): string | undefined {
  const error = body.error as Record<string, unknown> | undefined;
  return typeof error?.code === "string" ? error.code : undefined;
}

test("Nest institution draft and publication operations match Fastify scope and version rules", async () => {
  let auth: TrustedAuthResult | undefined = ownerAuth;
  const nestInstitutionService = makeInstitutionService();
  const fastifyInstitutionService = makeInstitutionService();
  const options = {
    getTrustedAuthResult: () => auth,
    institutionService: nestInstitutionService,
  } as Parameters<typeof createApiApp>[0] & Parameters<typeof buildServer>[0];
  const nest = await createApiApp(options);
  const fastify = buildServer({ ...options, institutionService: fastifyInstitutionService });

  try {
    await nest.listen(0, "127.0.0.1");
    await fastify.listen({ port: 0, host: "127.0.0.1" });
    const nestAddress = nest.getHttpServer().address() as AddressInfo;
    const fastifyAddress = fastify.server.address() as AddressInfo;
    assert.equal(nestAddress.address, "127.0.0.1");
    assert.equal(fastifyAddress.address, "127.0.0.1");
    const nestBase = `http://127.0.0.1:${nestAddress.port}`;
    const fastifyBase = `http://127.0.0.1:${fastifyAddress.port}`;

    const compare = async (path: string, method: "GET" | "POST" | "PUT", body?: unknown) => {
      const [nestResult, fastifyResult] = await Promise.all([
        requestJson(nestBase, path, method, body),
        requestJson(fastifyBase, path, method, body),
      ]);
      assert.equal(nestResult.status, fastifyResult.status, path);
      assert.deepEqual(
        withoutRequestId(nestResult.body),
        withoutRequestId(fastifyResult.body),
        path,
      );
      return nestResult;
    };

    const scope = `?tenant_id=${TENANT_ID}&campus_id=${EAST_CAMPUS_ID}`;
    const draftPath = `/admin/institution/profile/synthetic-profile/draft${scope}`;
    const createBody = { payload: institutionPayload, expected_version: null };
    const created = await compare(draftPath, "POST", createBody);
    assert.equal(created.status, 201, JSON.stringify(created.body));

    const updated = await compare(draftPath, "PUT", {
      payload: { ...institutionPayload, title: "模拟机构介绍修订" },
      expected_version: 1,
    });
    assert.equal(updated.status, 200);
    assert.equal((updated.body.data as Record<string, unknown>).version, 2);

    const stale = await compare(draftPath, "PUT", {
      payload: institutionPayload,
      expected_version: 1,
    });
    assert.equal(stale.status, 409);
    assert.equal(errorCode(stale.body), "VERSION_MISMATCH");

    const published = await compare(
      `/admin/institution/profile/synthetic-profile/publish${scope}`,
      "POST",
      { expected_version: 2 },
    );
    assert.equal(published.status, 200);
    assert.equal((published.body.data as Record<string, unknown>).status, "PUBLISHED");

    const unpublished = await compare(
      `/admin/institution/profile/synthetic-profile/unpublish${scope}`,
      "POST",
      { expected_version: 3 },
    );
    assert.equal(unpublished.status, 200);
    assert.equal((unpublished.body.data as Record<string, unknown>).status, "UNPUBLISHED");

    const homeScope = `?tenant_id=${TENANT_ID}&campus_id=${EAST_CAMPUS_ID}`;
    const homePath = `/admin/institution/home/synthetic-home/draft${homeScope}`;
    const homeCreated = await compare(homePath, "POST", {
      payload: homePayload,
      expected_version: null,
    });
    assert.equal(homeCreated.status, 201);
    const homeRead = await compare(homePath, "GET");
    assert.equal(homeRead.status, 200);
    assert.equal((homeRead.body.data as Record<string, unknown>).content_key, "synthetic-home");
    assert.equal((homeRead.body.data as Record<string, unknown>).status, "DRAFT");
    const homeUpdated = await compare(homePath, "PUT", {
      payload: { ...homePayload, title: "模拟首页内容修订" },
      expected_version: 1,
    });
    assert.equal(homeUpdated.status, 200);
    assert.equal((homeUpdated.body.data as Record<string, unknown>).version, 2);
    const homePublished = await compare(
      `/admin/institution/home/synthetic-home/publish${homeScope}`,
      "POST",
      { expected_version: 2 },
    );
    assert.equal(homePublished.status, 200);
    const homeUnpublished = await compare(
      `/admin/institution/home/synthetic-home/unpublish${homeScope}`,
      "POST",
      { expected_version: 3 },
    );
    assert.equal(homeUnpublished.status, 200);

    const invalidKind = await compare(
      `/admin/institution/organization/synthetic-invalid/draft${scope}`,
      "POST",
      createBody,
    );
    assert.equal(invalidKind.status, 400);
    const invalidContentKey = await compare(
      `/admin/institution/profile/%21invalid/draft${scope}`,
      "POST",
      createBody,
    );
    assert.equal(invalidContentKey.status, 400);
    const missingContent = await compare(
      `/admin/institution/profile/missing-content/publish${scope}`,
      "POST",
      { expected_version: 1 },
    );
    assert.equal(missingContent.status, 404);
    assert.equal(errorCode(missingContent.body), "NOT_FOUND_SCOPED");
    const unknownBody = await compare(draftPath, "PUT", {
      payload: institutionPayload,
      expected_version: 2,
      tenant_id: OTHER_TENANT_ID,
    });
    assert.equal(unknownBody.status, 400);
    const missingVersion = await compare(draftPath, "PUT", { payload: institutionPayload });
    assert.equal(missingVersion.status, 400);

    auth = {
      ...ownerAuth,
      memberships: [{ ...ownerAuth.memberships[0]!, capabilities: ["content:write"] }],
    };
    const writerCannotPublish = await compare(
      `/admin/institution/profile/synthetic-profile/publish${scope}`,
      "POST",
      { expected_version: 4 },
    );
    assert.equal(writerCannotPublish.status, 403);
    assert.equal(errorCode(writerCannotPublish.body), "FORBIDDEN_SCOPE");

    auth = {
      ...ownerAuth,
      memberships: [{ ...ownerAuth.memberships[0]!, campus_ids: [EAST_CAMPUS_ID] }],
    };
    const crossCampus = await compare(
      `/admin/institution/home/synthetic-home/draft?tenant_id=${TENANT_ID}&campus_id=${WEST_CAMPUS_ID}`,
      "POST",
      { payload: homePayload, expected_version: 1 },
    );
    assert.equal(crossCampus.status, 403);
    assert.equal(errorCode(crossCampus.body), "FORBIDDEN_SCOPE");
    const crossCampusRead = await compare(
      `/admin/institution/home/synthetic-home/draft?tenant_id=${TENANT_ID}&campus_id=${WEST_CAMPUS_ID}`,
      "GET",
    );
    assert.equal(crossCampusRead.status, 403);
    assert.equal(errorCode(crossCampusRead.body), "FORBIDDEN_SCOPE");

    const crossTenant = await compare(
      `/admin/institution/profile/synthetic-profile/publish?tenant_id=${OTHER_TENANT_ID}`,
      "POST",
      { expected_version: 4 },
    );
    assert.equal(crossTenant.status, 403);
    assert.equal(errorCode(crossTenant.body), "FORBIDDEN_SCOPE");

    const forgedIdentity = await compare(
      `/admin/institution/profile/synthetic-profile/draft${scope}&actor_id=${ACTOR_ID}`,
      "POST",
      createBody,
    );
    assert.equal(forgedIdentity.status, 401);
    assert.equal(errorCode(forgedIdentity.body), "UNAUTHENTICATED");

    auth = undefined;
    const unauthenticated = await compare(draftPath, "POST", createBody);
    assert.equal(unauthenticated.status, 401);
    assert.equal(errorCode(unauthenticated.body), "UNAUTHENTICATED");
    const unauthenticatedRead = await compare(homePath, "GET");
    assert.equal(unauthenticatedRead.status, 401);
    assert.equal(errorCode(unauthenticatedRead.body), "UNAUTHENTICATED");

    auth = { ...ownerAuth, memberships: [] };
    const noMembership = await compare(draftPath, "POST", createBody);
    assert.equal(noMembership.status, 403);
    assert.equal(errorCode(noMembership.body), "FORBIDDEN_SCOPE");
    const noMembershipRead = await compare(homePath, "GET");
    assert.equal(noMembershipRead.status, 403);
    assert.equal(errorCode(noMembershipRead.body), "FORBIDDEN_SCOPE");

    auth = {
      ...ownerAuth,
      memberships: [{ ...ownerAuth.memberships[0]!, capabilities: ["identity:read"] }],
    };
    const noWriteCapabilityRead = await compare(homePath, "GET");
    assert.equal(noWriteCapabilityRead.status, 403);
    assert.equal(errorCode(noWriteCapabilityRead.body), "FORBIDDEN_SCOPE");
  } finally {
    await Promise.all([nest.close(), fastify.close()]);
  }

  assert.equal(nest.getHttpServer().address(), null);
  assert.equal(fastify.server.address(), null);
});

test("Nest default institution service is shared between admin publication and visitor reads", async () => {
  const nest = await createApiApp({
    getTrustedAuthResult: () => ownerAuth,
    getPublicInstitutionScope: (_request, kind) =>
      kind === "INSTITUTION" ? { tenantId: TENANT_ID } : undefined,
  });

  try {
    await nest.listen(0, "127.0.0.1");
    const address = nest.getHttpServer().address() as AddressInfo;
    assert.equal(address.address, "127.0.0.1");
    const base = `http://127.0.0.1:${address.port}`;
    const scope = `?tenant_id=${TENANT_ID}&campus_id=${EAST_CAMPUS_ID}`;
    const draft = await requestJson(
      base,
      `/admin/institution/profile/shared-default-service/draft${scope}`,
      "POST",
      { payload: institutionPayload, expected_version: null },
    );
    assert.equal(draft.status, 201);

    const publish = await requestJson(
      base,
      `/admin/institution/profile/shared-default-service/publish${scope}`,
      "POST",
      { expected_version: 1 },
    );
    assert.equal(publish.status, 200);

    const visitor = await requestJson(
      base,
      "/public/institution/profile/shared-default-service",
      "GET",
    );
    assert.equal(visitor.status, 200);
    assert.equal((visitor.body.data as Record<string, unknown>).title, institutionPayload.title);
    assert.equal("editor_note" in (visitor.body.data as Record<string, unknown>), false);
  } finally {
    await nest.close();
  }

  assert.equal(nest.getHttpServer().address(), null);
});
