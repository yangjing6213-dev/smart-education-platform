import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import test from "node:test";
import type { TrustedAuthResult } from "@student-care/auth";
import { ContentService } from "../src/modules/content/content.service.js";
import {
  InMemoryContentRepository,
  type ContentRecord,
} from "../src/modules/content/content.repository.js";
import { createApiApp } from "../src/nest/api-app.js";

const ACTOR_ID = "00000000-0000-4000-8000-000000000003";
const TENANT_ID = "00000000-0000-4000-8000-000000000001";
const CAMPUS_ID = "00000000-0000-4000-8000-000000000002";
const OTHER_CAMPUS_ID = "00000000-0000-4000-8000-000000000004";

const trustedAuthResult: TrustedAuthResult = {
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

const publicContentRecord: ContentRecord = {
  id: "synthetic-institution-home",
  content_key: "synthetic-institution-home",
  tenant_id: TENANT_ID,
  campus_id: CAMPUS_ID,
  type: "INSTITUTION",
  status: "PUBLISHED",
  title: "模拟机构介绍",
  version: 1,
  visibility: "PUBLIC",
  body: {
    summary: "仅用于本机测试的合成摘要",
    blocks: [{ kind: "TEXT", text: "仅用于本机测试的合成内容" }],
  },
  published_at: "2026-10-15T00:00:00.000Z",
  synthetic_data: true,
  editor_note: "",
  moderation_state: "APPROVED",
  tenant_admin_note: "",
  campus_admin_note: "",
  updated_by: ACTOR_ID,
  updated_at: "2026-10-15T00:00:00.000Z",
};

function contentService(): ContentService {
  return new ContentService(new InMemoryContentRepository([publicContentRecord]));
}

test("Nest API serves health and scoped synthetic public content on loopback", async () => {
  const app = await createApiApp({
    getTrustedAuthResult: () => trustedAuthResult,
    contentService: contentService(),
  });
  const server = app.getHttpServer();

  try {
    await app.listen(0, "127.0.0.1");
    const address = server.address() as AddressInfo;
    const baseUrl = `http://127.0.0.1:${address.port}`;
    assert.equal(address.address, "127.0.0.1");

    const health = await fetch(`${baseUrl}/health`, { headers: { connection: "close" } });
    const response = await fetch(
      `${baseUrl}/public-content/${publicContentRecord.content_key}?tenant_id=${TENANT_ID}&campus_id=${CAMPUS_ID}`,
      { headers: { connection: "close" } },
    );

    assert.equal(health.status, 200);
    assert.deepEqual(await health.json(), { status: "ok" });
    assert.equal(response.status, 200);
    const body = (await response.json()) as {
      readonly data: Record<string, unknown>;
      readonly request_id: string;
    };
    assert.deepEqual(body.data, {
      id: publicContentRecord.id,
      content_key: publicContentRecord.content_key,
      type: publicContentRecord.type,
      title: publicContentRecord.title,
      version: publicContentRecord.version,
      visibility: publicContentRecord.visibility,
      summary: publicContentRecord.body.summary,
      blocks: [{ kind: "TEXT", text: "仅用于本机测试的合成内容" }],
      published_at: publicContentRecord.published_at,
    });
    assert.equal(typeof body.request_id, "string");
  } finally {
    await app.close();
  }

  assert.equal(server.address(), null);
});

test("Nest public content fails closed without trusted identity", async () => {
  const app = await createApiApp({ contentService: contentService() });
  const server = app.getHttpServer();

  try {
    await app.listen(0, "127.0.0.1");
    const address = server.address() as AddressInfo;
    const response = await fetch(
      `http://127.0.0.1:${address.port}/public-content/${publicContentRecord.content_key}?tenant_id=${TENANT_ID}&campus_id=${CAMPUS_ID}`,
      { headers: { connection: "close" } },
    );
    assert.equal(response.status, 401);
    const body = (await response.json()) as { readonly error?: { readonly code?: string } };
    assert.equal(body.error?.code, "UNAUTHENTICATED");
  } finally {
    await app.close();
  }

  assert.equal(server.address(), null);
});

test("Nest public content rejects forged claims, foreign scope, forbidden filters, and missing content", async () => {
  const app = await createApiApp({
    getTrustedAuthResult: () => trustedAuthResult,
    contentService: contentService(),
  });
  const server = app.getHttpServer();

  try {
    await app.listen(0, "127.0.0.1");
    const address = server.address() as AddressInfo;
    const baseUrl = `http://127.0.0.1:${address.port}`;
    const path = `/public-content/${publicContentRecord.content_key}`;
    const fetchStatus = async (url: string, headers: Record<string, string> = {}) =>
      fetch(`${baseUrl}${url}`, { headers: { connection: "close", ...headers } });

    const forgedQuery = await fetchStatus(`${path}?tenant_id=${TENANT_ID}&role=PLATFORM_ADMIN`);
    const forgedHeader = await fetchStatus(`${path}?tenant_id=${TENANT_ID}`, {
      "x-role": "PLATFORM_ADMIN",
    });
    const foreignTenant = await fetchStatus(
      `${path}?tenant_id=00000000-0000-4000-8000-000000000005`,
    );
    const foreignCampus = await fetchStatus(
      `${path}?tenant_id=${TENANT_ID}&campus_id=${OTHER_CAMPUS_ID}`,
    );
    const forbiddenFilter = await fetchStatus(
      `${path}?tenant_id=${TENANT_ID}&campus_id=${CAMPUS_ID}&status=PUBLISHED`,
    );
    const missing = await fetchStatus(
      `/public-content/missing-synthetic-content?tenant_id=${TENANT_ID}&campus_id=${CAMPUS_ID}`,
    );

    for (const response of [forgedQuery, forgedHeader]) {
      assert.equal(response.status, 401);
      const body = (await response.json()) as { readonly error?: { readonly code?: string } };
      assert.equal(body.error?.code, "UNAUTHENTICATED");
    }
    for (const response of [foreignTenant, foreignCampus]) {
      assert.equal(response.status, 403);
      const body = (await response.json()) as { readonly error?: { readonly code?: string } };
      assert.equal(body.error?.code, "FORBIDDEN_SCOPE");
    }
    assert.equal(forbiddenFilter.status, 400);
    const forbiddenBody = (await forbiddenFilter.json()) as {
      readonly error?: { readonly code?: string };
    };
    assert.equal(forbiddenBody.error?.code, "VALIDATION_FAILED");
    assert.equal(missing.status, 404);
    const missingBody = (await missing.json()) as { readonly error?: { readonly code?: string } };
    assert.equal(missingBody.error?.code, "NOT_FOUND_SCOPED");
  } finally {
    await app.close();
  }

  assert.equal(server.address(), null);
});
