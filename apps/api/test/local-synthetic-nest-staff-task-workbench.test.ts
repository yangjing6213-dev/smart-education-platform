import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import test from "node:test";
import type { TrustedAuthResult } from "@student-care/auth";
import type { ApiHttpRequest } from "../src/nest/api-tokens.js";
import { createApiApp } from "../src/nest/api-app.js";
import { BindingLeaveService } from "../src/local-synthetic/binding-leave.service.js";
import { LocalSyntheticGuardianBindingAdapter } from "../src/local-synthetic/nest-guardian-binding-adapter.js";
import { LocalSyntheticNestStaffTaskWorkbenchAdapter } from "../src/local-synthetic/nest-staff-task-workbench.adapter.js";
import { LocalRepository } from "../src/local-synthetic/repository.js";
import { StaffTaskService } from "../src/local-synthetic/task-assignment.service.js";
import { memberForActor } from "../src/local-synthetic/sessions.js";

const TENANT = "00000000-0000-4000-8000-000000000064";
const EAST = "00000000-0000-4000-8000-000000000065";
const WEST = "00000000-0000-4000-8000-000000000066";
const STUDENT = "00000000-0000-4000-8000-0000000000c8";
const ACTORS = {
  parent: "00000000-0000-4000-8000-000000000001",
  teacher: "00000000-0000-4000-8000-000000000003",
  owner: "00000000-0000-4000-8000-000000000004",
  westOwner: "00000000-0000-4000-8000-000000000005",
};

function trusted(
  actorId: string,
  campus: string,
  capabilities: readonly string[],
  extraMemberships: readonly unknown[] = [],
): TrustedAuthResult {
  return {
    trusted: true,
    session: {
      trusted: true,
      status: "ACTIVE",
      actor_id: actorId,
      expires_at: "2099-01-01T00:00:00.000Z",
    },
    identity: { actor_id: actorId, display_name: "模拟员工" },
    memberships: [
      {
        tenant_id: TENANT,
        campus_ids: [campus],
        status: "ACTIVE",
        capabilities,
      },
      ...extraMemberships,
    ],
  } as TrustedAuthResult;
}

const authByToken: Record<string, TrustedAuthResult> = {
  parent: trusted(ACTORS.parent, EAST, ["binding:apply", "binding:read"]),
  teacher: trusted(ACTORS.teacher, EAST, [
    "task:read",
    "task:claim",
    "task:start",
    "task:complete",
  ]),
  teacherReadOnly: trusted(ACTORS.teacher, EAST, ["task:read"]),
  owner: trusted(ACTORS.owner, EAST, [
    "binding:review",
    "task:read",
    "task:assign",
    "task:check",
    "task:cancel",
  ]),
  ownerNoReview: trusted(ACTORS.owner, EAST, ["task:read", "task:check"]),
  westOwner: trusted(ACTORS.westOwner, WEST, ["binding:review", "task:read", "task:check"]),
  ambiguous: trusted(
    ACTORS.teacher,
    EAST,
    ["task:read"],
    [
      {
        tenant_id: TENANT,
        campus_ids: [EAST],
        status: "ACTIVE",
        capabilities: ["task:read"],
      },
    ],
  ),
};

async function withApi(run: (baseUrl: string, taskId: string) => Promise<void>) {
  const repository = new LocalRepository();
  const taskService = new StaffTaskService(repository, () =>
    Date.parse("2026-10-19T04:00:00.000Z"),
  );
  const teacher = memberForActor(ACTORS.teacher);
  const owner = memberForActor(ACTORS.owner);
  assert.ok(teacher);
  assert.ok(owner);
  const task = taskService.create(owner, {
    code: "DAILY_CHECK",
    assigneeId: teacher.actorId,
    targetType: "CLASS",
    targetId: teacher.classIds[0],
    dueDate: "2026-10-20",
    priority: "NORMAL",
  });
  const binding = new BindingLeaveService(repository);
  const api = await createApiApp({
    guardianBindingOperations: new LocalSyntheticGuardianBindingAdapter(binding, repository),
    staffTaskWorkbenchOperations: new LocalSyntheticNestStaffTaskWorkbenchAdapter(taskService),
    getTrustedAuthResult: (request: ApiHttpRequest) => {
      const value = request.headers.authorization;
      const token =
        typeof value === "string" ? /^Bearer ([a-zA-Z]+)$/u.exec(value)?.[1] : undefined;
      return token ? authByToken[token] : undefined;
    },
  });
  await api.listen(0, "127.0.0.1");
  const address = api.getHttpServer().address() as AddressInfo | null;
  if (!address) throw new Error("Local synthetic API did not bind.");
  try {
    await run(`http://127.0.0.1:${address.port}`, task.id);
  } finally {
    await api.close();
  }
}

async function request(
  baseUrl: string,
  token: string | undefined,
  path: string,
  method: "GET" | "POST" = "GET",
  body?: unknown,
) {
  const headers = new Headers();
  if (token) headers.set("authorization", `Bearer ${token}`);
  if (body !== undefined) headers.set("content-type", "application/json");
  const response = await fetch(new URL(path, baseUrl), {
    method,
    headers,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return { status: response.status, body: (await response.json()) as Record<string, unknown> };
}

const payload = (value: { body: Record<string, unknown> }) =>
  value.body.data as Record<string, unknown>;

test("invited managers assign, return, check and cancel tasks through trusted async operations", async () => {
  await withApi(async (baseUrl) => {
    const listing = await request(baseUrl, "owner", "/admin/tasks");
    assert.equal(listing.status, 200);
    const choices = payload(listing).choices as Record<string, unknown>[];
    const choice = choices.find(
      (row) => row.targetType === "CLASS" && row.assigneeRef === ACTORS.teacher,
    );
    assert.ok(choice);
    let result = await request(baseUrl, "owner", "/admin/tasks", "POST", {
      code: "DAILY_CHECK",
      assigneeRef: choice.assigneeRef,
      classRef: choice.classRef,
      targetType: choice.targetType,
      targetRef: choice.targetRef,
      dueDate: "2030-01-02",
      priority: "URGENT",
    });
    assert.equal(result.status, 201);
    const id = payload(result).id as string;
    assert.deepEqual(payload(result).actions, ["cancel"]);
    for (const [action, body, version] of [
      ["claim", {}, 1],
      ["start", {}, 2],
      ["complete", { result: "BLOCKED" }, 3],
    ] as const) {
      result = await request(baseUrl, "teacher", `/staff/tasks/${id}/${action}`, "POST", {
        version,
        ...body,
      });
      assert.equal(result.status, 200);
    }
    result = await request(baseUrl, "owner", `/admin/tasks/${id}/check`, "POST", {
      version: 4,
      action: "RETURN",
    });
    assert.equal(result.status, 200);
    assert.equal(payload(result).result, "BLOCKED");
    for (const [action, body, version] of [
      ["claim", {}, 5],
      ["start", {}, 6],
      ["complete", { result: "FOLLOW_UP_REQUIRED" }, 7],
    ] as const) {
      assert.equal(
        (
          await request(baseUrl, "teacher", `/staff/tasks/${id}/${action}`, "POST", {
            version,
            ...body,
          })
        ).status,
        200,
      );
    }
    result = await request(baseUrl, "owner", `/admin/tasks/${id}/cancel`, "POST", { version: 8 });
    assert.equal(result.status, 200);
    assert.equal(payload(result).status, "CANCELLED");
    assert.equal(payload(result).result, "FOLLOW_UP_REQUIRED");
    assert.equal(payload(result).overdue, false);
    assert.deepEqual(payload(result).actions, []);
    assert.equal(
      (
        await request(baseUrl, "owner", `/admin/tasks/${id}/check`, "POST", {
          version: 9,
          action: "CONFIRM",
        })
      ).status,
      409,
    );
    assert.equal((await request(baseUrl, "teacher", "/admin/tasks")).status, 403);
    assert.doesNotMatch(
      JSON.stringify(payload(result)),
      /tenantId|campusId|classId|createdBy|assigneeId|synthetic/,
    );
  });
});

test("invited staff task access uses trusted membership capabilities and synthetic campus scope", async () => {
  await withApi(async (baseUrl, taskId) => {
    const ownTasks = await request(baseUrl, "teacher", "/staff/tasks");
    assert.equal(ownTasks.status, 200);
    const ownData = payload(ownTasks);
    assert.equal("actor_id" in ownData, false);
    assert.doesNotMatch(
      JSON.stringify(ownData),
      /tenantId|campusId|classId|assigneeId|createdBy|synthetic/,
    );
    const rows = ownData.tasks as Array<Record<string, unknown>>;
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.id, taskId);

    assert.equal((await request(baseUrl, "parent", "/staff/tasks")).status, 403);
    assert.equal(
      (
        await request(baseUrl, "teacherReadOnly", `/staff/tasks/${taskId}/claim`, "POST", {
          version: 1,
        })
      ).status,
      403,
    );
    assert.equal((await request(baseUrl, "ambiguous", "/staff/tasks")).status, 403);
    assert.deepEqual(payload(await request(baseUrl, "westOwner", "/staff/tasks")).tasks, []);
    assert.equal(
      (await request(baseUrl, "westOwner", `/staff/tasks/${taskId}/claim`, "POST", { version: 1 }))
        .status,
      403,
    );

    let result = await request(baseUrl, "teacher", `/staff/tasks/${taskId}/claim`, "POST", {
      version: 1,
    });
    assert.equal(result.status, 200);
    assert.equal(payload(result).status, "CLAIMED");
    result = await request(baseUrl, "teacher", `/staff/tasks/${taskId}/start`, "POST", {
      version: 2,
    });
    assert.equal(result.status, 200);
    result = await request(baseUrl, "teacher", `/staff/tasks/${taskId}/complete`, "POST", {
      version: 3,
      result: "FOLLOW_UP_REQUIRED",
    });
    assert.equal(result.status, 200);
    assert.equal(payload(result).status, "COMPLETED");
  });
});

test("parent relationship application is shared with an authorized employee and scoped by campus", async () => {
  await withApi(async (baseUrl) => {
    const submitted = await request(baseUrl, "parent", "/guardian-binding/applications", "POST", {
      student_candidate_ref: STUDENT,
      relationship: "GUARDIAN",
      consent: true,
    });
    assert.equal(submitted.status, 201);
    const application = payload(submitted);
    const id = application.id as string;

    assert.equal(
      (await request(baseUrl, "ownerNoReview", "/staff/guardian-binding/applications")).status,
      403,
    );
    const queue = await request(baseUrl, "owner", "/staff/guardian-binding/applications");
    assert.equal(queue.status, 200);
    assert.equal((payload(queue) as unknown as Array<Record<string, unknown>>)[0]?.id, id);
    assert.deepEqual(
      payload(await request(baseUrl, "westOwner", "/staff/guardian-binding/applications")),
      [],
    );

    const approved = await request(
      baseUrl,
      "owner",
      `/staff/guardian-binding/applications/${id}/review`,
      "POST",
      { version: 1, action: "approve" },
    );
    assert.equal(approved.status, 200);
    assert.equal(payload(approved).status, "APPROVED");
    const parentView = await request(baseUrl, "parent", "/guardian-relationships");
    assert.equal(parentView.status, 200);
    const relationships = payload(parentView) as unknown as Array<Record<string, unknown>>;
    assert.equal(relationships.length, 1);
    assert.equal(relationships[0]?.status, "ACTIVE");
  });
});
