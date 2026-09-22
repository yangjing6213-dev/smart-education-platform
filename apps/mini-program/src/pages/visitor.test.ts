import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

// prettier-ignore
// @ts-expect-error TS5097: the local focused test runs TypeScript modules directly.
import { VISITOR_ROUTES, backToVisitorHome, openVisitorContent, selectVisitorRoute } from "./../navigation/routes.ts";
// prettier-ignore
// @ts-expect-error TS5097: the local focused test runs TypeScript modules directly.
import { renderVisitorHome, publishedVisitorItems, type PublicVisitorResponse } from "./visitor/home.ts";
// prettier-ignore
// @ts-expect-error TS5097: the local focused test runs TypeScript modules directly.
import { renderVisitorContent } from "./visitor/content.ts";

const publishedItem = {
  slug: "welcome-to-synthetic-learning",
  title: "Synthetic learning welcome",
  summary: "A simulated public introduction.",
  body: ["This is clearly simulated public content."],
  publicationStatus: "PUBLISHED" as const,
  visibility: "PUBLIC" as const,
  scope: "PUBLIC" as const,
  syntheticData: "SIMULATED" as const,
  freshnessStatus: "FRESH" as const,
  enabledStatus: "ENABLED" as const,
};

const response: PublicVisitorResponse = {
  items: [
    publishedItem,
    { ...publishedItem, slug: "private-item", visibility: "PRIVATE" },
    { ...publishedItem, slug: "draft-item", publicationStatus: "DRAFT" },
    { ...publishedItem, slug: "foreign-item", scope: "FOREIGN" },
    { ...publishedItem, slug: "unpublished-item", publicationStatus: "UNPUBLISHED" },
    { ...publishedItem, slug: "stale-item", freshnessStatus: "STALE" },
    { ...publishedItem, slug: "disabled-item", enabledStatus: "DISABLED" },
    { slug: "malformed-item", title: 12 },
  ],
};

test("public projection keeps only fresh published simulated content", () => {
  const items = publishedVisitorItems(response);

  assert.deepEqual(
    items.map((item) => item.slug),
    [publishedItem.slug],
  );
  assert.equal("visibility" in items[0]!, true);
  assert.equal("tenantId" in items[0]!, false);
  assert.equal("campusId" in items[0]!, false);
  assert.equal("providerUrl" in items[0]!, false);
});

test("visitor home renders loading, empty, error, and published states", () => {
  assert.equal(renderVisitorHome(response, "LOADING").state, "LOADING");
  assert.equal(renderVisitorHome(response, "LOADING").statusRole, "status");
  assert.equal(renderVisitorHome({ items: [] }, "PUBLISHED").state, "EMPTY");
  assert.equal(renderVisitorHome({ malformed: true }, "PUBLISHED").state, "ERROR");

  const published = renderVisitorHome(response, "PUBLISHED");
  assert.equal(published.state, "PUBLISHED");
  assert.deepEqual(published.focusOrder, ["visitor-content-welcome-to-synthetic-learning"]);
  assert.match(published.html, /模拟数据/);
  assert.doesNotMatch(
    published.html,
    /private-item|draft-item|foreign-item|unpublished-item|stale-item|disabled-item|malformed-item/,
  );
});

test("visitor content fails closed for unavailable or non-public content", () => {
  assert.equal(renderVisitorContent(response, publishedItem.slug, "LOADING").state, "LOADING");
  assert.equal(renderVisitorContent(response, publishedItem.slug, "EMPTY").state, "EMPTY");
  assert.equal(renderVisitorContent(response, publishedItem.slug, "ERROR").state, "ERROR");

  const published = renderVisitorContent(response, publishedItem.slug);
  assert.equal(published.state, "PUBLISHED");
  assert.equal(published.item?.slug, publishedItem.slug);
  assert.equal(published.backNavigation.route, VISITOR_ROUTES.home);

  const unavailable = renderVisitorContent(response, "private-item");
  assert.equal(unavailable.state, "ERROR");
  assert.equal(unavailable.item, undefined);
  assert.match(unavailable.html, /不可用/);
});

test("visitor navigation selects home, content, and deterministic back transitions", () => {
  const home = selectVisitorRoute({
    navigation: { route: VISITOR_ROUTES.home },
    response,
  });
  assert.equal(home.kind, "HOME");
  assert.equal(home.view.route, VISITOR_ROUTES.home);

  const contentNavigation = openVisitorContent(publishedItem.slug);
  assert.deepEqual(contentNavigation, {
    route: VISITOR_ROUTES.content,
    contentKey: publishedItem.slug,
  });
  const content = selectVisitorRoute({ navigation: contentNavigation, response });
  assert.equal(content.kind, "CONTENT");
  assert.equal(content.view.item?.slug, publishedItem.slug);
  assert.deepEqual(backToVisitorHome(), { route: VISITOR_ROUTES.home });
  assert.deepEqual(openVisitorContent("bad key"), { route: VISITOR_ROUTES.home });
});

test("visitor views expose phone constraints, focus semantics, and no external activity", () => {
  const home = renderVisitorHome(response);
  const content = renderVisitorContent(response, publishedItem.slug);

  for (const view of [home, content]) {
    assert.deepEqual(view.layout, {
      maxInlineSize: "100%",
      minInlineSize: "0",
      overflowX: "hidden",
    });
    assert.deepEqual(view.requests, []);
    assert.deepEqual(view.externalDestinations, []);
    assert.match(view.html, /role="status"/);
  }
  assert.match(home.html, /data-platform="mini-program"/);
  assert.match(content.html, /data-action="back"/);
});

test("visitor production modules contain no server, web, provider, or request imports", async () => {
  const paths = [
    "apps/mini-program/src/pages/visitor/home.ts",
    "apps/mini-program/src/pages/visitor/content.ts",
    "apps/mini-program/src/navigation/routes.ts",
  ];
  const source = (await Promise.all(paths.map((path) => readFile(path, "utf8")))).join("\n");

  assert.doesNotMatch(
    source,
    /user-web|apps\/api|fetch\s*\(|XMLHttpRequest|provider|storage|https?:/i,
  );
});

test("native visitor shell registers only the approved local pages", async () => {
  const files = {
    appConfig: "apps/mini-program/app.json",
    appSource: "apps/mini-program/app.ts",
    homeSource: "apps/mini-program/pages/visitor/home/index.ts",
    homeTemplate: "apps/mini-program/pages/visitor/home/index.wxml",
    contentSource: "apps/mini-program/pages/visitor/content/index.ts",
    contentTemplate: "apps/mini-program/pages/visitor/content/index.wxml",
  } as const;
  const contents = await Object.fromEntries(
    await Promise.all(
      Object.entries(files).map(async ([key, path]) => [key, await readFile(path, "utf8")]),
    ),
  );
  const appConfig = JSON.parse(contents.appConfig) as { pages?: string[] };

  assert.deepEqual(appConfig.pages, ["pages/visitor/home/index", "pages/visitor/content/index"]);
  for (const source of [
    contents.appSource,
    contents.homeSource,
    contents.homeTemplate,
    contents.contentSource,
    contents.contentTemplate,
  ]) {
    assert.doesNotMatch(source, /wx\.request|wx\.setStorage|wx\.getStorage|https?:\/\//i);
  }
  assert.match(contents.homeSource, /createSyntheticVisitorResponse/);
  assert.match(contents.homeTemplate, /bindtap="handleContentTap"/);
  assert.match(contents.contentSource, /renderVisitorContent/);
  assert.match(contents.contentTemplate, /bindtap="handleBack"/);
});

test("native visitor templates keep actions and content inside the phone layout contract", async () => {
  const paths = [
    "apps/mini-program/app.wxss",
    "apps/mini-program/pages/visitor/home/index.wxss",
    "apps/mini-program/pages/visitor/content/index.wxss",
  ];
  const styles = (await Promise.all(paths.map((path) => readFile(path, "utf8")))).join("\n");

  assert.match(styles, /box-sizing\s*:\s*border-box/);
  assert.match(styles, /overflow-x\s*:\s*hidden/);
  assert.match(styles, /min-width\s*:\s*0/);
  assert.match(styles, /44px/);
  assert.match(styles, /focus/);
});
