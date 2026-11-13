/* global fetch, process, URL */
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { dirname, relative, resolve, isAbsolute } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { browserApiModuleUrl } from "../../../tests/e2e/helpers/release-browser-paths.mjs";
import { capture, evaluate, navigate, startNextBrowser, waitForExpression } from "../../../tests/e2e/helpers/user-web-next-browser.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const { createApiApp } = await import(browserApiModuleUrl(root, "nest/api-app.js"));
const { InviteAuthService, createInvitePasswordHash } = await import(browserApiModuleUrl(root, "nest/invite-auth.service.js"));
const artifacts = resolve(root, "artifacts/rc-a1587/user-web-account");
const relativeArtifacts = relative(resolve(root, "artifacts"), artifacts);
assert.ok(relativeArtifacts && !relativeArtifacts.startsWith("..") && !isAbsolute(relativeArtifacts));

test("parent account page reads a shared identity and saves display name through the authenticated API", { timeout: 90000 }, async (t) => {
  const password = "Synthetic-Account-Only-2026!";
  const account = {
    username: "parent.account",
    password_hash: await createInvitePasswordHash(password),
    identity: { actor_id: "00000000-0000-4000-8000-000000000001", display_name: "模拟家长甲" },
    memberships: [{
      tenant_id: "00000000-0000-4000-8000-000000000064",
      campus_ids: ["00000000-0000-4000-8000-000000000065"],
      status: "ACTIVE",
      capabilities: ["identity:read", "memberships:read", "binding:apply", "binding:read", "learning:summary", "leave:apply"],
    }],
  };
  let apiBase;
  const browser = await startNextBrowser(t, {
    repositoryRoot: root,
    startInviteApi: async () => {
      const service = new InviteAuthService([account]);
      const api = await createApiApp({ inviteAuthService: service });
      t.after(() => api.close());
      await api.listen(0, "127.0.0.1");
      apiBase = await api.getUrl();
      return apiBase;
    },
  });
  const errors = [];
  const loginEvents = [];
  const page = await browser.connectPage((method, params) => {
    if (method === "Runtime.exceptionThrown")
      errors.push(params.exceptionDetails?.text ?? "网页脚本异常");
    if (
      method === "Network.requestWillBeSent" &&
      typeof params.request?.url === "string" &&
      params.request.url.endsWith("/api-local/identity/login")
    )
      loginEvents.push("request");
    if (
      method === "Network.responseReceived" &&
      typeof params.response?.url === "string" &&
      (params.response.url.endsWith("/api-local/identity/login") ||
        params.response.url.endsWith("/api-local/me") ||
        params.response.url.endsWith("/api-local/identity/account"))
    )
      loginEvents.push(`response:${new URL(params.response.url).pathname}:${params.response.status}`);
    if (
      method === "Network.requestWillBeSent" &&
      typeof params.request?.url === "string" &&
      (params.request.url.endsWith("/api-local/me") ||
        params.request.url.endsWith("/api-local/identity/account"))
    )
      loginEvents.push(`request:${new URL(params.request.url).pathname}`);
  });
  await navigate(page, browser.baseUrl + "/web/login", "document.querySelector('#invite-username')");
  await waitForExpression(
    page,
    "document.querySelector('[data-invite-state]')?.getAttribute('data-invite-state') === 'IDLE' && !document.querySelector('[data-invite-submit]')?.disabled",
    "登录页应先完成已有会话检查，再接受凭据",
  );
  await evaluate(page, `(() => {
    const assign = (selector, value) => {
      const input = document.querySelector(selector);
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
      setter.call(input, value);
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    };
    assign('#invite-username', 'parent.account');
    assign('#invite-password', ${JSON.stringify(password)});
    document.querySelector('[data-invite-login]').requestSubmit();
  })()`);
  try {
    await waitForExpression(page, "document.querySelector('#invite-username') === null", "登录后应进入家长服务");
  } catch (cause) {
    const observed = await evaluate(
      page,
      "JSON.stringify({url:location.pathname,state:document.querySelector('[data-invite-state]')?.getAttribute('data-invite-state'),message:document.querySelector('[data-invite-state] [role]')?.textContent?.trim(),usernamePresent:Boolean(document.querySelector('#invite-username')?.value),passwordLength:document.querySelector('#invite-password')?.value.length,body:document.body.innerText.slice(0,500)})",
    );
    throw new Error(`${cause instanceof Error ? cause.message : "登录状态未切换"}; observed=${observed}; loginEvents=${loginEvents.join(",")}; errors=${errors.join("|")}`);
  }
  await navigate(page, browser.baseUrl + "/web/account", "document.querySelector('#account-title')");
  try {
    await waitForExpression(
      page,
      "document.querySelector('#account-display-name')?.value === '模拟家长甲'",
      "账号页应显示已登录账号资料",
    );
  } catch (cause) {
    const observed = await evaluate(
      page,
      "JSON.stringify({url:location.pathname,title:document.querySelector('#account-title')?.textContent?.trim(),status:document.querySelector('[role=status]')?.textContent?.trim(),body:document.body.innerText.slice(0,500)})",
    );
    throw new Error(`${cause instanceof Error ? cause.message : "账号资料未显示"}; observed=${observed}; network=${loginEvents.join(",")}; errors=${errors.join("|")}`);
  }
  assert.match(await evaluate(page, "document.body.textContent"), /登录用户名/u);
  assert.match(await evaluate(page, "document.body.textContent"), /我的账号/u);
  await evaluate(page, `(() => {
    const input = document.querySelector('#account-display-name');
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    setter.call(input, '模拟家长乙');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    input.closest('form').requestSubmit();
  })()`);
  await waitForExpression(page, "document.body.textContent.includes('姓名已更新')", "保存姓名后应显示成功状态");
  const login = await fetch(apiBase + "/identity/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username: account.username, password }),
  });
  assert.equal(login.status, 200);
  const token = (await login.json()).data.access_token;
  const refreshed = await fetch(apiBase + "/identity/account", { headers: { authorization: "Bearer " + token } });
  assert.equal(refreshed.status, 200);
  assert.equal((await refreshed.json()).data.display_name, "模拟家长乙");
  await mkdir(artifacts, { recursive: true });
  await capture(page, resolve(artifacts, "account-parent.png"), true);
  assert.deepEqual(errors, []);
});
