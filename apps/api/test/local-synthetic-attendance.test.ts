import assert from "node:assert/strict";
import test from "node:test";
import { buildLocalSyntheticServer } from "../src/local-synthetic/server.js";
import { AttendanceService } from "../src/local-synthetic/attendance.service.js";
import { LocalRepository } from "../src/local-synthetic/repository.js";
import { memberForActor } from "../src/local-synthetic/sessions.js";

type App = Awaited<ReturnType<typeof buildLocalSyntheticServer>>;
type Row = {
  id: string;
  version: number;
  status: string;
  studentId: string;
  bindingId: string;
  arrivalTime: string | null;
  departureTime: string | null;
  corrected: boolean;
  confirmedLeave: boolean;
  history: Row[];
  correction: null | {
    id: string;
    status: string;
    requestedBy: string;
    reviewedBy: string | null;
    original: { status: string; arrivalTime: string | null; departureTime: string | null };
    proposed: { status: string; arrivalTime: string | null; departureTime: string | null };
  };
};
const base = "/local/attendance-records";
const original = { student: "student-alpha", date: "2026-10-12", status: "ARRIVED", time: "14:30" };
const proposed = { status: "DEPARTED", arrivalTime: "14:20", departureTime: "18:00" };
async function call(app: App, actor: string, method: "GET" | "POST", path: string, body?: object) {
  return app.inject({
    method,
    url: path,
    headers: { host: "127.0.0.1:4317", ...(actor ? { authorization: `Bearer ${actor}` } : {}) },
    ...(body ? { payload: body } : {}),
  });
}
async function identity(app: App, profile: string) {
  const r = await call(app, "", "POST", "/local/sessions", { profile });
  assert.equal(r.statusCode, 201, r.body);
  return r.json<{ handle: string }>().handle;
}
async function post(app: App, actor: string, path: string, body: object, code = 200) {
  const r = await call(app, actor, "POST", path, body);
  assert.equal(r.statusCode, code, `${path}: ${r.body}`);
  return r.json<Row>();
}
async function bind(app: App, parent: string, owner: string, student = "student-alpha") {
  const r = await post(
    app,
    parent,
    "/local/binding-applications",
    { student, relationship: "GUARDIAN" },
    201,
  );
  return post(app, owner, `/local/binding-applications/${r.id}/review`, {
    version: r.version,
    action: "approve",
  });
}

test("attendance is empty until recorded, with normal arrival/departure and immutable revisions", async () => {
  const app = await buildLocalSyntheticServer({ mode: "local-synthetic" });
  try {
    const t = await identity(app, "teacher-east"),
      o = await identity(app, "owner-east");
    assert.deepEqual((await call(app, t, "GET", base)).json(), []);
    let row = await post(app, t, base, { ...original, status: "NOT_ARRIVED", time: null }, 201);
    assert.equal(row.arrivalTime, null);
    assert.equal(row.corrected, false);
    row = await post(app, t, `${base}/${row.id}/arrive`, { version: row.version, time: "14:30" });
    assert.equal(row.status, "ARRIVED");
    assert.equal(row.history[0]?.status, "NOT_ARRIVED");
    const oldVersion = row.version;
    row = await post(app, t, `${base}/${row.id}/depart`, { version: row.version, time: "18:00" });
    assert.equal(row.status, "DEPARTED");
    assert.equal(row.departureTime, "18:00");
    assert.equal(row.corrected, false);
    assert.equal(row.history.length, 2);
    assert.equal(
      (
        await call(app, t, "POST", `${base}/${row.id}/depart`, {
          version: oldVersion,
          time: "18:01",
        })
      ).statusCode,
      409,
    );
    assert.equal(
      (
        await call(app, t, "POST", `${base}/${row.id}/depart`, {
          version: row.version,
          time: "18:01",
        })
      ).statusCode,
      409,
    );
    row.history[0]!.status = "MUTATED";
    assert.equal(
      (await call(app, o, "GET", `${base}/${row.id}`)).json<Row>().history[0]?.status,
      "NOT_ARRIVED",
    );
    assert.equal((await call(app, t, "POST", base, original)).statusCode, 409);
    const second = await post(app, t, base, { ...original, student: "student-beta" }, 201);
    assert.notEqual(second.id, row.id);
    assert.equal((await call(app, t, "GET", base)).json<Row[]>().length, 2);
  } finally {
    await app.close();
  }
});

test("invalid dates, times, status combinations and injected authority never write", async () => {
  const app = await buildLocalSyntheticServer({ mode: "local-synthetic" });
  try {
    const t = await identity(app, "teacher-east");
    for (const patch of [
      { date: "2026-02-30" },
      { date: "2030-01-01" },
      { time: "24:00" },
      { time: "9:00" },
      { time: null },
      { status: "DEPARTED" },
      { status: ["ARRIVED"] },
      { status: "NOT_ARRIVED", time: "14:30" },
      { tenantId: "other" },
    ])
      assert.equal(
        (await call(app, t, "POST", base, { ...original, ...patch })).statusCode,
        400,
        JSON.stringify(patch),
      );
    assert.deepEqual((await call(app, t, "GET", base)).json(), []);
    const row = await post(app, t, base, original, 201);
    assert.equal(
      (
        await call(app, t, "POST", `${base}/${row.id}/depart`, {
          version: row.version,
          time: "14:29",
        })
      ).statusCode,
      400,
    );
    for (const value of [
      { status: "NOT_ARRIVED", arrivalTime: "14:30", departureTime: null },
      { status: "ARRIVED", arrivalTime: "14:30", departureTime: "18:00" },
      { status: "DEPARTED", arrivalTime: "18:00", departureTime: "14:30" },
      { ...proposed, role: "owner" },
    ])
      assert.equal(
        (
          await call(app, t, "POST", `${base}/${row.id}/correction`, {
            version: row.version,
            reason: "TIME_ENTRY_ERROR",
            proposed: value,
          })
        ).statusCode,
        400,
      );
    assert.equal(
      (
        await call(app, t, "POST", `${base}/${row.id}/correction`, {
          version: row.version,
          reason: "free text",
          proposed,
        })
      ).statusCode,
      400,
    );
    assert.equal((await call(app, t, "GET", `${base}/${row.id}`)).json<Row>().version, row.version);
  } finally {
    await app.close();
  }
});

test("correction requires independent human review, preserves original until approved, and rejects stale approvals", async () => {
  const app = await buildLocalSyntheticServer({ mode: "local-synthetic" });
  try {
    const t = await identity(app, "teacher-east"),
      o = await identity(app, "owner-east");
    let row = await post(app, t, base, original, 201);
    row = await post(app, t, `${base}/${row.id}/correction`, {
      version: row.version,
      reason: "TIME_ENTRY_ERROR",
      proposed,
    });
    assert.equal(row.status, "ARRIVED");
    assert.equal(row.arrivalTime, "14:30");
    assert.equal(row.correction?.status, "PENDING");
    assert.equal(row.correction?.reviewedBy, null);
    assert.deepEqual(row.correction?.original, {
      status: "ARRIVED",
      arrivalTime: "14:30",
      departureTime: null,
    });
    for (const suffix of ["arrive", "depart"])
      assert.equal(
        (
          await call(app, t, "POST", `${base}/${row.id}/${suffix}`, {
            version: row.version,
            time: "18:00",
          })
        ).statusCode,
        409,
      );
    assert.equal(
      (
        await call(app, t, "POST", `${base}/${row.id}/correction`, {
          version: row.version,
          reason: "LATE_ENTRY",
          proposed,
        })
      ).statusCode,
      409,
    );
    assert.equal(
      (
        await call(app, t, "POST", `${base}/${row.id}/review`, {
          version: row.version,
          action: "approve",
        })
      ).statusCode,
      403,
    );
    const pendingVersion = row.version;
    row = await post(app, o, `${base}/${row.id}/review`, {
      version: row.version,
      action: "return",
    });
    assert.equal(row.correction?.status, "RETURNED");
    assert.equal(row.arrivalTime, "14:30");
    assert.equal(row.corrected, false);
    const firstCorrection = row.correction?.id;
    row = await post(app, t, `${base}/${row.id}/correction`, {
      version: row.version,
      reason: "LATE_ENTRY",
      proposed,
    });
    assert.notEqual(row.correction?.id, firstCorrection);
    assert.equal(
      (
        await call(app, o, "POST", `${base}/${row.id}/review`, {
          version: pendingVersion,
          action: "approve",
        })
      ).statusCode,
      409,
    );
    row = await post(app, o, `${base}/${row.id}/review`, {
      version: row.version,
      action: "approve",
    });
    assert.equal(row.status, "DEPARTED");
    assert.equal(row.arrivalTime, "14:20");
    assert.equal(row.corrected, true);
    assert.equal(row.correction?.status, "APPROVED");
    assert.notEqual(row.correction?.requestedBy, row.correction?.reviewedBy);
    assert.equal(row.history[2]?.correction?.status, "RETURNED");
    assert.equal(
      (
        await call(app, o, "POST", `${base}/${row.id}/review`, {
          version: row.version,
          action: "approve",
        })
      ).statusCode,
      409,
    );
  } finally {
    await app.close();
  }
});

test("parent safe projection uses own approved binding and independent child/guardian release", async () => {
  const app = await buildLocalSyntheticServer({ mode: "local-synthetic" });
  try {
    const p = await identity(app, "parent-alpha"),
      q = await identity(app, "parent-beta"),
      t = await identity(app, "teacher-east"),
      o = await identity(app, "owner-east");
    const a = await post(app, t, base, original, 201),
      b = await post(app, t, base, { ...original, student: "student-beta" }, 201);
    assert.deepEqual((await call(app, p, "GET", base)).json(), []);
    assert.equal((await call(app, p, "GET", `${base}/${a.id}`)).statusCode, 403);
    const pa = await bind(app, p, o),
      pb = await bind(app, p, o, "student-beta"),
      qa = await bind(app, q, o);
    const view = (await call(app, p, "GET", `${base}/${a.id}`)).json<Row>();
    assert.deepEqual(
      Object.keys(view).sort(),
      [
        "id",
        "version",
        "bindingId",
        "studentId",
        "studentLabel",
        "date",
        "status",
        "arrivalTime",
        "departureTime",
        "corrected",
        "confirmedLeave",
      ].sort(),
    );
    assert.equal(view.bindingId, pa.id);
    assert.equal((await call(app, q, "GET", `${base}/${a.id}`)).json<Row>().bindingId, qa.id);
    await post(app, p, `/local/binding-applications/${pa.id}/release`, { version: pa.version });
    assert.equal((await call(app, p, "GET", `${base}/${a.id}`)).statusCode, 403);
    assert.equal((await call(app, p, "GET", `${base}/${b.id}`)).json<Row>().bindingId, pb.id);
    assert.equal((await call(app, q, "GET", `${base}/${a.id}`)).statusCode, 200);
    const rebound = await bind(app, p, o);
    assert.notEqual(rebound.id, pa.id);
    assert.equal((await call(app, p, "GET", `${base}/${a.id}`)).json<Row>().bindingId, rebound.id);
    assert.equal(
      (await call(app, p, "POST", `${base}/${a.id}/depart`, { version: a.version, time: "18:00" }))
        .statusCode,
      403,
    );
  } finally {
    await app.close();
  }
});

test("confirmed leave is boolean context only, requires still-approved source relation, and never creates attendance", async () => {
  const app = await buildLocalSyntheticServer({ mode: "local-synthetic" });
  try {
    const p = await identity(app, "parent-alpha"),
      q = await identity(app, "parent-beta"),
      t = await identity(app, "teacher-east"),
      o = await identity(app, "owner-east");
    const source = await bind(app, p, o);
    await bind(app, q, o);
    const leave = await post(
      app,
      p,
      "/local/leave-requests",
      {
        bindingId: source.id,
        startDate: original.date,
        endDate: original.date,
        reason: "FAMILY_ARRANGEMENT",
      },
      201,
    );
    assert.deepEqual((await call(app, t, "GET", base)).json(), []);
    const a = await post(app, t, base, { ...original, status: "NOT_ARRIVED", time: null }, 201);
    const b = await post(app, t, base, { ...original, student: "student-beta" }, 201);
    assert.equal(a.confirmedLeave, false);
    await post(app, t, `/local/leave-requests/${leave.id}/review`, {
      version: leave.version,
      action: "confirm",
    });
    assert.equal((await call(app, q, "GET", `${base}/${a.id}`)).json<Row>().confirmedLeave, true);
    assert.equal((await call(app, t, "GET", `${base}/${b.id}`)).json<Row>().confirmedLeave, false);
    await post(app, p, `/local/binding-applications/${source.id}/release`, {
      version: source.version,
    });
    assert.equal((await call(app, q, "GET", `${base}/${a.id}`)).json<Row>().confirmedLeave, false);
  } finally {
    await app.close();
  }
});

test("attendance actions require scoped membership, reject forged authority and record only minimal audit metadata", async () => {
  const app = await buildLocalSyntheticServer({ mode: "local-synthetic" });
  try {
    const t = await identity(app, "teacher-east"),
      o = await identity(app, "owner-east");
    const row = await post(app, t, base, original, 201);
    assert.equal((await call(app, "", "GET", base)).statusCode, 401);
    for (const profile of [
      "owner-west",
      "owner-other-tenant",
      "teacher-other-class",
      "content-editor-east",
      "platform-admin",
    ]) {
      const actor = await identity(app, profile);
      assert.deepEqual((await call(app, actor, "GET", base)).json(), [], profile);
      const known = await call(app, actor, "GET", `${base}/${row.id}`);
      const unknown = await call(app, actor, "GET", `${base}/00000000-0000-4000-8000-000000000099`);
      assert.equal(known.statusCode, 403, profile);
      assert.deepEqual(known.json(), unknown.json());
      assert.equal(
        (await call(app, actor, "POST", base, { ...original, date: "2026-10-13" })).statusCode,
        403,
        profile,
      );
    }
    assert.equal(
      (
        await call(app, t, "POST", `${base}/${row.id}/depart`, {
          version: row.version,
          time: "18:00",
          capabilities: ["attendance:review"],
        })
      ).statusCode,
      400,
    );
    assert.equal((await call(app, t, "GET", `${base}?role=owner`)).statusCode, 400);
    const audits = (await call(app, o, "GET", "/local/audit")).json<Record<string, unknown>[]>();
    assert.ok(
      audits.some((event) => event.action === "attendance.create" && event.outcome === "ACCEPTED"),
    );
    assert.ok(
      audits.some((event) => event.action === "attendance.depart" && event.outcome === "DENIED"),
    );
    for (const event of audits)
      assert.deepEqual(
        Object.keys(event).sort(),
        ["actorId", "objectId", "version", "action", "outcome", "at"].sort(),
      );
    assert.equal(JSON.stringify(audits).includes(t), false);
  } finally {
    await app.close();
  }
});

test("repository retains scoped audit and detached correction history; even a dual-action actor cannot self-review", () => {
  const repository = new LocalRepository(),
    service = new AttendanceService(repository);
  const teacher = memberForActor("00000000-0000-4000-8000-000000000003")!;
  const dual = { ...teacher, actions: [...teacher.actions, "attendance:review" as const] };
  const row = service.create(teacher, original);
  const pending = service.correction(teacher, row.id, {
    version: row.version,
    reason: "TIME_ENTRY_ERROR",
    proposed,
  });
  assert.throws(
    () => service.review(dual, row.id, { version: pending.version, action: "approve" }),
    { code: "UNAVAILABLE" },
  );
  pending.correction!.proposed.arrivalTime = "00:00";
  const current = repository.get(row.id);
  assert.ok(current?.kind === "attendance");
  assert.equal(current.correction?.proposed.arrivalTime, "14:20");
  assert.equal(
    repository.replaceBatch([
      { ...current, version: current.version + 1 },
      { ...current, version: current.version + 1 },
    ]),
    false,
  );
  assert.equal(repository.get(row.id)?.version, current.version);
  const owner = memberForActor("00000000-0000-4000-8000-000000000004")!;
  const result = service.review(owner, row.id, { version: current.version, action: "approve" });
  result.history[1]!.correction!.proposed.arrivalTime = "00:00";
  const stored = repository.get(row.id);
  assert.ok(stored?.kind === "attendance");
  assert.equal(stored.history[1]?.correction?.proposed.arrivalTime, "14:20");
  const audits = repository.audits();
  assert.equal(audits[0]?.tenantId, teacher.tenantId);
  assert.equal(audits[0]?.campusId, teacher.campusId);
  audits[0]!.action = "MUTATED";
  assert.equal(repository.audits()[0]?.action, "attendance.create");
});
