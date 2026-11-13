import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { URL } from "node:url";

const mainSource = await readFile(new URL("../src/main.ts", import.meta.url), "utf8");

const requestId = "33333333-3333-4333-8333-333333333333";
const request = {
  id: requestId,
  version: 1,
  type: "ACCESS",
  status: "SUBMITTED",
  createdAt: "2026-10-08T01:00:00.000Z",
  updatedAt: "2026-10-08T01:00:00.000Z",
  dataChanged: false,
};
const apiRequest = {
  ...request,
  bindingId: "22222222-2222-4222-8222-222222222222",
  tenantId: "private-tenant",
  campusId: "private-campus",
  classId: "private-class",
  requestedBy: "private-actor",
  history: [{ actorId: "private-actor", action: "SUBMIT" }],
};

function response(body, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

test("privacy review page exposes only scoped synthetic request actions", () => {
  return import("../dist/pages/privacy-requests.js").then(({ renderPrivacyRequestsPage }) => {
    const html = renderPrivacyRequestsPage({
      profile: "owner-east",
      rows: [request],
      canAct: true,
      busy: false,
      message: "仅显示当前负责范围内的合成申请。",
    });

    assert.match(html, /个人信息申请/u);
    assert.match(html, /开始处理/u);
    assert.match(html, /示例东校区负责人/u);
    assert.doesNotMatch(html, /student-alpha|示例学生|tenant-|campus-|requestedBy|<textarea/u);
  });
});

test("read-only reviewer cannot start or complete a request", () => {
  return import("../dist/pages/privacy-requests.js").then(({ renderPrivacyRequestsPage }) => {
    const html = renderPrivacyRequestsPage({
      profile: "owner-west",
      rows: [{ ...request, status: "IN_REVIEW" }],
      canAct: false,
      busy: false,
      message: "当前为只读查看。",
    });

    assert.match(html, /只读/u);
    assert.doesNotMatch(html, /data-privacy-action=/u);
  });
});

test("review client uses only the selected synthetic profile and current request version", async () => {
  const { PrivacyRequestReviewClient } = await import("../dist/local-review/privacy-requests.js");
  let row = { ...request };
  const calls = [];
  const fetcher = async (input, init) => {
    const url = new URL(input);
    calls.push({ url, init });
    if (url.pathname === "/local/sessions") return response({ handle: "h".repeat(43) }, 201);
    if (url.pathname === "/local/session")
      return response({
        mode: "local-synthetic",
        profile: "owner-east",
        actions: ["privacy:review"],
      });
    if (url.pathname.endsWith("/review") && init?.method === "POST") {
      row = {
        ...row,
        version: row.version + 1,
        status: JSON.parse(init.body).action === "START" ? "IN_REVIEW" : "SIMULATED_COMPLETE",
        updatedAt: "2026-10-08T02:00:00.000Z",
      };
      return response(row);
    }
    if (url.pathname === "/local/privacy-requests") return response([{ ...apiRequest, ...row }]);
    throw new Error(`Unexpected request: ${url.pathname}`);
  };
  const client = new PrivacyRequestReviewClient({ baseUrl: "http://127.0.0.1:4317", fetcher });

  await client.connect("owner-east");
  assert.equal(client.snapshot.status, "READY");
  assert.equal(client.snapshot.requests[0]?.status, "SUBMITTED");
  await client.review(0, "START");

  const reviewCall = calls.find(
    ({ url, init }) => url.pathname.endsWith("/review") && init?.method === "POST",
  );
  assert.ok(reviewCall);
  assert.equal(reviewCall.url.pathname, `/local/privacy-requests/${requestId}/review`);
  assert.deepEqual(JSON.parse(reviewCall.init.body), { version: 1, action: "START" });
  assert.equal(reviewCall.init.headers.get("Authorization"), `Bearer ${"h".repeat(43)}`);
  assert.equal(client.snapshot.requests[0]?.status, "IN_REVIEW");
  assert.equal(client.snapshot.requests[0]?.dataChanged, false);
  assert.equal(Object.hasOwn(client.snapshot.requests[0] ?? {}, "requestedBy"), false);
  assert.equal(
    JSON.stringify(calls.map(({ url, init }) => ({ url: url.href, body: init?.body }))).includes(
      "tenantId",
    ),
    false,
  );
});

test("review client denies missing permission and rejects student identity in a response", async () => {
  const { PrivacyRequestReviewClient } = await import("../dist/local-review/privacy-requests.js");
  const denied = new PrivacyRequestReviewClient({
    fetcher: async (input) => {
      const url = new URL(input);
      if (url.pathname === "/local/sessions") return response({ handle: "d".repeat(43) }, 201);
      if (url.pathname === "/local/session")
        return response({
          mode: "local-synthetic",
          profile: "owner-east",
          actions: ["consent:review"],
        });
      throw new Error(`Unexpected request: ${url.pathname}`);
    },
  });
  await denied.connect("owner-east");
  assert.equal(denied.snapshot.status, "DENIED");
  assert.deepEqual(denied.snapshot.requests, []);

  const unsafe = new PrivacyRequestReviewClient({
    fetcher: async (input) => {
      const url = new URL(input);
      if (url.pathname === "/local/sessions") return response({ handle: "u".repeat(43) }, 201);
      if (url.pathname === "/local/session")
        return response({
          mode: "local-synthetic",
          profile: "owner-east",
          actions: ["privacy:review"],
        });
      if (url.pathname === "/local/privacy-requests")
        return response([{ ...apiRequest, studentLabel: "不应出现的学生信息" }]);
      throw new Error(`Unexpected request: ${url.pathname}`);
    },
  });
  await unsafe.connect("owner-east");
  assert.equal(unsafe.snapshot.status, "ERROR");
  assert.deepEqual(unsafe.snapshot.requests, []);
});

test("admin navigation and route expose the privacy request queue", () => {
  assert.equal(mainSource.includes('["/admin/privacy-requests", "隐私申请审核"]'), true);
  assert.equal(mainSource.includes('path === "/admin/privacy-requests"'), true);
});
