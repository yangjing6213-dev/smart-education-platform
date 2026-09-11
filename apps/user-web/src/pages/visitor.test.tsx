import assert from "node:assert/strict";
import test from "node:test";

// @ts-expect-error TS6142: this package intentionally keeps JSX-free .tsx page boundaries.
import { createSyntheticVisitorResponse, selectVisitorRoute } from "../routes/visitor.routes.js";

test("public visitor routing excludes private, draft, and foreign items", () => {
  const route = selectVisitorRoute({
    path: "/visitor",
    response: createSyntheticVisitorResponse(),
  });

  assert.equal(route.kind, "HOME");
  assert.equal(route.view.heading, "访客首页");
  assert.match(route.view.html, /模拟数据/);
  assert.deepEqual(
    route.view.items.map((item) => item.slug),
    ["welcome-to-synthetic-learning"],
  );
  assert.doesNotMatch(route.view.html, /private|draft|foreign|tenant-only/i);
});

test("visitor content renders only the approved published projection", () => {
  const route = selectVisitorRoute({
    path: "/visitor/content/welcome-to-synthetic-learning",
    response: createSyntheticVisitorResponse(),
  });

  assert.equal(route.kind, "CONTENT");
  assert.equal(route.view.state, "PUBLISHED");
  assert.match(route.view.html, /Synthetic learning welcome/);
  assert.doesNotMatch(route.view.html, /tenant-|private|provider|https?:\/\//i);
  assert.deepEqual(route.view.requests, []);
});

test("visitor pages expose deterministic loading, empty, error, and published states", () => {
  const response = createSyntheticVisitorResponse();
  const cases = [
    ["LOADING", "Loading visitor content"],
    ["EMPTY", "No published visitor content"],
    ["ERROR", "Visitor content is unavailable"],
    ["PUBLISHED", "Synthetic learning welcome"],
  ] as const;

  for (const [state, expectedText] of cases) {
    const route = selectVisitorRoute({
      path: "/visitor",
      response: state === "EMPTY" ? { items: [] } : response,
      state,
    });

    assert.equal(route.kind, "HOME");
    assert.equal(route.view.state, state);
    assert.match(route.view.statusAnnouncement, new RegExp(expectedText, "i"));
    assert.equal(route.view.statusRole, "status");
  }
});

test("visitor actions have a stable keyboard order and narrow viewport guard", () => {
  const route = selectVisitorRoute({
    path: "/visitor",
    response: createSyntheticVisitorResponse(),
  });

  assert.equal(route.kind, "HOME");
  assert.deepEqual(route.view.focusOrder, ["visitor-content-welcome-to-synthetic-learning"]);
  assert.equal(route.view.layout.maxInlineSize, "100%");
  assert.equal(route.view.layout.overflowX, "hidden");
  assert.equal(route.view.layout.minInlineSize, "0");
  assert.match(route.view.html, /href="\/visitor\/content\/welcome-to-synthetic-learning"/);
});

test("visitor route rejects unknown content without requests or external destinations", () => {
  const route = selectVisitorRoute({
    path: "/visitor/content/private-item",
    response: createSyntheticVisitorResponse(),
  });

  assert.equal(route.kind, "CONTENT");
  assert.equal(route.view.state, "ERROR");
  assert.match(route.view.statusAnnouncement, /unavailable/i);
  assert.deepEqual(route.view.requests, []);
  assert.deepEqual(route.view.externalDestinations, []);
});
