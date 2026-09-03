import assert from "node:assert/strict";
import test from "node:test";
import fastify from "fastify";
import { buildServer } from "../../server.js";
import { registerPublicTeacherRoutes } from "../../routes/public-teachers.route.js";
import {
  InMemoryTeacherProfileRepository,
  type TeacherProfileRecord,
  type TeacherProfileRepository,
  TeacherProfileService,
  type TeacherActorContext,
  type TeacherDraftPayload,
  type TeacherPublicationAuditEvent,
} from "./public-profile.service.js";

const ACTOR_ID = "00000000-0000-4000-8000-000000000003";
const TENANT_ID = "00000000-0000-4000-8000-000000000001";
const CAMPUS_ID = "00000000-0000-4000-8000-000000000002";
const FOREIGN_TENANT_ID = "00000000-0000-4000-8000-000000000004";
const FOREIGN_CAMPUS_ID = "00000000-0000-4000-8000-000000000005";

const teacherPayload = {
  display_name: "模拟教师一号",
  headline: "小学数学引导教师",
  subjects: ["数学", "作业引导"],
  bio: "这是一段仅用于测试的虚构公开介绍。",
  photo_ref: "file-ref:/synthetic/teacher-one.png",
  private_email: "teacher-one@example.invalid",
  internal_notes: "仅供机构内部使用的模拟备注",
} as const satisfies TeacherDraftPayload;

const ownerContext = {
  trusted: true,
  actorId: ACTOR_ID,
  activeMembership: true,
  scope: { tenantId: TENANT_ID, campusId: CAMPUS_ID },
  capabilities: ["content:write", "content:publish"],
} as const satisfies TeacherActorContext;

const staffContext = {
  ...ownerContext,
  capabilities: ["content:write"],
} as const satisfies TeacherActorContext;

function makeRouteApp(
  service: TeacherProfileService,
  auth: {
    readonly identity: { readonly actor_id: string };
    readonly memberships: readonly {
      readonly tenant_id: string;
      readonly campus_ids: readonly string[];
      readonly status: "ACTIVE" | "REVOKED";
      readonly capabilities: readonly string[];
    }[];
  } = {
    identity: { actor_id: ACTOR_ID },
    memberships: [
      {
        tenant_id: TENANT_ID,
        campus_ids: [CAMPUS_ID],
        status: "ACTIVE",
        capabilities: ["content:write", "content:publish"],
      },
    ],
  },
  scope = { actorId: ACTOR_ID, tenantId: TENANT_ID, campusId: CAMPUS_ID },
) {
  const app = fastify({ logger: false });
  app.decorateRequest("authContext", undefined);
  app.decorateRequest("scopeContext", undefined);
  app.addHook("preHandler", async (request) => {
    request.authContext = auth as never;
    request.scopeContext = scope;
  });
  registerPublicTeacherRoutes(app, service, () => ({ tenantId: TENANT_ID, campusId: CAMPUS_ID }));
  return app;
}

test("public teacher reads expose only published allowlisted fields", () => {
  const service = new TeacherProfileService(new InMemoryTeacherProfileRepository());

  assert.deepEqual(service.readPublic(ownerContext.scope, "teacher-one"), {
    ok: false,
    error: { code: "NOT_FOUND_SCOPED", message: "Published teacher profile was not found." },
  });
  assert.equal(service.createDraft(ownerContext, "teacher-one", teacherPayload).ok, true);
  assert.deepEqual(service.readPublic(ownerContext.scope, "teacher-one"), {
    ok: false,
    error: { code: "NOT_FOUND_SCOPED", message: "Published teacher profile was not found." },
  });
  assert.equal(service.publish(ownerContext, "teacher-one", 1).ok, true);

  const result = service.readPublic(ownerContext.scope, "teacher-one");
  assert.equal(result.ok, true);
  if (!result.ok) return;

  assert.deepEqual(Object.keys(result.data).sort(), [
    "bio",
    "display_name",
    "headline",
    "id",
    "photo_ref",
    "published_at",
    "subjects",
  ]);
  assert.equal("version" in result.data, false);
  assert.equal("private_email" in result.data, false);
  assert.equal("internal_notes" in result.data, false);
  assert.equal("tenant_id" in result.data, false);
  assert.equal("campus_id" in result.data, false);
});

test("teacher editing and publication require active membership capabilities", () => {
  const service = new TeacherProfileService(new InMemoryTeacherProfileRepository());

  assert.equal(service.createDraft(staffContext, "teacher-one", teacherPayload).ok, true);
  assert.deepEqual(service.publish(staffContext, "teacher-one", 1), {
    ok: false,
    error: { code: "FORBIDDEN_SCOPE", message: "Teacher profile scope access is not permitted." },
  });
  assert.deepEqual(
    service.createDraft(
      { ...ownerContext, activeMembership: false } as unknown as TeacherActorContext,
      "teacher-two",
      teacherPayload,
    ),
    {
      ok: false,
      error: {
        code: "FORBIDDEN_SCOPE",
        message: "Teacher profile scope access is not permitted.",
      },
    },
  );
});

test("foreign tenant and campus scopes cannot read or edit another profile", () => {
  const service = new TeacherProfileService(new InMemoryTeacherProfileRepository());
  assert.equal(service.createDraft(ownerContext, "teacher-one", teacherPayload).ok, true);
  assert.equal(service.publish(ownerContext, "teacher-one", 1).ok, true);

  const foreignTenant = {
    ...ownerContext,
    scope: { tenantId: FOREIGN_TENANT_ID, campusId: CAMPUS_ID },
  } as const;
  const foreignCampus = {
    ...ownerContext,
    scope: { tenantId: TENANT_ID, campusId: FOREIGN_CAMPUS_ID },
  } as const;

  assert.deepEqual(service.readPublic(foreignTenant.scope, "teacher-one"), {
    ok: false,
    error: { code: "NOT_FOUND_SCOPED", message: "Published teacher profile was not found." },
  });
  assert.deepEqual(service.updateDraft(foreignCampus, "teacher-one", teacherPayload, 1), {
    ok: false,
    error: { code: "NOT_FOUND_SCOPED", message: "Published teacher profile was not found." },
  });
});

test("stale versions preserve profile state and emit no publication event", () => {
  const events: TeacherPublicationAuditEvent[] = [];
  const service = new TeacherProfileService(new InMemoryTeacherProfileRepository(), {
    onPublicationAuditEvent: (event) => events.push(event),
  });

  assert.equal(service.createDraft(ownerContext, "teacher-one", teacherPayload).ok, true);
  assert.deepEqual(service.updateDraft(ownerContext, "teacher-one", teacherPayload, 0), {
    ok: false,
    error: { code: "VERSION_MISMATCH", message: "Teacher profile version is stale." },
  });
  assert.deepEqual(service.publish(ownerContext, "teacher-one", 0), {
    ok: false,
    error: { code: "VERSION_MISMATCH", message: "Teacher profile version is stale." },
  });

  const draft = service.readDraft(ownerContext, "teacher-one");
  assert.equal(draft.ok, true);
  if (!draft.ok) return;
  assert.equal(draft.data.version, 1);
  assert.equal(draft.data.status, "DRAFT");
  assert.equal(events.length, 0);
});

test("invalid file references are rejected before a profile is stored", () => {
  const service = new TeacherProfileService(new InMemoryTeacherProfileRepository());
  const invalidPayload = {
    ...teacherPayload,
    photo_ref: "https://external.invalid/teacher.png",
  } as TeacherDraftPayload;

  assert.deepEqual(service.createDraft(ownerContext, "teacher-one", invalidPayload), {
    ok: false,
    error: {
      code: "VALIDATION_FAILED",
      message: "Teacher profile input is invalid.",
    },
  });
  assert.deepEqual(service.readDraft(ownerContext, "teacher-one"), {
    ok: false,
    error: { code: "NOT_FOUND_SCOPED", message: "Published teacher profile was not found." },
  });
});

test("admin and public routes use server-owned scope and reject client claims", async () => {
  const service = new TeacherProfileService(new InMemoryTeacherProfileRepository());
  const app = makeRouteApp(service);

  try {
    const created = await app.inject({
      method: "POST",
      url: "/admin/teachers/teacher-one/draft",
      payload: { payload: teacherPayload },
    });
    assert.equal(created.statusCode, 201);

    const forged = await app.inject({
      method: "POST",
      url: "/admin/teachers/teacher-two/draft?tenant_id=" + FOREIGN_TENANT_ID,
      payload: {
        payload: teacherPayload,
        tenant_id: FOREIGN_TENANT_ID,
        campus_id: FOREIGN_CAMPUS_ID,
        role: "tenant-admin",
      },
    });
    assert.equal(forged.statusCode, 400);
    assert.equal(forged.json().error.code, "VALIDATION_FAILED");

    const publicResponse = await app.inject({
      method: "GET",
      url: "/public/teachers/teacher-one?tenant_id=" + FOREIGN_TENANT_ID,
    });
    assert.equal(publicResponse.statusCode, 400);
    assert.equal(publicResponse.json().error.code, "VALIDATION_FAILED");
  } finally {
    await app.close();
  }
});

test("compare-and-save makes repeated expected versions mutually exclusive", () => {
  class SnapshotRepository implements TeacherProfileRepository {
    private record: TeacherProfileRecord | undefined;
    private staleRead: TeacherProfileRecord | undefined;
    private compareAndSaveCalls = 0;

    public get(_scope: { tenantId: string; campusId: string }, _profileId: string) {
      void _scope;
      void _profileId;
      const record = this.record === undefined ? undefined : (this.staleRead ?? this.record);
      return record === undefined ? undefined : { ...record, subjects: [...record.subjects] };
    }

    public save(record: TeacherProfileRecord): void {
      if (this.record !== undefined) throw new Error("non-atomic update used");
      this.record = { ...record, subjects: [...record.subjects] };
      this.staleRead = this.record;
    }

    public compareAndSave(
      _scope: { tenantId: string; campusId: string },
      _profileId: string,
      expectedVersion: number,
      record: TeacherProfileRecord,
    ): boolean {
      this.compareAndSaveCalls += 1;
      if (this.record?.version !== expectedVersion) return false;
      this.record = { ...record, subjects: [...record.subjects] };
      return true;
    }

    public getCompareAndSaveCount(): number {
      return this.compareAndSaveCalls;
    }
  }

  const repository = new SnapshotRepository();
  const service = new TeacherProfileService(repository);
  assert.equal(service.createDraft(ownerContext, "teacher-one", teacherPayload).ok, true);

  const first = service.updateDraft(ownerContext, "teacher-one", teacherPayload, 1);
  const second = service.updateDraft(ownerContext, "teacher-one", teacherPayload, 1);

  assert.equal(first.ok, true);
  assert.deepEqual(second, {
    ok: false,
    error: { code: "VERSION_MISMATCH", message: "Teacher profile version is stale." },
  });
  assert.equal(repository.getCompareAndSaveCount(), 2);
});

test("buildServer registers the public teacher route without requiring visitor authentication", async () => {
  const app = buildServer();

  try {
    const response = await app.inject({
      method: "GET",
      url: "/public/teachers/teacher-one",
    });
    assert.equal(response.statusCode, 403);
  } finally {
    await app.close();
  }
});

test("admin route denies campus not covered by the active membership", async () => {
  const service = new TeacherProfileService(new InMemoryTeacherProfileRepository());
  const app = makeRouteApp(
    service,
    {
      identity: { actor_id: ACTOR_ID },
      memberships: [
        {
          tenant_id: TENANT_ID,
          campus_ids: [CAMPUS_ID],
          status: "ACTIVE",
          capabilities: ["content:write", "content:publish"],
        },
      ],
    },
    { actorId: ACTOR_ID, tenantId: TENANT_ID, campusId: FOREIGN_CAMPUS_ID },
  );

  try {
    const response = await app.inject({
      method: "POST",
      url: "/admin/teachers/teacher-one/draft",
      payload: { payload: teacherPayload },
    });
    assert.equal(response.statusCode, 403);
    assert.equal(response.json().error.code, "FORBIDDEN_SCOPE");
  } finally {
    await app.close();
  }
});
