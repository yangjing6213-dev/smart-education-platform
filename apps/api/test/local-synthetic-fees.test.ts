import assert from "node:assert/strict";
import test from "node:test";
import { FeesService } from "../src/local-synthetic/fees.service.js";
import { LocalRepository } from "../src/local-synthetic/repository.js";
import { buildLocalSyntheticServer } from "../src/local-synthetic/server.js";
import type { LocalMember } from "../src/local-synthetic/sessions.js";

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
  return approved.json() as Json;
}

test("fees are read-only and parent projection is bound to the approved student relationship", async () => {
  const app = await buildLocalSyntheticServer({
    mode: "local-synthetic",
    now: () => Date.parse("2026-10-12T01:00:00.000Z"),
  });
  try {
    const parent = await session(app, "parent-alpha");
    const owner = await session(app, "owner-east");

    assert.deepEqual((await call(app, parent, "GET", "/local/fees")).json(), []);
    const binding = await approveBinding(app, parent, owner);
    const list = await call(app, parent, "GET", "/local/fees");
    assert.equal(list.statusCode, 200, list.body);
    const rows = list.json() as Json[];
    assert.ok(rows.some((row) => row.documentType === "FEE_ITEM" && row.available === true));
    assert.ok(rows.some((row) => row.documentType === "BILL" && row.status === "PAID"));
    assert.ok(rows.some((row) => row.available === false && row.unavailableReason));
    assert.equal(Object.hasOwn(rows[0]!, "tenantId"), false);
    assert.equal(Object.hasOwn(rows[0]!, "content"), false);

    const active = rows.find((row) => row.available === true)!;
    const detail = await call(app, parent, "GET", `/local/fees/${active.id}`);
    assert.equal(detail.statusCode, 200, detail.body);
    const detailValue = detail.json() as Json;
    assert.equal(detailValue.version, active.version);
    assert.equal(detailValue.synthetic, true);
    assert.equal(typeof detailValue.summary, "string");
    assert.equal(Object.hasOwn(detailValue, "tenantId"), false);

    const download = await call(app, parent, "GET", `/local/fees/${active.id}/download`);
    assert.equal(download.statusCode, 200, download.body);
    assert.match(String((download.json() as Json).text), /合成数据/);

    const released = await call(
      app,
      parent,
      "POST",
      `/local/binding-applications/${binding.id}/release`,
      { version: binding.version },
    );
    assert.equal(released.statusCode, 200, released.body);
    assert.deepEqual((await call(app, parent, "GET", "/local/fees")).json(), []);
    assert.equal((await call(app, parent, "GET", `/local/fees/${active.id}`)).statusCode, 403);
    assert.equal(
      (await call(app, parent, "GET", `/local/fees/${active.id}/download`)).statusCode,
      403,
    );
    const rebound = await approveBinding(app, parent, owner);
    assert.notEqual(rebound.id, binding.id);
    assert.deepEqual((await call(app, parent, "GET", "/local/fees")).json(), []);
  } finally {
    await app.close();
  }
});

test("fee summary is campus-scoped and never exposes payment or write actions", async () => {
  const app = await buildLocalSyntheticServer({
    mode: "local-synthetic",
    now: () => Date.parse("2026-10-12T01:00:00.000Z"),
  });
  try {
    const ownerEast = await session(app, "owner-east");
    const ownerWest = await session(app, "owner-west");
    const platform = await session(app, "platform-admin");
    const parent = await session(app, "parent-alpha");
    const east = await call(app, ownerEast, "GET", "/local/fee-summary");
    assert.equal(east.statusCode, 200, east.body);
    const eastValue = east.json() as Json;
    assert.equal(eastValue.synthetic, true);
    assert.equal(eastValue.campusId, undefined);
    assert.equal(typeof eastValue.totalDocuments, "number");
    assert.equal(Object.hasOwn(eastValue, "studentId"), false);
    assert.equal((await call(app, ownerWest, "GET", "/local/fee-summary")).statusCode, 200);
    const anonymous = await call(app, platform, "GET", "/local/fee-summary");
    assert.equal(anonymous.statusCode, 200, anonymous.body);
    assert.equal(Object.hasOwn(anonymous.json() as Json, "amount"), false);
    assert.equal((await call(app, parent, "GET", "/local/fee-summary")).statusCode, 403);
    assert.equal((await call(app, ownerEast, "POST", "/local/fees", {})).statusCode, 404);
    assert.equal((await call(app, ownerEast, "POST", "/local/fee-summary", {})).statusCode, 404);
  } finally {
    await app.close();
  }
});

test("expired and revoked documents with amounts do not increase the campus fee total", () => {
  const repository = new LocalRepository();
  const service = new FeesService(repository, () =>
    Date.parse("2026-10-12T01:00:00.000Z"),
  );
  const source = repository.get("fee-item-alpha");
  assert.ok(source && source.kind === "feeDocument");
  const owner = {
    actorId: "00000000-0000-4000-8000-000000000004",
    profile: "owner-east",
    label: "示例东校区负责人",
    tenantId: source.tenantId,
    campusId: source.campusId,
    classIds: [source.classId],
    actions: ["fees:summary"],
  } satisfies LocalMember;
  const before = service.summary(owner);

  repository.insert({
    ...source,
    id: "expired-fee-with-amount",
    status: "EXPIRED",
    amount: 990,
    validFrom: "2026-08-01",
    validTo: "2026-08-31",
    unavailableReason: "该资料已过期",
  });
  repository.insert({
    ...source,
    id: "revoked-fee-with-amount",
    status: "REVOKED",
    amount: 775,
    validFrom: "2026-09-01",
    validTo: "2026-12-31",
    unavailableReason: "该资料已撤回",
  });

  const after = service.summary(owner);
  assert.ok("amountTotal" in before && "amountTotal" in after);
  assert.equal(after.totalDocuments, before.totalDocuments + 2);
  assert.equal(after.unavailableDocuments, before.unavailableDocuments + 2);
  assert.equal(after.activeDocuments, before.activeDocuments);
  assert.equal(after.amountTotal, before.amountTotal);
});

test("unknown, expired and revoked fee documents fail closed", async () => {
  const app = await buildLocalSyntheticServer({
    mode: "local-synthetic",
    now: () => Date.parse("2026-10-12T01:00:00.000Z"),
  });
  try {
    const parent = await session(app, "parent-alpha");
    const owner = await session(app, "owner-east");
    await approveBinding(app, parent, owner);
    const rows = (await call(app, parent, "GET", "/local/fees")).json() as Json[];
    const unavailable = rows.find((row) => row.available === false)!;
    assert.equal(Object.hasOwn(unavailable, "summary"), false);
    assert.equal(Object.hasOwn(unavailable, "text"), false);
    assert.equal(
      (await call(app, parent, "GET", `/local/fees/${unavailable.id}/download`)).statusCode,
      409,
    );
    assert.equal((await call(app, parent, "GET", "/local/fees/missing-fee")).statusCode, 403);
    assert.equal(
      (await call(app, parent, "GET", `/local/fees/${unavailable.id}?version=1`)).statusCode,
      400,
    );
  } finally {
    await app.close();
  }
});
