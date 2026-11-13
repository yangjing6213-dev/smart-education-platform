import assert from "node:assert/strict";
import test from "node:test";

// @ts-expect-error TS6142: this package intentionally keeps JSX-free .tsx page boundaries.
import { createSyntheticVisitorResponse, selectVisitorRoute } from "../routes/visitor.routes.js";
// @ts-expect-error TS6142: this package intentionally keeps JSX-free .tsx page boundaries.
import { renderVisitorInstitution } from "./visitor-institution.js";
// @ts-expect-error TS6142: this package intentionally keeps JSX-free .tsx page boundaries.
import { renderVisitorDayFlow } from "./visitor-day-flow.js";
import { createSyntheticPublicVerticalResponse } from "./visitor-public-verticals.js";
// @ts-expect-error TS6142: this package intentionally keeps JSX-free .tsx page boundaries.
import { renderVisitorContactIntent } from "./visitor-home.js";

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
    ["teacher-team", "seasonal-activities", "meal-plan", "environment-and-contact"],
  );
  assert.doesNotMatch(route.view.html, /private|draft|foreign|tenant-only/i);
});

test("visitor synthetic content uses the shared Chinese public information language", () => {
  const route = selectVisitorRoute({
    path: "/visitor",
    response: createSyntheticVisitorResponse(),
  });

  assert.equal(route.kind, "HOME");
  assert.equal(route.view.items[0]?.title, "教师团队");
  assert.match(route.view.html, /教师团队/u);
});

test("visitor home exposes the four public content card links", () => {
  const route = selectVisitorRoute({
    path: "/visitor",
    response: createSyntheticVisitorResponse(),
  });

  assert.equal(route.kind, "HOME");
  assert.deepEqual(
    route.view.items.map((item) => item.slug),
    ["teacher-team", "seasonal-activities", "meal-plan", "environment-and-contact"],
  );
  for (const slug of [
    "teacher-team",
    "seasonal-activities",
    "meal-plan",
    "environment-and-contact",
  ]) {
    assert.match(route.view.html, new RegExp(`href="/visitor/content/${slug}"`, "u"));
  }
});

test("visitor content renders only the approved published projection", () => {
  const route = selectVisitorRoute({
    path: "/visitor/content/teacher-team",
    response: createSyntheticVisitorResponse(),
  });

  assert.equal(route.kind, "CONTENT");
  assert.equal(route.view.state, "PUBLISHED");
  assert.match(route.view.html, /教师团队/);
  assert.doesNotMatch(route.view.html, /tenant-|private|provider|https?:\/\//i);
  assert.deepEqual(route.view.requests, []);
});

test("visitor pages expose deterministic loading, empty, error, and published states", () => {
  const response = createSyntheticVisitorResponse();
  const cases = [
    ["LOADING", "Loading visitor content"],
    ["EMPTY", "No published visitor content"],
    ["ERROR", "Visitor content is unavailable"],
    ["PUBLISHED", "教师团队"],
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
    "visitor-content-teacher-team",
    "visitor-content-seasonal-activities",
    "visitor-content-meal-plan",
    "visitor-content-environment-and-contact",
    "contact-intent-name",
    "contact-intent-topic",
    "contact-intent-submit",
  ]);
  assert.equal(route.view.layout.maxInlineSize, "100%");
  assert.equal(route.view.layout.overflowX, "hidden");
  assert.equal(route.view.layout.minInlineSize, "0");
  assert.match(route.view.html, /href="\/visitor\/content\/teacher-team"/);
});

test("empty visitor home exposes a safe keyboard-reachable next action", () => {
  const route = selectVisitorRoute({
    path: "/visitor",
    response: { items: [] },
  });

  assert.equal(route.kind, "HOME");
  assert.equal(route.view.state, "EMPTY");
  assert.deepEqual(route.view.focusOrder, [
    "visitor-home-empty-action",
    "contact-intent-name",
    "contact-intent-topic",
    "contact-intent-submit",
  ]);
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
    ["teacher-team", "seasonal-activities", "meal-plan", "environment-and-contact"],
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

test("visitor home exposes the V0.1 public information architecture", () => {
  const route = selectVisitorRoute({
    path: "/visitor",
    response: createSyntheticVisitorResponse(),
  });

  assert.equal(route.kind, "HOME");
  for (const landmark of [
    "机构介绍",
    "家校共育",
    "一日流程",
    "教师团队",
    "活动与消息",
    "餐食与食谱",
    "环境与校区",
    "联系状态",
  ]) {
    assert.match(route.view.html, new RegExp(landmark, "u"));
  }
  assert.match(route.view.html, /data-synthetic="true"/u);
  assert.match(route.view.html, /模拟数据/u);
  assert.match(route.view.html, /暂无已发布活动/u);
  assert.match(route.view.html, /暂无公开餐食或食谱/u);
  assert.match(route.view.html, /暂无公开校区信息/u);
  assert.match(route.view.html, /联系信息准备中/u);
});

test("visitor home keeps public navigation within the approved route set", () => {
  const route = selectVisitorRoute({
    path: "/visitor",
    response: createSyntheticVisitorResponse(),
  });

  assert.equal(route.kind, "HOME");
  const hrefs = [...route.view.html.matchAll(/href="([^"]+)"/gu)].map((match) => match[1]);
  assert.ok(hrefs.every((href) => href !== undefined && !/^https?:/u.test(href)));
  assert.ok(
    hrefs.every(
      (href) =>
        href !== undefined &&
        (href === "/visitor" ||
          href.startsWith("/visitor#") ||
          href.startsWith("/visitor/content/") ||
          href === "/web/visitor/institution" ||
          href === "/web/visitor/day-flow" ||
          href === "/staff/workbench"),
    ),
  );
  assert.doesNotMatch(route.view.html, /课程目录|校区目录|接送|报名/u);
});

test("visitor meal-plan page renders only the live published projection and safe loading states", () => {
  const response = createSyntheticVisitorResponse();
  const route = selectVisitorRoute({
    path: "/visitor/content/meal-plan",
    response,
    publicMeals: {
      status: "READY",
      date: "2026-10-14",
      meals: [
        {
          id: "meal-local-1",
          meal_date: "2026-10-14",
          meal_type: "LUNCH",
          items: ["模拟米饭", "<script>不可执行</script>"],
          notes: "仅供开发测试",
          published_at: "2026-10-14T04:00:00.000Z",
        },
      ],
    },
  });
  assert.equal(route.kind, "CONTENT");
  assert.match(route.view.html, /模拟米饭/u);
  assert.match(route.view.html, /&lt;script&gt;不可执行&lt;\/script&gt;/u);
  assert.doesNotMatch(route.view.html, /这是仅用于演示的餐食公开内容/u);
  assert.doesNotMatch(route.view.html, /private_notes|tenant_id|published_at/u);

  const empty = selectVisitorRoute({
    path: "/visitor/content/meal-plan",
    response,
    publicMeals: { status: "READY", date: "2026-10-14", meals: [] },
  });
  assert.equal(empty.kind, "CONTENT");
  assert.match(empty.view.html, /本日暂无已发布餐食/u);
  assert.doesNotMatch(empty.view.html, /模拟米饭/u);

  const error = selectVisitorRoute({
    path: "/visitor/content/meal-plan",
    response,
    publicMeals: { status: "ERROR", date: "2026-10-14", meals: [] },
  });
  assert.equal(error.kind, "CONTENT");
  assert.match(error.view.html, /公开餐食暂时无法读取/u);
});

test("visitor home exposes a local contact intent form without network destinations", () => {
  const route = selectVisitorRoute({
    path: "/visitor",
    response: createSyntheticVisitorResponse(),
  });

  assert.equal(route.kind, "HOME");
  assert.match(route.view.html, /data-contact-intent-form="true"/u);
  assert.match(route.view.html, /仅用于当前浏览器演示，不保存、不发送/u);
  assert.doesNotMatch(route.view.html, /https?:\/\//iu);
  assert.deepEqual(route.view.requests, []);
  assert.deepEqual(route.view.externalDestinations, []);
});

test("visitor contact intent exposes validation, submitting, and confirmed states", () => {
  const invalid = renderVisitorContactIntent("INVALID");
  const submitting = renderVisitorContactIntent("SUBMITTING");
  const confirmed = renderVisitorContactIntent("CONFIRMED");

  assert.match(invalid, /role="alert"/u);
  assert.match(invalid, /请填写模拟称呼并选择想了解的内容/u);
  assert.match(submitting, /role="status"/u);
  assert.match(submitting, /模拟提交中/u);
  assert.match(confirmed, /已收到你的模拟意向/u);
  assert.match(confirmed, /不会发送消息/u);
  assert.doesNotMatch(`${invalid}${submitting}${confirmed}`, /https?:\/\//iu);
});

test("visitor content carries the institution context and explicit unavailable state", () => {
  const published = selectVisitorRoute({
    path: "/visitor/content/teacher-team",
    response: createSyntheticVisitorResponse(),
  });
  const unavailable = selectVisitorRoute({
    path: "/visitor/content/unknown",
    response: createSyntheticVisitorResponse(),
  });

  assert.equal(published.kind, "CONTENT");
  assert.match(published.view.html, /同芯学园/u);
  assert.match(published.view.html, /模拟数据/u);
  assert.match(published.view.html, /返回访客首页/u);
  assert.equal(unavailable.kind, "CONTENT");
  assert.match(unavailable.view.html, /访客内容暂不可用/u);
  assert.match(unavailable.view.html, /公开内容暂不可用/u);
});

test("visitor public verticals expose institution and day-flow routes with synthetic published data", () => {
  const response = createSyntheticPublicVerticalResponse();
  const institution = renderVisitorInstitution(response);
  const dayFlow = renderVisitorDayFlow(response);

  assert.equal(institution.route, "/web/visitor/institution");
  assert.equal(institution.state, "PUBLISHED");
  assert.match(institution.html, /机构介绍/u);
  assert.match(institution.html, /模拟数据/u);
  assert.equal(dayFlow.route, "/web/visitor/day-flow");
  assert.equal(dayFlow.state, "PUBLISHED");
  assert.match(dayFlow.html, /一日流程/u);
  assert.match(dayFlow.html, /抵达与安顿/u);
  assert.deepEqual(institution.requests, []);
  assert.deepEqual(dayFlow.externalDestinations, []);
});

test("visitor public verticals fail closed across loading, empty, error, and unsafe projections", () => {
  const response = createSyntheticPublicVerticalResponse();
  assert.equal(renderVisitorInstitution(response, "LOADING").state, "LOADING");
  assert.equal(
    renderVisitorInstitution({ institution: null, dayFlow: response.dayFlow }).state,
    "EMPTY",
  );
  assert.equal(
    renderVisitorInstitution({ institution: { title: 42 } }, "PUBLISHED").state,
    "ERROR",
  );
  assert.equal(
    renderVisitorDayFlow({
      dayFlow: { ...response.dayFlow, freshnessStatus: "STALE" },
    }).state,
    "EMPTY",
  );
  assert.doesNotMatch(
    renderVisitorDayFlow({ dayFlow: { ...response.dayFlow, scope: "FOREIGN" } }).html,
    /抵达与安顿/u,
  );
});

test("visitor routing selects the public vertical slices", () => {
  const response = createSyntheticVisitorResponse();
  const institution = selectVisitorRoute({ path: "/web/visitor/institution", response });
  const dayFlow = selectVisitorRoute({ path: "/web/visitor/day-flow", response });

  assert.equal(institution.kind, "INSTITUTION");
  assert.equal(institution.view.route, "/web/visitor/institution");
  assert.equal(dayFlow.kind, "DAY_FLOW");
  assert.equal(dayFlow.view.route, "/web/visitor/day-flow");
});

test("public verticals fail closed for unsafe records without exposing正文", () => {
  const response = createSyntheticPublicVerticalResponse();
  const mutations = [
    { publicationStatus: "DRAFT" },
    { publicationStatus: "UNPUBLISHED" },
    { visibility: "PRIVATE" },
    { scope: "FOREIGN" },
    { tenantId: "tenant-other" },
    { campusId: "campus-other" },
    { freshnessStatus: "STALE" },
    { enabledStatus: "DISABLED" },
    { syntheticData: "REAL" },
    { id: "unknown" },
  ];
  for (const mutation of mutations) {
    const institution = renderVisitorInstitution({
      institution: { ...response.institution, ...mutation, summary: "hidden-body-marker" },
    });
    const dayFlow = renderVisitorDayFlow({
      dayFlow: { ...response.dayFlow, ...mutation, summary: "hidden-body-marker" },
    });
    for (const view of [institution, dayFlow]) {
      assert.notEqual(view.state, "PUBLISHED", JSON.stringify(mutation));
      assert.doesNotMatch(view.html, /hidden-body-marker/u);
      assert.deepEqual(view.requests, []);
      assert.deepEqual(view.externalDestinations, []);
    }
  }
});

test("public vertical pages keep culture, timeline, and local return landmarks", () => {
  const response = createSyntheticPublicVerticalResponse();
  const institution = renderVisitorInstitution(response);
  const dayFlow = renderVisitorDayFlow(response);

  assert.match(institution.html, /id="institution-culture"/u);
  assert.match(institution.html, /企业文化/u);
  assert.match(institution.html, /href="\/visitor#about"/u);
  assert.equal((dayFlow.html.match(/<details\b/gu) ?? []).length, 3);
  assert.ok(dayFlow.html.indexOf("15:30") < dayFlow.html.indexOf("16:00"));
  assert.ok(dayFlow.html.indexOf("16:00") < dayFlow.html.indexOf("17:30"));
  assert.match(dayFlow.html, /href="\/visitor#routine"/u);
});
