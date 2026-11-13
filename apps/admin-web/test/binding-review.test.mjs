/* global Response, URL */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { AdminBindingReviewClient } from "../dist/local-review/binding-review.js";
import { renderAdminBindingReview } from "../dist/pages/binding-review.js";

const mainSource = await readFile(new URL("../src/main.ts", import.meta.url), "utf8");
const browserTestSource = await readFile(
  new URL("./binding-review-browser.mjs", import.meta.url),
  "utf8",
);
const relationId = "11111111-1111-4111-8111-111111111111";
const studentId = "22222222-2222-4222-8222-222222222222";
const reviewerId = "33333333-3333-4333-8333-333333333333";
const reviewAt = "2026-10-14T01:30:00.000Z";
const relation = {
  id: relationId,
  version: 1,
  status: "PENDING",
  relationship: "GUARDIAN",
  studentId,
  studentAlias: "student-alpha",
  studentLabel: "示例学生甲",
  classLabel: "示例三年级甲班",
  campusLabel: "示例东校区",
  guardianLabel: "模拟家长甲",
};

function response(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function createFetcher(profile = "owner-east", options = {}) {
  const calls = [];
  let rows = options.rows ?? [relation];
  let audits = options.audits ?? [];
  const fetcher = async (input, init = {}) => {
    const url = new URL(typeof input === "string" ? input : input.href);
    const method = init.method ?? "GET";
    calls.push({ url, method, init });
    if (url.pathname === "/local/sessions") return response({ handle: "h".repeat(43) }, 201);
    if (url.pathname === "/local/session")
      return response({
        mode: "local-synthetic",
        profile,
        actorId: reviewerId,
        actions: options.actions ?? ["binding:review", "audit:read"],
      });
    if (url.pathname === "/local/binding-applications" && method === "GET") return response(rows);
    if (url.pathname === "/local/audit" && method === "GET") return response(audits);
    if (url.pathname === `/local/binding-applications/${relationId}/review` && method === "POST") {
      const body = JSON.parse(String(init.body));
      if (options.reviewStatus === 409) return response({ error: { code: "STATE_CONFLICT" } }, 409);
      rows = [
        { ...relation, version: 2, status: body.action === "approve" ? "APPROVED" : "REJECTED" },
      ];
      audits = [
        {
          actorId: reviewerId,
          objectId: relationId,
          version: 2,
          action: `binding.${body.action}`,
          outcome: "ACCEPTED",
          at: reviewAt,
        },
      ];
      return response(rows[0]);
    }
    throw new Error(`Unexpected request ${url}`);
  };
  return { fetcher, calls };
}

test("binding review has a reachable management route and clears session state on exit", () => {
  assert.match(mainSource, /\["\/admin\/binding-review", "家长关系审核"\]/u);
  assert.match(mainSource, /path === "\/admin\/binding-review"/u);
  assert.match(mainSource, /bindingReviewClient\.disconnect\(\)/u);
});

test("browser flow owns a disposable 4319 service and closes it", () => {
  assert.match(browserTestSource, /LOCAL_SYNTHETIC_API_SERVER_MODULE/u);
  assert.match(browserTestSource, /apiPort = 4319/u);
  assert.match(browserTestSource, /localApi\.start\(apiPort\)/u);
  assert.match(browserTestSource, /localApi\.close\(\)/u);
  assert.doesNotMatch(browserTestSource, /LOCAL_API_BASE_URL/u);
  assert.match(browserTestSource, /crossCampusReview\.response\.status, 403/u);
  assert.match(browserTestSource, /route\.replace\("owner-east", "owner-west"\)/u);
  assert.match(browserTestSource, /westCampusPendingQueueEmpty/u);
  assert.ok(
    browserTestSource.indexOf('route.replace("owner-east", "owner-west")') <
      browserTestSource.indexOf('await page.goto(route, { waitUntil: "networkidle" })'),
  );
});

test("campus reviewer sees scoped synthetic labels without identifiers", async () => {
  const { fetcher, calls } = createFetcher();
  const client = new AdminBindingReviewClient({ baseUrl: "http://127.0.0.1:4317", fetcher });
  await client.connect("owner-east");

  assert.equal(client.snapshot.status, "READY");
  assert.equal(client.snapshot.records[0]?.studentLabel, "示例学生甲");
  assert.equal(client.snapshot.records[0]?.guardianLabel, "模拟家长甲");
  const html = renderAdminBindingReview({ ...client.snapshot, confirmed: false });
  assert.match(html, /示例东校区/u);
  assert.match(html, /模拟家长甲/u);
  assert.match(html, /示例学生甲/u);
  assert.match(html, /data-binding-review-confirm/u);
  assert.doesNotMatch(html, /11111111|22222222|student-alpha|campus-[a-z]+/u);
  assert.equal(
    calls.every(({ url }) => url.origin === "http://127.0.0.1:4317"),
    true,
  );
  assert.equal(
    calls.every(({ url }) => url.pathname.startsWith("/local/")),
    true,
  );
  assert.equal(
    calls.every(({ init }) => init.redirect === "error"),
    true,
  );
});

test("review page shows matched synthetic action and time without exposing identifiers or inventing a note", async () => {
  const audit = {
    actorId: reviewerId,
    objectId: relationId,
    version: 2,
    action: "binding.approve",
    outcome: "ACCEPTED",
    at: reviewAt,
  };
  const { fetcher, calls } = createFetcher("owner-east", {
    rows: [{ ...relation, version: 2, status: "APPROVED" }],
    audits: [audit],
  });
  const client = new AdminBindingReviewClient({ baseUrl: "http://127.0.0.1:4317", fetcher });
  await client.connect("owner-east");

  assert.equal(client.snapshot.auditAvailable, true);
  assert.deepEqual(client.snapshot.audit, [
    { objectId: relationId, version: 2, action: "approve", at: reviewAt },
  ]);
  assert.ok(calls.some(({ url }) => url.pathname === "/local/audit"));
  const html = renderAdminBindingReview({ ...client.snapshot, confirmed: false });
  assert.match(html, /本机模拟审核角色/u);
  assert.match(html, /关系已确认/u);
  assert.match(html, /2026/u);
  assert.match(html, /不记录审核说明/u);
  assert.doesNotMatch(html, /11111111|22222222|33333333|student-alpha/u);
});

test("missing audit permission keeps the scoped relation queue and does not request audit data", async () => {
  const { fetcher, calls } = createFetcher("owner-east", { actions: ["binding:review"] });
  const client = new AdminBindingReviewClient({ baseUrl: "http://127.0.0.1:4317", fetcher });
  await client.connect("owner-east");

  assert.equal(client.snapshot.status, "READY");
  assert.equal(client.snapshot.records.length, 1);
  assert.equal(client.snapshot.auditAvailable, false);
  assert.equal(calls.some(({ url }) => url.pathname === "/local/audit"), false);
});

test("approval and rejection require confirmation and send the current version", async () => {
  for (const action of ["approve", "reject"]) {
    const { fetcher, calls } = createFetcher();
    const client = new AdminBindingReviewClient({ baseUrl: "http://127.0.0.1:4317", fetcher });
    await client.connect("owner-east");
    await client.review(0, action, false);
    assert.equal(
      calls.some(({ url }) => url.pathname.endsWith("/review")),
      false,
    );

    await client.review(0, action, true);
    const reviewCall = calls.find(({ url }) => url.pathname.endsWith("/review"));
    assert.ok(reviewCall);
    assert.deepEqual(JSON.parse(String(reviewCall.init.body)), { version: 1, action });
    assert.equal(
      client.snapshot.records[0]?.status,
      action === "approve" ? "APPROVED" : "REJECTED",
    );
  }
});

test("permission denial and stale review fail closed", async () => {
  const denied = createFetcher("owner-east", { actions: [] });
  const deniedClient = new AdminBindingReviewClient({
    baseUrl: "http://127.0.0.1:4317",
    fetcher: denied.fetcher,
  });
  await deniedClient.connect("owner-east");
  assert.equal(deniedClient.snapshot.status, "DENIED");
  assert.equal(deniedClient.snapshot.records.length, 0);

  const stale = createFetcher("owner-east", { reviewStatus: 409 });
  const staleClient = new AdminBindingReviewClient({
    baseUrl: "http://127.0.0.1:4317",
    fetcher: stale.fetcher,
  });
  await staleClient.connect("owner-east");
  await staleClient.review(0, "approve", true);
  assert.equal(staleClient.snapshot.records[0]?.status, "PENDING");
  assert.match(staleClient.snapshot.message, /申请状态已变化/u);
});

test("a response containing another campus is hidden instead of rendered", async () => {
  const leaked = createFetcher("owner-west", { rows: [relation] });
  const client = new AdminBindingReviewClient({
    baseUrl: "http://127.0.0.1:4317",
    fetcher: leaked.fetcher,
  });
  await client.connect("owner-west");
  assert.equal(client.snapshot.status, "ERROR");
  assert.equal(client.snapshot.records.length, 0);
  assert.doesNotMatch(
    renderAdminBindingReview({ ...client.snapshot, confirmed: false }),
    /示例学生甲/u,
  );
});

test("renderer escapes labels and only offers actions for pending records", () => {
  const html = renderAdminBindingReview({
    status: "READY",
    profile: "owner-east",
    records: [
      { ...relation, guardianLabel: "<script>alert(1)</script>" },
      { ...relation, id: "33333333-3333-4333-8333-333333333333", status: "APPROVED" },
    ],
    auditAvailable: true,
    audit: [],
    message: "当前范围内的模拟数据。",
    canReview: true,
    confirmed: true,
  });
  assert.doesNotMatch(html, /<script>/u);
  assert.match(html, /&lt;script&gt;/u);
  assert.equal((html.match(/data-binding-action=/gu) ?? []).length, 2);
  assert.match(html, /已确认关系/u);
});

test("client rejects non-loopback origins and mismatched reviewer sessions", async () => {
  assert.throws(
    () => new AdminBindingReviewClient({ baseUrl: "https://example.com" }),
    /loopback/u,
  );
  const mismatch = createFetcher("owner-west");
  const client = new AdminBindingReviewClient({
    baseUrl: "http://127.0.0.1:4317",
    fetcher: mismatch.fetcher,
  });
  await client.connect("owner-east");
  assert.equal(client.snapshot.status, "ERROR");
  assert.equal(client.snapshot.records.length, 0);
});
