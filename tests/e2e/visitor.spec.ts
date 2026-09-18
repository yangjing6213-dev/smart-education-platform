import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

import { evaluateBrowserEvidence } from "../../scripts/verify-release.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

type VisitorModule = {
  createSyntheticVisitorResponse(): unknown;
  selectVisitorRoute(input: {
    path?: string;
    navigation?: { route: string; contentKey?: string };
    response: unknown;
  }): {
    kind: string;
    view: {
      state: string;
      html: string;
      items?: readonly { slug: string }[];
      requests: readonly string[];
      externalDestinations: readonly string[];
    };
  };
};

async function loadVisitorModule(relativePath: string): Promise<VisitorModule> {
  return (await import(pathToFileURL(path.join(root, relativePath)).href)) as VisitorModule;
}

test("visitor web and mini projections expose only synthetic public content", async () => {
  const web = await loadVisitorModule("apps/user-web/dist/routes/visitor.routes.js");
  const webRoute = web.selectVisitorRoute({
    path: "/visitor",
    response: web.createSyntheticVisitorResponse(),
  });

  assert.equal(webRoute.kind, "HOME");
  assert.deepEqual(
    webRoute.view.items?.map((item) => item.slug),
    ["welcome-to-synthetic-learning"],
  );
  assert.doesNotMatch(webRoute.view.html, /private|draft|foreign|https?:\/\//iu);
  assert.deepEqual(webRoute.view.requests, []);
  assert.deepEqual(webRoute.view.externalDestinations, []);

  const mini = await loadVisitorModule("apps/mini-program/src/navigation/routes.ts");
  const miniResponse = mini.createSyntheticVisitorResponse();
  const miniRoute = mini.selectVisitorRoute({
    navigation: { route: "pages/visitor/home" },
    response: miniResponse,
  });

  assert.equal(miniRoute.kind, "HOME");
  assert.equal(miniRoute.view.state, "PUBLISHED");
  assert.match(miniRoute.view.html, /data-platform="mini-program"/u);
  assert.deepEqual(miniRoute.view.requests, []);
  assert.deepEqual(miniRoute.view.externalDestinations, []);
});

test("visitor browser evidence rejects any external request", () => {
  const result = evaluateBrowserEvidence({
    routes: [
      {
        route: "/web/visitor/home",
        viewport: "desktop-1440x1024",
        heading: "Visitor home",
        durationMs: 12,
        pageErrors: [],
        severeConsoleErrors: [],
        failedRequests: [],
        horizontalOverflowPx: 15,
        requests: ["http://127.0.0.1:4173/index.html", "https://example.invalid/pixel"],
      },
    ],
    learning: null,
  });

  assert.equal(result.ok, false);
  assert.ok(result.blockers.some((blocker) => blocker.startsWith("EXTERNAL_REQUEST:")));
  assert.ok(result.blockers.some((blocker) => blocker.startsWith("HORIZONTAL_OVERFLOW:")));
});
