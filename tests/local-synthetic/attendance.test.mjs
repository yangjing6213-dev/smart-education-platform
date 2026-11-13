import assert from "node:assert/strict";
import { request } from "node:http";
import test from "node:test";
import { buildLocalSyntheticServer } from "../../apps/api/dist/src/local-synthetic/server.js";

function http(base, actor, method, path, data) {
  return new Promise((resolve, reject) => {
    const req = request(
      base + path,
      {
        method,
        headers: {
          ...(actor ? { Authorization: `Bearer ${actor}` } : {}),
          ...(data ? { "Content-Type": "application/json" } : {}),
        },
      },
      (response) => {
        let body = "";
        response.setEncoding("utf8");
        response.on("data", (part) => {
          body += part;
        });
        response.on("error", reject);
        response.on("end", () => resolve({ status: response.statusCode, body: JSON.parse(body) }));
      },
    );
    req.on("error", reject);
    req.end(data ? JSON.stringify(data) : undefined);
  });
}

test("independent HTTP identities share attendance, review corrections, and isolate current parent bindings", async () => {
  const app = await buildLocalSyntheticServer({ mode: "local-synthetic" });
  const base = await app.start(0);
  const root = "/local/attendance-records";
  async function ok(actor, method, path, body, code = 200) {
    const r = await http(base, actor, method, path, body);
    assert.equal(r.status, code, JSON.stringify(r.body));
    return r.body;
  }
  async function session(profile) {
    return (await ok("", "POST", "/local/sessions", { profile }, 201)).handle;
  }
  try {
    const t = await session("teacher-east"),
      o = await session("owner-east"),
      p = await session("parent-alpha"),
      sameParent = await session("parent-alpha"),
      q = await session("parent-beta"),
      wrong = await session("teacher-other-class");
    const relations = [];
    for (const [actor, student] of [
      [p, "student-alpha"],
      [p, "student-beta"],
      [q, "student-alpha"],
    ]) {
      let relation = await ok(
        actor,
        "POST",
        "/local/binding-applications",
        { student, relationship: "GUARDIAN" },
        201,
      );
      relation = await ok(o, "POST", `/local/binding-applications/${relation.id}/review`, {
        version: relation.version,
        action: "approve",
      });
      relations.push(relation);
    }
    let a = await ok(
      t,
      "POST",
      root,
      { student: "student-alpha", date: "2026-10-13", status: "NOT_ARRIVED", time: null },
      201,
    );
    const b = await ok(
      t,
      "POST",
      root,
      { student: "student-beta", date: "2026-10-13", status: "ARRIVED", time: "14:35" },
      201,
    );
    a = await ok(t, "POST", `${root}/${a.id}/arrive`, { version: a.version, time: "14:30" });
    a = await ok(t, "POST", `${root}/${a.id}/depart`, { version: a.version, time: "18:00" });
    const first = await ok(p, "GET", `${root}/${a.id}`);
    assert.deepEqual(await ok(sameParent, "GET", `${root}/${a.id}`), first);
    a = await ok(t, "POST", `${root}/${a.id}/correction`, {
      version: a.version,
      reason: "TIME_ENTRY_ERROR",
      proposed: { status: "DEPARTED", arrivalTime: "14:30", departureTime: "18:10" },
    });
    assert.equal((await ok(o, "GET", `${root}/${a.id}`)).correction.status, "PENDING");
    assert.equal((await ok(p, "GET", `${root}/${a.id}`)).departureTime, "18:00");
    await ok(t, "POST", `${root}/${a.id}/review`, { version: a.version, action: "approve" }, 403);
    const stale = a.version;
    a = await ok(o, "POST", `${root}/${a.id}/review`, { version: a.version, action: "approve" });
    await ok(o, "POST", `${root}/${a.id}/review`, { version: stale, action: "approve" }, 409);
    const final = await ok(p, "GET", `${root}/${a.id}`);
    assert.equal(final.departureTime, "18:10");
    assert.equal(final.corrected, true);
    for (const key of ["history", "correction", "tenantId", "updatedBy"])
      assert.equal(Object.hasOwn(final, key), false);
    assert.equal((await ok(p, "GET", `${root}/${b.id}`)).arrivalTime, "14:35");
    assert.deepEqual(await ok(wrong, "GET", root), []);
    await ok(wrong, "GET", `${root}/${a.id}`, undefined, 403);
    await ok(p, "POST", `/local/binding-applications/${relations[0].id}/release`, {
      version: relations[0].version,
    });
    await ok(sameParent, "GET", `${root}/${a.id}`, undefined, 403);
    assert.equal((await ok(sameParent, "GET", root)).length, 1);
    assert.equal((await ok(q, "GET", `${root}/${a.id}`)).bindingId, relations[2].id);
    await ok(t, "POST", "/local/session/end", {});
    await ok(t, "GET", root, undefined, 401);
  } finally {
    await app.close();
  }
});
