import assert from "node:assert/strict";
import test from "node:test";
import type { TrustedAuthResult } from "@student-care/auth";
import { ParentPickupController } from "../src/nest/parent-pickup.controller.js";
import type { ApiHttpRequest, ParentPickupOperations } from "../src/nest/api-tokens.js";

const ACTOR_ID = "00000000-0000-4000-8000-000000000003";
const TENANT_ID = "00000000-0000-4000-8000-000000000001";
const CAMPUS_ID = "00000000-0000-4000-8000-000000000002";

function trustedAuth(
  campuses: readonly string[] = [CAMPUS_ID],
  capabilities: readonly ("binding:read" | "binding:apply" | "attendance:write")[] = [
    "binding:read",
    "binding:apply",
  ],
): TrustedAuthResult {
  return {
    trusted: true,
    session: {
      trusted: true,
      status: "ACTIVE",
      actor_id: ACTOR_ID,
      expires_at: "2099-01-01T00:00:00.000Z",
    },
    identity: { actor_id: ACTOR_ID, display_name: "模拟家长甲" },
    memberships: [
      {
        tenant_id: TENANT_ID,
        campus_ids: campuses,
        status: "ACTIVE",
        capabilities,
      },
    ],
  };
}

function response() {
  return {
    statusCode: 0,
    body: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(value: unknown) {
      this.body = value;
      return value;
    },
  };
}

function request(query: Record<string, unknown> = {}, headers: Record<string, string> = {}) {
  return { query, headers } as ApiHttpRequest;
}

function controller(
  auth: TrustedAuthResult | undefined,
  operations: ParentPickupOperations,
): ParentPickupController {
  return new ParentPickupController(operations, () => auth);
}

test("parent pickup requires one trusted active campus with both read and apply capability", async () => {
  const calls: unknown[] = [];
  const operations = {
    list: async (context: unknown) => {
      calls.push(context);
      return { bindings: [], authorizations: [], records: [] };
    },
    create: async () => ({}),
    activate: async () => ({}),
    revoke: async () => ({}),
  } as unknown as ParentPickupOperations;

  const denied = response();
  await controller(undefined, operations).parentPickup(request(), denied);
  assert.equal(denied.statusCode, 401);

  const ambiguous = response();
  await controller(
    trustedAuth([CAMPUS_ID, "00000000-0000-4000-8000-000000000004"]),
    operations,
  ).parentPickup(request(), ambiguous);
  assert.equal(ambiguous.statusCode, 403);

  const forged = response();
  await controller(trustedAuth(), operations).parentPickup(request({ actor_id: ACTOR_ID }), forged);
  assert.equal(forged.statusCode, 401);

  const clientScope = response();
  await controller(trustedAuth(), operations).parentPickup(
    request({}, { "x-campus-id": CAMPUS_ID }),
    clientScope,
  );
  assert.equal(clientScope.statusCode, 400);
  assert.equal(calls.length, 0);
});

test("parent pickup forwards only trusted scope and versioned operations", async () => {
  const calls: { name: string; context: unknown; value?: unknown; id?: string }[] = [];
  const operations = {
    list: async (context: unknown) => {
      calls.push({ name: "list", context });
      return { bindings: [], authorizations: [], records: [] };
    },
    create: async (context: unknown, value: unknown) => {
      calls.push({ name: "create", context, value });
      return { id: "00000000-0000-4000-8000-000000000005", status: "DRAFT" };
    },
    activate: async (context: unknown, id: string, value: unknown) => {
      calls.push({ name: "activate", context, id, value });
      return { id, status: "ACTIVE" };
    },
    revoke: async (context: unknown, id: string, value: unknown) => {
      calls.push({ name: "revoke", context, id, value });
      return { id, status: "REVOKED" };
    },
  } as unknown as ParentPickupOperations;
  const instance = controller(trustedAuth(), operations);
  const input = {
    bindingId: "00000000-0000-4000-8000-000000000006",
    recipient: "pickup-alpha",
    type: "TEMPORARY",
    startDate: "2026-10-25",
    endDate: "2026-10-25",
    startTime: "09:00",
    endTime: "17:00",
  };

  const listed = response();
  await instance.parentPickup(request(), listed);
  assert.equal(listed.statusCode, 200);
  assert.deepEqual(calls[0]?.context, {
    actorId: ACTOR_ID,
    tenantId: TENANT_ID,
    campusId: CAMPUS_ID,
    capabilities: ["binding:read", "binding:apply"],
  });

  const created = response();
  await instance.create(input, request(), created);
  assert.equal(created.statusCode, 201);
  assert.deepEqual(calls[1]?.value, input);

  const id = "00000000-0000-4000-8000-000000000005";
  const activated = response();
  await instance.activate(id, { version: 1 }, request(), activated);
  assert.equal(activated.statusCode, 200);
  const revoked = response();
  await instance.revoke(id, { version: 2 }, request(), revoked);
  assert.equal(revoked.statusCode, 200);
  assert.deepEqual(
    calls.slice(2).map(({ name, value }) => [name, value]),
    [
      ["activate", { version: 1 }],
      ["revoke", { version: 2 }],
    ],
  );
});

test("pickup credential endpoints use trusted parent and staff scopes", async () => {
  const calls: { name: string; context: unknown; id?: string; value?: unknown }[] = [];
  const operations = {
    list: async () => ({ bindings: [], authorizations: [], records: [] }),
    create: async () => ({}),
    activate: async () => ({}),
    revoke: async () => ({}),
    issueCredential: async (context: unknown, id: string, value: unknown) => {
      calls.push({ name: "issue", context, id, value });
      return { credential: "synthetic-once-only", expiresAt: "2026-10-25T01:05:00.000Z" };
    },
    previewCredential: async (context: unknown, value: unknown) => {
      calls.push({ name: "preview", context, value });
      return {
        studentLabel: "模拟学生甲",
        classLabel: "模拟三年级一班",
        recipientLabel: "模拟接送人甲",
      };
    },
    confirmCredential: async (context: unknown, value: unknown) => {
      calls.push({ name: "confirm", context, value });
      return { status: "COMPLETED" };
    },
  } as unknown as ParentPickupOperations;
  type CredentialController = {
    issueCredential(
      id: string,
      body: unknown,
      request: ApiHttpRequest,
      reply: ReturnType<typeof response>,
    ): Promise<unknown>;
    previewCredential(
      body: unknown,
      request: ApiHttpRequest,
      reply: ReturnType<typeof response>,
    ): Promise<unknown>;
    confirmCredential(
      body: unknown,
      request: ApiHttpRequest,
      reply: ReturnType<typeof response>,
    ): Promise<unknown>;
  };
  const parent = controller(trustedAuth(), operations) as unknown as CredentialController;
  const credential = "synthetic-one-time-token";

  const issued = response();
  await parent.issueCredential(
    "00000000-0000-4000-8000-000000000005",
    { version: 2 },
    request(),
    issued,
  );
  assert.equal(issued.statusCode, 200);
  assert.deepEqual(calls[0], {
    name: "issue",
    context: {
      actorId: ACTOR_ID,
      tenantId: TENANT_ID,
      campusId: CAMPUS_ID,
      capabilities: ["binding:read", "binding:apply"],
    },
    id: "00000000-0000-4000-8000-000000000005",
    value: { version: 2 },
  });

  const staff = controller(
    trustedAuth([CAMPUS_ID], ["attendance:write"]),
    operations,
  ) as unknown as CredentialController;
  const checks = { student: true, recipient: true, authorization: true };
  const preview = response();
  await staff.previewCredential({ credential }, request(), preview);
  assert.equal(preview.statusCode, 200);
  assert.deepEqual(calls[1], {
    name: "preview",
    context: {
      actorId: ACTOR_ID,
      tenantId: TENANT_ID,
      campusId: CAMPUS_ID,
      capabilities: ["attendance:write"],
    },
    value: { credential },
  });

  const confirmed = response();
  await staff.confirmCredential({ credential, checks }, request(), confirmed);
  assert.equal(confirmed.statusCode, 200);
  assert.deepEqual(calls[2], {
    name: "confirm",
    context: {
      actorId: ACTOR_ID,
      tenantId: TENANT_ID,
      campusId: CAMPUS_ID,
      capabilities: ["attendance:write"],
    },
    value: { credential, checks },
  });

  const denied = response();
  const unprivileged = controller(trustedAuth(), operations) as unknown as CredentialController;
  await unprivileged.previewCredential({ credential }, request(), denied);
  assert.equal(denied.statusCode, 403);
  assert.equal(calls.length, 3);
});
