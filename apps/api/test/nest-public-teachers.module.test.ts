import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import test from "node:test";
import {
  InMemoryTeacherProfileRepository,
  TeacherProfileService,
  type TeacherActorContext,
  type TeacherDraftPayload,
} from "../src/modules/teachers/public-profile.service.js";
import { createApiApp } from "../src/nest/api-app.js";

const ACTOR_ID = "00000000-0000-4000-8000-000000000003";
const TENANT_ID = "00000000-0000-4000-8000-000000000001";
const CAMPUS_ID = "00000000-0000-4000-8000-000000000002";

const ownerContext: TeacherActorContext = {
  trusted: true,
  actorId: ACTOR_ID,
  activeMembership: true,
  scope: { tenantId: TENANT_ID, campusId: CAMPUS_ID },
  capabilities: ["content:write", "content:publish"],
};

const publicTeacherPayload = {
  display_name: "模拟教师一号",
  headline: "小学数学引导教师",
  subjects: ["数学", "作业引导"],
  bio: "仅用于本机测试的虚构公开介绍。",
  photo_ref: "file-ref:/synthetic/teacher-one.png",
  private_email: "teacher-one@example.invalid",
  internal_notes: "仅供机构内部使用的模拟备注",
} as const satisfies TeacherDraftPayload;

function publishedTeacherService(): TeacherProfileService {
  const service = new TeacherProfileService(new InMemoryTeacherProfileRepository());
  assert.equal(
    service.createDraft(ownerContext, "synthetic-teacher-one", publicTeacherPayload).ok,
    true,
  );
  assert.equal(service.publish(ownerContext, "synthetic-teacher-one", 1).ok, true);
  return service;
}

test("Nest public teacher read fails closed when no server-owned scope is configured", async () => {
  const app = await createApiApp();
  const server = app.getHttpServer();

  try {
    await app.listen(0, "127.0.0.1");
    const address = server.address() as AddressInfo;
    const response = await fetch(
      `http://127.0.0.1:${address.port}/public/teachers/synthetic-teacher-one`,
      { headers: { connection: "close" } },
    );

    assert.equal(address.address, "127.0.0.1");
    assert.equal(response.status, 403);
    const body = (await response.json()) as { readonly error?: { readonly code?: string } };
    assert.equal(body.error?.code, "FORBIDDEN_SCOPE");
  } finally {
    await app.close();
  }

  assert.equal(server.address(), null);
});

test("Nest public teacher read returns only the published public projection", async () => {
  const app = await createApiApp({
    teacherProfileService: publishedTeacherService(),
    getPublicTeacherScope: () => ({ tenantId: TENANT_ID, campusId: CAMPUS_ID }),
  });
  const server = app.getHttpServer();

  try {
    await app.listen(0, "127.0.0.1");
    const address = server.address() as AddressInfo;
    const response = await fetch(
      `http://127.0.0.1:${address.port}/public/teachers/synthetic-teacher-one`,
      { headers: { connection: "close" } },
    );

    assert.equal(address.address, "127.0.0.1");
    assert.equal(response.status, 200);
    const body = (await response.json()) as {
      readonly data: Record<string, unknown>;
      readonly request_id: string;
    };
    assert.deepEqual(Object.keys(body.data).sort(), [
      "bio",
      "display_name",
      "headline",
      "id",
      "photo_ref",
      "published_at",
      "subjects",
    ]);
    assert.equal("private_email" in body.data, false);
    assert.equal("internal_notes" in body.data, false);
    assert.equal("tenant_id" in body.data, false);
    assert.equal("campus_id" in body.data, false);
    assert.equal(typeof body.request_id, "string");
  } finally {
    await app.close();
  }

  assert.equal(server.address(), null);
});

test("Nest public teacher read rejects client scope filters and hides unpublished profiles", async () => {
  const service = new TeacherProfileService(new InMemoryTeacherProfileRepository());
  assert.equal(
    service.createDraft(ownerContext, "synthetic-teacher-draft", publicTeacherPayload).ok,
    true,
  );
  const app = await createApiApp({
    teacherProfileService: service,
    getPublicTeacherScope: () => ({ tenantId: TENANT_ID, campusId: CAMPUS_ID }),
  });
  const server = app.getHttpServer();

  try {
    await app.listen(0, "127.0.0.1");
    const address = server.address() as AddressInfo;
    const base = `http://127.0.0.1:${address.port}/public/teachers`;
    const forbiddenQuery = await fetch(`${base}/synthetic-teacher-draft?role=PLATFORM_ADMIN`, {
      headers: { connection: "close" },
    });
    const unpublished = await fetch(`${base}/synthetic-teacher-draft`, {
      headers: { connection: "close" },
    });

    assert.equal(forbiddenQuery.status, 400);
    const forbiddenBody = (await forbiddenQuery.json()) as {
      readonly error?: { readonly code?: string };
    };
    assert.equal(forbiddenBody.error?.code, "VALIDATION_FAILED");
    assert.equal(unpublished.status, 404);
    const unpublishedBody = (await unpublished.json()) as {
      readonly error?: { readonly code?: string };
    };
    assert.equal(unpublishedBody.error?.code, "NOT_FOUND_SCOPED");
  } finally {
    await app.close();
  }

  assert.equal(server.address(), null);
});
