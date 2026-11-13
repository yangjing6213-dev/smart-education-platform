import assert from "node:assert/strict";
import test from "node:test";
import { buildLocalSyntheticServer } from "../src/local-synthetic/server.js";
import { CareRecordService } from "../src/local-synthetic/care-record.service.js";
import { LocalRepository } from "../src/local-synthetic/repository.js";
import { memberForActor } from "../src/local-synthetic/sessions.js";

type App = Awaited<ReturnType<typeof buildLocalSyntheticServer>>;
type Row = {
  id: string;
  version: number;
  status: string;
  published: boolean;
  publicationVersion: number;
  bindingId: string;
  receipt: string;
  values: Record<string, string>;
};
const values = {
  arrival: "ARRIVED_AS_PLANNED",
  homework: "COMPLETED",
  meal: "FINISHED",
  rest: "RESTED",
  activity: "PARTICIPATED",
  wellbeing: "ROUTINE",
};
async function call(
  app: App,
  handle: string,
  method: "GET" | "POST" | "PATCH",
  path: string,
  body?: object,
) {
  return app.inject({
    method,
    url: path,
    headers: { host: "127.0.0.1:4317", ...(handle ? { authorization: `Bearer ${handle}` } : {}) },
    ...(body ? { payload: body } : {}),
  });
}
async function identity(app: App, profile: string) {
  const r = await call(app, "", "POST", "/local/sessions", { profile });
  assert.equal(r.statusCode, 201, r.body);
  return r.json<{ handle: string }>().handle;
}
async function approveBinding(app: App, p: string, o: string) {
  const pending = (
    await call(app, p, "POST", "/local/binding-applications", {
      student: "student-alpha",
      relationship: "GUARDIAN",
    })
  ).json<Row>();
  const result = await call(app, o, "POST", `/local/binding-applications/${pending.id}/review`, {
    version: pending.version,
    action: "approve",
  });
  assert.equal(result.statusCode, 200, result.body);
  return result.json<Row>();
}
async function draft(app: App, t: string, date = "2026-10-13") {
  const result = await call(app, t, "POST", "/local/care-records", {
    student: "student-alpha",
    date,
    values,
  });
  assert.equal(result.statusCode, 201, result.body);
  return result.json<Row>();
}
async function command(app: App, actor: string, row: Row, action: string, extra: object = {}) {
  const result = await call(app, actor, "POST", `/local/care-records/${row.id}/${action}`, {
    version: row.version,
    ...extra,
  });
  assert.equal(result.statusCode, 200, result.body);
  return result.json<Row>();
}
async function published(app: App, teacher: string, owner: string) {
  let row = await draft(app, teacher);
  row = await command(app, teacher, row, "submit");
  row = await command(app, owner, row, "review", { action: "confirm" });
  return command(app, owner, row, "publish");
}

test("care draft, review return, resubmit, confirmation and separate publication produce a safe parent projection", async () => {
  const app = await buildLocalSyntheticServer({ mode: "local-synthetic" });
  try {
    const p = await identity(app, "parent-alpha"),
      t = await identity(app, "teacher-east"),
      o = await identity(app, "owner-east");
    const relation = await approveBinding(app, p, o);
    let row = await draft(app, t);
    assert.deepEqual((await call(app, p, "GET", "/local/care-records")).json(), []);
    assert.equal((await call(app, p, "GET", `/local/care-records/${row.id}`)).statusCode, 403);
    row = await command(app, t, row, "submit");
    assert.equal(
      (
        await call(app, t, "POST", `/local/care-records/${row.id}/review`, {
          version: row.version,
          action: "confirm",
        })
      ).statusCode,
      403,
    );
    row = await command(app, o, row, "review", { action: "return" });
    row = await command(app, t, row, "resubmit", {
      values: { ...values, homework: "IN_PROGRESS" },
    });
    row = await command(app, o, row, "review", { action: "confirm" });
    assert.equal(row.status, "CONFIRMED");
    assert.equal(row.published, false);
    assert.deepEqual((await call(app, p, "GET", "/local/care-records")).json(), []);
    row = await command(app, o, row, "publish");
    assert.equal(row.publicationVersion, 1);
    const view = (await call(app, p, "GET", `/local/care-records/${row.id}`)).json<Row>();
    assert.equal(view.bindingId, relation.id);
    assert.equal(view.receipt, "UNREAD");
    assert.equal(view.values.homework, "正在完成");
    for (const internal of [
      "createdBy",
      "reviewedBy",
      "history",
      "tenantId",
      "classId",
      "campusId",
      "status",
    ])
      assert.equal(Object.hasOwn(view, internal), false, internal);
    assert.equal(
      (
        await call(app, p, "POST", `/local/care-records/${row.id}/receipt`, {
          bindingId: relation.id,
          version: row.version,
          publicationVersion: row.publicationVersion,
          action: "acknowledge",
        })
      ).statusCode,
      409,
    );
    const receiptBody = {
      bindingId: relation.id,
      version: row.version,
      publicationVersion: row.publicationVersion,
    };
    assert.equal(
      (
        await call(app, p, "POST", `/local/care-records/${row.id}/receipt`, {
          ...receiptBody,
          action: "read",
        })
      ).json<Row>().receipt,
      "READ",
    );
    assert.equal(
      (
        await call(app, p, "POST", `/local/care-records/${row.id}/receipt`, {
          ...receiptBody,
          action: "acknowledge",
        })
      ).json<Row>().receipt,
      "ACKNOWLEDGED",
    );
    row = await command(app, o, row, "revoke-publication");
    assert.deepEqual((await call(app, p, "GET", "/local/care-records")).json(), []);
    assert.equal(
      (
        await call(app, p, "POST", `/local/care-records/${row.id}/receipt`, {
          ...receiptBody,
          action: "read",
        })
      ).statusCode,
      403,
    );
  } finally {
    await app.close();
  }
});

test("care actions require exact server class, tenant, campus and creator ownership; platform receives no details", async () => {
  const app = await buildLocalSyntheticServer({ mode: "local-synthetic" });
  try {
    const t = await identity(app, "teacher-east"),
      row = await draft(app, t);
    for (const profile of [
      "teacher-east-peer",
      "teacher-other-class",
      "owner-west",
      "owner-other-tenant",
      "content-editor-east",
      "platform-admin",
      "parent-alpha",
    ]) {
      const actor = await identity(app, profile);
      assert.deepEqual((await call(app, actor, "GET", "/local/care-records")).json(), [], profile);
      assert.equal(
        (await call(app, actor, "GET", `/local/care-records/${row.id}`)).statusCode,
        403,
        profile,
      );
      assert.equal(
        (
          await call(app, actor, "POST", `/local/care-records/${row.id}/submit`, {
            version: row.version,
          })
        ).statusCode,
        403,
        profile,
      );
      assert.equal(
        (
          await call(app, actor, "PATCH", `/local/care-records/${row.id}`, {
            version: row.version,
            values,
          })
        ).statusCode,
        403,
        profile,
      );
    }
  } finally {
    await app.close();
  }
});

test("care receipts are independent for each guardian and new relationship or publication never inherits receipts", async () => {
  const app = await buildLocalSyntheticServer({ mode: "local-synthetic" });
  try {
    const a = await identity(app, "parent-alpha"),
      b = await identity(app, "parent-beta"),
      t = await identity(app, "teacher-east"),
      o = await identity(app, "owner-east");
    const ba = await approveBinding(app, a, o),
      bb = await approveBinding(app, b, o);
    let row = await published(app, t, o);
    const body = {
      bindingId: ba.id,
      version: row.version,
      publicationVersion: row.publicationVersion,
    };
    assert.equal(
      (
        await call(app, a, "POST", `/local/care-records/${row.id}/receipt`, {
          ...body,
          action: "read",
        })
      ).statusCode,
      200,
    );
    assert.equal(
      (
        await call(app, a, "POST", `/local/care-records/${row.id}/receipt`, {
          ...body,
          action: "acknowledge",
        })
      ).statusCode,
      200,
    );
    assert.equal(
      (await call(app, b, "GET", `/local/care-records/${row.id}`)).json<Row>().receipt,
      "UNREAD",
    );
    assert.equal(
      (
        await call(app, b, "POST", `/local/care-records/${row.id}/receipt`, {
          ...body,
          action: "read",
        })
      ).statusCode,
      403,
    );
    assert.equal(
      (
        await call(app, a, "POST", `/local/binding-applications/${ba.id}/release`, {
          version: ba.version,
        })
      ).statusCode,
      200,
    );
    assert.equal((await call(app, a, "GET", `/local/care-records/${row.id}`)).statusCode, 403);
    assert.equal((await call(app, b, "GET", `/local/care-records/${row.id}`)).statusCode, 200);
    const newBinding = await approveBinding(app, a, o);
    assert.notEqual(newBinding.id, ba.id);
    assert.equal(
      (await call(app, a, "GET", `/local/care-records/${row.id}`)).json<Row>().receipt,
      "UNREAD",
    );
    assert.equal(
      (
        await call(app, a, "POST", `/local/care-records/${row.id}/receipt`, {
          ...body,
          action: "read",
        })
      ).statusCode,
      403,
    );
    const bBody = { ...body, bindingId: bb.id };
    assert.equal(
      (
        await call(app, b, "POST", `/local/care-records/${row.id}/receipt`, {
          ...bBody,
          action: "read",
        })
      ).statusCode,
      200,
    );
    row = await command(app, o, row, "revoke-publication");
    row = await command(app, o, row, "publish");
    assert.equal(row.publicationVersion, 2);
    assert.equal(
      (await call(app, b, "GET", `/local/care-records/${row.id}`)).json<Row>().receipt,
      "UNREAD",
    );
    assert.equal(
      (
        await call(app, b, "POST", `/local/care-records/${row.id}/receipt`, {
          ...bBody,
          action: "acknowledge",
        })
      ).statusCode,
      409,
    );
  } finally {
    await app.close();
  }
});

test("care duplicate dates, invalid fields, stale commands and mixed batches cannot mutate part of a write set", async () => {
  const app = await buildLocalSyntheticServer({ mode: "local-synthetic" });
  try {
    const t = await identity(app, "teacher-east"),
      o = await identity(app, "owner-east");
    let a = await draft(app, t),
      b = await draft(app, t, "2026-10-14");
    assert.equal(
      (
        await call(app, t, "POST", "/local/care-records", {
          student: "student-alpha",
          date: "2026-10-13",
          values,
        })
      ).statusCode,
      409,
    );
    for (const patch of [
      { values: { ...values, role: "owner" } },
      { values: { ...values, meal: "custom" } },
      { date: "2026-02-30" },
      { tenantId: "forged" },
    ]) {
      assert.equal(
        (
          await call(app, t, "POST", "/local/care-records", {
            student: "student-alpha",
            date: "2026-10-15",
            values,
            ...patch,
          })
        ).statusCode,
        400,
      );
    }
    a = await command(app, t, a, "submit");
    b = await command(app, t, b, "submit");
    const batch = (items: object[]) =>
      call(app, o, "POST", "/local/care-records/review-batch", { action: "confirm", items });
    assert.equal(
      (
        await batch([
          { id: a.id, version: a.version },
          { id: b.id, version: b.version + 1 },
        ])
      ).statusCode,
      409,
    );
    assert.equal(
      (
        await batch([
          { id: a.id, version: a.version },
          { id: "missing", version: 1 },
        ])
      ).statusCode,
      403,
    );
    assert.equal(
      (await call(app, t, "GET", `/local/care-records/${a.id}`)).json<Row>().status,
      "SUBMITTED",
    );
    assert.equal(
      (
        await batch([
          { id: a.id, version: a.version },
          { id: a.id, version: a.version },
        ])
      ).statusCode,
      400,
    );
    const pass = await batch([
      { id: a.id, version: a.version },
      { id: b.id, version: b.version },
    ]);
    assert.equal(pass.statusCode, 200);
    assert.equal(
      pass.json<Row[]>().every((row) => row.status === "CONFIRMED" && !row.published),
      true,
    );
    assert.equal((await batch([{ id: a.id, version: a.version }])).statusCode, 409);
  } finally {
    await app.close();
  }
});

test("changing a confirmed care record requires publication revocation and another review before publishing", async () => {
  const app = await buildLocalSyntheticServer({ mode: "local-synthetic" });
  try {
    const t = await identity(app, "teacher-east"),
      o = await identity(app, "owner-east");
    let row = await published(app, t, o);
    assert.equal(
      (
        await call(app, t, "PATCH", `/local/care-records/${row.id}`, {
          version: row.version,
          values,
        })
      ).statusCode,
      409,
    );
    row = await command(app, o, row, "revoke-publication");
    const edited = await call(app, t, "PATCH", `/local/care-records/${row.id}`, {
      version: row.version,
      values: { ...values, activity: "OBSERVED" },
    });
    assert.equal(edited.statusCode, 200);
    row = edited.json<Row>();
    assert.equal(row.status, "DRAFT");
    assert.equal(
      (
        await call(app, o, "POST", `/local/care-records/${row.id}/publish`, {
          version: row.version,
        })
      ).statusCode,
      409,
    );
    row = await command(app, t, row, "submit");
    row = await command(app, o, row, "review", { action: "escalate" });
    assert.equal(row.status, "EXCEPTION_PENDING");
    row = await command(app, o, row, "review", { action: "return" });
    row = await command(app, t, row, "withdraw");
    assert.equal(row.status, "CANCELLED");
    const replacement = await draft(app, t);
    assert.notEqual(replacement.id, row.id);
  } finally {
    await app.close();
  }
});

test("care concurrent review and repeated publication or receipt reject duplicates", async () => {
  const app = await buildLocalSyntheticServer({ mode: "local-synthetic" });
  try {
    const p = await identity(app, "parent-alpha"),
      t = await identity(app, "teacher-east"),
      o = await identity(app, "owner-east");
    const b = await approveBinding(app, p, o);
    let row = await command(app, t, await draft(app, t), "submit");
    const results = await Promise.all(
      [1, 2].map(() =>
        call(app, o, "POST", `/local/care-records/${row.id}/review`, {
          version: row.version,
          action: "confirm",
        }),
      ),
    );
    assert.deepEqual(results.map((result) => result.statusCode).sort(), [200, 409]);
    row = results.find((result) => result.statusCode === 200)!.json<Row>();
    row = await command(app, o, row, "publish");
    assert.equal(
      (
        await call(app, o, "POST", `/local/care-records/${row.id}/publish`, {
          version: row.version,
        })
      ).statusCode,
      409,
    );
    const data = {
      bindingId: b.id,
      version: row.version,
      publicationVersion: row.publicationVersion,
      action: "read",
    };
    assert.equal(
      (await call(app, p, "POST", `/local/care-records/${row.id}/receipt`, data)).statusCode,
      200,
    );
    assert.equal(
      (await call(app, p, "POST", `/local/care-records/${row.id}/receipt`, data)).statusCode,
      409,
    );
    assert.equal(
      (
        await call(app, p, "POST", `/local/care-records/${row.id}/receipt`, {
          ...data,
          action: "acknowledge",
        })
      ).statusCode,
      200,
    );
    assert.equal(
      (
        await call(app, p, "POST", `/local/care-records/${row.id}/receipt`, {
          ...data,
          action: "acknowledge",
        })
      ).statusCode,
      409,
    );
  } finally {
    await app.close();
  }
});

test("care record and audit reads return detached copies and preserve prior draft values", () => {
  const repository = new LocalRepository(),
    service = new CareRecordService(repository);
  const teacher = memberForActor("00000000-0000-4000-8000-000000000003")!;
  const row = service.create(teacher, { student: "student-alpha", date: "2026-10-15", values });
  row.values.homework = "NEEDS_SUPPORT";
  const changed = service.edit(teacher, row.id, {
    version: row.version,
    values: { ...values, homework: "IN_PROGRESS" },
  });
  assert.equal(changed.history[0]?.values.homework, "COMPLETED");
  changed.history[0]!.values.homework = "NEEDS_SUPPORT";
  const saved = repository.get(row.id);
  assert.ok(saved?.kind === "care");
  assert.equal(saved.history[0]?.values.homework, "COMPLETED");
  const audits = repository.audits();
  audits[0]!.action = "modified-by-caller";
  assert.equal(repository.audits()[0]?.action, "care.create");
});
