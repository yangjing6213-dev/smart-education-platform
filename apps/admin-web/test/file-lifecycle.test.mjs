import assert from "node:assert/strict";
import test from "node:test";
import {
  createLocalMediaTransport,
  MediaAssetsAdminClient,
} from "../dist/local-review/media-assets.js";
import { renderFileLifecycle } from "../dist/pages/file-lifecycle.js";
import { buildLocalSyntheticServer } from "../../api/dist/src/local-synthetic/server.js";

const { fetch, Headers, Response, URL } = globalThis;

const id = "00000000-0000-4000-8000-0000000002bd";
const referenceId = "00000000-0000-4000-8000-000000000321";
const asset = {
  id,
  alias: "teacher-profile-placeholder",
  title: "教师介绍占位图",
  version: 1,
  type: "IMAGE",
  status: "REFERENCED",
  expiresOn: "2026-12-31",
  references: [{ id: referenceId, label: "教师介绍", kind: "TEACHER_INTRO" }],
};
const summary = {
  total: 3,
  available: 1,
  referenced: 1,
  expired: 0,
  archived: 1,
  revoked: 0,
  deleted: 0,
};

function transportFor(profile, log, responseOverrides = {}) {
  return async (path, options = {}) => {
    log.push({ path, method: options.method ?? "GET" });
    let body;
    let status = 200;
    if (path === "/local/sessions") {
      body = { handle: "a".repeat(43), mode: "local-synthetic", label: "合成身份" };
      status = 201;
    } else if (path === "/local/session") {
      body = {
        profile,
        actions:
          profile === "owner-east"
            ? ["media:read", "media:manage"]
            : profile === "platform-admin"
              ? ["media:summary"]
              : ["identity:read"],
      };
    } else if (path === "/local/media-assets") body = { assets: [asset] };
    else if (path === "/local/media-asset-events") body = [];
    else if (path === "/local/media-asset-summary") body = summary;
    else if (responseOverrides[path]) {
      ({ body, status } = responseOverrides[path]);
    } else body = { ...asset, status: "ARCHIVED", version: 2, references: [] };
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => body,
    };
  };
}

test("campus owner connects to scoped media metadata without paths or file bytes", async () => {
  const requests = [];
  const client = new MediaAssetsAdminClient(transportFor("owner-east", requests));
  await client.connect("owner-east");
  assert.equal(client.snapshot.status, "READY");
  assert.equal(client.snapshot.assets[0].title, "教师介绍占位图");
  assert.deepEqual(client.snapshot.summary, null);
  assert.doesNotMatch(
    JSON.stringify(client.snapshot),
    /objectKey|downloadUrl|signedUrl|filePath|bytes/iu,
  );
  assert.ok(requests.some((request) => request.path === "/local/media-assets"));
});

test("teacher role is denied before asset-list data is requested", async () => {
  const requests = [];
  const client = new MediaAssetsAdminClient(transportFor("teacher-east", requests));
  await client.connect("teacher-east");
  assert.equal(client.snapshot.status, "DENIED");
  assert.equal(client.snapshot.assets.length, 0);
  assert.equal(
    requests.some((request) => request.path === "/local/media-assets"),
    false,
  );
});

test("platform role receives aggregate counts only", async () => {
  const requests = [];
  const client = new MediaAssetsAdminClient(transportFor("platform-admin", requests));
  await client.connect("platform-admin");
  assert.equal(client.snapshot.status, "READY");
  assert.deepEqual(client.snapshot.summary, summary);
  assert.equal(client.snapshot.assets.length, 0);
  assert.equal(
    requests.some((request) => request.path === "/local/media-assets"),
    false,
  );
});

test("version conflict is explained and readonly rendering disables every action", async () => {
  const conflict = {
    "/local/media-assets/00000000-0000-4000-8000-0000000002bd/archive": {
      body: { error: { code: "STATE_CONFLICT" } },
      status: 409,
    },
  };
  const requests = [];
  const client = new MediaAssetsAdminClient(transportFor("owner-east", requests, conflict));
  await client.connect("owner-east");
  await client.archive(id, 1);
  assert.match(client.snapshot.message, /刷新后重试/u);
  const readonly = renderFileLifecycle(client.snapshot, "owner-east", true);
  assert.match(readonly, /合成数据/u);
  assert.match(readonly, /disabled/u);
  assert.doesNotMatch(readonly, /https?:\/\//u);
  assert.doesNotMatch(readonly, /objectKey|signedUrl|filePath/u);
});

test("platform and denied views do not render individual media names or references", async () => {
  const requests = [];
  const client = new MediaAssetsAdminClient(transportFor("platform-admin", requests));
  await client.connect("platform-admin");
  const html = renderFileLifecycle(client.snapshot, "platform-admin", false);
  assert.match(html, /匿名汇总/u);
  assert.doesNotMatch(html, /教师介绍占位图|家长指南占位文档/u);
});

test("media transport uses only the configured loopback port and local API paths", async () => {
  const requests = [];
  const transport = createLocalMediaTransport(4317, async (input, init) => {
    requests.push({ url: new URL(input), init });
    return new Response("{}", { headers: { "content-type": "application/json" } });
  });

  await transport("/local/media-assets", { method: "GET" });

  assert.equal(requests.length, 1);
  assert.equal(requests[0].url.origin, "http://127.0.0.1:4317");
  assert.equal(requests[0].url.pathname, "/local/media-assets");
  await assert.rejects(
    () => transport("https://example.invalid/local/media-assets"),
    /只允许访问本机合成服务/u,
  );
  await assert.rejects(() => transport("/admin/private"), /只允许访问本机合成服务/u);
  assert.equal(requests.length, 1);
});

test("missing or invalid media service ports never call the network transport", async () => {
  const requests = [];
  for (const port of [null, 0, -1, 65536, Number.NaN]) {
    const transport = createLocalMediaTransport(port, async (...args) => {
      requests.push(args);
      return new Response("{}", { headers: { "content-type": "application/json" } });
    });
    await assert.rejects(() => transport("/local/media-assets"), /本机服务端口无效/u);
  }
  assert.equal(requests.length, 0);
});

test("disconnect stops a pending connection from requesting or restoring page state", async () => {
  const requests = [];
  let notifySessionStarted;
  let resolveSession;
  const sessionStarted = new Promise((resolve) => {
    notifySessionStarted = resolve;
  });
  const pendingSession = new Promise((resolve) => {
    resolveSession = resolve;
  });
  const client = new MediaAssetsAdminClient(async (path) => {
    requests.push(path);
    if (path === "/local/sessions")
      return {
        ok: true,
        status: 201,
        json: async () => ({ handle: "a".repeat(43) }),
      };
    if (path === "/local/session") {
      notifySessionStarted();
      return pendingSession;
    }
    throw new Error(`Unexpected request after disconnect: ${path}`);
  });

  const connection = client.connect("owner-east");
  await sessionStarted;
  client.disconnect();
  resolveSession({
    ok: true,
    status: 200,
    json: async () => ({ profile: "owner-east", actions: ["media:read", "media:manage"] }),
  });
  await connection;

  assert.deepEqual(requests, ["/local/sessions", "/local/session"]);
  assert.equal(client.snapshot.status, "IDLE");
  assert.equal(client.snapshot.profile, null);
  assert.equal(client.snapshot.assets.length, 0);
});

test("disconnect prevents an in-flight media list from restoring old page data", async () => {
  let notifyAssetsStarted;
  let resolveAssets;
  const assetsStarted = new Promise((resolve) => {
    notifyAssetsStarted = resolve;
  });
  const pendingAssets = new Promise((resolve) => {
    resolveAssets = resolve;
  });
  const client = new MediaAssetsAdminClient(async (path) => {
    if (path === "/local/sessions")
      return { ok: true, status: 201, json: async () => ({ handle: "a".repeat(43) }) };
    if (path === "/local/session")
      return {
        ok: true,
        status: 200,
        json: async () => ({ profile: "owner-east", actions: ["media:read", "media:manage"] }),
      };
    if (path === "/local/media-assets") {
      notifyAssetsStarted();
      return pendingAssets;
    }
    if (path === "/local/media-asset-events")
      return { ok: true, status: 200, json: async () => [] };
    throw new Error(`Unexpected request: ${path}`);
  });

  const connection = client.connect("owner-east");
  await assetsStarted;
  client.disconnect();
  resolveAssets({ ok: true, status: 200, json: async () => ({ assets: [asset] }) });
  await connection;

  assert.equal(client.snapshot.status, "IDLE");
  assert.equal(client.snapshot.profile, null);
  assert.equal(client.snapshot.assets.length, 0);
  assert.equal(client.snapshot.events.length, 0);
});

test("disconnect invalidates pending refresh, management and access-check requests", async () => {
  const scenarios = [
    { name: "refresh", path: "/local/media-assets", body: { assets: [asset] } },
    {
      name: "management",
      path: `/local/media-assets/${id}/archive`,
      body: { id, status: "ARCHIVED", version: 2 },
      operation: (client) => client.archive(id, 1),
    },
    {
      name: "access-check",
      path: `/local/media-assets/${id}/access-check`,
      body: { allowed: true, recorded: true, message: "已记录" },
      operation: (client) => client.checkAccess(id, 1),
    },
  ];

  for (const scenario of scenarios) {
    const requests = [];
    let delayEnabled = false;
    let notifyStarted;
    let resolvePending;
    const requestStarted = new Promise((resolve) => {
      notifyStarted = resolve;
    });
    const pendingResponse = new Promise((resolve) => {
      resolvePending = resolve;
    });
    const client = new MediaAssetsAdminClient(async (path) => {
      requests.push(path);
      if (delayEnabled && path === scenario.path) {
        notifyStarted();
        return pendingResponse;
      }
      const body =
        path === "/local/sessions"
          ? { handle: "a".repeat(43) }
          : path === "/local/session"
            ? { profile: "owner-east", actions: ["media:read", "media:manage"] }
            : path === "/local/media-assets"
              ? { assets: [asset] }
              : path === "/local/media-asset-events"
                ? []
                : {};
      return {
        ok: true,
        status: path === "/local/sessions" ? 201 : 200,
        json: async () => body,
      };
    });
    await client.connect("owner-east");
    delayEnabled = true;
    const operation = scenario.operation?.(client) ?? client.refresh();
    await requestStarted;
    const requestCountAtDisconnect = requests.length;
    client.disconnect();
    resolvePending({
      ok: true,
      status: 200,
      json: async () => scenario.body,
    });
    await operation;

    assert.equal(client.snapshot.status, "IDLE", `${scenario.name} leaves the client disconnected`);
    assert.equal(client.snapshot.assets.length, 0, `${scenario.name} does not restore old assets`);
    assert.equal(
      requests.length,
      requestCountAtDisconnect,
      `${scenario.name} starts no request after disconnect`,
    );
  }
});

test("media client connects to a real in-memory service on the launcher's port", async () => {
  const allowedOrigin = "http://127.0.0.1:49999";
  const service = await buildLocalSyntheticServer({
    mode: "local-synthetic",
    allowedOrigins: [allowedOrigin],
  });
  try {
    const base = await service.start(0);
    const servicePort = Number(new URL(base).port);
    const preflight = await fetch(`${base}/local/sessions`, {
      method: "OPTIONS",
      headers: {
        Origin: allowedOrigin,
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "authorization,content-type",
      },
    });
    assert.equal(preflight.status, 204);
    assert.equal(preflight.headers.get("access-control-allow-origin"), allowedOrigin);
    assert.match(preflight.headers.get("access-control-allow-methods") ?? "", /POST/u);
    assert.match(preflight.headers.get("access-control-allow-headers") ?? "", /authorization/u);
    const transport = createLocalMediaTransport(servicePort, async (input, init) => {
      const headers = new Headers(init?.headers);
      headers.set("Origin", allowedOrigin);
      const response = await fetch(input, { ...init, headers });
      assert.equal(response.headers.get("access-control-allow-origin"), allowedOrigin);
      return response;
    });
    const client = new MediaAssetsAdminClient(transport);
    await client.connect("owner-east");

    assert.equal(client.snapshot.status, "READY");
    assert.ok(client.snapshot.assets.length > 0);
    assert.equal(client.snapshot.profile, "owner-east");
    assert.doesNotMatch(JSON.stringify(client.snapshot), /objectKey|signedUrl|filePath/u);
  } finally {
    await service.close();
  }
});
