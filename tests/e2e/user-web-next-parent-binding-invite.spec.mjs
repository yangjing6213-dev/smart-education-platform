/* global Buffer, process, URL */

import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { createServer } from "node:http";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  capture,
  clickParentControl,
  evaluate,
  navigate,
  startNextBrowser,
  waitForExpression,
} from "./helpers/user-web-next-browser.mjs";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const evidenceRoot = resolve(
  repositoryRoot,
  process.env.USER_WEB_E2E_ARTIFACT_ROOT ??
    "artifacts/task20-a1-284-guardian-reapply-audit-20261023/followup-nextjs-security-20261023/browser",
);
const studentId = "00000000-0000-4000-8000-0000000000c8";
const applicationId = "00000000-0000-4000-8000-000000000101";
const nextApplicationId = "00000000-0000-4000-8000-000000000112";
const relationshipId = "00000000-0000-4000-8000-000000000111";
const consentId = "00000000-0000-4000-8000-000000000102";
const privacyId = "00000000-0000-4000-8000-000000000103";

async function readBody(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  return chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : undefined;
}

function reply(response, status, body) {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  response.end(JSON.stringify(body));
}

async function createSyntheticApi() {
  let bindingStatus;
  let relationshipStatus;
  let relationshipVersion = 1;
  let consentStatus;
  let privacyStatus;
  let applicationCount = 0;
  let latestApplicationId = null;
  const applications = new Map();
  const requests = [];
  const server = createServer(async (request, response) => {
    try {
      const body = await readBody(request);
      const path = request.url ?? "/";
      const authorization = request.headers.authorization;
      requests.push({ method: request.method, path, authorization, body });
      const parent = authorization === `Bearer ${"p".repeat(43)}`;
      if (path === "/identity/login" && request.method === "POST") {
        if (body?.username !== "parent-demo" || body?.password !== "local-only-password")
          return reply(response, 401, { error: { code: "INVALID_CREDENTIALS" } });
        return reply(response, 200, {
          data: {
            token_type: "Bearer",
            access_token: "p".repeat(43),
            expires_at: "2099-01-01T00:00:00.000Z",
          },
        });
      }
      if (!parent) return reply(response, 401, { error: { code: "UNAUTHENTICATED" } });
      if (path === "/me" && request.method === "GET")
        return reply(response, 200, {
          data: {
            actor_id: "00000000-0000-4000-8000-000000000001",
            display_name: "示例监护人甲",
            memberships: [
              {
                status: "ACTIVE",
                capabilities: ["binding:apply", "binding:read"],
              },
            ],
          },
        });
      if (path === "/parent/student-options" && request.method === "GET")
        return reply(response, 200, {
          data: [{ id: studentId, alias: "student-alpha", label: "示例学生甲" }],
        });
      if (path === "/parent/fees" && request.method === "GET")
        return reply(response, 200, {
          data: {
            bindingApplications: bindingStatus
              ? [
                  {
                    id: applicationId,
                    relationship: "GUARDIAN",
                    studentAlias: "student-alpha",
                    studentLabel: "示例学生甲",
                    status: bindingStatus,
                  },
                ]
              : [],
            documents:
              bindingStatus === "APPROVED" && relationshipStatus === "ACTIVE"
                ? [
                    {
                      id: "fee-item-alpha",
                      version: 1,
                      studentId,
                      studentAlias: "student-alpha",
                      studentLabel: "示例学生甲",
                      documentType: "BILL",
                      title: "合成费用单",
                      period: "2026年10月",
                      amount: 680,
                      currency: "CNY",
                      status: "AVAILABLE",
                      sourceVersion: 1,
                      validFrom: "2026-10-01",
                      validTo: "2026-10-31",
                      available: true,
                      summary: "仅用于本地浏览器验收的合成费用资料。",
                      synthetic: true,
                    },
                  ]
                : [],
            ledger: {
              scope: "parent",
              synthetic: true,
              entries:
                bindingStatus === "APPROVED" && relationshipStatus === "ACTIVE"
                  ? [
                      {
                        id: "ledger-alpha-charge",
                        type: "CHARGE",
                        amountMinor: 68000,
                        currency: "CNY",
                        period: "2026-10",
                        occurredOn: "2026-10-01",
                        documentId: "fee-item-alpha",
                        documentVersion: 1,
                        studentAlias: "student-alpha",
                        studentLabel: "示例学生甲",
                        synthetic: true,
                      },
                    ]
                  : [],
              reconciliation: {
                chargeMinor:
                  bindingStatus === "APPROVED" && relationshipStatus === "ACTIVE" ? 68000 : 0,
                paymentMinor: 0,
                refundMinor: 0,
                balanceDueMinor:
                  bindingStatus === "APPROVED" && relationshipStatus === "ACTIVE" ? 68000 : 0,
                currency: "CNY",
              },
            },
          },
        });
      if (path === "/guardian-binding/applications" && request.method === "POST") {
        bindingStatus = "PENDING";
        applicationCount += 1;
        latestApplicationId = applicationCount === 1 ? applicationId : nextApplicationId;
        applications.set(latestApplicationId, "PENDING");
        return reply(response, 201, {
          data: {
            id: latestApplicationId,
            student_candidate_ref: studentId,
            relationship: "GUARDIAN",
            status: "PENDING",
            version: 1,
            submitted_at:
              applicationCount === 1 ? "2026-10-19T00:00:00.000Z" : "2026-10-20T00:00:00.000Z",
            reviewed_at: null,
          },
          request_id: "00000000-0000-4000-8000-000000000104",
        });
      }
      if (path === "/guardian-binding/applications" && request.method === "GET")
        return reply(response, 200, {
          data: [...applications].map(([id, status], index) => ({
            id,
            student_candidate_ref: studentId,
            relationship: "GUARDIAN",
            status,
            version: status === "PENDING" ? 1 : 2,
            submitted_at: index === 0 ? "2026-10-19T00:00:00.000Z" : "2026-10-20T00:00:00.000Z",
            reviewed_at: status === "APPROVED" ? "2026-10-19T00:01:00.000Z" : null,
          })),
        });
      if (path === "/guardian-relationships" && request.method === "GET")
        return reply(response, 200, {
          data: relationshipStatus
            ? [
                {
                  id: relationshipId,
                  student_id: studentId,
                  relationship: "GUARDIAN",
                  status: relationshipStatus,
                  source_application_id: applicationId,
                  version: relationshipVersion,
                  approved_at: "2026-10-19T00:01:00.000Z",
                },
              ]
            : [],
        });
      if (
        path === `/guardian-relationships/${relationshipId}/release` &&
        request.method === "POST"
      ) {
        assert.equal(relationshipStatus, "ACTIVE");
        assert.deepEqual(body, { version: relationshipVersion });
        relationshipStatus = "RELEASED";
        relationshipVersion += 1;
        return reply(response, 200, {
          data: {
            id: relationshipId,
            student_id: studentId,
            relationship: "GUARDIAN",
            status: "RELEASED",
            source_application_id: applicationId,
            version: relationshipVersion,
            approved_at: "2026-10-19T00:01:00.000Z",
          },
        });
      }
      if (path === "/consent-policies" && request.method === "GET")
        return reply(response, 200, {
          data: ["CARE_RECORD", "HEALTH_SUPPORT", "LEARNING_SUPPORT"].map((key) => ({
            key,
            title: key,
            noticeVersion: `${key}_NOTICE_V1`,
            necessity: "合成用途说明",
            dataClasses: ["合成成长记录"],
            retentionDays: 30,
            retentionNotice: "仅本地演示",
            impactReviewStatus: "DEMO_ONLY_PENDING_HUMAN_REVIEW",
          })),
        });
      if (path === "/consents" && request.method === "GET")
        return reply(response, 200, {
          data: consentStatus
            ? [
                {
                  id: consentId,
                  bindingId: applicationId,
                  version: consentStatus === "ACTIVE" ? 1 : 2,
                  purposeKey: "CARE_RECORD",
                  purposeTitle: "成长记录",
                  noticeVersion: "CARE_RECORD_NOTICE_V1",
                  status: consentStatus,
                  retentionStatus: "WITHIN_PERIOD",
                  retentionDays: 30,
                  retainUntil: "2026-11-18T00:00:00.000Z",
                  retentionOutcomeNotice: null,
                  dataChanged: false,
                },
              ]
            : [],
        });
      if (path === "/consents" && request.method === "POST") {
        consentStatus = "ACTIVE";
        return reply(response, 201, {
          data: {
            id: consentId,
            bindingId: applicationId,
            version: 1,
            purposeKey: "CARE_RECORD",
            purposeTitle: "成长记录",
            noticeVersion: "CARE_RECORD_NOTICE_V1",
            status: consentStatus,
            retentionStatus: "WITHIN_PERIOD",
            retentionDays: 30,
            retainUntil: "2026-11-18T00:00:00.000Z",
            retentionOutcomeNotice: null,
            dataChanged: false,
          },
        });
      }
      if (path === `/consents/${consentId}/revoke` && request.method === "POST") {
        consentStatus = "REVOKED";
        return reply(response, 200, {
          data: {
            id: consentId,
            bindingId: applicationId,
            version: 2,
            purposeKey: "CARE_RECORD",
            purposeTitle: "成长记录",
            noticeVersion: "CARE_RECORD_NOTICE_V1",
            status: consentStatus,
            retentionStatus: "WITHIN_PERIOD",
            retentionDays: 30,
            retainUntil: "2026-11-18T00:00:00.000Z",
            retentionOutcomeNotice: null,
            dataChanged: false,
          },
        });
      }
      if (path === "/privacy-requests" && request.method === "GET")
        return reply(response, 200, {
          data: privacyStatus
            ? [
                {
                  id: privacyId,
                  version: privacyStatus === "SUBMITTED" ? 1 : 2,
                  type: "ACCESS",
                  status: privacyStatus,
                  updatedAt: "2026-10-19T00:00:00.000Z",
                  dataChanged: false,
                },
              ]
            : [],
        });
      if (path === "/privacy-requests" && request.method === "POST") {
        privacyStatus = "SUBMITTED";
        return reply(response, 201, {
          data: {
            id: privacyId,
            version: 1,
            type: "ACCESS",
            status: privacyStatus,
            updatedAt: "2026-10-19T00:00:00.000Z",
            dataChanged: false,
          },
        });
      }
      if (path === `/privacy-requests/${privacyId}/withdraw` && request.method === "POST") {
        privacyStatus = "WITHDRAWN";
        return reply(response, 200, {
          data: {
            id: privacyId,
            version: 2,
            type: "ACCESS",
            status: privacyStatus,
            updatedAt: "2026-10-19T00:01:00.000Z",
            dataChanged: false,
          },
        });
      }
      return reply(response, 404, { error: { code: "NOT_FOUND" } });
    } catch {
      return reply(response, 500, { error: { code: "TEST_SERVER_ERROR" } });
    }
  });
  await new Promise((resolvePromise, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolvePromise);
  });
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  return {
    url: `http://127.0.0.1:${address.port}`,
    requests,
    approve() {
      assert.equal(bindingStatus, "PENDING");
      bindingStatus = "APPROVED";
      applications.set(latestApplicationId, "APPROVED");
      relationshipStatus = "ACTIVE";
    },
    close: () =>
      new Promise((resolvePromise, reject) =>
        server.close((error) => (error ? reject(error) : resolvePromise())),
      ),
  };
}

test("Next parent binding uses invitation login and completes the synthetic parent flow", async (t) => {
  await mkdir(evidenceRoot, { recursive: true });
  const api = await createSyntheticApi();
  const previousApi = process.env.USER_WEB_LOCAL_NEST_API;
  const previousDist = process.env.TASK20_NEXT_DIST_DIR;
  const previousArtifacts = process.env.USER_WEB_E2E_ARTIFACT_ROOT;
  process.env.USER_WEB_LOCAL_NEST_API = api.url;
  process.env.TASK20_NEXT_DIST_DIR =
    process.env.TASK20_NEXT_DIST_DIR ??
    "../../artifacts/task20-a1-284-guardian-reapply-audit-20261023/followup-nextjs-security-20261023/next-user-build";
  process.env.USER_WEB_E2E_ARTIFACT_ROOT = evidenceRoot;
  t.after(async () => {
    if (previousApi === undefined) delete process.env.USER_WEB_LOCAL_NEST_API;
    else process.env.USER_WEB_LOCAL_NEST_API = previousApi;
    if (previousDist === undefined) delete process.env.TASK20_NEXT_DIST_DIR;
    else process.env.TASK20_NEXT_DIST_DIR = previousDist;
    if (previousArtifacts === undefined) delete process.env.USER_WEB_E2E_ARTIFACT_ROOT;
    else process.env.USER_WEB_E2E_ARTIFACT_ROOT = previousArtifacts;
    await api.close();
  });

  const runtime = await startNextBrowser(t, { repositoryRoot, skipLegacyApi: true });
  const browserRequests = [];
  const pageErrors = [];
  const page = await runtime.connectPage((method, params) => {
    if (method === "Network.requestWillBeSent") browserRequests.push(params.request.url);
    if (method === "Runtime.exceptionThrown")
      pageErrors.push(params.exceptionDetails?.text ?? "网页脚本异常");
  });

  await navigate(
    page,
    `${runtime.baseUrl}/web/parent/binding`,
    "document.querySelector('[data-parent-binding-state=ERROR]')",
  );
  assert.ok(await evaluate(page, "Boolean(document.querySelector('[data-parent-binding-login]'))"));
  await clickParentControl(page, "[data-parent-binding-login]");
  await waitForExpression(
    page,
    "document.querySelector('[data-invite-state]')?.dataset.inviteState==='IDLE'",
    "登录页必须可用。",
  );
  await evaluate(
    page,
    `(() => { const set=(selector,value)=>{const el=document.querySelector(selector);const setter=Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el),'value').set;setter.call(el,value);el.dispatchEvent(new Event('input',{bubbles:true}));};set('[name=username]','parent-demo');set('[name=password]','local-only-password');})()`,
  );
  await clickParentControl(page, "[data-invite-submit]");
  await waitForExpression(
    page,
    "document.querySelector('[data-parent-binding-state=READY]')",
    "受邀家长登录后应返回关系绑定页面。",
  );

  await clickParentControl(page, "[data-parent-binding-submit]");
  await waitForExpression(
    page,
    "document.querySelector('[data-binding-status=PENDING]')",
    "关系申请应进入待审核状态。",
  );
  api.approve();
  await clickParentControl(page, "#parent-binding-refresh");
  await waitForExpression(
    page,
    "document.querySelector('[data-binding-status=APPROVED]')",
    "家长刷新后应看到审核通过。",
  );

  await clickParentControl(page, "[data-parent-consent-confirm=CARE_RECORD]");
  await clickParentControl(page, "[data-parent-consent-grant=CARE_RECORD]");
  await waitForExpression(
    page,
    "document.querySelector('[data-parent-consent-key=CARE_RECORD]')?.dataset.consentState==='ACTIVE'",
    "授权状态应更新。",
  );
  await clickParentControl(page, "[data-parent-consent-key=CARE_RECORD] input[type=checkbox]");
  await clickParentControl(page, "[data-parent-consent-key=CARE_RECORD] button");
  await waitForExpression(
    page,
    "document.querySelector('[data-parent-consent-key=CARE_RECORD]')?.dataset.consentState==='INACTIVE'",
    "撤回授权后状态应更新。",
  );
  await clickParentControl(page, "[data-parent-privacy-request=ACCESS]");
  await waitForExpression(
    page,
    "document.querySelector('[data-parent-privacy-type=ACCESS]')?.dataset.requestState==='SUBMITTED'",
    "隐私申请应进入已提交状态。",
  );
  await clickParentControl(page, "[data-parent-privacy-withdraw=ACCESS]");
  await waitForExpression(
    page,
    "document.querySelector('[data-parent-privacy-type=ACCESS]')?.dataset.requestState==='WITHDRAWN'",
    "隐私申请撤回后状态应更新。",
  );

  const cookies = await page.send("Network.getAllCookies");
  const session = cookies.cookies.find((cookie) => cookie.name === "student_care_local_session");
  assert.ok(session?.httpOnly);
  assert.equal(await evaluate(page, "document.cookie"), "");
  assert.equal(await evaluate(page, "localStorage.length + sessionStorage.length"), 0);

  for (const width of [1365, 390, 320]) {
    await page.send("Emulation.setDeviceMetricsOverride", {
      width,
      height: width === 1365 ? 1000 : 900,
      deviceScaleFactor: 1,
      mobile: width !== 1365,
    });
    assert.ok(
      await evaluate(
        page,
        "document.documentElement.scrollWidth<=innerWidth && document.body.scrollWidth<=innerWidth",
      ),
      `家长绑定页面在 ${width}px 不得横向溢出。`,
    );
    if (width === 1365) {
      await evaluate(
        page,
        "document.activeElement instanceof HTMLElement && document.activeElement.blur()",
      );
      await capture(page, join(evidenceRoot, "parent-binding-desktop.png"), true);
    }
  }

  await navigate(
    page,
    `${runtime.baseUrl}/web/parent/fees`,
    "document.querySelector('[data-parent-fees-state]')",
  );
  await waitForExpression(
    page,
    "document.querySelector('[data-parent-fees-state=READY]')?.dataset.parentFeesState==='READY'",
    "审核通过后，家长费用页应显示邀请账号可见的合成资料。",
  );
  assert.ok(
    await evaluate(page, "document.querySelectorAll('[data-parent-fee-document]').length===1"),
  );
  assert.ok(
    await evaluate(page, "document.querySelectorAll('[data-parent-fee-ledger-entry]').length===1"),
  );
  assert.ok(api.requests.some((item) => item.path === "/parent/fees" && item.method === "GET"));
  for (const width of [1365, 390, 320]) {
    await page.send("Emulation.setDeviceMetricsOverride", {
      width,
      height: width === 1365 ? 1000 : 900,
      deviceScaleFactor: 1,
      mobile: width !== 1365,
    });
    assert.ok(
      await evaluate(
        page,
        "document.documentElement.scrollWidth<=innerWidth && document.body.scrollWidth<=innerWidth",
      ),
      `家长费用页在 ${width}px 不得横向溢出。`,
    );
    if (width === 1365) {
      await evaluate(
        page,
        "document.activeElement instanceof HTMLElement && document.activeElement.blur()",
      );
      await capture(page, join(evidenceRoot, "parent-fees-desktop.png"), true);
    }
  }

  await navigate(
    page,
    `${runtime.baseUrl}/web/parent/binding`,
    "document.querySelector('[data-parent-binding-state=READY]')",
  );
  await waitForExpression(
    page,
    "document.querySelector('[data-binding-status=APPROVED]') && document.querySelector('[data-parent-relationship-release-confirm]')",
    "已审核关系应显示解除确认入口。",
  );
  assert.equal(
    await evaluate(
      page,
      "document.querySelector('[data-parent-relationship-release-submit]').disabled",
    ),
    true,
    "未勾选确认前不能解除关系。",
  );
  await clickParentControl(page, "[data-parent-relationship-release-confirm]");
  await clickParentControl(page, "[data-parent-relationship-release-submit]");
  await waitForExpression(
    page,
    "document.querySelector('[data-binding-status=ENDED]') && document.querySelector('[data-parent-relationship-released]')",
    "解除后必须读回已结束状态。",
  );
  assert.equal(
    await evaluate(page, "Boolean(document.querySelector('[data-parent-binding-submit]'))"),
    true,
    "解除关系后应显示重新申请入口。",
  );
  assert.equal(await evaluate(page, "document.querySelector('[data-parent-consent-key]')"), null);
  assert.equal(await evaluate(page, "document.querySelector('[data-parent-privacy-type]')"), null);
  assert.ok(
    api.requests.some(
      (item) =>
        item.path === `/guardian-relationships/${relationshipId}/release` &&
        item.method === "POST" &&
        item.body?.version === 1,
    ),
  );
  for (const width of [1365, 390, 320]) {
    await page.send("Emulation.setDeviceMetricsOverride", {
      width,
      height: width === 1365 ? 1000 : 900,
      deviceScaleFactor: 1,
      mobile: width !== 1365,
    });
    assert.ok(
      await evaluate(
        page,
        "document.documentElement.scrollWidth<=innerWidth && document.body.scrollWidth<=innerWidth",
      ),
      `解除关系页面在 ${width}px 不得横向溢出。`,
    );
    if (width === 1365) {
      await evaluate(
        page,
        "document.activeElement instanceof HTMLElement && document.activeElement.blur()",
      );
      await capture(page, join(evidenceRoot, "parent-binding-released-desktop.png"), true);
    }
  }
  await clickParentControl(page, "[data-parent-binding-submit]");
  await waitForExpression(
    page,
    "document.querySelector('[data-binding-status=PENDING]') && document.querySelector('[data-parent-binding-submit]')===null",
    "重新申请后应显示最新待审状态，并关闭旧授权入口。",
  );
  assert.equal(
    api.requests.filter(
      (item) => item.path === "/guardian-binding/applications" && item.method === "POST",
    ).length,
    2,
  );
  assert.equal(await evaluate(page, "document.querySelector('[data-parent-consent-key]')"), null);
  assert.equal(await evaluate(page, "document.querySelector('[data-parent-privacy-type]')"), null);
  await capture(page, join(evidenceRoot, "parent-binding-reapplication-pending.png"), true);
  assert.deepEqual(pageErrors, []);
  assert.ok(
    browserRequests.every((requestUrl) => new URL(requestUrl).origin === runtime.baseUrl),
    "浏览器不得发出外部请求。",
  );
  assert.ok(api.requests.length > 0);
  assert.ok(
    api.requests.every(
      (request) =>
        request.authorization === undefined || request.authorization.startsWith("Bearer "),
    ),
  );
});
