import assert from "node:assert/strict";
import test from "node:test";
import type { AddressInfo } from "node:net";
import type { TrustedAuthResult } from "@student-care/auth";
import { createApiApp } from "../src/nest/api-app.js";
import {
  LibraryError,
  type LibraryContext,
  type StaffLibraryOperations,
} from "../src/modules/staff-library/operations.js";

const actor = "00000000-0000-4000-8000-000000000001";
const tenant = "00000000-0000-4000-8000-000000000002";
const campus = "00000000-0000-4000-8000-000000000003";
const item = "00000000-0000-4000-8000-000000000004";
const secondCampus = "00000000-0000-4000-8000-000000000005";

test("invited library gates each method by the trusted active membership and validates commands before writing", async () => {
  const calls: string[] = [];
  const messages: unknown[][] = [];
  let storageFailure: Error | undefined;
  const respond =
    (name: string) =>
    async (context: LibraryContext, ...args: unknown[]) => {
      assert.deepEqual(
        [context.actorId, context.tenantId, context.campusId],
        [actor, tenant, campus],
      );
      calls.push(name);
      messages.push(args);
      if (storageFailure) throw storageFailure;
      return name === "summary" ? { total: 0, published: 0, revoked: 0, expired: 0 } : {};
    };
  const operations: StaffLibraryOperations = {
    list: respond("list"),
    detail: respond("detail"),
    favorite: respond("favorite"),
    use: respond("use"),
    managed: respond("managed"),
    create: respond("create"),
    update: respond("update"),
    revoke: respond("revoke"),
    summary: respond("summary"),
  };
  let auth: TrustedAuthResult | undefined;
  const options = { getTrustedAuthResult: () => auth, staffLibraryOperations: operations };
  const app = await createApiApp(options);
  await app.listen(0, "127.0.0.1");
  const origin = "http://127.0.0.1:" + (app.getHttpServer().address() as AddressInfo).port;
  const request = async (path: string, method = "GET", body?: object) =>
    (
      await fetch(origin + path, {
        method,
        ...(body
          ? { headers: { "content-type": "application/json" }, body: JSON.stringify(body) }
          : {}),
      })
    ).status;
  const base = "/staff/library/resources";
  const admin = "/admin/library/items";
  function set(
    capabilities: TrustedAuthResult["memberships"][number]["capabilities"],
    status: "ACTIVE" | "SUSPENDED" = "ACTIVE",
    campuses = [campus],
  ) {
    auth = {
      trusted: true,
      session: {
        trusted: true,
        status: "ACTIVE",
        actor_id: actor,
        expires_at: "2099-01-01T00:00:00.000Z",
      },
      identity: { actor_id: actor, display_name: "示例员工" },
      memberships: [{ tenant_id: tenant, campus_ids: campuses, capabilities, status }],
    };
  }
  try {
    assert.equal(await request(base), 401);
    set(["task:read"]);
    assert.equal(await request(base), 403);
    set(["library:read"], "SUSPENDED");
    assert.equal(await request(base), 403);
    set(["library:read"], "ACTIVE", [campus, secondCampus]);
    assert.equal(await request(base), 403);
    set(["library:read"]);
    auth = { ...auth!, session: { ...auth!.session, status: "REVOKED" } };
    assert.equal(await request(base), 401);
    set(["library:read"]);
    auth = {
      ...auth!,
      memberships: [...auth!.memberships, { ...auth!.memberships[0]!, campus_ids: [secondCampus] }],
    };
    assert.equal(await request(base), 403);
    set(["library:read"]);
    assert.equal(await request(base + "?tenant_id=" + tenant), 400);
    assert.equal(
      (await fetch(origin + base, { headers: { "x-campus-id": secondCampus } })).status,
      400,
    );
    assert.equal(await request(base + "?role=owner"), 401);
    assert.equal(await request(base), 200);
    assert.equal(await request("/staff/library/guides/" + item), 200);
    assert.equal(await request(base + "/" + item + "/use", "POST", { version: 0 }), 400);
    assert.equal(await request(base + "/" + item + "/use", "POST", { version: 1 }), 200);
    assert.equal(
      await request(base + "/" + item + "/favorite", "POST", {
        version: 1,
        favorite: true,
        tenantId: tenant,
      }),
      400,
    );
    assert.equal(
      await request(base + "/" + item + "/favorite", "POST", { version: 1, favorite: false }),
      200,
    );
    assert.equal(await request(admin), 403);
    assert.equal(await request("/admin/library/summary"), 403);
    set(["library:summary"]);
    assert.equal(await request("/admin/library/summary"), 200);
    assert.equal(await request(admin), 403);
    set(["library:manage"]);
    assert.equal(await request(admin), 200);
    const create = {
      kind: "GUIDE",
      title: "流程指南",
      summary: "范围",
      body: "查看操作流程",
      category: "ORIENTATION",
      grade: "",
      subject: "",
      tags: [],
      scope: "CAMPUS",
      classId: null,
      expiresOn: "2099-12-31",
    };
    assert.equal(await request(admin, "POST", { ...create, expiresOn: "2099-02-31" }), 400);
    assert.equal(await request(admin, "POST", { ...create, actor_id: actor }), 400);
    assert.equal(await request(admin, "POST", { ...create, tags: ["重复", "重复"] }), 400);
    assert.equal(await request(admin, "POST", { ...create, body: "https://outside.invalid" }), 400);
    assert.equal(await request(admin, "POST", create), 200);
    assert.equal(
      await request(admin + "/" + item, "PATCH", {
        version: 1,
        scope: "CLASS",
        classId: null,
        expiresOn: create.expiresOn,
      }),
      400,
    );
    assert.equal(
      await request(admin + "/" + item, "PATCH", {
        version: 1,
        scope: "CAMPUS",
        classId: null,
        expiresOn: create.expiresOn,
      }),
      200,
    );
    assert.equal(await request(admin + "/" + item + "/revoke", "POST", { version: 2 }), 200);
    assert.deepEqual(calls, [
      "list",
      "detail",
      "use",
      "favorite",
      "summary",
      "managed",
      "create",
      "update",
      "revoke",
    ]);
    assert.deepEqual(messages, [
      ["RESOURCE"],
      ["GUIDE", item],
      [item, 1],
      [item, 1, false],
      [],
      [],
      [create],
      [item, { version: 1, scope: "CAMPUS", classId: null, expiresOn: create.expiresOn }],
      [item, 2],
    ]);
    storageFailure = new LibraryError(409, "CONFLICT_STATE");
    assert.equal(await request(admin + "/" + item + "/revoke", "POST", { version: 1 }), 409);
    storageFailure = new Error("synthetic private diagnostic");
    const failure = await fetch(origin + admin);
    assert.equal(failure.status, 500);
    assert.doesNotMatch(await failure.text(), /synthetic private diagnostic/u);
  } finally {
    await app.close();
  }
});
