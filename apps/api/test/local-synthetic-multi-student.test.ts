import assert from "node:assert/strict";
import test from "node:test";
import { buildLocalSyntheticServer } from "../src/local-synthetic/server.js";

type App = Awaited<ReturnType<typeof buildLocalSyntheticServer>>;
type Row = {
  id: string;
  version: number;
  studentId: string;
  studentAlias: string;
  studentLabel: string;
  bindingId: string;
  publicationVersion: number;
  status: string;
  receipt: string;
  acknowledged: boolean;
};
const alpha = "00000000-0000-4000-8000-0000000000c8";
const beta = "00000000-0000-4000-8000-0000000000c9";
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
async function success(app: App, actor: string, path: string, body: object, code = 200) {
  const r = await call(app, actor, "POST", path, body);
  assert.equal(r.statusCode, code, `${path}: ${r.body}`);
  return r.json<Row>();
}
async function binding(app: App, parent: string, owner: string, student: string) {
  const row = await success(
    app,
    parent,
    "/local/binding-applications",
    { student, relationship: "GUARDIAN" },
    201,
  );
  return success(app, owner, `/local/binding-applications/${row.id}/review`, {
    version: row.version,
    action: "approve",
  });
}
async function draft(app: App, teacher: string, student: string, date = "2026-10-12") {
  return success(app, teacher, "/local/care-records", { student, date, values }, 201);
}
async function publish(app: App, teacher: string, owner: string, row: Row) {
  row = await success(app, teacher, `/local/care-records/${row.id}/submit`, {
    version: row.version,
  });
  row = await success(app, owner, `/local/care-records/${row.id}/review`, {
    version: row.version,
    action: "confirm",
  });
  return success(app, owner, `/local/care-records/${row.id}/publish`, { version: row.version });
}
async function read(
  app: App,
  parent: string,
  row: Row,
  relation: Row,
  action: "read" | "acknowledge",
) {
  return success(app, parent, `/local/care-records/${row.id}/receipt`, {
    bindingId: relation.id,
    version: row.version,
    publicationVersion: row.publicationVersion,
    action,
  });
}

test("student options require current session and expose only fixed action-scoped invitations", async () => {
  const app = await buildLocalSyntheticServer({ mode: "local-synthetic" });
  try {
    assert.equal((await call(app, "", "GET", "/local/student-options")).statusCode, 401);
    for (const profile of [
      "parent-alpha",
      "parent-beta",
      "teacher-east",
      "teacher-east-peer",
      "owner-east",
    ]) {
      const actor = await identity(app, profile);
      const result = await call(app, actor, "GET", "/local/student-options");
      assert.equal(result.statusCode, 200, result.body);
      assert.deepEqual(result.json(), [
        {
          id: alpha,
          alias: "student-alpha",
          label: "示例学生甲",
          campusId: "00000000-0000-4000-8000-000000000065",
          classId: "00000000-0000-4000-8000-000000000067",
          campusLabel: "示例东校区",
          classLabel: "示例三年级甲班",
        },
        {
          id: beta,
          alias: "student-beta",
          label: "示例学生乙",
          campusId: "00000000-0000-4000-8000-000000000065",
          classId: "00000000-0000-4000-8000-000000000067",
          campusLabel: "示例东校区",
          classLabel: "示例三年级甲班",
        },
      ]);
      assert.equal(
        (await call(app, actor, "GET", "/local/student-options?campusId=other")).statusCode,
        400,
      );
      await success(app, actor, "/local/session/end", {});
      assert.equal((await call(app, actor, "GET", "/local/student-options")).statusCode, 401);
    }
    for (const profile of [
      "owner-west",
      "owner-other-tenant",
      "teacher-other-class",
      "content-editor-east",
      "platform-admin",
    ]) {
      const actor = await identity(app, profile);
      assert.deepEqual(
        (await call(app, actor, "GET", "/local/student-options")).json(),
        [],
        profile,
      );
    }
  } finally {
    await app.close();
  }
});

test("two children and two guardians have independent binding and leave ownership", async () => {
  const app = await buildLocalSyntheticServer({ mode: "local-synthetic" });
  try {
    const p = await identity(app, "parent-alpha"),
      q = await identity(app, "parent-beta"),
      o = await identity(app, "owner-east"),
      t = await identity(app, "teacher-east");
    const a = await binding(app, p, o, "student-alpha"),
      b = await binding(app, p, o, "student-beta"),
      qb = await binding(app, q, o, "student-beta");
    assert.equal(a.studentId, alpha);
    assert.equal(b.studentId, beta);
    assert.equal(b.studentLabel, "示例学生乙");
    assert.equal(b.studentAlias, "student-beta");
    assert.notEqual(b.id, qb.id);
    const rows = (await call(app, p, "GET", "/local/binding-applications")).json<Row[]>();
    assert.deepEqual(
      rows.map((r) => r.studentId),
      [alpha, beta],
    );
    assert.ok(rows[0]);
    rows[0].studentLabel = "changed";
    assert.equal(
      (await call(app, p, "GET", `/local/binding-applications/${a.id}`)).json<Row>().studentLabel,
      "示例学生甲",
    );
    assert.equal(
      (
        await call(app, p, "POST", "/local/binding-applications", {
          student: "student-beta",
          relationship: "GUARDIAN",
        })
      ).statusCode,
      409,
    );
    const dates = { startDate: "2026-10-12", endDate: "2026-10-12", reason: "FAMILY_ARRANGEMENT" };
    const la = await success(app, p, "/local/leave-requests", { bindingId: a.id, ...dates }, 201);
    const lb = await success(app, p, "/local/leave-requests", { bindingId: b.id, ...dates }, 201);
    assert.equal(la.studentId, alpha);
    assert.equal(lb.studentId, beta);
    assert.equal(lb.studentLabel, "示例学生乙");
    assert.equal(
      (await call(app, q, "POST", "/local/leave-requests", { bindingId: b.id, ...dates }))
        .statusCode,
      403,
    );
    const confirmed = await success(app, t, `/local/leave-requests/${lb.id}/review`, {
      version: lb.version,
      action: "confirm",
    });
    await success(app, p, `/local/leave-requests/${confirmed.id}/receipt`, {
      version: confirmed.version,
    });
    assert.equal(
      (await call(app, p, "GET", `/local/leave-requests/${la.id}`)).json<Row>().acknowledged,
      false,
    );
    assert.equal(
      (
        await call(app, p, "POST", `/local/leave-requests/${lb.id}/receipt`, {
          version: lb.version,
        })
      ).statusCode,
      409,
    );
    assert.equal((await call(app, q, "GET", `/local/leave-requests/${lb.id}`)).statusCode, 403);
  } finally {
    await app.close();
  }
});

test("same-day care is unique per child and all projections carry accurate student identity", async () => {
  const app = await buildLocalSyntheticServer({ mode: "local-synthetic" });
  try {
    const p = await identity(app, "parent-alpha"),
      o = await identity(app, "owner-east"),
      t = await identity(app, "teacher-east");
    await binding(app, p, o, "student-alpha");
    const a = await draft(app, t, "student-alpha"),
      b = await draft(app, t, "student-beta");
    assert.equal(b.studentLabel, "示例学生乙");
    assert.equal(b.studentId, beta);
    assert.equal(
      (
        await call(app, t, "POST", "/local/care-records", {
          student: "student-beta",
          date: "2026-10-12",
          values,
        })
      ).statusCode,
      409,
    );
    assert.deepEqual((await call(app, p, "GET", "/local/care-records")).json(), []);
    const pa = await publish(app, t, o, a),
      pb = await publish(app, t, o, b);
    assert.equal(pb.studentLabel, "示例学生乙");
    let list = (await call(app, p, "GET", "/local/care-records")).json<Row[]>();
    assert.deepEqual(
      list.map((r) => r.studentId),
      [alpha],
    );
    assert.equal((await call(app, p, "GET", `/local/care-records/${pb.id}`)).statusCode, 403);
    await binding(app, p, o, "student-beta");
    list = (await call(app, p, "GET", "/local/care-records")).json<Row[]>();
    assert.deepEqual(
      list.map((r) => [r.studentId, r.studentLabel]),
      [
        [alpha, "示例学生甲"],
        [beta, "示例学生乙"],
      ],
    );
    for (const row of list)
      for (const field of [
        "history",
        "createdBy",
        "reviewedBy",
        "tenantId",
        "campusId",
        "classId",
        "status",
      ])
        assert.equal(Object.hasOwn(row, field), false, field);
    assert.equal(
      (await call(app, o, "GET", `/local/care-records/${pa.id}`)).json<Row>().studentLabel,
      "示例学生甲",
    );
  } finally {
    await app.close();
  }
});

test("release of one child preserves other child and guardian receipts; rebind cannot inherit old receipt", async () => {
  const app = await buildLocalSyntheticServer({ mode: "local-synthetic" });
  try {
    const p = await identity(app, "parent-alpha"),
      q = await identity(app, "parent-beta"),
      o = await identity(app, "owner-east"),
      t = await identity(app, "teacher-east");
    const a = await binding(app, p, o, "student-alpha"),
      b = await binding(app, p, o, "student-beta"),
      qa = await binding(app, q, o, "student-alpha");
    const ca = await publish(app, t, o, await draft(app, t, "student-alpha")),
      cb = await publish(app, t, o, await draft(app, t, "student-beta"));
    await read(app, p, ca, a, "read");
    await read(app, p, ca, a, "acknowledge");
    await read(app, p, cb, b, "read");
    await read(app, p, cb, b, "acknowledge");
    assert.equal(
      (await call(app, q, "GET", `/local/care-records/${ca.id}`)).json<Row>().receipt,
      "UNREAD",
    );
    assert.equal(
      (
        await call(app, p, "POST", `/local/care-records/${ca.id}/receipt`, {
          bindingId: b.id,
          version: ca.version,
          publicationVersion: ca.publicationVersion,
          action: "read",
        })
      ).statusCode,
      403,
    );
    const dates = { startDate: "2026-10-14", endDate: "2026-10-14", reason: "TEMPORARY_MATTER" };
    const la = await success(app, p, "/local/leave-requests", { bindingId: a.id, ...dates }, 201),
      lb = await success(app, p, "/local/leave-requests", { bindingId: b.id, ...dates }, 201);
    await success(app, p, `/local/binding-applications/${a.id}/release`, { version: a.version });
    assert.equal((await call(app, p, "GET", `/local/care-records/${ca.id}`)).statusCode, 403);
    assert.equal((await call(app, p, "GET", `/local/leave-requests/${la.id}`)).statusCode, 403);
    assert.equal((await call(app, p, "GET", `/local/leave-requests/${lb.id}`)).statusCode, 200);
    assert.equal(
      (await call(app, p, "GET", `/local/care-records/${cb.id}`)).json<Row>().receipt,
      "ACKNOWLEDGED",
    );
    assert.equal(
      (await call(app, q, "GET", `/local/binding-applications/${qa.id}`)).json<Row>().status,
      "APPROVED",
    );
    await read(app, q, ca, qa, "read");
    await read(app, q, ca, qa, "acknowledge");
    const again = await binding(app, p, o, "student-alpha");
    assert.notEqual(again.id, a.id);
    assert.equal(
      (await call(app, p, "GET", `/local/care-records/${ca.id}`)).json<Row>().receipt,
      "UNREAD",
    );
    assert.equal(
      (
        await call(app, p, "POST", `/local/care-records/${ca.id}/receipt`, {
          bindingId: a.id,
          version: ca.version,
          publicationVersion: ca.publicationVersion,
          action: "read",
        })
      ).statusCode,
      403,
    );
    assert.equal((await call(app, p, "GET", `/local/leave-requests/${la.id}`)).statusCode, 403);
    assert.equal(
      (await call(app, q, "GET", `/local/care-records/${ca.id}`)).json<Row>().receipt,
      "ACKNOWLEDGED",
    );
  } finally {
    await app.close();
  }
});

test("unknown student, wrong scope and forged fields fail closed; mixed-student batch is atomic", async () => {
  const app = await buildLocalSyntheticServer({ mode: "local-synthetic" });
  try {
    const p = await identity(app, "parent-alpha"),
      o = await identity(app, "owner-east"),
      t = await identity(app, "teacher-east");
    assert.equal(
      (
        await call(app, p, "POST", "/local/binding-applications", {
          student: "unknown",
          relationship: "GUARDIAN",
        })
      ).statusCode,
      403,
    );
    assert.equal(
      (
        await call(app, p, "POST", "/local/binding-applications", {
          student: "student-beta",
          relationship: "GUARDIAN",
          tenantId: "other",
        })
      ).statusCode,
      400,
    );
    for (const profile of [
      "teacher-other-class",
      "owner-west",
      "owner-other-tenant",
      "platform-admin",
      "content-editor-east",
    ]) {
      const actor = await identity(app, profile);
      const existing = await call(app, actor, "POST", "/local/care-records", {
        student: "student-beta",
        date: "2026-10-12",
        values,
      });
      const missing = await call(app, actor, "POST", "/local/care-records", {
        student: "unknown",
        date: "2026-10-12",
        values,
      });
      assert.equal(existing.statusCode, 403, profile);
      assert.deepEqual(existing.json(), missing.json());
    }
    assert.equal(
      (
        await call(app, t, "POST", "/local/care-records", {
          student: "student-beta",
          date: "2026-10-12",
          values,
          classId: "other",
        })
      ).statusCode,
      400,
    );
    let a = await draft(app, t, "student-alpha"),
      b = await draft(app, t, "student-beta");
    a = await success(app, t, `/local/care-records/${a.id}/submit`, { version: a.version });
    b = await success(app, t, `/local/care-records/${b.id}/submit`, { version: b.version });
    assert.equal(
      (
        await call(app, o, "POST", "/local/care-records/review-batch", {
          action: "confirm",
          items: [
            { id: a.id, version: a.version },
            { id: b.id, version: b.version - 1 },
          ],
        })
      ).statusCode,
      409,
    );
    assert.equal(
      (await call(app, o, "GET", `/local/care-records/${a.id}`)).json<Row>().status,
      "SUBMITTED",
    );
    assert.equal(
      (
        await call(app, o, "POST", "/local/care-records/review-batch", {
          action: "confirm",
          items: [
            { id: a.id, version: a.version },
            { id: "00000000-0000-4000-8000-000000000099", version: 1 },
          ],
        })
      ).statusCode,
      403,
    );
    assert.equal(
      (await call(app, o, "GET", `/local/care-records/${a.id}`)).json<Row>().version,
      a.version,
    );
    const both = await call(app, o, "POST", "/local/care-records/review-batch", {
      action: "confirm",
      items: [
        { id: a.id, version: a.version },
        { id: b.id, version: b.version },
      ],
    });
    assert.equal(both.statusCode, 200, both.body);
    assert.deepEqual(
      both.json<Row[]>().map((r) => [r.studentId, r.studentLabel]),
      [
        [alpha, "示例学生甲"],
        [beta, "示例学生乙"],
      ],
    );
  } finally {
    await app.close();
  }
});
