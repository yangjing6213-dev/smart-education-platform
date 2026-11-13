import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { PublicInstitutionClient } from "../app/web/visitor/public-institution.js";
import { VisitorRouteView } from "../app/web/visitor/route-view.js";

test("content detail returns Next 404 only for an explicitly missing public record", async () => {
  const previousBase = process.env.PUBLIC_API_BASE_URL;
  const previousRef = process.env.PUBLIC_CAMPUS_REF;
  const previousFetch = globalThis.fetch;
  process.env.PUBLIC_API_BASE_URL = "http://127.0.0.1:4100";
  process.env.PUBLIC_CAMPUS_REF = "synthetic-campus-east";
  try {
    globalThis.fetch = async () => new Response("{}", { status: 404 });
    await assert.rejects(
      VisitorRouteView({ path: "/visitor/content/missing-record", section: "home" }),
      { digest: "NEXT_HTTP_ERROR_FALLBACK;404" },
    );

    globalThis.fetch = async () => new Response("{}", { status: 503 });
    const unavailable = renderToStaticMarkup(
      await VisitorRouteView({ path: "/visitor/content/missing-record", section: "home" }),
    );
    assert.match(unavailable, /公开机构资料暂时无法读取/);
    assert.doesNotMatch(unavailable, /当前没有已发布且可公开的内容/);

    delete process.env.PUBLIC_API_BASE_URL;
    const unconfigured = renderToStaticMarkup(
      await VisitorRouteView({ path: "/visitor/content/missing-record", section: "home" }),
    );
    assert.match(unconfigured, /公开机构资料尚未配置/);
  } finally {
    globalThis.fetch = previousFetch;
    if (previousBase === undefined) delete process.env.PUBLIC_API_BASE_URL;
    else process.env.PUBLIC_API_BASE_URL = previousBase;
    if (previousRef === undefined) delete process.env.PUBLIC_CAMPUS_REF;
    else process.env.PUBLIC_CAMPUS_REF = previousRef;
  }
});

const publicRef = "synthetic-campus-east";

function projection(overrides: Record<string, unknown> = {}) {
  return {
    id: "synthetic-content-id",
    content_key: "institution-profile",
    type: "INSTITUTION",
    title: "合成机构介绍",
    version: 2,
    visibility: "PUBLIC",
    summary: "只用于自动测试的虚构说明。",
    blocks: [{ kind: "TEXT", text: "不对应真实机构。" }],
    published_at: "2026-10-22T08:00:00.000Z",
    editor_note: "不应公开",
    tenant_id: "must-not-be-projected",
    ...overrides,
  };
}

test("visitor public content remains empty until its server configuration is supplied", async () => {
  let requested = false;
  const client = new PublicInstitutionClient({
    fetcher: async () => {
      requested = true;
      return new Response("{}", { status: 200 });
    },
  });

  assert.deepEqual(await client.list("home"), { state: "NOT_CONFIGURED", items: [] });
  assert.equal(requested, false);
});

test("visitor public client accepts only HTTPS or loopback HTTP and valid opaque references", async () => {
  let requests = 0;
  const fetcher = async () => {
    requests += 1;
    return new Response(JSON.stringify({ data: [] }), { status: 200 });
  };
  const insecureRemote = new PublicInstitutionClient({
    baseUrl: "http://example.test",
    publicRef,
    fetcher,
  });
  const invalidReference = new PublicInstitutionClient({
    baseUrl: "https://api.example.test",
    publicRef: "campus/ref?tenant_id=spoofed",
    fetcher,
  });
  const local = new PublicInstitutionClient({
    baseUrl: "http://127.0.0.1:4100",
    publicRef,
    fetcher,
  });

  assert.deepEqual(await insecureRemote.list("home"), { state: "ERROR", items: [] });
  assert.deepEqual(await invalidReference.list("home"), { state: "ERROR", items: [] });
  assert.equal((await local.list("home")).state, "READY");
  assert.equal(requests, 1);
});

test("visitor public requests contain only the campus reference and project approved fields", async () => {
  let requestedUrl: URL | undefined;
  let requestedInit: RequestInit | undefined;
  const client = new PublicInstitutionClient({
    baseUrl: "https://api.example.test",
    publicRef,
    fetcher: async (input, init) => {
      requestedUrl = new URL(String(input));
      requestedInit = init;
      return new Response(JSON.stringify({ data: [projection()] }), { status: 200 });
    },
  });

  const result = await client.list("profile");
  assert.equal(result.state, "READY");
  assert.equal(result.items.length, 1);
  assert.deepEqual(result.items[0], {
    slug: "institution-profile",
    title: "合成机构介绍",
    summary: "只用于自动测试的虚构说明。",
    body: ["不对应真实机构。"],
    publicationStatus: "PUBLISHED",
    visibility: "PUBLIC",
    scope: "PUBLIC",
    syntheticData: "SIMULATED",
    freshnessStatus: "FRESH",
    enabledStatus: "ENABLED",
  });
  assert.equal(requestedUrl?.pathname, "/public/institution/profile");
  assert.deepEqual([...requestedUrl!.searchParams.entries()], [["public_ref", publicRef]]);
  assert.equal(requestedInit?.method, "GET");
  assert.equal(requestedInit?.credentials, "omit");
  assert.equal(requestedInit?.cache, "no-store");
  assert.equal(requestedInit?.redirect, "error");
});

test("visitor public client fails closed on invalid projections and reports missing content", async () => {
  const invalid = new PublicInstitutionClient({
    baseUrl: "https://api.example.test",
    publicRef,
    fetcher: async () =>
      new Response(JSON.stringify({ data: [projection({ visibility: "STAFF" })] }), {
        status: 200,
      }),
  });
  const missing = new PublicInstitutionClient({
    baseUrl: "https://api.example.test",
    publicRef,
    fetcher: async () => new Response("{}", { status: 404 }),
  });

  assert.deepEqual(await invalid.list("profile"), { state: "ERROR", items: [] });
  assert.deepEqual(await missing.read("home", "missing-content"), { state: "EMPTY" });
  assert.deepEqual(await missing.read("home", "bad/key"), { state: "ERROR" });
});

test("Next visitor home renders escaped API content without the old static demo or contact form", async () => {
  const previousBaseUrl = process.env.PUBLIC_API_BASE_URL;
  const previousPublicRef = process.env.PUBLIC_CAMPUS_REF;
  const previousFetch = globalThis.fetch;
  process.env.PUBLIC_API_BASE_URL = "http://127.0.0.1:4100";
  process.env.PUBLIC_CAMPUS_REF = publicRef;
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        data: [
          projection({
            content_key: "synthetic-public-card",
            type: "HOME_BLOCK",
            title: "<script>alert(1)</script>",
            summary: "<img src=x onerror=alert(1)>",
          }),
        ],
      }),
      { status: 200 },
    );

  try {
    const markup = renderToStaticMarkup(
      await VisitorRouteView({ path: "/visitor", section: "home" }),
    );
    assert.match(markup, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
    assert.match(markup, /&lt;img src=x onerror=alert\(1\)&gt;/);
    assert.doesNotMatch(markup, /<script|<img src=x/i);
    assert.doesNotMatch(markup, /让成长从放学后继续发生|林老师|contact-intent-form/);
  } finally {
    globalThis.fetch = previousFetch;
    if (previousBaseUrl === undefined) delete process.env.PUBLIC_API_BASE_URL;
    else process.env.PUBLIC_API_BASE_URL = previousBaseUrl;
    if (previousPublicRef === undefined) delete process.env.PUBLIC_CAMPUS_REF;
    else process.env.PUBLIC_CAMPUS_REF = previousPublicRef;
  }
});

test("Next visitor home shows an unavailable state and no static content when unconfigured", async () => {
  const previousBaseUrl = process.env.PUBLIC_API_BASE_URL;
  const previousPublicRef = process.env.PUBLIC_CAMPUS_REF;
  const previousFetch = globalThis.fetch;
  delete process.env.PUBLIC_API_BASE_URL;
  delete process.env.PUBLIC_CAMPUS_REF;
  globalThis.fetch = async () => {
    throw new Error("fetch must not run without server configuration");
  };

  try {
    const markup = renderToStaticMarkup(
      await VisitorRouteView({ path: "/visitor", section: "home" }),
    );
    assert.match(markup, /公开机构资料尚未配置，暂时无法展示。/);
    assert.doesNotMatch(markup, /让成长从放学后继续发生|林老师|课后成长与校园动态/);
  } finally {
    globalThis.fetch = previousFetch;
    if (previousBaseUrl === undefined) delete process.env.PUBLIC_API_BASE_URL;
    else process.env.PUBLIC_API_BASE_URL = previousBaseUrl;
    if (previousPublicRef === undefined) delete process.env.PUBLIC_CAMPUS_REF;
    else process.env.PUBLIC_CAMPUS_REF = previousPublicRef;
  }
});

test("Next institution and content detail routes read the matching published API records", async () => {
  const previousBaseUrl = process.env.PUBLIC_API_BASE_URL;
  const previousPublicRef = process.env.PUBLIC_CAMPUS_REF;
  const previousFetch = globalThis.fetch;
  const requestedPaths: string[] = [];
  process.env.PUBLIC_API_BASE_URL = "http://127.0.0.1:4100";
  process.env.PUBLIC_CAMPUS_REF = publicRef;
  globalThis.fetch = async (input) => {
    const url = new URL(String(input));
    requestedPaths.push(url.pathname);
    if (url.pathname === "/public/institution/profile") {
      return new Response(
        JSON.stringify({
          data: [projection({ title: "已发布的合成机构资料" })],
        }),
        { status: 200 },
      );
    }
    return new Response(
      JSON.stringify({
        data: projection({
          content_key: "home-public-card",
          type: "HOME_BLOCK",
          title: "已发布的合成首页详情",
          summary: "首页详情摘要。",
        }),
      }),
      { status: 200 },
    );
  };

  try {
    const institutionMarkup = renderToStaticMarkup(
      await VisitorRouteView({ path: "/web/visitor/institution", section: "institution" }),
    );
    const detailMarkup = renderToStaticMarkup(
      await VisitorRouteView({ path: "/visitor/content/home-public-card", section: "home" }),
    );
    assert.match(institutionMarkup, /已发布的合成机构资料/);
    assert.match(institutionMarkup, /不对应真实机构。/);
    assert.match(detailMarkup, /已发布的合成首页详情/);
    assert.match(detailMarkup, /首页详情摘要。/);
    assert.deepEqual(requestedPaths, [
      "/public/institution/profile",
      "/public/institution/home/home-public-card",
    ]);
  } finally {
    globalThis.fetch = previousFetch;
    if (previousBaseUrl === undefined) delete process.env.PUBLIC_API_BASE_URL;
    else process.env.PUBLIC_API_BASE_URL = previousBaseUrl;
    if (previousPublicRef === undefined) delete process.env.PUBLIC_CAMPUS_REF;
    else process.env.PUBLIC_CAMPUS_REF = previousPublicRef;
  }
});
