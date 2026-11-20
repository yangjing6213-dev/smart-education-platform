/* global AbortSignal, fetch */
import assert from "node:assert/strict";
import { mkdir, stat } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath, URL } from "node:url";
import test from "node:test";
import { browserApiModuleUrl } from "./helpers/release-browser-paths.mjs";
import {
  capture,
  evaluate,
  localApiRequest,
  navigate,
  startNextBrowser,
} from "./helpers/user-web-next-browser.mjs";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const artifactRoot = resolve(
  repositoryRoot,
  process.env.USER_WEB_E2E_ARTIFACT_ROOT ?? "artifacts/user-web-next-startup",
);
const artifactRelative = relative(resolve(repositoryRoot, "artifacts"), artifactRoot);
assert.ok(artifactRelative && !artifactRelative.startsWith("..") && !isAbsolute(artifactRelative));

test("prebuilt API and Next start with isolated sessions, both clocks, and owned cleanup", async (t) => {
  let previousHandle;
  for (const fixedNow of [undefined, "2026-10-12T01:00:00.000Z"]) {
    const mode = fixedNow === undefined ? "current-clock" : "fixed-clock";
    let apiBaseUrl;
    let baseUrl;
    await t.test(mode, { timeout: 45000 }, async (subtest) => {
      const compiledApi = browserApiModuleUrl(repositoryRoot, "local-synthetic/server.js");
      const before = await stat(compiledApi);
      const started = Date.now();
      const harness = await startNextBrowser(subtest, { repositoryRoot, fixedNow });
      ({ apiBaseUrl, baseUrl } = harness);
      subtest.diagnostic(`${mode}: API + Next + browser ready in ${Date.now() - started}ms`);
      assert.equal((await stat(compiledApi)).mtimeMs, before.mtimeMs, "E2E must not rebuild API");
      assert.equal(new URL(apiBaseUrl).hostname, "127.0.0.1");
      if (previousHandle) {
        const denied = await fetch(apiBaseUrl + "/local/session", {
          headers: { authorization: "Bearer " + previousHandle },
        });
        assert.equal(denied.status, 401, "A new fixture must not inherit an earlier session");
        await denied.body?.cancel();
      }
      const session = await localApiRequest(apiBaseUrl, "/local/sessions", undefined, "POST", {
        profile: "parent-alpha",
      });
      previousHandle = session.handle;
      if (fixedNow) {
        assert.equal(Date.parse(session.expiresAt), Date.parse(fixedNow) + 15 * 60 * 1000);
      } else {
        assert.ok(Math.abs(Date.parse(session.expiresAt) - Date.now() - 15 * 60 * 1000) < 5000);
      }
      const allowed = await fetch(apiBaseUrl + "/local/profiles", { headers: { origin: baseUrl } });
      assert.equal(allowed.status, 200);
      await allowed.body?.cancel();
      const denied = await fetch(apiBaseUrl + "/local/profiles", {
        headers: { origin: "https://untrusted.invalid" },
      });
      assert.equal(denied.status, 403);
      await denied.body?.cancel();

      const errors = [];
      const page = await harness.connectPage((method) => {
        if (method === "Runtime.exceptionThrown") errors.push(method);
      });
      await navigate(page, baseUrl + "/web/visitor/home", "document.querySelector('h1')");
      assert.equal(
        await evaluate(
          page,
          "document.querySelector('[data-official-institution-profile] h1').textContent.trim()",
        ),
        "做有温度的教育，温暖孩子成长路。",
      );
      assert.equal(
        await evaluate(
          page,
          "document.querySelectorAll('main #visitor-public-content-heading, main a[href^=\"/visitor/content/\"]').length",
        ),
        0,
        "Without a public-content backend, the homepage must not show a published feed or article links",
      );
      assert.deepEqual(errors, []);
      await mkdir(artifactRoot, { recursive: true });
      await capture(page, resolve(artifactRoot, `startup-${mode}.png`));
    });
    for (const url of [apiBaseUrl, baseUrl].filter(Boolean)) {
      await assert.rejects(
        fetch(url, { signal: AbortSignal.timeout(1000) }),
        (error) => error.cause?.code === "ECONNREFUSED",
        "Test-owned services must release their ports after cleanup",
      );
    }
  }
});
