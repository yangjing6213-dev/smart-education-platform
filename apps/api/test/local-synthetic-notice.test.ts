import assert from "node:assert/strict";
import test from "node:test";
import { buildLocalSyntheticServer } from "../src/local-synthetic/server.js";

type App = Awaited<ReturnType<typeof buildLocalSyntheticServer>>;
type Json = Record<string, unknown> & { id: string; version: number };
type Response = { statusCode: number; body: string; json(): unknown };

async function call(app: App, actor: string, method: "GET" | "POST", url: string, body?: unknown) {
  return app.inject({
    method,
    url,
    headers: { host: "127.0.0.1:4317", ...(actor ? { authorization: `Bearer ${actor}` } : {}) },
    ...(body === undefined ? {} : { payload: body as object }),
  } as never) as unknown as Promise<Response>;
}

async function session(app: App, profile: string) {
  const response = await call(app, "", "POST", "/local/sessions", { profile });
  assert.equal(response.statusCode, 201, response.body);
  return (response.json() as { handle: string }).handle;
}

async function approveBinding(app: App, parent: string, owner: string) {
  const applied = await call(app, parent, "POST", "/local/binding-applications", {
    student: "student-alpha",
    relationship: "GUARDIAN",
  });
  assert.equal(applied.statusCode, 201, applied.body);
  const pending = applied.json() as Json;
  const approved = await call(
    app,
    owner,
    "POST",
    `/local/binding-applications/${pending.id}/review`,
    { version: pending.version, action: "approve" },
  );
  assert.equal(approved.statusCode, 200, approved.body);
}

test("notice follows employee review, parent receipt and new-version boundaries", async () => {
  const app = await buildLocalSyntheticServer({
    mode: "local-synthetic",
    now: () => Date.parse("2026-10-12T01:00:00.000Z"),
  });
  try {
    const parent = await session(app, "parent-alpha");
    const teacher = await session(app, "teacher-east");
    const owner = await session(app, "owner-east");
    const ownerWest = await session(app, "owner-west");
    const platform = await session(app, "platform-admin");

    assert.deepEqual((await call(app, parent, "GET", "/local/notices")).json(), []);
    await approveBinding(app, parent, owner);
    const created = await call(app, teacher, "POST", "/local/notices", {
      template: "CLASS_ACTIVITY",
    });
    assert.equal(created.statusCode, 201, created.body);
    const draft = created.json() as Json;
    assert.equal(draft.status, "DRAFT");
    assert.equal((await call(app, teacher, "GET", "/local/notice-owned")).statusCode, 200);
    assert.equal(
      ((await call(app, teacher, "GET", "/local/notice-owned")).json() as Json[])[0]?.id,
      draft.id,
    );
    assert.equal(
      (await call(app, teacher, "POST", `/local/notices/${draft.id}/submit`, { version: 1 }))
        .statusCode,
      200,
    );
    const queue = await call(app, owner, "GET", "/local/notice-review");
    assert.equal(queue.statusCode, 200, queue.body);
    assert.equal((queue.json() as Json[]).find((row) => row.id === draft.id)?.status, "SUBMITTED");
    assert.deepEqual((await call(app, ownerWest, "GET", "/local/notice-review")).json(), []);
    assert.equal((await call(app, platform, "GET", "/local/notice-review")).statusCode, 403);

    const confirmed = await call(app, owner, "POST", `/local/notices/${draft.id}/review`, {
      version: 2,
      action: "CONFIRM",
    });
    assert.equal(confirmed.statusCode, 200, confirmed.body);
    const published = await call(app, owner, "POST", `/local/notices/${draft.id}/publish`, {
      version: 3,
    });
    assert.equal(published.statusCode, 200, published.body);
    const current = published.json() as Json;
    assert.equal(current.status, "PUBLISHED");
    assert.equal(
      ((await call(app, owner, "GET", "/local/notice-owned")).json() as Json[])[0]?.version,
      4,
    );

    const parentList = await call(app, parent, "GET", "/local/notices");
    assert.equal(parentList.statusCode, 200, parentList.body);
    const visible = (parentList.json() as Json[]).find((row) => row.id === draft.id)!;
    assert.equal(visible.version, 4);
    assert.equal(visible.receiptStatus, "UNREAD");
    assert.equal(
      (await call(app, parent, "POST", `/local/notices/${draft.id}/ack`, { version: 4 }))
        .statusCode,
      409,
    );
    const read = await call(app, parent, "POST", `/local/notices/${draft.id}/read`, { version: 4 });
    assert.equal((read.json() as Json).receiptStatus, "READ");
    assert.equal(
      (await call(app, parent, "POST", `/local/notices/${draft.id}/ack`, { version: 4 }))
        .statusCode,
      200,
    );
    assert.equal(
      ((await call(app, parent, "GET", "/local/notices")).json() as Json[]).find(
        (row) => row.id === draft.id,
      )?.receiptStatus,
      "ACKNOWLEDGED",
    );
    assert.equal(
      (await call(app, parent, "POST", `/local/notices/${draft.id}/read`, { version: 3 }))
        .statusCode,
      409,
    );

    const nextVersion = await call(app, owner, "POST", `/local/notices/${draft.id}/publish`, {
      version: 4,
    });
    assert.equal(nextVersion.statusCode, 200, nextVersion.body);
    const refreshed = ((await call(app, parent, "GET", "/local/notices")).json() as Json[]).find(
      (row) => row.id === draft.id,
    )!;
    assert.equal(refreshed.version, 5);
    assert.equal(refreshed.receiptStatus, "UNREAD");
    assert.equal(
      ((await call(app, owner, "GET", "/local/notice-owned")).json() as Json[])[0]?.version,
      5,
    );
    assert.equal(
      ((await call(app, teacher, "GET", "/local/notice-owned")).json() as Json[])[0]?.version,
      5,
    );

    const revoked = await call(app, owner, "POST", `/local/notices/${draft.id}/revoke`, {
      version: 5,
    });
    assert.equal(revoked.statusCode, 200, revoked.body);
    assert.deepEqual((await call(app, parent, "GET", "/local/notices")).json(), []);
  } finally {
    await app.close();
  }
});

test("notice rejects non-fixed templates, missing relation and stale commands", async () => {
  const app = await buildLocalSyntheticServer({ mode: "local-synthetic" });
  try {
    const parent = await session(app, "parent-alpha");
    const teacher = await session(app, "teacher-east");
    const owner = await session(app, "owner-east");
    assert.equal(
      (await call(app, teacher, "POST", "/local/notices", { template: "FREE_TEXT" })).statusCode,
      403,
    );
    assert.equal((await call(app, parent, "GET", "/local/notice-owned")).statusCode, 403);
    const created = await call(app, teacher, "POST", "/local/notices", {
      template: "INSTITUTION_ANNOUNCEMENT",
    });
    const draft = created.json() as Json;
    assert.equal(
      (await call(app, teacher, "POST", `/local/notices/${draft.id}/submit`, { version: 99 }))
        .statusCode,
      409,
    );
    assert.equal(
      (
        await call(app, owner, "POST", `/local/notices/${draft.id}/review`, {
          version: 1,
          action: "CONFIRM",
        })
      ).statusCode,
      409,
    );
    assert.deepEqual((await call(app, parent, "GET", "/local/notices")).json(), []);
    assert.equal(
      (await call(app, owner, "POST", `/local/notices/${draft.id}/publish`, { version: 1 }))
        .statusCode,
      409,
    );
  } finally {
    await app.close();
  }
});

test("released parent binding immediately loses notice projection", async () => {
  const app = await buildLocalSyntheticServer({ mode: "local-synthetic" });
  try {
    const parent = await session(app, "parent-alpha");
    const teacher = await session(app, "teacher-east");
    const owner = await session(app, "owner-east");
    await approveBinding(app, parent, owner);
    const created = (
      await call(app, teacher, "POST", "/local/notices", {
        template: "INSTITUTION_ANNOUNCEMENT",
      })
    ).json() as Json;
    await call(app, teacher, "POST", `/local/notices/${created.id}/submit`, { version: 1 });
    await call(app, owner, "POST", `/local/notices/${created.id}/review`, {
      version: 2,
      action: "CONFIRM",
    });
    await call(app, owner, "POST", `/local/notices/${created.id}/publish`, { version: 3 });
    const visible = ((await call(app, parent, "GET", "/local/notices")).json() as Json[])[0]!;
    const binding = (
      await call(app, parent, "GET", "/local/binding-applications")
    ).json() as Json[];
    const approved = binding.find((row) => row.status === "APPROVED")!;
    assert.equal(
      (
        await call(app, parent, "POST", `/local/binding-applications/${approved.id}/release`, {
          version: approved.version,
        })
      ).statusCode,
      200,
    );
    assert.deepEqual((await call(app, parent, "GET", "/local/notices")).json(), []);
    assert.equal(
      (
        await call(app, parent, "POST", `/local/notices/${visible.id}/read`, {
          version: visible.version,
        })
      ).statusCode,
      403,
    );
  } finally {
    await app.close();
  }
});
