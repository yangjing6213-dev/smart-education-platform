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
  assert.deepEqual(route.view.focusOrder, [
    "visitor-primary-action",
    "visitor-content-welcome-to-synthetic-learning",
  ]);
  assert.equal(route.view.layout.maxInlineSize, "100%");
  assert.equal(route.view.layout.overflowX, "hidden");
  assert.equal(route.view.layout.minInlineSize, "0");
  assert.match(route.view.html, /href="\/visitor\/content\/welcome-to-synthetic-learning"/);
});

test("empty visitor home exposes a safe keyboard-reachable next action", () => {
  const route = selectVisitorRoute({
    path: "/visitor",
    response: { items: [] },
  });

  assert.equal(route.kind, "HOME");
  assert.equal(route.view.state, "EMPTY");
  assert.deepEqual(route.view.focusOrder, ["visitor-home-empty-action"]);
  assert.match(route.view.html, /id="visitor-home-empty-action"/);
  assert.match(route.view.html, /href="\/visitor"/);
});

test("empty visitor content is announced as a live status", () => {
  const route = selectVisitorRoute({
    path: "/visitor",
    response: { items: [] },
  });

  assert.match(
    route.view.html,
    /<p class="empty-copy" role="status" aria-live="polite">当前没有可展示的公开内容。<\/p>/u,
  );
});

test("below-fold visitor imagery uses lazy loading", () => {
  const route = selectVisitorRoute({
    path: "/visitor",
    response: createSyntheticVisitorResponse(),
  });

  assert.equal((route.view.html.match(/loading="lazy"/gu) ?? []).length, 3);
});

test("stale and disabled public items are excluded from the projection", () => {
  const response = createSyntheticVisitorResponse();
  const published = response.items[0];
  assert.ok(published);
  const unsafeResponse = {
    items: [
      ...response.items,
      { ...published, slug: "stale-item", freshnessStatus: "STALE" },
      { ...published, slug: "disabled-item", enabledStatus: "DISABLED" },
    ],
  };
  const route = selectVisitorRoute({
    path: "/visitor",
    response: unsafeResponse,
  });

  assert.equal(route.kind, "HOME");
  assert.deepEqual(
    route.view.items.map((item) => item.slug),
    ["welcome-to-synthetic-learning"],
  );
  assert.doesNotMatch(route.view.html, /stale-item|disabled-item/i);
});

test("malformed public responses fail closed without throwing or leaking fields", () => {
  const malformedResponse = {
    items: [
      {
        slug: 42,
        title: { raw: "private malformed title" },
        summary: null,
        body: [null],
        publicationStatus: "PUBLISHED",
        visibility: "PUBLIC",
        scope: "PUBLIC",
        syntheticData: "SIMULATED",
      },
    ],
  };

  assert.doesNotThrow(() => {
    const route = selectVisitorRoute({
      path: "/visitor",
      response: malformedResponse as never,
    });
    assert.equal(route.kind, "HOME");
    assert.equal(route.view.state, "ERROR");
    assert.deepEqual(route.view.items, []);
    assert.doesNotMatch(route.view.html, /private malformed title|raw/i);
  });

  assert.doesNotThrow(() => {
    const route = selectVisitorRoute({
      path: "/visitor/content/malformed-item",
      response: malformedResponse as never,
    });
    assert.equal(route.kind, "CONTENT");
    assert.equal(route.view.state, "ERROR");
    assert.doesNotMatch(route.view.html, /private malformed title|raw/i);
  });
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

test("visitor home compatibility route preserves the accepted projection", () => {
  const response = createSyntheticVisitorResponse();
  const primary = selectVisitorRoute({ path: "/visitor", response });
  const compatibility = selectVisitorRoute({ path: "/web/visitor/home", response });

  assert.equal(primary.kind, "HOME");
  assert.equal(compatibility.kind, "HOME");
  assert.deepEqual(compatibility.view, primary.view);
});

test("visitor home declares the supported empty states without business routes", () => {
  const route = selectVisitorRoute({
    path: "/visitor",
    response: createSyntheticVisitorResponse(),
  });

  assert.equal(route.kind, "HOME");
  assert.match(route.view.html, /暂无课程/);
  assert.match(route.view.html, /暂无活动/);
  assert.match(route.view.html, /暂无校区/);
  assert.doesNotMatch(route.view.html, /href="\/(courses|campuses|pickup|enrollment)/i);
});
