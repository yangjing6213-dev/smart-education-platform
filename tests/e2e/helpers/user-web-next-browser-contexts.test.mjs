import assert from "node:assert/strict";
import test from "node:test";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { evaluate, navigate, startNextBrowser } from "./user-web-next-browser.mjs";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

test(
  "separate browser contexts isolate cookies and web storage",
  { timeout: 120_000 },
  async (t) => {
    const browser = await startNextBrowser(t, { repositoryRoot, skipLegacyApi: true });
    const externalRequests = [];
    const observe = (method, params) => {
      if (method !== "Network.requestWillBeSent") return;
      const url = params.request?.url;
      if (typeof url === "string" && /^https?:/iu.test(url)) {
        if (new URL(url).origin !== browser.baseUrl) externalRequests.push(url);
      }
    };
    const first = await browser.createIsolatedPage(observe);
    const second = await browser.createIsolatedPage(observe);
    const url = `${browser.baseUrl}/web/visitor/home`;

    await navigate(first, url, "document.readyState === 'complete' && document.body");
    await navigate(second, url, "document.readyState === 'complete' && document.body");

    await evaluate(
      first,
      "document.cookie='context-scope=alpha; Path=/; SameSite=Lax'; localStorage.setItem('context-scope','alpha'); sessionStorage.setItem('context-scope','alpha')",
    );
    assert.deepEqual(
      await evaluate(
        second,
        "({cookie:document.cookie.includes('context-scope=alpha'),local:localStorage.getItem('context-scope'),session:sessionStorage.getItem('context-scope')})",
      ),
      { cookie: false, local: null, session: null },
    );

    await evaluate(
      second,
      "document.cookie='context-scope=beta; Path=/; SameSite=Lax'; localStorage.setItem('context-scope','beta'); sessionStorage.setItem('context-scope','beta')",
    );
    assert.deepEqual(
      await evaluate(
        first,
        "({cookie:document.cookie.includes('context-scope=alpha')&&!document.cookie.includes('context-scope=beta'),local:localStorage.getItem('context-scope'),session:sessionStorage.getItem('context-scope')})",
      ),
      { cookie: true, local: "alpha", session: "alpha" },
    );
    assert.deepEqual(externalRequests, []);
  },
);
