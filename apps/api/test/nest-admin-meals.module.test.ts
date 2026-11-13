import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import test from "node:test";
import type { TrustedAuthResult } from "@student-care/auth";
import { MealService } from "../src/modules/meals/meal.service.js";
import { createApiApp } from "../src/nest/api-app.js";
import { listenOnFetchSafePort } from "./support/fetch-safe-port.js";

const TENANT = "10000000-0000-4000-8000-000000000001";
const CAMPUS = "10000000-0000-4000-8000-000000000002";
const OTHER_CAMPUS = "10000000-0000-4000-8000-000000000003";
const OTHER_TENANT = "10000000-0000-4000-8000-000000000004";
const ACTOR = "10000000-0000-4000-8000-000000000005";
const MEAL = "a0000000-0000-4000-8000-000000000006";
const PAYLOAD = {
  meal_date: "2026-10-22",
  meal_type: "LUNCH",
  items: ["合成主食", "合成蔬菜"],
  notes: "仅用于本地合成验证。",
};

function auth(
  tenantId = TENANT,
  campusIds = [CAMPUS],
  capabilities: TrustedAuthResult["memberships"][number]["capabilities"] = [
    "content:write",
    "content:publish",
  ],
): TrustedAuthResult {
  return {
    trusted: true,
    session: {
      trusted: true,
      status: "ACTIVE",
      actor_id: ACTOR,
      expires_at: "2099-01-01T00:00:00.000Z",
    },
    identity: { actor_id: ACTOR, display_name: "合成餐食负责人" },
    memberships: [{ tenant_id: tenantId, campus_ids: campusIds, status: "ACTIVE", capabilities }],
  };
}

async function startApi(enabled = true) {
  const sessions: Readonly<Record<string, TrustedAuthResult>> = {
    owner: auth(),
    writer: auth(TENANT, [CAMPUS], ["content:write"]),
    reader: auth(TENANT, [CAMPUS], ["identity:read"]),
    west: auth(TENANT, [OTHER_CAMPUS]),
    foreign: auth(OTHER_TENANT, [OTHER_CAMPUS]),
    ambiguous: auth(TENANT, [CAMPUS, OTHER_CAMPUS]),
    split: {
      ...auth(),
      memberships: [
        {
          tenant_id: TENANT,
          campus_ids: [CAMPUS],
          status: "ACTIVE",
          capabilities: ["content:write"],
        },
        {
          tenant_id: TENANT,
          campus_ids: [OTHER_CAMPUS],
          status: "ACTIVE",
          capabilities: ["content:publish"],
        },
      ],
    },
  };
  const app = await createApiApp({
    ...(enabled ? { mealService: new MealService() } : {}),
    getTrustedAuthResult: (request) => {
      const authorization = request.headers.authorization;
      return typeof authorization === "string" ? sessions[authorization.slice(7)] : undefined;
    },
    getPublicMealScope: () => ({ tenantId: TENANT, campusId: CAMPUS }),
  });
  await listenOnFetchSafePort((port) => app.listen(port, "127.0.0.1"));
  const address = app.getHttpServer().address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${address.port}`;
  return {
    close: () => app.close(),
    async request(
      path: string,
      token = "owner",
      method = "GET",
      body?: unknown,
      extraHeaders = {},
    ) {
      const response = await fetch(baseUrl + path, {
        method,
        headers: {
          ...(token ? { authorization: `Bearer ${token}` } : {}),
          ...(body === undefined ? {} : { "content-type": "application/json" }),
          ...extraHeaders,
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      return { status: response.status, body: (await response.json()) as Record<string, unknown> };
    },
  };
}

test("Nest admin meals saves versioned drafts and publishes only public menu fields", async () => {
  const api = await startApi();
  try {
    const initial = await api.request("/admin/meals");
    assert.equal(initial.status, 200);
    assert.deepEqual(initial.body.data, []);
    const created = await api.request(`/admin/meals/${MEAL.toUpperCase()}/draft`, "owner", "POST", {
      payload: PAYLOAD,
    });
    assert.equal(created.status, 201);
    const draft = created.body.data as Record<string, unknown>;
    assert.equal(draft.id, MEAL);
    assert.equal(draft.status, "DRAFT");
    assert.equal(draft.version, 1);
    assert.deepEqual(Object.keys(draft).sort(), [
      "actions",
      "id",
      "items",
      "meal_date",
      "meal_type",
      "notes",
      "published_at",
      "status",
      "updated_at",
      "version",
    ]);
    assert.deepEqual(draft.actions, ["edit", "publish"]);
    const updated = await api.request(`/admin/meals/${MEAL}/draft`, "owner", "PUT", {
      payload: { ...PAYLOAD, items: ["更新后的合成主食"] },
      expected_version: 1,
    });
    assert.equal(updated.status, 200);
    assert.equal((updated.body.data as Record<string, unknown>).version, 2);
    const stale = await api.request(`/admin/meals/${MEAL}/publish`, "owner", "POST", {
      expected_version: 1,
    });
    assert.equal(stale.status, 409);
    assert.equal((stale.body.error as Record<string, unknown>).code, "VERSION_MISMATCH");
    const published = await api.request(`/admin/meals/${MEAL}/publish`, "owner", "POST", {
      expected_version: 2,
    });
    assert.equal(published.status, 200);
    assert.equal((published.body.data as Record<string, unknown>).status, "PUBLISHED");
    const publicRows = await api.request("/public/meals?date=2026-10-22", "");
    assert.equal(publicRows.status, 200);
    const publicMeal = (publicRows.body.data as Record<string, unknown>[])[0]!;
    assert.deepEqual(publicMeal.items, ["更新后的合成主食"]);
    assert.deepEqual(Object.keys(publicMeal).sort(), [
      "id",
      "items",
      "meal_date",
      "meal_type",
      "notes",
      "published_at",
    ]);
    const withdrawn = await api.request(`/admin/meals/${MEAL}/unpublish`, "owner", "POST", {
      expected_version: 3,
    });
    assert.equal(withdrawn.status, 200);
    assert.equal((withdrawn.body.data as Record<string, unknown>).version, 4);
    assert.deepEqual((await api.request("/public/meals?date=2026-10-22", "")).body.data, []);
  } finally {
    await api.close();
  }
});

test("published meals require explicit withdrawal before draft editing", async () => {
  const api = await startApi();
  try {
    assert.equal(
      (await api.request(`/admin/meals/${MEAL}/draft`, "owner", "POST", { payload: PAYLOAD }))
        .status,
      201,
    );
    assert.equal(
      (await api.request(`/admin/meals/${MEAL}/publish`, "owner", "POST", { expected_version: 1 }))
        .status,
      200,
    );
    const edit = await api.request(`/admin/meals/${MEAL}/draft`, "writer", "PUT", {
      payload: PAYLOAD,
      expected_version: 2,
    });
    assert.equal(edit.status, 409);
    assert.equal((edit.body.error as Record<string, unknown>).code, "CONFLICT_STATE");
    assert.equal(
      ((await api.request("/public/meals?date=2026-10-22", "")).body.data as unknown[]).length,
      1,
    );
    assert.equal(
      (
        await api.request(`/admin/meals/${MEAL}/unpublish`, "writer", "POST", {
          expected_version: 2,
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await api.request(`/admin/meals/${MEAL}/unpublish`, "owner", "POST", {
          expected_version: 2,
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await api.request(`/admin/meals/${MEAL}/draft`, "writer", "PUT", {
          payload: PAYLOAD,
          expected_version: 3,
        })
      ).status,
      200,
    );
  } finally {
    await api.close();
  }
});

test("Nest admin meals rejects unauthenticated, ambiguous and insufficient scopes", async () => {
  const api = await startApi();
  try {
    assert.equal((await api.request("/admin/meals", "")).status, 401);
    assert.equal((await api.request("/admin/meals", "reader")).status, 403);
    assert.equal((await api.request("/admin/meals", "ambiguous")).status, 403);
    assert.equal((await api.request("/admin/meals", "split")).status, 403);
    assert.equal(
      (await api.request(`/admin/meals/${MEAL}/publish`, "split", "POST", { expected_version: 1 }))
        .status,
      403,
    );
    assert.equal((await api.request("/admin/meals?tenant_id=forged")).status, 400);
    assert.equal(
      (
        await api.request("/admin/meals", "owner", "GET", undefined, {
          "x-campus-id": OTHER_CAMPUS,
        })
      ).status,
      400,
    );
    assert.equal(
      (await api.request("/admin/meals", "owner", "GET", undefined, { "x-actor-id": ACTOR }))
        .status,
      401,
    );
    assert.equal(
      (await api.request(`/admin/meals/${MEAL}/draft`, "writer", "POST", { payload: PAYLOAD }))
        .status,
      201,
    );
    assert.equal(
      (await api.request(`/admin/meals/${MEAL}/publish`, "writer", "POST", { expected_version: 1 }))
        .status,
      403,
    );
  } finally {
    await api.close();
  }
});

test("Nest admin meals never exposes a meal across campus or tenant scope", async () => {
  const api = await startApi();
  try {
    assert.equal(
      (await api.request(`/admin/meals/${MEAL}/draft`, "owner", "POST", { payload: PAYLOAD }))
        .status,
      201,
    );
    for (const token of ["west", "foreign"]) {
      const rows = await api.request("/admin/meals", token);
      assert.equal(rows.status, 200);
      assert.deepEqual(rows.body.data, []);
      assert.equal(
        (await api.request(`/admin/meals/${MEAL}/publish`, token, "POST", { expected_version: 1 }))
          .status,
        404,
      );
    }
  } finally {
    await api.close();
  }
});

test("Nest admin meals rejects unsupported fields and invalid versions before changes", async () => {
  const api = await startApi();
  try {
    const path = `/admin/meals/${MEAL}/draft`;
    assert.equal(
      (
        await api.request(path, "owner", "POST", {
          payload: { ...PAYLOAD, private_notes: "hidden" },
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await api.request(path, "owner", "POST", {
          payload: { ...PAYLOAD, meal_date: "2026-02-30" },
        })
      ).status,
      400,
    );
    assert.equal(
      (await api.request(path, "owner", "POST", { payload: PAYLOAD, tenant_id: TENANT })).status,
      400,
    );
    assert.equal(
      (await api.request("/admin/meals/not-a-uuid/draft", "owner", "POST", { payload: PAYLOAD }))
        .status,
      400,
    );
    assert.equal((await api.request(path, "owner", "POST", { payload: PAYLOAD })).status, 201);
    for (const version of [0, -1, 1.5, "1"]) {
      assert.equal(
        (
          await api.request(`/admin/meals/${MEAL}/publish`, "owner", "POST", {
            expected_version: version,
          })
        ).status,
        400,
      );
    }
    const current = (await api.request("/admin/meals")).body.data as Record<string, unknown>[];
    assert.equal(current[0]?.version, 1);
  } finally {
    await api.close();
  }
});

test("Nest admin meal routes are absent without an explicitly supplied operations provider", async () => {
  const api = await startApi(false);
  try {
    assert.equal((await api.request("/admin/meals")).status, 404);
  } finally {
    await api.close();
  }
});
