/* global Request */
import assert from "node:assert/strict";
import { GET, POST } from "../../apps/user-web/src/app/api-local/[...path]/handler.ts";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import process from "node:process";
import { fileURLToPath, URL } from "node:url";
import { browserApiModuleUrl } from "./helpers/release-browser-paths.mjs";
import {
  capture,
  clickParentControl,
  evaluate,
  navigate,
  startNextBrowser,
  waitForExpression,
} from "./helpers/user-web-next-browser.mjs";
import { projectIdentity } from "../../apps/user-web/dist/local-synthetic/invite-session.js";

const identity = (capabilities, status = "ACTIVE") => ({
  actor_id: "00000000-0000-4000-8000-000000000001",
  display_name: "合成员工",
  memberships: [{ status, capabilities }],
});
test("invited staff can reach both library routes only with active library access", () => {
  const urls = projectIdentity(identity(["task:read", "library:read"])).services.map((s) => s.href);
  for (const path of ["/web/staff/resources", "/web/staff/guides"]) {
    assert.ok(urls.includes(path), path);
    assert.ok(!projectIdentity(identity(["task:read"])).services.some((s) => s.href === path));
  }
  assert.throws(() => projectIdentity(identity(["library:read"], "SUSPENDED")));
});

test("library proxy accepts only explicit routes and never forwards client scope or arbitrary mutation fields", async () => {
  const rootPath = ["staff", "library", "resources"];
  const path = [...rootPath, randomUUID(), "favorite"];
  const origin = "http://127.0.0.1:3000";
  const ctx = (path) => ({ params: Promise.resolve({ path }) });
  const environment = process.env.USER_WEB_LOCAL_NEST_API;
  process.env.USER_WEB_LOCAL_NEST_API = "http://127.0.0.1:1";
  try {
    const request = (parts, init = {}) =>
      new Request(origin + "/api-local/" + parts.join("/"), init);
    assert.equal((await GET(request(rootPath), ctx(rootPath))).status, 401);
    assert.equal(
      (await GET(request(rootPath, { headers: { "x-campus-id": "untrusted" } }), ctx(rootPath)))
        .status,
      400,
    );
    const guideMutation = ["staff", "library", "guides", path[3], "favorite"];
    const payload = {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin,
        cookie: "student_care_local_session=" + "s".repeat(43),
      },
      body: JSON.stringify({ version: 1, favorite: true, scope: "CLASS" }),
    };
    assert.equal((await POST(request(guideMutation, payload), ctx(guideMutation))).status, 404);
    assert.equal((await POST(request(path, payload), ctx(path))).status, 400);
  } finally {
    if (environment === undefined) delete process.env.USER_WEB_LOCAL_NEST_API;
    else process.env.USER_WEB_LOCAL_NEST_API = environment;
  }
});

const root = fileURLToPath(new URL("../..", import.meta.url));
const makeItem = (kind, title, others = {}) => ({
  id: randomUUID(),
  kind,
  title,
  summary: "合成资料摘要",
  category: "备课",
  grade: "二年级",
  subject: "数学",
  tags: ["课前准备"],
  scope: "CAMPUS",
  expiresOn: "2099-12-31",
  version: 1,
  favorite: false,
  lastUsedAt: null,
  body: "合成正文：" + title,
  ...others,
});

test(
  "invited employee opens resources and guides from workbench, reads, filters, saves and recovers",
  { timeout: 180000 },
  async (t) => {
    const { createApiApp } = await import(browserApiModuleUrl(root, "nest/api-app.js"));
    const { InviteAuthService, createInvitePasswordHash } = await import(
      browserApiModuleUrl(root, "nest/invite-auth.service.js")
    );
    const account = "library.synthetic",
      password = randomUUID() + "!Aa";
    // Use the existing synthetic workbench's assigned teacher and campus.
    const actor = "00000000-0000-4000-8000-000000000003",
      tenant = "00000000-0000-4000-8000-000000000064",
      campus = "00000000-0000-4000-8000-000000000065";
    const resource = makeItem("RESOURCE", "合成数学教案");
    const guide = makeItem("GUIDE", "合成交接指引", {
      category: "交接",
      grade: "",
      subject: "",
      tags: ["入职"],
    });
    const rows = [
      resource,
      makeItem("RESOURCE", "合成阅读教案", {
        grade: "一年级",
        subject: "语文",
        category: "阅读",
        tags: ["朗读"],
      }),
      guide,
    ];
    const writes = [];
    let failOnce = false,
      empty = false;
    const browser = await startNextBrowser(t, {
      repositoryRoot: root,
      startInviteApi: async (legacy) => {
        const inviteAuthService = new InviteAuthService([
          {
            username: account,
            password_hash: await createInvitePasswordHash(password),
            identity: { actor_id: actor, display_name: "合成员工" },
            memberships: [
              {
                tenant_id: tenant,
                campus_ids: [campus],
                status: "ACTIVE",
                capabilities: ["identity:read", "memberships:read", "task:read", "library:read"],
              },
            ],
          },
        ]);
        function assertScope(context) {
          assert.deepEqual(
            [context.actorId, context.tenantId, context.campusId],
            [actor, tenant, campus],
          );
        }
        const api = await createApiApp({
          inviteAuthService,
          staffTaskWorkbenchOperations: legacy.staffTaskWorkbenchOperations,
          staffLibraryOperations: {
            async list(ctx, kind) {
              assertScope(ctx);
              return {
                items: empty
                  ? []
                  : rows
                      .filter((row) => row.kind === kind)
                      .map((row) => ({ ...row, internal: "MUST_BE_REMOVED" })),
              };
            },
            async detail(ctx, kind, id) {
              assertScope(ctx);
              const row = rows.find((candidate) => candidate.id === id && candidate.kind === kind);
              assert.ok(row);
              return { ...row, internal: "MUST_BE_REMOVED" };
            },
            async favorite(ctx, id, version, favorite) {
              assertScope(ctx);
              assert.equal(id, resource.id);
              assert.equal(version, 1);
              resource.favorite = favorite;
              writes.push("favorite");
              return { id, version };
            },
            async use(ctx, id, version) {
              assertScope(ctx);
              assert.equal(id, resource.id);
              assert.equal(version, 1);
              resource.lastUsedAt = new Date().toISOString();
              writes.push("use");
              return { id, version };
            },
          },
        });
        api.use((req, res, next) => {
          if (failOnce && req.url.startsWith("/staff/library/")) {
            failOnce = false;
            res.status(503).json({ error: { code: "TEST_UNAVAILABLE" } });
            return;
          }
          next();
        });
        t.after(() => api.close());
        await api.listen(0, "127.0.0.1");
        return api.getUrl();
      },
    });
    const errors = [],
      external = [],
      failedResponses = [];
    let signedIn = false;
    const page = await browser.connectPage((method, params) => {
      if (method === "Runtime.exceptionThrown") errors.push(params.exceptionDetails.text);
      if (method === "Network.responseReceived" && params.response.status >= 400) {
        const { status, url } = params.response;
        const path = new URL(url).pathname;
        const expectedAnonymous =
          !signedIn &&
          status === 401 &&
          ["/api-local/me", "/api-local/staff/library/resources"].includes(path);
        const expectedFault = status === 503 && path === "/api-local/staff/library/guides";
        if (!(expectedAnonymous || expectedFault)) failedResponses.push({ status, path });
      }
      if (
        method === "Network.requestWillBeSent" &&
        /^https?:/u.test(params.request.url) &&
        new URL(params.request.url).origin !== browser.baseUrl
      )
        external.push(new URL(params.request.url).origin);
    });
    const contains = (text) =>
      "document.querySelector('main')?.innerText.includes(" + JSON.stringify(text) + ")";
    const wait = async (expr) => waitForExpression(page, expr, "未满足页面条件：" + expr);
    const click = async (selector) => {
      await wait(
        "document.querySelector(" +
          JSON.stringify(selector) +
          ") && !document.querySelector(" +
          JSON.stringify(selector) +
          ").disabled",
      );
      await clickParentControl(page, selector);
    };
    async function button(label) {
      const target = JSON.stringify(label);
      await wait(
        "[...document.querySelectorAll('main button')].some(b=>b.textContent===" +
          target +
          "&&!b.disabled)",
      );
      await evaluate(
        page,
        "(()=>{document.querySelector('[data-e2e-click]')?.removeAttribute('data-e2e-click');[...document.querySelectorAll('main button')].find(b=>b.textContent===" +
          target +
          "&&!b.disabled).setAttribute('data-e2e-click','');})()",
      );
      await click("[data-e2e-click]");
    }
    async function filter(label, value) {
      const target = JSON.stringify(label),
        order = await evaluate(
          page,
          "[...document.querySelectorAll('select')].findIndex(s=>s.closest('label').firstChild.textContent===" +
            target +
            ")",
        );
      assert.ok(order >= 0, label);
      const selector = "select";
      const query = "document.querySelectorAll(" + JSON.stringify(selector) + ")[" + order + "]";
      await evaluate(page, query + ".focus()");
      await page.send("Input.dispatchKeyEvent", {
        type: "keyDown",
        key: "Home",
        windowsVirtualKeyCode: 36,
      });
      const index = await evaluate(
        page,
        "Array.from(" + query + ".options).findIndex(o=>o.value===" + JSON.stringify(value) + ")",
      );
      assert.ok(index >= 0, "选项必须存在：" + value);
      for (let i = 0; i < index; i++)
        await page.send("Input.dispatchKeyEvent", {
          type: "keyDown",
          key: "ArrowDown",
          windowsVirtualKeyCode: 40,
        });
      await page.send("Input.dispatchKeyEvent", {
        type: "keyUp",
        key: "ArrowDown",
        windowsVirtualKeyCode: 40,
      });
      await wait(query + ".value===" + JSON.stringify(value));
    }
    async function type(selector, value) {
      await click(selector);
      await page.send("Input.insertText", { text: value });
    }
    const shots = resolve(root, "artifacts/rc-a1611/run/browser");
    await mkdir(shots, { recursive: true });
    async function layouts(prefix) {
      for (const width of [320, 390, 1280]) {
        await page.send("Emulation.setDeviceMetricsOverride", {
          width,
          height: 900,
          mobile: false,
          deviceScaleFactor: 1,
        });
        assert.ok(
          await evaluate(page, "document.documentElement.scrollWidth<=innerWidth"),
          prefix + " " + width + " 不能横向溢出",
        );
        await evaluate(page, "window.scrollTo({top:0,behavior:'instant'})");
        await capture(page, resolve(shots, prefix + "-" + width + ".png"), true);
      }
    }
    await navigate(
      page,
      browser.baseUrl + "/web/staff/resources",
      contains("请使用受邀员工账号登录"),
    );
    await navigate(
      page,
      browser.baseUrl + "/web/login",
      "document.querySelector('#invite-username') && !document.querySelector('#invite-username').disabled",
    );
    await type("#invite-username", account);
    await type("#invite-password", password);
    await click("[data-invite-submit]");
    await click('[data-invite-service][href="/web/staff/workbench"]');
    signedIn = true;
    await click('main section a[href="/web/staff/resources"]');
    await wait(contains("合成数学教案"));
    await wait("document.querySelector('nav[aria-label=员工服务] a[href*=guides]')");
    assert.deepEqual(
      await evaluate(
        page,
        "Array.from(document.querySelectorAll('nav[aria-label=员工服务] a'), link => link.pathname)",
      ),
      ["/web/staff/resources", "/web/staff/guides"],
    );
    await layouts("next-staff-resources");
    const projected = await evaluate(
      page,
      "(async()=>{const res=await fetch('/api-local/staff/library/resources');return res.json()})()",
    );
    assert.ok(
      projected.data.items.length === 2 &&
        projected.data.items.every((item) => !("internal" in item) && !("body" in item)),
    );
    await filter("类型", "备课");
    await filter("年级", "二年级");
    await filter("学科", "数学");
    await filter("标签", "课前准备");
    await type("input[type=search]", "数学");
    await wait("!" + contains("合成阅读教案"));
    await button("查看正文");
    await wait(contains(resource.body));
    await button("返回列表");
    await button("清除筛选");
    await wait(contains("合成阅读教案"));
    await button("收藏");
    await wait(contains("已收藏。"));
    await button("我的收藏");
    await wait(contains(resource.title));
    await button("记为最近使用");
    await wait(contains("已记入最近使用"));
    await button("最近使用");
    await wait(contains(resource.title));
    await page.send("Page.reload");
    await wait(contains("取消收藏"));
    await button("最近使用");
    await wait(contains(resource.title));
    await button("取消收藏");
    await wait(contains("已取消收藏"));
    await button("我的收藏");
    await wait(contains("没有匹配内容"));
    assert.deepEqual(writes, ["favorite", "use", "favorite"]);
    await click('nav[aria-label="员工服务"] a[href="/web/staff/guides"]');
    await wait(contains(guide.title));
    await layouts("next-staff-guides");
    await filter("类型", "交接");
    await type("input[type=search]", "无匹配");
    await wait(contains("没有匹配内容"));
    await page.send("Page.reload");
    await wait(contains(guide.title));
    await button("查看正文");
    await wait(contains(guide.body));
    failOnce = true;
    await page.send("Page.reload");
    await wait(contains("暂时无法读取"));
    empty = true;
    await button("刷新重试");
    await wait(contains("暂无可查看的新员工指南"));
    assert.deepEqual(
      await evaluate(
        page,
        "({local:Object.keys(localStorage),session:Object.keys(sessionStorage)})",
      ),
      { local: [], session: [] },
    );
    assert.deepEqual(errors, []);
    assert.deepEqual(external, []);
    assert.deepEqual(failedResponses, []);
  },
);
