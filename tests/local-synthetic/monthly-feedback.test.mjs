import assert from "node:assert/strict";
import test from "node:test";
import { buildLocalSyntheticServer } from "../../apps/api/dist/src/local-synthetic/server.js";

test("monthly feedback loopback contract keeps parent view limited and invalidates stale sources", async () => {
  const app = await buildLocalSyntheticServer({ mode: "local-synthetic" });
  const base = await app.start(0);
  async function request(actor, method, path, body) {
    const response = await globalThis.fetch(base + path, {
      method,
      headers: {
        ...(actor ? { authorization: `Bearer ${actor}` } : {}),
        "content-type": "application/json",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: response.status, body: await response.json() };
  }
  async function session(profile) {
    return (await request("", "POST", "/local/sessions", { profile })).body.handle;
  }
  async function publishCare(teacher, owner, date) {
    const created = await request(teacher, "POST", "/local/care-records", {
      student: "student-alpha",
      date,
      values: {
        arrival: "ARRIVED_AS_PLANNED",
        homework: "COMPLETED",
        meal: "FINISHED",
        rest: "RESTED",
        activity: "PARTICIPATED",
        wellbeing: "ROUTINE",
      },
    });
    assert.equal(created.status, 201);
    let row = created.body;
    for (const [actor, action, extra] of [
      [teacher, "submit", {}],
      [owner, "review", { action: "confirm" }],
      [owner, "publish", {}],
    ]) {
      const result = await request(actor, "POST", `/local/care-records/${row.id}/${action}`, {
        version: row.version,
        ...extra,
      });
      assert.equal(result.status, 200);
      row = result.body;
    }
  }
  try {
    const teacher = await session("teacher-east");
    const owner = await session("owner-east");
    const parent = await session("parent-alpha");
    await publishCare(teacher, owner, "2026-12-09");
    const binding = await request(parent, "POST", "/local/binding-applications", {
      student: "student-alpha",
      relationship: "GUARDIAN",
    });
    assert.equal(binding.status, 201);
    await request(owner, "POST", `/local/binding-applications/${binding.body.id}/review`, {
      version: binding.body.version,
      action: "approve",
    });
    const created = await request(teacher, "POST", "/local/monthly-feedback", {
      month: "2026-12",
      supplements: {
        learningParticipation: "KEEP_WATCHING",
        dailyHabits: "PROGRESSING",
        activityParticipation: "PROGRESSING",
        familySchoolCollaboration: "FOLLOW_UP",
      },
    });
    assert.equal(created.status, 201);
    let row = created.body;
    for (const [actor, path, body] of [
      [teacher, "submit", { version: row.version }],
      [owner, "review", { version: row.version + 1, action: "CONFIRM" }],
      [owner, "publish", { version: row.version + 2 }],
    ]) {
      const next = await request(actor, "POST", `/local/monthly-feedback/${row.id}/${path}`, body);
      assert.equal(next.status, 200);
      row = next.body;
    }
    const parentView = await request(parent, "GET", "/local/monthly-feedback-parent");
    assert.equal(parentView.status, 200);
    assert.equal("sources" in parentView.body[0], false);
    const unchanged = await request(
      owner,
      "POST",
      `/local/monthly-feedback/${row.id}/source-refresh`,
      { version: row.version },
    );
    assert.equal(unchanged.status, 200);
    assert.equal(unchanged.body.status, "PUBLISHED");
    assert.equal(unchanged.body.version, row.version);
    await publishCare(teacher, owner, "2026-12-10");
    const stale = await request(owner, "POST", `/local/monthly-feedback/${row.id}/source-refresh`, {
      version: unchanged.body.version,
    });
    assert.equal(stale.status, 200);
    assert.equal(stale.body.status, "REVIEW_REQUIRED");
    assert.equal(stale.body.sourceVersion, 2);
    assert.equal("sources" in stale.body, false);
    assert.equal(stale.body.sourceSummary[0].count, 2);
    const hidden = await request(parent, "GET", "/local/monthly-feedback-parent");
    assert.equal(hidden.body[0].status, "REVIEW_REQUIRED");
    assert.deepEqual(hidden.body[0].items, []);
    assert.equal("sources" in hidden.body[0], false);
    assert.equal("sourceSummary" in hidden.body[0], false);
  } finally {
    await app.close();
  }
});
