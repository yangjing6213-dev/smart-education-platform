import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer, request } from "node:http";
import process from "node:process";
import { createInterface } from "node:readline";
import test from "node:test";
import { fileURLToPath, URL } from "node:url";
import { chromium } from "playwright";
import { proxyReview } from "../src/local-proxy.mjs";
import {
  SUPPLY_REQUEST_REVIEW_ROUTE,
  SupplyRequestReviewClient,
  renderSupplyRequestReview,
} from "../dist/local-review/supply-request.js";

const session = {
  profile: "owner-east",
  label: "示例东校区负责人",
  tenantId: "00000000-0000-4000-8000-000000000100",
  campusId: "00000000-0000-4000-8000-000000000101",
  classIds: ["00000000-0000-4000-8000-000000000103"],
  actions: ["supply:read", "supply:review", "supply:claim"],
};
const statuses = [
  "DRAFT",
  "SUBMITTED",
  "CONFIRMED",
  "RETURNED",
  "READY",
  "OUT_OF_STOCK",
  "CANCELLED",
  "CLAIMED",
];
const counts = (status = "SUBMITTED") =>
  Object.fromEntries(statuses.map((key) => [key, key === status ? 1 : 0]));
const row = (status = "SUBMITTED", version = 2) => ({
  id: "00000000-0000-4000-8000-000000000701",
  kind: "supplyRequest",
  version,
  status,
  tenantId: session.tenantId,
  campusId: session.campusId,
  classId: session.classIds[0],
  createdBy: "00000000-0000-4000-8000-000000000003",
  authorLabel: "示例东校区教师",
  catalog: "ART_ACTIVITY_SET",
  quantity: 2,
  purpose: "CLASS_ACTIVITY",
  synthetic: true,
});
const response = (payload, status = 200) => ({
  ok: status < 400,
  status,
  json: async () => globalThis.structuredClone(payload),
});
function fixture() {
  let current = row();
  const calls = [];
  const transport = async (path, init) => {
    calls.push({ path, ...init });
    if (path === "/local/sessions") return response({ handle: "a".repeat(43) });
    if (path === "/local/session") return response(session);
    if (path === "/local/supply-summary")
      return response({ synthetic: true, counts: counts(current.status) });
    if (path === "/local/supply-requests") return response([current]);
    if (path === "/local/supply-requests-review")
      return response(
        ["SUBMITTED", "READY", "OUT_OF_STOCK"].includes(current.status) ? [current] : [],
      );
    if (path.endsWith("/review")) {
      const body = JSON.parse(init.body);
      current = row(
        body.action === "CONFIRM"
          ? "READY"
          : body.action === "RETURN"
            ? "RETURNED"
            : "OUT_OF_STOCK",
        body.version + 1,
      );
      return response(current);
    }
    if (path.endsWith("/claim")) {
      current = row("CLAIMED", JSON.parse(init.body).version + 1);
      return response(current);
    }
    return response({}, 404);
  };
  return { transport, calls };
}

test("review page exposes fixed catalog, versioned controls, and read-only history", async () => {
  const { transport } = fixture();
  const client = new SupplyRequestReviewClient(transport);
  await client.connect("CAMPUS_REVIEWER");
  const html = renderSupplyRequestReview(client.snapshot, true);
  assert.equal(SUPPLY_REQUEST_REVIEW_ROUTE, "/admin/supply-request-review");
  assert.match(html, /美术活动包/u);
  assert.match(html, /班级活动/u);
  assert.match(html, /确认可领取/u);
  assert.match(html, /退回修改/u);
  assert.match(html, /标记缺货/u);
  assert.doesNotMatch(html, /textarea|<input/u);
  assert.doesNotMatch(renderSupplyRequestReview(client.snapshot, false), /data-supply-action/u);
});

test("confirm and claim send exact versioned commands and retain terminal history", async () => {
  const { transport, calls } = fixture();
  const client = new SupplyRequestReviewClient(transport);
  await client.connect("INSTITUTION_REVIEWER");
  await client.command(row().id, 2, "CONFIRM");
  assert.equal(client.snapshot.rows[0].status, "READY");
  await client.command(row().id, 3, "CLAIM");
  assert.equal(client.snapshot.rows.length, 0);
  assert.equal(client.snapshot.history[0].status, "CLAIMED");
  assert.equal(client.snapshot.counts.CLAIMED, 1);
  assert.deepEqual(JSON.parse(calls.find((call) => call.path.endsWith("/review")).body), {
    version: 2,
    action: "CONFIRM",
  });
  assert.deepEqual(JSON.parse(calls.find((call) => call.path.endsWith("/claim")).body), {
    version: 3,
  });
  const writes = calls.filter((call) => call.method === "POST").length;
  await assert.rejects(client.command(row().id, 3, "CLAIM"), /最新状态|刷新/u);
  assert.equal(calls.filter((call) => call.method === "POST").length, writes);
  assert.ok(
    calls.every(
      (call) =>
        call.path.startsWith("/local/") && call.credentials === "omit" && call.redirect === "error",
    ),
  );
});

for (const action of ["RETURN", "OUT_OF_STOCK"]) {
  test(`${action} refreshes the review queue and all-status counts`, async () => {
    const { transport } = fixture();
    const client = new SupplyRequestReviewClient(transport);
    await client.connect("CAMPUS_REVIEWER");
    await client.command(row().id, 2, action);
    const status = action === "RETURN" ? "RETURNED" : "OUT_OF_STOCK";
    assert.equal(client.snapshot.counts[status], 1);
    assert.match(
      renderSupplyRequestReview(client.snapshot, true),
      action === "RETURN" ? /已退回/u : /缺货/u,
    );
  });
}

test("platform fetches only counts and never renders previously loaded detail", async () => {
  const { transport, calls } = fixture();
  const client = new SupplyRequestReviewClient(transport);
  await client.connect("CAMPUS_REVIEWER");
  const old = client.snapshot;
  calls.length = 0;
  await client.connect("PLATFORM_ADMIN");
  assert.deepEqual(
    calls.map((call) => call.path),
    ["/local/sessions", "/local/supply-summary"],
  );
  assert.deepEqual(JSON.parse(calls[0].body), { profile: "platform-admin" });
  assert.equal(client.snapshot.counts.SUBMITTED, 1);
  assert.deepEqual(client.snapshot.rows, []);
  assert.deepEqual(client.snapshot.history, []);
  assert.equal(client.snapshot.session, null);
  const html = renderSupplyRequestReview({ ...old, role: "PLATFORM_ADMIN" }, true);
  assert.match(html, /匿名状态统计/u);
  for (const detail of [
    row().id,
    session.campusId,
    session.label,
    row().authorLabel,
    "美术活动包",
    "班级活动",
    "data-supply-action",
  ])
    assert.ok(!html.includes(detail), detail);
  await assert.rejects(client.command(row().id, 2, "CONFIRM"), /无权/u);
});

test("invalid scope, fixed item, or quantity fails closed", async () => {
  for (const patch of [
    { campusId: "00000000-0000-4000-8000-000000000999" },
    { quantity: 21 },
    { catalog: "constructor" },
    { purpose: "toString" },
    { synthetic: false },
  ]) {
    const { transport } = fixture();
    const client = new SupplyRequestReviewClient((path, init) =>
      path === "/local/supply-requests-review"
        ? response([{ ...row(), ...patch }])
        : transport(path, init),
    );
    await client.connect("CAMPUS_REVIEWER");
    assert.equal(client.snapshot.status, "ERROR");
    assert.deepEqual(client.snapshot.rows, []);
    assert.deepEqual(client.snapshot.history, []);
  }
});

test("platform rejects unexpected summary details and negative counts", async () => {
  for (const body of [
    { synthetic: true, counts: counts(), rows: [row()] },
    { synthetic: true, counts: { ...counts(), READY: -1 } },
  ]) {
    const { transport } = fixture();
    const client = new SupplyRequestReviewClient((path, init) =>
      path === "/local/supply-summary" ? response(body) : transport(path, init),
    );
    await client.connect("PLATFORM_ADMIN");
    assert.equal(client.snapshot.status, "ERROR");
    assert.deepEqual(client.snapshot.rows, []);
  }
});

test("late owner response cannot overwrite a newly selected platform role", async () => {
  const { transport } = fixture();
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  let reached;
  const waiting = new Promise((resolve) => {
    reached = resolve;
  });
  const client = new SupplyRequestReviewClient(async (path, init) => {
    if (path === "/local/supply-requests-review") {
      reached();
      await gate;
    }
    return transport(path, init);
  });
  const owner = client.connect("CAMPUS_REVIEWER");
  await waiting;
  await client.connect("PLATFORM_ADMIN");
  release();
  await owner;
  assert.equal(client.snapshot.role, "PLATFORM_ADMIN");
  assert.deepEqual(client.snapshot.rows, []);
  assert.equal(client.snapshot.session, null);
});

test("leaving the review page clears its local session and request details", async () => {
  const { transport } = fixture();
  const client = new SupplyRequestReviewClient(transport);
  await client.connect("CAMPUS_REVIEWER");
  client.disconnect();
  assert.equal(client.snapshot.status, "IDLE");
  assert.equal(client.snapshot.session, null);
  assert.deepEqual(client.snapshot.rows, []);
  assert.deepEqual(client.snapshot.history, []);
});

test("HTTP conflict refreshes stale rows and explains the retry", async () => {
  const { transport } = fixture();
  const client = new SupplyRequestReviewClient((path, init) =>
    path.endsWith("/review") ? response({}, 409) : transport(path, init),
  );
  await client.connect("CAMPUS_REVIEWER");
  await assert.rejects(client.command(row().id, 2, "CONFIRM"), /最新状态|刷新/u);
});

test("actual preview proxy allows only scoped supply reads, review and claim", async () => {
  const seen = [];
  const upstream = createServer((req, res) => {
    seen.push(req.url);
    res.end("[]");
  });
  upstream.listen(0, "127.0.0.1");
  await once(upstream, "listening");
  const proxy = createServer(
    (req, res) => void proxyReview(req, res, proxy.address().port, upstream.address().port),
  );
  proxy.listen(0, "127.0.0.1");
  await once(proxy, "listening");
  const base = `http://127.0.0.1:${proxy.address().port}`;
  const send = (path, method = "GET", origin = base) =>
    new Promise((resolve, reject) => {
      const req = request(
        base + path,
        { method, headers: { Origin: origin, "Content-Type": "application/json" } },
        (res) => {
          res.resume();
          res.on("end", () => resolve(res.statusCode));
        },
      );
      req.on("error", reject);
      req.end(method === "POST" ? "{}" : undefined);
    });
  try {
    for (const path of [
      "/local/supply-requests",
      "/local/supply-requests-review",
      "/local/supply-summary",
    ])
      assert.equal(await send(path), 200);
    for (const action of ["review", "claim"])
      assert.equal(await send(`/local/supply-requests/${row().id}/${action}`, "POST"), 200);
    const before = seen.length;
    assert.equal(await send("/local/supply-requests", "POST"), 404);
    assert.equal(await send(`/local/supply-requests/${row().id}/submit`, "POST"), 404);
    assert.equal(await send(`/local/supply-requests/${row().id}/review`, "GET"), 404);
    assert.equal(await send("/local/supply-requests-review", "POST"), 404);
    assert.equal(await send(`/local/supply-requests/${row().id}/delete`, "POST"), 404);
    assert.equal(await send(`/local/supply-requests-review?role=PLATFORM_ADMIN`), 404);
    assert.equal(await send("/local/supply-requests?tenantId=forged"), 404);
    assert.equal(
      await send(`/local/supply-requests/${row().id}/review`, "POST", "https://example.com"),
      403,
    );
    assert.equal(seen.length, before);
  } finally {
    await new Promise((resolve) => proxy.close(resolve));
    await new Promise((resolve) => upstream.close(resolve));
  }
});

test("browser uses real preview proxy for confirm, claim, return, shortage, and anonymous platform summary", async () => {
  const coreUrl = new URL("../../../apps/api/dist/src/local-synthetic/server.js", import.meta.url);
  const { buildLocalSyntheticServer } = await import(coreUrl.href);
  const service = await buildLocalSyntheticServer({ mode: "local-synthetic" });
  const serviceUrl = await service.start(0);
  const preview = spawn(
    process.execPath,
    [
      fileURLToPath(new URL("../preview.mjs", import.meta.url)),
      "--local-service-port",
      new URL(serviceUrl).port,
    ],
    { stdio: ["ignore", "pipe", "pipe"] },
  );
  let browser;
  try {
    const lines = createInterface({ input: preview.stdout });
    const [line] = await once(lines, "line", { signal: globalThis.AbortSignal.timeout(10000) });
    lines.close();
    const { baseUrl } = JSON.parse(line);
    async function api(handle, path, body) {
      const result = await globalThis.fetch(serviceUrl + path, {
        method: body ? "POST" : "GET",
        headers: {
          ...(handle ? { Authorization: `Bearer ${handle}` } : {}),
          "Content-Type": "application/json",
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      assert.ok(result.ok, `${path}: ${result.status}`);
      return result.json();
    }
    const teacher = (await api(null, "/local/sessions", { profile: "teacher-east" })).handle;
    async function submit() {
      const draft = await api(teacher, "/local/supply-requests", {
        catalog: "ART_ACTIVITY_SET",
        quantity: 2,
        purpose: "CLASS_ACTIVITY",
      });
      return api(teacher, `/local/supply-requests/${draft.id}/submit`, { version: draft.version });
    }
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();
    page.setDefaultTimeout(10000);
    const errors = [],
      external = [],
      failedResponses = [],
      requests = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("request", (request) => {
      requests.push(new URL(request.url()).pathname);
      if (new URL(request.url()).origin !== baseUrl) external.push(request.url());
    });
    page.on("response", (response) => {
      if (response.status() >= 400) failedResponses.push(response.url());
    });
    const first = await submit();
    await page.goto(baseUrl + "/admin/institution");
    await page.locator(`[data-route="${SUPPLY_REQUEST_REVIEW_ROUTE}"]`).click();
    await page.locator('[data-supply-action="CONFIRM"]').waitFor();
    await page.locator('[data-supply-action="CONFIRM"]').click();
    await page.locator('[data-supply-action="CLAIM"]').waitFor();
    assert.match(await page.locator(`[data-supply-row="${first.id}"]`).innerText(), /可领取/u);
    await page.locator('[data-supply-action="CLAIM"]').click();
    await page.locator('[data-supply-count="CLAIMED"]').filter({ hasText: "1" }).waitFor();
    assert.match(await page.locator(`[data-supply-row="${first.id}"]`).innerText(), /已领取/u);
    assert.equal((await api(teacher, "/local/supply-requests"))[0].status, "CLAIMED");
    const returned = await submit();
    await page.locator("#supply-refresh").click();
    await page.locator('[data-supply-action="RETURN"]').waitFor();
    await page.locator('[data-supply-action="RETURN"]').click();
    await page.locator('[data-supply-count="RETURNED"]').filter({ hasText: "1" }).waitFor();
    assert.match(await page.locator(`[data-supply-row="${returned.id}"]`).innerText(), /已退回/u);
    const teacherRows = await api(teacher, "/local/supply-requests");
    const returnedRow = teacherRows.find((candidate) => candidate.id === returned.id);
    await api(teacher, `/local/supply-requests/${returned.id}/cancel`, {
      version: returnedRow.version,
    });
    const shortage = await submit();
    await page.locator("#supply-refresh").click();
    await page.locator('[data-supply-action="OUT_OF_STOCK"]').waitFor();
    await page.locator('[data-supply-action="OUT_OF_STOCK"]').click();
    await page.locator('[data-supply-count="OUT_OF_STOCK"]').filter({ hasText: "1" }).waitFor();
    assert.match(await page.locator(`[data-supply-row="${shortage.id}"]`).innerText(), /缺货/u);
    const beforePlatform = requests.length;
    await page.locator("#supply-role").selectOption("PLATFORM_ADMIN");
    await page.locator("#supply-feedback").filter({ hasText: "已刷新匿名状态统计" }).waitFor();
    const platformRequests = requests.slice(beforePlatform);
    assert.deepEqual(platformRequests, ["/local/sessions", "/local/supply-summary"]);
    assert.equal(await page.locator("[data-supply-row]").count(), 0);
    assert.equal(await page.locator("[data-supply-action]").count(), 0);
    const platformHtml = await page.content();
    for (const detail of [
      first.id,
      returned.id,
      shortage.id,
      "示例东校区教师",
      "美术活动包",
      "班级活动",
    ])
      assert.ok(!platformHtml.includes(detail), detail);
    assert.equal(await page.locator('[data-supply-count="CLAIMED"]').innerText(), "1");
    assert.equal(await page.locator('[data-supply-count="CANCELLED"]').innerText(), "1");
    await page.setViewportSize({ width: 390, height: 844 });
    assert.ok(await page.locator("#supply-role").isVisible());
    assert.equal(
      await page.evaluate(
        () => globalThis.document.documentElement.scrollWidth <= globalThis.innerWidth,
      ),
      true,
    );
    await page.goto(baseUrl + SUPPLY_REQUEST_REVIEW_ROUTE + "?mode=readonly");
    await page.locator("#supply-feedback").filter({ hasText: "已刷新授权范围" }).waitFor();
    assert.equal(await page.locator("[data-supply-action]").count(), 0);
    assert.equal(await page.locator("#supply-role").isDisabled(), true);
    assert.deepEqual(errors, []);
    assert.deepEqual(external, []);
    assert.deepEqual(failedResponses, []);
  } finally {
    await browser?.close();
    if (preview.exitCode === null) {
      const exited = once(preview, "exit");
      preview.kill();
      await exited;
    }
    await service.close();
  }
});
