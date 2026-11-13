/* global Response, URL */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const consent = await import(new URL("../dist/local-review/consent.js", import.meta.url).href);
const page = await import(new URL("../dist/pages/consent-review.js", import.meta.url).href);
const mainSource = await readFile(new URL("../src/main.ts", import.meta.url), "utf8");

const consentId = "33333333-3333-4333-8333-333333333333";
const expiryId = "55555555-5555-4555-8555-555555555555";
const dueRecord = {
  id: consentId,
  version: 1,
  bindingId: "44444444-4444-4444-8444-444444444444",
  purposeKey: "CARE_RECORD",
  purposeTitle: "成长记录",
  noticeVersion: "CARE_RECORD_NOTICE_V1",
  necessity: "用于查看已审核发布的成长记录摘要。",
  dataClasses: ["成长活动摘要"],
  impactReviewStatus: "DEMO_ONLY_PENDING_HUMAN_REVIEW",
  authorizedByActorId: "actor-secret",
  authorizedAt: "2026-09-01T00:00:00.000Z",
  revokedAt: null,
  retentionDays: 30,
  retainUntil: "2026-10-01T00:00:00.000Z",
  retentionStatus: "REVIEW_DUE",
  retentionOutcomeNotice: null,
  status: "ACTIVE",
  dataChanged: false,
  history: [{ actorId: "actor-secret", action: "GRANT", version: 1 }],
};

function response(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

test("leaving the consent review route clears its confirmation state", () => {
  const start = mainSource.indexOf("const path = window.location.pathname;");
  const end = mainSource.indexOf("const mode = currentViewMode();", start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  assert.match(
    mainSource.slice(start, end),
    /if \(path !== "\/admin\/consent-review"\)\s*\{\s*consentReviewConfirmed = false;\s*consentReviewClient\.disconnect\(\);/u,
  );
});

test("consent review navigation labels the selected synthetic campus", () => {
  const start = mainSource.indexOf("function renderConsentReviewRoute()");
  const end = mainSource.indexOf("function render(): void", start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  assert.match(
    mainSource.slice(start, end),
    /profile === "owner-east" \? "模拟东校区" : "模拟西校区"/u,
  );
});

test("consent review page renders scoped summaries without record or identity identifiers", () => {
  const html = page.renderConsentReviewPage({
    status: "READY",
    profile: "owner-east",
    records: [
      {
        id: consentId,
        purposeKey: "CARE_RECORD",
        purposeTitle: "成长记录",
        noticeVersion: "CARE_RECORD_NOTICE_V1",
        necessity: "用于查看已审核发布的成长记录摘要。",
        dataClasses: ["成长活动摘要"],
        retentionStatus: "REVIEW_DUE",
        retentionDays: 30,
        retainUntil: "2026-10-01T00:00:00.000Z",
        retentionOutcomeNotice: null,
        status: "ACTIVE",
        version: 1,
        dataChanged: false,
      },
    ],
    confirmed: false,
    canReview: true,
    message: "仅显示当前负责人范围内的合成记录。",
  });

  assert.match(html, /当前负责人范围/u);
  assert.match(html, /标记必要保留/u);
  assert.match(html, /期限到期演练/u);
  assert.match(html, /尚未删除任何数据/u);
  assert.match(html, /disabled/u);
  assert.doesNotMatch(html, /actor-secret|33333333|44444444|tenant-|campus-|class-/u);

  const empty = page.renderConsentReviewPage({
    status: "READY",
    profile: "owner-west",
    records: [],
    confirmed: false,
    canReview: true,
    message: "仅显示当前负责人范围内的合成记录。",
  });
  assert.match(empty, /没有同意记录/u);
});

test("read-only and conflict modes do not expose confirmation or review actions", () => {
  const html = page.renderConsentReviewPage({
    status: "READY",
    profile: "owner-east",
    records: [
      {
        id: consentId,
        purposeKey: "CARE_RECORD",
        purposeTitle: "成长记录",
        noticeVersion: "CARE_RECORD_NOTICE_V1",
        necessity: "用于查看已审核发布的成长记录摘要。",
        dataClasses: ["成长活动摘要"],
        retentionStatus: "REVIEW_DUE",
        retentionDays: 30,
        retainUntil: "2026-10-01T00:00:00.000Z",
        retentionOutcomeNotice: null,
        status: "ACTIVE",
        version: 1,
        dataChanged: false,
      },
    ],
    confirmed: true,
    canReview: false,
    message: "仅显示当前负责人范围内的合成记录。",
  });

  assert.doesNotMatch(html, /data-consent-action/u);
  assert.match(html, /data-consent-review-confirm[^>]*disabled/u);
  assert.match(html, /当前模式仅供查看，不允许提交复核/u);

  const start = mainSource.indexOf("function renderConsentReviewRoute()");
  const end = mainSource.indexOf("function render(): void", start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const routeSource = mainSource.slice(start, end);
  assert.match(routeSource, /currentViewMode\(\) === "AUTHORIZED"/u);
  assert.match(routeSource, /if \(!canReview\) return;/u);
  assert.match(routeSource, /consentReviewProfilePath\(selected, window\.location\.search\)/u);

  assert.equal(
    page.consentReviewProfilePath("owner-east", "?mode=readonly&profile=owner-west"),
    "/admin/consent-review?profile=owner-east&mode=readonly",
  );
  assert.equal(
    page.consentReviewProfilePath("owner-west", "?mode=conflict&profile=owner-east"),
    "/admin/consent-review?profile=owner-west&mode=conflict",
  );
});

test("consent review client checks reviewer permission, scope, confirmation and current version", async () => {
  const calls = [];
  const expiryRecord = {
    ...dueRecord,
    id: expiryId,
    purposeKey: "HEALTH_SUPPORT",
    purposeTitle: "健康协助",
  };
  let rows = [dueRecord, expiryRecord];
  const fetcher = async (input, init) => {
    const url = String(input);
    calls.push({ url, init });
    if (url.endsWith("/local/sessions"))
      return response({ handle: "h".repeat(43), profile: "owner-east" }, 201);
    if (url.endsWith("/local/session"))
      return response({
        mode: "local-synthetic",
        profile: "owner-east",
        actions: ["consent:review"],
      });
    if (url.endsWith("/local/consents") && init?.method === "POST") {
      assert.fail("Consent review must not create records");
    }
    if (url.endsWith(`/local/consents/${consentId}/retention-review`)) {
      const body = JSON.parse(String(init.body));
      assert.deepEqual(body, { version: 1, action: "REQUIRED_HOLD" });
      rows[0] = { ...dueRecord, version: 2, retentionStatus: "REQUIRED_HOLD" };
      return response(rows[0]);
    }
    if (url.endsWith(`/local/consents/${expiryId}/retention-review`)) {
      const body = JSON.parse(String(init.body));
      assert.deepEqual(body, { version: 1, action: "SIMULATE_EXPIRY" });
      rows[1] = { ...expiryRecord, version: 2, retentionStatus: "SIMULATED_EXPIRED" };
      return response(rows[1]);
    }
    if (url.endsWith("/local/consents")) return response(rows);
    throw new Error(`Unexpected request ${url}`);
  };
  const client = new consent.ConsentReviewClient({ baseUrl: "http://127.0.0.1:4317", fetcher });
  await client.connect("owner-east");

  assert.equal(client.snapshot.status, "READY");
  assert.equal(
    calls.every((call) => call.init?.redirect === "error"),
    true,
  );
  assert.equal(client.snapshot.records[0]?.authorizedByActorId, undefined);
  assert.equal(client.snapshot.records[0]?.id, consentId);
  await client.review(0, "REQUIRED_HOLD", false);
  assert.equal(
    calls.some((call) => call.url.endsWith("retention-review")),
    false,
  );

  await client.review(0, "REQUIRED_HOLD", true);
  assert.equal(client.snapshot.records[0]?.retentionStatus, "REQUIRED_HOLD");
  assert.equal(client.snapshot.records[0]?.dataChanged, false);
  await client.review(1, "SIMULATE_EXPIRY", true);
  assert.equal(client.snapshot.records[1]?.retentionStatus, "SIMULATED_EXPIRED");
  assert.equal(client.snapshot.records[1]?.dataChanged, false);
});

test("consent review client rejects non-review sessions, unsafe origins and stale actions", async () => {
  assert.throws(
    () => new consent.ConsentReviewClient({ baseUrl: "https://example.com" }),
    /loopback/u,
  );
  const denied = new consent.ConsentReviewClient({
    baseUrl: "http://127.0.0.1:4317",
    fetcher: async (input) =>
      String(input).endsWith("/local/sessions")
        ? response({ handle: "h".repeat(43) }, 201)
        : response({ mode: "local-synthetic", profile: "owner-east", actions: [] }),
  });
  await denied.connect("owner-east");
  assert.equal(denied.snapshot.status, "DENIED");

  const stale = new consent.ConsentReviewClient({
    baseUrl: "http://127.0.0.1:4317",
    fetcher: async (input, init) => {
      const url = String(input);
      if (url.endsWith("/local/sessions")) return response({ handle: "h".repeat(43) }, 201);
      if (url.endsWith("/local/session"))
        return response({
          mode: "local-synthetic",
          profile: "owner-east",
          actions: ["consent:review"],
        });
      if (url.endsWith("/local/consents") && init?.method !== "POST") return response([dueRecord]);
      return response({ error: { code: "STATE_CONFLICT" } }, 409);
    },
  });
  await stale.connect("owner-east");
  await stale.review(0, "SIMULATE_EXPIRY", true);
  assert.equal(stale.snapshot.status, "READY");
  assert.match(stale.snapshot.message, /版本已变化/u);
});

test("consent review rejects missing or unsafe mutation receipts", async () => {
  for (const receipt of [{ dataChanged: true }, {}]) {
    const client = new consent.ConsentReviewClient({
      baseUrl: "http://127.0.0.1:4317",
      fetcher: async (input, init) => {
        const url = String(input);
        if (url.endsWith("/local/sessions"))
          return response({ handle: "h".repeat(43), profile: "owner-east" }, 201);
        if (url.endsWith("/local/session"))
          return response({
            mode: "local-synthetic",
            profile: "owner-east",
            actions: ["consent:review"],
          });
        if (url.endsWith("/retention-review") && init?.method === "POST") return response(receipt);
        if (url.endsWith("/local/consents")) return response([dueRecord]);
        throw new Error(`Unexpected request ${url}`);
      },
    });
    await client.connect("owner-east");
    await client.review(0, "REQUIRED_HOLD", true);

    assert.equal(client.snapshot.status, "READY");
    assert.equal(client.snapshot.records[0]?.retentionStatus, "REVIEW_DUE");
    assert.doesNotMatch(client.snapshot.message, /状态已更新|dataChanged=false/u);
  }
});
