/* global AbortSignal, fetch */
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { browserApiModuleUrl } from "./helpers/release-browser-paths.mjs";
import {
  capture,
  clickParentControl,
  evaluate,
  navigate,
  startNextBrowser,
  waitForExpression,
} from "./helpers/user-web-next-browser.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const { createApiApp } = await import(browserApiModuleUrl(root, "nest/api-app.js"));
const { publicCampusReference } = await import(
  browserApiModuleUrl(root, "nest/public-campus-scope.js")
);
const { InMemoryContentRepository } = await import(
  browserApiModuleUrl(root, "modules/content/content.repository.js")
);
const { InstitutionService } = await import(
  browserApiModuleUrl(root, "modules/institution/institution.service.js")
);
const evidence = resolve(
  root,
  process.env.USER_WEB_E2E_ARTIFACT_ROOT ?? "artifacts/public-content-browser",
);
const evidenceRelative = relative(resolve(root, "artifacts"), evidence);
assert.ok(evidenceRelative && !evidenceRelative.startsWith("..") && !isAbsolute(evidenceRelative));
const tenantId = "00000000-0000-4000-8000-000000000001";
const campusId = "00000000-0000-4000-8000-000000000002";
const otherId = "00000000-0000-4000-8000-000000000009";
const publicRef = "synthetic-public-campus-a1270";

test("published public content works through Nest; drafts, private and other scopes return 404", async (t) => {
  const service = new InstitutionService(new InMemoryContentRepository());
  const owner = {
    trusted: true,
    actorId: "synthetic-owner",
    activeMembership: true,
    scope: { tenantId, campusId },
    capabilities: ["content:write", "content:publish"],
  };
  const payload = {
    title: "合成公开活动",
    type: "HOME_BLOCK",
    visibility: "PUBLIC",
    body: {
      summary: "虚构公开活动简介。",
      blocks: [{ kind: "TEXT", text: "不对应真实儿童或机构。" }],
    },
    editor_note: "EDITOR_NOTE_MUST_STAY_PRIVATE",
  };
  for (const [key, context, visibility, publish] of [
    ["synthetic-public", owner, "PUBLIC", true],
    ["synthetic-draft", owner, "PUBLIC", false],
    ["synthetic-private", owner, "STAFF", true],
    [
      "synthetic-other-campus",
      { ...owner, scope: { tenantId, campusId: otherId } },
      "PUBLIC",
      true,
    ],
    [
      "synthetic-other-tenant",
      { ...owner, scope: { tenantId: otherId, campusId: otherId } },
      "PUBLIC",
      true,
    ],
  ]) {
    assert.equal(service.createHomeDraft(context, key, { ...payload, visibility }).ok, true);
    if (publish) assert.equal(service.publishHome(context, key, 1).ok, true);
  }
  const api = await createApiApp({
    institutionService: service,
    getPublicInstitutionScope: (request, kind) =>
      publicCampusReference(request) === publicRef
        ? kind === "INSTITUTION"
          ? { tenantId }
          : { tenantId, campusId }
        : undefined,
  });
  let closed = false;
  t.after(async () => {
    if (!closed) await api.close();
  });
  await api.listen(0, "127.0.0.1");
  const apiUrl = `http://127.0.0.1:${api.getHttpServer().address().port}`;
  const previousBase = process.env.PUBLIC_API_BASE_URL;
  const previousRef = process.env.PUBLIC_CAMPUS_REF;
  process.env.PUBLIC_API_BASE_URL = apiUrl;
  process.env.PUBLIC_CAMPUS_REF = publicRef;
  let runtime;
  try {
    runtime = await startNextBrowser(t, { repositoryRoot: root, skipLegacyApi: true });
  } finally {
    if (previousBase === undefined) delete process.env.PUBLIC_API_BASE_URL;
    else process.env.PUBLIC_API_BASE_URL = previousBase;
    if (previousRef === undefined) delete process.env.PUBLIC_CAMPUS_REF;
    else process.env.PUBLIC_CAMPUS_REF = previousRef;
  }
  const response = await fetch(runtime.baseUrl + "/visitor");
  assert.equal(response.status, 200);
  const home = await response.text();
  assert.match(home, /了解同芯学园的机构介绍、教育理念与公开服务信息/u);
  assert.doesNotMatch(home, /页面内容均为模拟数据/u);
  assert.match(
    home,
    /一家和别的学习机构不一样、崇尚个性化的学习中心。我们注重培养孩子的学习能力、学习习惯与学习兴趣，做有温度的教育，温暖孩子成长之路。/u,
  );
  assert.match(home, /合成公开活动/);
  assert.doesNotMatch(
    home,
    /synthetic-draft|synthetic-private|synthetic-other-|EDITOR_NOTE_MUST_STAY_PRIVATE/,
  );
  assert.doesNotMatch(home, new RegExp(tenantId + "|" + campusId));
  const institution = await fetch(runtime.baseUrl + "/web/visitor/institution");
  assert.equal(institution.status, 200);
  const institutionBody = await institution.text();
  assert.match(institutionBody, /了解同芯学园的机构介绍、教育理念与公开服务信息/u);
  assert.match(institutionBody, /机构介绍与企业文化采用机构提供的正式资料/u);
  assert.doesNotMatch(institutionBody, /页面中的机构、人员、菜单和流程均为虚构示例/u);
  assert.match(
    institutionBody,
    /一家和别的学习机构不一样、崇尚个性化的学习中心。我们注重培养孩子的学习能力、学习习惯与学习兴趣，做有温度的教育，温暖孩子成长之路。/u,
  );
  assert.match(institutionBody, /做家长最信任的托育平台/u);
  assert.match(institutionBody, /做有温度的教育，温暖孩子成长路。/u);
  assert.match(institutionBody, /让每一个家庭因为我们的存在变得更加幸福和快乐/u);
  assert.match(institutionBody, /向善向上，学生至上/u);
  assert.doesNotMatch(institutionBody, /合成机构资料|模拟数据|暂不可用/u);
  assert.doesNotMatch(institutionBody, /\b1[3-9]\d{9}\b/u);
  assert.doesNotMatch(institutionBody, /EDITOR_NOTE_MUST_STAY_PRIVATE/);

  for (const key of [
    "not-published",
    "synthetic-draft",
    "synthetic-private",
    "synthetic-other-campus",
    "synthetic-other-tenant",
  ]) {
    const apiResponse = await fetch(
      `${apiUrl}/public/institution/home/${key}?public_ref=${publicRef}`,
    );
    assert.equal(apiResponse.status, 404, "The real service must reject the hidden record");
    await apiResponse.body?.cancel();
    const pageResponse = await fetch(runtime.baseUrl + "/visitor/content/" + key);
    assert.equal(pageResponse.status, 404, `${key}: API missing status must reach the page`);
    assert.doesNotMatch(await pageResponse.text(), /合成公开活动|EDITOR_NOTE_MUST_STAY_PRIVATE/);
  }
  const forged = await fetch(
    `${apiUrl}/public/institution/home?public_ref=${publicRef}&campus_id=${otherId}`,
  );
  assert.equal(forged.status, 400);
  await forged.body?.cancel();
  const unknownRef = await fetch(
    `${apiUrl}/public/institution/home?public_ref=unknown-synthetic-ref`,
  );
  assert.equal(unknownRef.status, 403);
  await unknownRef.body?.cancel();

  const errors = [];
  const page = await runtime.connectPage((method) => {
    if (method === "Runtime.exceptionThrown") errors.push(method);
  });
  await mkdir(evidence, { recursive: true });
  await navigate(
    page,
    runtime.baseUrl + "/web/visitor/institution",
    "document.querySelector('[data-official-institution-profile]')",
  );
  const visibleInstitution = await evaluate(
    page,
    "document.querySelector('main')?.innerText ?? ''",
  );
  assert.match(visibleInstitution, /机构介绍/u);
  assert.match(visibleInstitution, /做家长最信任的托育平台/u);
  assert.match(visibleInstitution, /创新协作，修己达人/u);
  assert.doesNotMatch(visibleInstitution, /1[3-9]\d{9}/u);
  await page.send("Emulation.setDeviceMetricsOverride", {
    width: 1365,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await capture(page, resolve(evidence, "institution-official-copy-desktop.png"));
  await page.send("Emulation.setDeviceMetricsOverride", {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: true,
  });
  assert.equal(await evaluate(page, "document.documentElement.scrollWidth <= innerWidth"), true);
  await capture(page, resolve(evidence, "institution-official-copy-mobile.png"));
  await navigate(
    page,
    runtime.baseUrl + "/visitor",
    "document.querySelector('#visitor-home-heading')",
  );
  await clickParentControl(page, "a[href='/visitor/content/synthetic-public']");
  await waitForExpression(
    page,
    "document.querySelector('#visitor-content-heading')?.textContent === '合成公开活动'",
    "Published content must open by clicking its card",
  );
  await page.send("Emulation.setDeviceMetricsOverride", {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: true,
  });
  assert.equal(await evaluate(page, "document.documentElement.scrollWidth <= innerWidth"), true);
  assert.deepEqual(errors, []);
  await mkdir(evidence, { recursive: true });
  await capture(page, resolve(evidence, "published-content-mobile.png"));

  // Withdraw via the real service; a previously published URL must immediately become 404.
  assert.equal(service.unpublishHome(owner, "synthetic-public", 2).ok, true);
  const withdrawn = await fetch(runtime.baseUrl + "/visitor/content/synthetic-public");
  assert.equal(withdrawn.status, 404);
  assert.doesNotMatch(await withdrawn.text(), /合成公开活动/);

  await api.close();
  closed = true;
  const offlineInstitution = await fetch(runtime.baseUrl + "/web/visitor/institution", {
    signal: AbortSignal.timeout(5000),
  });
  assert.equal(offlineInstitution.status, 200);
  assert.match(await offlineInstitution.text(), /做有温度的教育，温暖孩子成长路。/u);
  const offlineHome = await fetch(runtime.baseUrl + "/visitor", {
    signal: AbortSignal.timeout(5000),
  });
  assert.equal(offlineHome.status, 200);
  assert.match(await offlineHome.text(), /崇尚个性化的学习中心/u);
  const unavailable = await fetch(runtime.baseUrl + "/visitor/content/synthetic-public", {
    signal: AbortSignal.timeout(5000),
  });
  assert.equal(unavailable.status, 200, "Service failure must not masquerade as missing content");
  const errorPage = await unavailable.text();
  assert.match(errorPage, /公开机构资料暂时无法读取/);
  assert.doesNotMatch(errorPage, /合成公开活动|EDITOR_NOTE_MUST_STAY_PRIVATE/);
});
