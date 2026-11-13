import assert from "node:assert/strict";
import test from "node:test";
import { buildLocalSyntheticServer } from "../src/local-synthetic/server.js";

type App = Awaited<ReturnType<typeof buildLocalSyntheticServer>>;
type Row = Record<string, unknown> & { id: string; version: number; status: string };
type Response = { statusCode: number; body: string; json(): unknown };

async function call(
  app: App,
  actor: string,
  method: "GET" | "POST" | "PATCH",
  url: string,
  body?: unknown,
) {
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

test("supply request supports fixed catalog, review and claim flow", async () => {
  const app = await buildLocalSyntheticServer({ mode: "local-synthetic" });
  try {
    const teacher = await session(app, "teacher-east");
    const owner = await session(app, "owner-east");
    const invalid = await call(app, teacher, "POST", "/local/supply-requests", {
      catalog: "OTHER",
      quantity: 21,
      purpose: "CLASS_ACTIVITY",
    });
    assert.equal(invalid.statusCode, 400, invalid.body);
    let response = await call(app, teacher, "POST", "/local/supply-requests", {
      catalog: "STATIONERY_SET",
      quantity: 3,
      purpose: "CLASS_ACTIVITY",
    });
    assert.equal(response.statusCode, 201, response.body);
    let row = response.json() as Row;
    assert.equal(row.status, "DRAFT");
    assert.equal(row.catalogLabel, "日常文具包");
    response = await call(app, teacher, "POST", `/local/supply-requests/${row.id}/submit`, {
      version: row.version,
    });
    assert.equal(response.statusCode, 200, response.body);
    row = response.json() as Row;
    assert.equal(row.status, "SUBMITTED");
    response = await call(app, owner, "POST", `/local/supply-requests/${row.id}/review`, {
      version: row.version,
      action: "CONFIRM",
    });
    assert.equal(response.statusCode, 200, response.body);
    row = response.json() as Row;
    assert.equal(row.status, "READY");
    response = await call(app, teacher, "POST", `/local/supply-requests/${row.id}/claim`, {
      version: row.version,
    });
    assert.equal(response.statusCode, 200, response.body);
    row = response.json() as Row;
    assert.equal(row.status, "CLAIMED");
    assert.equal(
      (
        await call(app, teacher, "POST", `/local/supply-requests/${row.id}/claim`, {
          version: row.version,
        })
      ).statusCode,
      409,
    );
  } finally {
    await app.close();
  }
});

test("supply request enforces campus scope and anonymous summary", async () => {
  const app = await buildLocalSyntheticServer({ mode: "local-synthetic" });
  try {
    const teacher = await session(app, "teacher-east");
    const ownerWest = await session(app, "owner-west");
    const platform = await session(app, "platform-admin");
    const created = await call(app, teacher, "POST", "/local/supply-requests", {
      catalog: "FIRST_AID_SET",
      quantity: 1,
      purpose: "EMERGENCY_STOCK",
    });
    const row = created.json() as Row;
    assert.equal(
      (await call(app, ownerWest, "GET", `/local/supply-requests/${row.id}`)).statusCode,
      403,
    );
    const summary = await call(app, platform, "GET", "/local/supply-summary");
    assert.equal(summary.statusCode, 200, summary.body);
    const body = summary.json() as { counts: Record<string, number>; synthetic: boolean };
    assert.equal(body.synthetic, true);
    assert.equal(body.counts.DRAFT, 1);
    assert.equal("id" in body, false);
  } finally {
    await app.close();
  }
});

test("catalog accepts only own fixed keys and permits distinct concurrent requests", async () => {
  const app = await buildLocalSyntheticServer({ mode: "local-synthetic" });
  try {
    const teacher = await session(app, "teacher-east");
    for (const catalog of ["toString", "constructor", "__proto__"]) {
      const response = await call(app, teacher, "POST", "/local/supply-requests", {
        catalog,
        quantity: 1,
        purpose: "CLASS_ACTIVITY",
      });
      assert.equal(response.statusCode, 400, `must reject inherited catalog ${catalog}`);
    }
    for (const quantity of [0, 21, 1.5, "2", null]) {
      assert.equal(
        (
          await call(app, teacher, "POST", "/local/supply-requests", {
            catalog: "STATIONERY_SET",
            quantity,
            purpose: "CLASS_ACTIVITY",
          })
        ).statusCode,
        400,
      );
    }
    assert.equal(
      (
        await call(app, teacher, "POST", "/local/supply-requests", {
          catalog: "STATIONERY_SET",
          quantity: 1,
          purpose: "toString",
        })
      ).statusCode,
      400,
    );
    for (const catalog of ["STATIONERY_SET", "ART_ACTIVITY_SET"]) {
      assert.equal(
        (
          await call(app, teacher, "POST", "/local/supply-requests", {
            catalog,
            quantity: 20,
            purpose: "CLASS_ACTIVITY",
          })
        ).statusCode,
        201,
        "a pending stationery request cannot block a different item",
      );
    }
    assert.equal(
      (
        await call(app, teacher, "POST", "/local/supply-requests", {
          catalog: "STATIONERY_SET",
          quantity: 20,
          purpose: "CLASS_ACTIVITY",
        })
      ).statusCode,
      409,
      "repeat create must not duplicate an active request",
    );
  } finally {
    await app.close();
  }
});

test("editing cannot create a duplicate active item and leaves the old draft intact", async () => {
  const app = await buildLocalSyntheticServer({ mode: "local-synthetic" });
  try {
    const teacher = await session(app, "teacher-east");
    const stationery = { catalog: "STATIONERY_SET", quantity: 1, purpose: "CLASS_ACTIVITY" };
    assert.equal(
      (await call(app, teacher, "POST", "/local/supply-requests", stationery)).statusCode,
      201,
    );
    const second = (
      await call(app, teacher, "POST", "/local/supply-requests", {
        ...stationery,
        catalog: "ART_ACTIVITY_SET",
      })
    ).json() as Row;
    const response = await call(app, teacher, "PATCH", `/local/supply-requests/${second.id}`, {
      version: second.version,
      ...stationery,
    });
    assert.equal(response.statusCode, 409);
    const unchanged = (
      await call(app, teacher, "GET", `/local/supply-requests/${second.id}`)
    ).json() as Row;
    assert.equal(unchanged.catalog, "ART_ACTIVITY_SET");
    assert.equal(unchanged.version, second.version);
  } finally {
    await app.close();
  }
});

test("return edit resubmit, shortage, cancellation and audit stay versioned", async () => {
  const app = await buildLocalSyntheticServer({ mode: "local-synthetic" });
  try {
    const teacher = await session(app, "teacher-east"),
      owner = await session(app, "owner-east");
    let row = (
      await call(app, teacher, "POST", "/local/supply-requests", {
        catalog: "CLEANING_SET",
        quantity: 2,
        purpose: "DAILY_OPERATION",
      })
    ).json() as Row;
    async function next(actor: string, action: string, extra = {}) {
      const response = await call(
        app,
        actor,
        "POST",
        `/local/supply-requests/${row.id}/${action}`,
        { version: row.version, ...extra },
      );
      assert.equal(response.statusCode, 200, response.body);
      row = response.json() as Row;
    }
    await next(teacher, "submit");
    const stale = row.version;
    await next(owner, "review", { action: "RETURN" });
    assert.equal(row.status, "RETURNED");
    const edited = await call(app, teacher, "PATCH", `/local/supply-requests/${row.id}`, {
      version: row.version,
      catalog: "CLEANING_SET",
      quantity: 1,
      purpose: "DAILY_OPERATION",
    });
    assert.equal(edited.statusCode, 200, edited.body);
    row = edited.json() as Row;
    await next(teacher, "submit");
    assert.equal(
      (
        await call(app, owner, "POST", `/local/supply-requests/${row.id}/review`, {
          version: stale,
          action: "CONFIRM",
        })
      ).statusCode,
      409,
    );
    await next(owner, "review", { action: "OUT_OF_STOCK" });
    assert.equal(row.status, "OUT_OF_STOCK");
    assert.equal(
      (
        await call(app, teacher, "POST", `/local/supply-requests/${row.id}/claim`, {
          version: row.version,
        })
      ).statusCode,
      409,
    );
    const replacement = await call(app, teacher, "POST", "/local/supply-requests", {
      catalog: "CLEANING_SET",
      quantity: 1,
      purpose: "DAILY_OPERATION",
    });
    assert.equal(
      replacement.statusCode,
      201,
      "shortage must not permanently block further applications",
    );
    row = replacement.json() as Row;
    await next(teacher, "submit");
    await next(teacher, "cancel");
    assert.equal(row.status, "CANCELLED");
    assert.equal(
      (
        await call(app, owner, "POST", `/local/supply-requests/${row.id}/review`, {
          version: row.version,
          action: "CONFIRM",
        })
      ).statusCode,
      409,
    );
    const audits = await call(app, owner, "GET", "/local/audit");
    assert.equal(audits.statusCode, 200);
    assert.match(audits.body, /supply\.cancel/);
    assert.match(audits.body, /DENIED/);
  } finally {
    await app.close();
  }
});

test("supply role and resource checks reject peers, parents and other scopes", async () => {
  const app = await buildLocalSyntheticServer({ mode: "local-synthetic" });
  try {
    const teacher = await session(app, "teacher-east");
    const row = (
      await call(app, teacher, "POST", "/local/supply-requests", {
        catalog: "FIRST_AID_SET",
        quantity: 1,
        purpose: "EMERGENCY_STOCK",
      })
    ).json() as Row;
    for (const profile of [
      "owner-west",
      "owner-other-tenant",
      "teacher-other-class",
      "teacher-east-peer",
      "parent-alpha",
      "content-editor-east",
      "platform-admin",
    ]) {
      const other = await session(app, profile);
      if (profile.startsWith("owner-") || profile.startsWith("teacher-")) {
        const identity = (await call(app, other, "GET", "/local/session")).json() as {
          actions: string[];
        };
        assert.ok(
          identity.actions.includes("supply:read"),
          "same role must have capability so denial proves resource scope",
        );
        const listed = await call(app, other, "GET", "/local/supply-requests");
        assert.equal(listed.statusCode, 200);
        assert.deepEqual(listed.json(), []);
      }
      assert.equal(
        (await call(app, other, "GET", `/local/supply-requests/${row.id}`)).statusCode,
        403,
        profile,
      );
      assert.equal(
        (
          await call(app, other, "POST", `/local/supply-requests/${row.id}/claim`, {
            version: row.version,
          })
        ).statusCode,
        403,
        profile,
      );
      assert.equal(
        (
          await call(app, other, "POST", `/local/supply-requests/${row.id}/review`, {
            version: row.version,
            action: "CONFIRM",
          })
        ).statusCode,
        403,
        profile,
      );
    }
    assert.equal(
      (
        await call(app, teacher, "POST", `/local/supply-requests/${row.id}/review`, {
          version: row.version,
          action: "CONFIRM",
        })
      ).statusCode,
      403,
    );
    assert.equal(
      (
        await call(app, teacher, "POST", "/local/supply-requests", {
          catalog: "FIRST_AID_SET",
          quantity: 1,
          purpose: "EMERGENCY_STOCK",
          tenantId: "forged",
        })
      ).statusCode,
      400,
    );
  } finally {
    await app.close();
  }
});
