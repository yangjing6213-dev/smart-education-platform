import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  ParentConsentClient,
  ParentInviteConsentClient,
  renderParentConsentPage,
} from "./parent-consent.js";

const recordId = "11111111-1111-4111-8111-111111111111";
const bindingId = "22222222-2222-4222-8222-222222222222";
const studentId = "33333333-3333-4333-8333-333333333333";
const relationshipId = "44444444-4444-4444-8444-444444444444";
const nextBindingId = "55555555-5555-4555-8555-555555555555";
const requestId = "66666666-6666-4666-8666-666666666666";
const mainSource = await readFile(new URL("../../src/main.ts", import.meta.url), "utf8");
const localProxySource = await readFile(
  new URL("../../src/app/local/[...path]/handler.ts", import.meta.url),
  "utf8",
);
const baseRecord = {
  id: recordId,
  version: 1,
  bindingId,
  purposeKey: "CARE_RECORD",
  purposeTitle: "成长记录",
  noticeVersion: "CARE_RECORD_NOTICE_V1",
  necessity: "用于查看经审核发布的成长记录摘要。",
  dataClasses: ["成长活动摘要"],
  impactReviewStatus: "DEMO_ONLY_PENDING_HUMAN_REVIEW",
  authorizedByActorId: "actor-secret",
  authorizedAt: "2026-10-08T00:00:00.000Z",
  revokedAt: null,
  retentionDays: 30,
  retainUntil: "2026-11-07T00:00:00.000Z",
  retentionStatus: "WITHIN_PERIOD",
  retentionOutcomeNotice: null,
  status: "ACTIVE",
  dataChanged: false,
  history: [{ actorId: "actor-secret", action: "GRANT", version: 1 }],
};

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

test("parent consent page keeps grant unavailable until a guardian binding is approved", () => {
  const html = renderParentConsentPage({
    status: "READY",
    bindingStatus: "PENDING",
    policies: [],
    consents: [],
    privacyRequests: [],
    message: "关系申请已提交，等待员工审核。",
  });

  assert.match(html, /关系申请已提交/u);
  assert.match(html, /本机合成演示/u);
  assert.doesNotMatch(html, /确认并授权|撤回授权/u);
});

test("released invitation relationship can be reapplied and the newest pending application wins", async () => {
  const applications: Record<string, unknown>[] = [
    {
      id: bindingId,
      version: 2,
      status: "APPROVED",
      relationship: "GUARDIAN",
      student_candidate_ref: studentId,
      studentAlias: "student-alpha",
      submitted_at: "2026-10-20T09:00:00.000Z",
      reviewed_at: "2026-10-20T09:05:00.000Z",
    },
  ];
  const relationships = [
    {
      id: relationshipId,
      student_id: studentId,
      relationship: "GUARDIAN",
      status: "RELEASED",
      source_application_id: bindingId,
      version: 2,
      approved_at: "2026-10-20T09:05:00.000Z",
    },
  ];
  const calls: Array<{ url: string; method: string }> = [];
  const fetcher: typeof fetch = async (input, init) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    calls.push({ url, method });
    if (url.endsWith("/api-local/me"))
      return response({
        data: {
          memberships: [{ status: "ACTIVE", capabilities: ["binding:apply", "binding:read"] }],
        },
      });
    if (url.endsWith("/api-local/guardian-binding/applications") && method === "POST") {
      applications.push({
        id: nextBindingId,
        version: 1,
        status: "PENDING",
        relationship: "GUARDIAN",
        student_candidate_ref: studentId,
        studentAlias: "student-alpha",
        submitted_at: "2026-10-21T09:00:00.000Z",
        reviewed_at: null,
      });
      return response(
        {
          request_id: requestId,
          data: {
            id: nextBindingId,
            student_candidate_ref: studentId,
            relationship: "GUARDIAN",
            status: "PENDING",
            version: 1,
            submitted_at: "2026-10-21T09:00:00.000Z",
            reviewed_at: null,
          },
        },
        201,
      );
    }
    if (url.endsWith("/api-local/guardian-binding/applications"))
      return response({ data: applications });
    if (url.endsWith("/api-local/parent/student-options"))
      return response({ data: [{ id: studentId, alias: "student-alpha" }] });
    if (url.endsWith("/api-local/consent-policies"))
      return response({
        data: ["CARE_RECORD", "HEALTH_SUPPORT", "LEARNING_SUPPORT"].map((key) => ({
          key,
          title: key,
          noticeVersion: `${key}_NOTICE_V1`,
          necessity: "合成用途说明",
          dataClasses: ["合成摘要"],
          retentionDays: 30,
          retentionNotice: "仅本地演示",
          impactReviewStatus: "DEMO_ONLY_PENDING_HUMAN_REVIEW",
        })),
      });
    if (url.endsWith("/api-local/guardian-relationships")) return response({ data: relationships });
    throw new Error(`Unexpected request ${url}`);
  };
  const client = new ParentInviteConsentClient({
    baseUrl: "http://127.0.0.1:4317",
    fetcher,
  });

  await client.connect();
  assert.equal(client.snapshot.bindingStatus, "ENDED");
  assert.equal(client.snapshot.relationship?.status, "RELEASED");
  await client.applyBinding();

  assert.equal(client.snapshot.status, "READY");
  assert.equal(client.snapshot.bindingStatus, "PENDING");
  assert.equal(client.snapshot.relationship, null);
  assert.ok(calls.some((call) => call.method === "POST" && call.url.endsWith("/applications")));
  assert.equal(
    calls.some((call) => call.url.endsWith("/api-local/consents")),
    false,
  );
});

test("approved guardian can find fixed personal-information request choices", () => {
  const html = renderParentConsentPage({
    status: "READY",
    bindingStatus: "APPROVED",
    policies: [],
    consents: [],
    privacyRequests: [],
    message: "已连接。",
  });

  assert.match(html, /个人信息申请/u);
  assert.match(html, /data-parent-privacy-form/u);
  for (const type of ["ACCESS", "CORRECT", "COPY", "DELETE"])
    assert.match(html, new RegExp(`value="${type}"`, "u"));
  assert.doesNotMatch(html, /<textarea|name="details"/u);
});

test("approved guardian sees only request summary and can withdraw open requests", () => {
  const html = renderParentConsentPage({
    status: "READY",
    bindingStatus: "APPROVED",
    policies: [],
    consents: [],
    privacyRequests: [
      {
        id: recordId,
        version: 1,
        type: "COPY",
        status: "SUBMITTED",
        updatedAt: "2026-10-08T01:00:00.000Z",
        dataChanged: false,
      },
    ],
    message: "申请已提交。",
  });

  assert.match(html, /获取资料副本/u);
  assert.match(html, /等待负责人查看/u);
  assert.match(html, /data-parent-privacy-withdraw="0"/u);
  assert.doesNotMatch(html, /11111111|tenant-|campus-|class-|requestedBy/u);
});

test("completed privacy request explains that no real data was accessed or changed", () => {
  const html = renderParentConsentPage({
    status: "READY",
    bindingStatus: "APPROVED",
    policies: [],
    consents: [],
    privacyRequests: [
      {
        id: recordId,
        version: 3,
        type: "DELETE",
        status: "SIMULATED_COMPLETE",
        updatedAt: "2026-10-08T02:00:00.000Z",
        dataChanged: false,
      },
    ],
    message: "已完成。",
  });

  assert.match(html, /本机处理演示已完成/u);
  assert.match(html, /没有访问、复制、更正或删除真实资料/u);
  assert.match(html, /dataChanged=false/u);
  assert.doesNotMatch(html, /data-parent-privacy-withdraw/u);
});

test("user web navigation exposes the parent service page entry", () => {
  assert.equal(mainSource.includes('<a href="/web/parent/binding">家长服务</a>'), true);
});

test("parent consent uses the preview page origin for the local service proxy", () => {
  assert.match(
    mainSource,
    /new ParentConsentClient\(\{\s*baseUrl: window\.location\.origin,?\s*\}\)/u,
  );
});

test("same-origin local proxy forwards only the fixed guardian-binding path to Nest loopback", () => {
  assert.match(localProxySource, /path === "guardian-binding\/applications"/u);
  assert.match(localProxySource, /http:\/\/127\.0\.0\.1:4321/u);
  assert.match(localProxySource, /guardianBindingPath\s*\?\s*`\//u);
});

test("approved guardian can open the parent fee page while pending relations cannot", () => {
  const approved = renderParentConsentPage({
    status: "READY",
    bindingStatus: "APPROVED",
    policies: [],
    consents: [],
    privacyRequests: [],
    message: "已连接。",
  });
  const pending = renderParentConsentPage({
    status: "READY",
    bindingStatus: "PENDING",
    policies: [],
    consents: [],
    privacyRequests: [],
    message: "等待审核。",
  });

  assert.equal(approved.includes('href="/web/parent/home"'), true);
  assert.equal(pending.includes('href="/web/parent/home"'), false);
});

test("parent fee page has a reachable application route", () => {
  assert.equal(mainSource.includes('window.location.pathname === "/web/parent/home"'), true);
  assert.equal(mainSource.includes("renderParentFeesRoute()"), true);
});

test("parent privacy request form is connected to submit and withdraw actions", () => {
  assert.equal(mainSource.includes("[data-parent-privacy-form]"), true);
  assert.equal(mainSource.includes("parentConsentClient.submitPrivacyRequest"), true);
  assert.equal(mainSource.includes("parentConsentClient.withdrawPrivacyRequest"), true);
});

test("parent consent page exposes fixed notices but never renders internal identifiers", () => {
  const html = renderParentConsentPage({
    status: "READY",
    bindingStatus: "APPROVED",
    policies: [
      {
        key: "CARE_RECORD",
        title: "成长记录",
        noticeVersion: "CARE_RECORD_NOTICE_V1",
        necessity: "用于查看经审核发布的成长记录摘要。",
        dataClasses: ["成长活动摘要"],
        retentionDays: 30,
        retentionNotice: "演示期限 30 天；实际期限须由机构与专业人员确认。",
      },
    ],
    consents: [
      {
        id: recordId,
        bindingId,
        purposeKey: "CARE_RECORD",
        purposeTitle: "成长记录",
        noticeVersion: "CARE_RECORD_NOTICE_V1",
        version: 1,
        status: "ACTIVE",
        retentionStatus: "WITHIN_PERIOD",
        retentionDays: 30,
        retainUntil: "2026-11-07T00:00:00.000Z",
        retentionOutcomeNotice: null,
        dataChanged: false,
      },
    ],
    privacyRequests: [],
    message: "已连接。",
  });

  assert.match(html, /CARE_RECORD_NOTICE_V1/u);
  assert.match(html, /成长活动摘要/u);
  assert.match(html, /撤回授权/u);
  assert.doesNotMatch(html, /actor-secret|11111111|22222222|tenant-|campus-|class-/u);
});

test("parent client ignores approved relations and consent records for another synthetic student", async () => {
  const otherBindingId = "33333333-3333-4333-8333-333333333333";
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const fetcher: typeof fetch = async (input, init) => {
    const url = String(input);
    calls.push({ url, ...(init === undefined ? {} : { init }) });
    if (url.endsWith("/local/sessions")) return response({ handle: "h".repeat(43) }, 201);
    if (url.endsWith("/local/session"))
      return response({
        mode: "local-synthetic",
        profile: "parent-alpha",
        actions: ["binding:apply", "consent:manage", "privacy:request"],
      });
    if (url.endsWith("/local/binding-applications"))
      return response([
        {
          id: otherBindingId,
          status: "APPROVED",
          relationship: "GUARDIAN",
          studentAlias: "student-beta",
          studentLabel: "模拟学生乙",
        },
      ]);
    if (url.endsWith("/local/consent-policies"))
      return response([
        {
          key: "CARE_RECORD",
          title: "成长记录",
          noticeVersion: "CARE_RECORD_NOTICE_V1",
          necessity: "用于查看成长记录。",
          dataClasses: ["成长摘要"],
          retentionDays: 30,
          retentionNotice: "仅演示。",
          impactReviewStatus: "DEMO_ONLY_PENDING_HUMAN_REVIEW",
        },
        {
          key: "HEALTH_SUPPORT",
          title: "健康协助",
          noticeVersion: "HEALTH_SUPPORT_NOTICE_V1",
          necessity: "用于查看健康事项。",
          dataClasses: ["健康摘要"],
          retentionDays: 14,
          retentionNotice: "仅演示。",
          impactReviewStatus: "DEMO_ONLY_PENDING_HUMAN_REVIEW",
        },
        {
          key: "LEARNING_SUPPORT",
          title: "学习支持",
          noticeVersion: "LEARNING_SUPPORT_NOTICE_V1",
          necessity: "用于学习支持。",
          dataClasses: ["学习摘要"],
          retentionDays: 7,
          retentionNotice: "仅演示。",
          impactReviewStatus: "DEMO_ONLY_PENDING_HUMAN_REVIEW",
        },
      ]);
    if (url.endsWith("/local/consents"))
      return response([{ ...baseRecord, bindingId: otherBindingId }]);
    throw new Error(`Unexpected request ${url}`);
  };
  const client = new ParentConsentClient({
    baseUrl: "http://127.0.0.1:4317",
    fetcher,
  });

  await client.connect();
  assert.equal(
    calls.every((call) => call.init?.redirect === "error"),
    true,
  );
  await client.grant("CARE_RECORD", true);

  assert.equal(client.snapshot.bindingStatus, "NONE");
  assert.deepEqual(client.snapshot.consents, []);
  assert.equal(
    calls.some((call) => call.url.endsWith("/local/consents") && call.init?.method === "POST"),
    false,
  );
});

test("parent client submits a fixed relation request and requires explicit confirmation to grant", async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const candidateId = "33333333-3333-4333-8333-333333333333";
  let bindingRows: unknown[] = [];
  let consentRows: unknown[] = [];
  let bindingReceiptOverride: unknown = null;
  let mutationReceiptOverride: unknown = null;
  const fetcher: typeof fetch = async (input, init) => {
    const url = String(input);
    calls.push({ url, ...(init === undefined ? {} : { init }) });
    if (url.endsWith("/local/sessions"))
      return response({ handle: "h".repeat(43), profile: "parent-alpha" }, 201);
    if (url.endsWith("/local/session"))
      return response({
        mode: "local-synthetic",
        profile: "parent-alpha",
        actions: ["binding:apply", "consent:manage", "privacy:request"],
      });
    if (url.endsWith("/local/student-options"))
      return response([
        {
          id: candidateId,
          alias: "student-alpha",
          label: "模拟学生甲",
          campusId: "campus-synthetic-east",
          classId: "class-synthetic-grade3-a",
        },
      ]);
    if (url.endsWith("/local/binding-applications") && init?.method === "POST") {
      assert.deepEqual(JSON.parse(String(init.body)), {
        student: "student-alpha",
        relationship: "GUARDIAN",
      });
      if (bindingReceiptOverride !== null) return response(bindingReceiptOverride, 201);
      bindingRows = [
        {
          id: bindingId,
          version: 1,
          status: "PENDING",
          relationship: "GUARDIAN",
          studentId: candidateId,
          studentAlias: "student-alpha",
          studentLabel: "模拟学生甲",
        },
      ];
      return response(
        {
          id: bindingId,
          studentId: candidateId,
          studentAlias: "student-alpha",
          relationship: "GUARDIAN",
          status: "PENDING",
          version: 1,
        },
        201,
      );
    }
    if (url.endsWith("/local/binding-applications")) return response(bindingRows);
    if (url.endsWith("/local/consent-policies"))
      return response([
        {
          key: "CARE_RECORD",
          title: "成长记录",
          noticeVersion: "CARE_RECORD_NOTICE_V1",
          necessity: "用于查看经审核发布的成长记录摘要。",
          dataClasses: ["成长活动摘要"],
          retentionDays: 30,
          retentionNotice: "演示期限 30 天；实际期限须确认。",
          impactReviewStatus: "DEMO_ONLY_PENDING_HUMAN_REVIEW",
        },
        {
          key: "HEALTH_SUPPORT",
          title: "健康协助",
          noticeVersion: "HEALTH_SUPPORT_NOTICE_V1",
          necessity: "用于演示监护人知情后接收健康事项摘要。",
          dataClasses: ["健康事项摘要"],
          retentionDays: 14,
          retentionNotice: "演示期限 14 天；实际期限须确认。",
          impactReviewStatus: "DEMO_ONLY_PENDING_HUMAN_REVIEW",
        },
        {
          key: "LEARNING_SUPPORT",
          title: "学习支持",
          noticeVersion: "LEARNING_SUPPORT_NOTICE_V1",
          necessity: "用于演示固定题目的学习支持。",
          dataClasses: ["学习参与摘要"],
          retentionDays: 7,
          retentionNotice: "演示期限 7 天；实际期限须确认。",
          impactReviewStatus: "DEMO_ONLY_PENDING_HUMAN_REVIEW",
        },
      ]);
    if (url.endsWith("/local/consents") && init?.method === "POST") {
      const body = JSON.parse(String(init.body)) as { confirmed: boolean };
      assert.equal(body.confirmed, true);
      consentRows = [baseRecord];
      return response(baseRecord, 201);
    }
    if (url.endsWith("/local/consents")) return response(consentRows);
    if (url.endsWith("/local/privacy-requests")) return response([]);
    if (url.endsWith(`/local/consents/${recordId}/revoke`)) {
      if (mutationReceiptOverride !== null) return response(mutationReceiptOverride);
      consentRows = [{ ...baseRecord, version: 2, status: "REVOKED" }];
      return response(consentRows[0]);
    }
    throw new Error(`Unexpected request ${url}`);
  };
  const client = new ParentConsentClient({
    baseUrl: "http://127.0.0.1:4317",
    fetcher,
  });
  await client.connect();
  assert.equal(client.snapshot.bindingStatus, "NONE");

  for (const invalidReceipt of [{}, { data: { id: "not-a-uuid" } }]) {
    bindingReceiptOverride = invalidReceipt;
    await client.applyBinding();
    assert.equal(client.snapshot.bindingStatus, "NONE");
    assert.doesNotMatch(client.snapshot.message, /关系申请已提交/u);
  }
  bindingReceiptOverride = null;
  await client.applyBinding();
  assert.equal(client.snapshot.bindingStatus, "PENDING");
  assert.equal(
    calls.some(
      (call) => call.url.endsWith("/local/binding-applications") && call.init?.method === "POST",
    ),
    true,
  );
  assert.equal(
    calls.some((call) => call.url.endsWith("/local/consents") && call.init?.method === "POST"),
    false,
  );

  bindingRows = [{ ...(bindingRows[0] as object), status: "APPROVED" }];
  await client.refresh();
  assert.equal(client.snapshot.bindingStatus, "APPROVED");
  await client.grant("CARE_RECORD", false);
  assert.equal(
    calls.some((call) => call.url.endsWith("/local/consents") && call.init?.method === "POST"),
    false,
  );

  await client.grant("CARE_RECORD", true);
  assert.equal(client.snapshot.consents[0]?.status, "ACTIVE");
  assert.equal(client.snapshot.consents[0]?.dataChanged, false);
  assert.equal(Object.hasOwn(client.snapshot.consents[0] ?? {}, "authorizedByActorId"), false);

  await client.revoke(0, false);
  assert.equal(
    calls.some((call) => call.url.endsWith(`/local/consents/${recordId}/revoke`)),
    false,
  );

  for (const invalidReceipt of [{ dataChanged: true }, {}]) {
    mutationReceiptOverride = invalidReceipt;
    await client.revoke(0, true);
    assert.equal(client.snapshot.consents[0]?.status, "ACTIVE");
    assert.doesNotMatch(client.snapshot.message, /状态已更新|dataChanged=false/u);
  }

  mutationReceiptOverride = null;
  await client.revoke(0, true);
  assert.equal(client.snapshot.consents[0]?.status, "REVOKED");
});

test("parent client fails closed for non-loopback API addresses and unavailable service", async () => {
  assert.throws(() => new ParentConsentClient({ baseUrl: "https://example.com" }), /loopback/u);
  const client = new ParentConsentClient({
    baseUrl: "http://127.0.0.1:4317",
    fetcher: async () => {
      throw new Error("offline");
    },
  });
  await client.connect();
  assert.equal(client.snapshot.status, "ERROR");
  assert.match(client.snapshot.message, /本机服务/u);
});

test("parent submits only a fixed privacy request and can withdraw it", async () => {
  const requestId = "44444444-4444-4444-8444-444444444444";
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  let requests: unknown[] = [];
  const fetcher: typeof fetch = async (input, init) => {
    const url = String(input);
    calls.push({ url, ...(init === undefined ? {} : { init }) });
    if (url.endsWith("/local/sessions")) return response({ handle: "h".repeat(43) }, 201);
    if (url.endsWith("/local/session"))
      return response({
        mode: "local-synthetic",
        profile: "parent-alpha",
        actions: ["binding:apply", "consent:manage", "privacy:request"],
      });
    if (url.endsWith("/local/binding-applications"))
      return response([
        {
          id: bindingId,
          version: 1,
          status: "APPROVED",
          relationship: "GUARDIAN",
          studentAlias: "student-alpha",
          studentLabel: "模拟学生甲",
        },
      ]);
    if (url.endsWith("/local/consent-policies"))
      return response([
        {
          key: "CARE_RECORD",
          title: "成长记录",
          noticeVersion: "CARE_RECORD_NOTICE_V1",
          necessity: "用于查看成长记录摘要。",
          dataClasses: ["成长摘要"],
          retentionDays: 30,
          retentionNotice: "仅演示。",
          impactReviewStatus: "DEMO_ONLY_PENDING_HUMAN_REVIEW",
        },
        {
          key: "HEALTH_SUPPORT",
          title: "健康协助",
          noticeVersion: "HEALTH_SUPPORT_NOTICE_V1",
          necessity: "用于查看健康事项摘要。",
          dataClasses: ["健康摘要"],
          retentionDays: 14,
          retentionNotice: "仅演示。",
          impactReviewStatus: "DEMO_ONLY_PENDING_HUMAN_REVIEW",
        },
        {
          key: "LEARNING_SUPPORT",
          title: "学习支持",
          noticeVersion: "LEARNING_SUPPORT_NOTICE_V1",
          necessity: "用于查看学习支持摘要。",
          dataClasses: ["学习摘要"],
          retentionDays: 7,
          retentionNotice: "仅演示。",
          impactReviewStatus: "DEMO_ONLY_PENDING_HUMAN_REVIEW",
        },
      ]);
    if (url.endsWith("/local/consents")) return response([]);
    if (url.endsWith("/local/privacy-requests") && init?.method === "POST") {
      const body = JSON.parse(String(init.body)) as Record<string, unknown>;
      assert.deepEqual(body, { bindingId, type: "COPY" });
      requests = [
        {
          id: requestId,
          version: 1,
          type: "COPY",
          status: "SUBMITTED",
          bindingId,
          requestedBy: "private-actor",
          tenantId: "private-tenant",
          campusId: "private-campus",
          classId: "private-class",
          createdAt: "2026-10-08T01:00:00.000Z",
          updatedAt: "2026-10-08T01:00:00.000Z",
          dataChanged: false,
          history: [],
        },
      ];
      return response(requests[0], 201);
    }
    if (url.endsWith(`/local/privacy-requests/${requestId}/withdraw`)) {
      requests = [
        {
          ...(requests[0] as object),
          version: 2,
          status: "WITHDRAWN",
          updatedAt: "2026-10-08T02:00:00.000Z",
        },
      ];
      return response(requests[0]);
    }
    if (url.endsWith("/local/privacy-requests")) return response(requests);
    throw new Error(`Unexpected request ${url}`);
  };
  const client = new ParentConsentClient({
    baseUrl: "http://127.0.0.1:4317",
    fetcher,
  });

  await client.connect();
  await client.submitPrivacyRequest("COPY");
  assert.equal(client.snapshot.privacyRequests[0]?.status, "SUBMITTED");
  assert.equal(client.snapshot.privacyRequests[0]?.dataChanged, false);
  assert.equal(Object.hasOwn(client.snapshot.privacyRequests[0] ?? {}, "requestedBy"), false);
  await client.withdrawPrivacyRequest(0);

  const post = calls.find(
    ({ url, init }) => url.endsWith("/local/privacy-requests") && init?.method === "POST",
  );
  const withdraw = calls.find(
    ({ url, init }) => url.endsWith("/withdraw") && init?.method === "POST",
  );
  assert.ok(post);
  assert.ok(withdraw);
  assert.deepEqual(JSON.parse(String(withdraw.init?.body)), { version: 1 });
  assert.equal(client.snapshot.privacyRequests[0]?.status, "WITHDRAWN");
  assert.equal(client.snapshot.privacyRequests[0]?.dataChanged, false);
});
