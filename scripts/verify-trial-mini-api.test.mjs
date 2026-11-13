import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { Readable } from "node:stream";
import test from "node:test";
import { URL } from "node:url";
import { verifyTrialMiniApi } from "./verify-trial-mini-api.mjs";

const id = "79428f56-4a87-4731-9861-08af77ebedbb";
const args = ["qa~campus", "2026-11-02", id, "合成米饭", "合成豆腐"];
const unauthorized = {
  error: { code: "UNAUTHENTICATED", message: "Authentication is required." },
  request_id: id,
};
const meal = {
  id,
  meal_date: args[1],
  meal_type: "LUNCH",
  items: args.slice(3),
  notes: "",
  published_at: "2026-11-02T00:00:00Z",
};
function response(statusCode, data, headers = {}) {
  return Object.assign(Readable.from([Buffer.from(JSON.stringify(data))]), {
    statusCode,
    headers: { "content-type": "application/json; charset=utf-8", ...headers },
  });
}
function requestFixture(override = {}, calls = []) {
  return async (address, options) => {
    const url = new URL(address);
    assert.equal(url.origin, "https://api.enhe-tongxin.com");
    assert.equal(options.method, "GET");
    assert.equal(options.rejectUnauthorized, true);
    assert.deepEqual(
      Object.keys(options.headers)
        .map((k) => k.toLowerCase())
        .sort(),
      ["accept", "accept-encoding"],
    );
    assert.ok(options.signal);
    calls.push(url.pathname + url.search);
    if (override[url.pathname]) return override[url.pathname]();
    if (url.pathname === "/me") return response(401, unauthorized);
    if (url.pathname === "/public/meals") return response(200, { request_id: id, data: [meal] });
    assert.equal(url.pathname, "/health");
    return response(404, null);
  };
}

test("anonymous checks use the Mini query and a known published meal on the fixed host", async () => {
  const calls = [];
  assert.deepEqual(await verifyTrialMiniApi(args, requestFixture({}, calls)), {
    status: "PASS",
    check: "complete",
  });
  assert.deepEqual(calls, [
    "/me",
    "/public/meals?date=2026-11-02&public_ref=qa%7Ecampus",
    "/health",
  ]);
});

test("invalid input never makes a request", async () => {
  for (const invalid of [
    ["../other", ...args.slice(1)],
    [args[0], "2026-02-31", ...args.slice(2)],
    [args[0], args[1], "not-a-uuid", "dish"],
    args.slice(0, 3),
  ]) {
    const calls = [];
    assert.deepEqual(await verifyTrialMiniApi(invalid, requestFixture({}, calls)), {
      status: "FAIL",
      check: "input",
    });
    assert.deepEqual(calls, []);
  }
});

test("wrong endpoints, certificates, redirects, overlong responses and unsafe unauthorized envelopes fail closed", async () => {
  const failures = [
    () => {
      throw Object.assign(new Error("private text"), { code: "CERT_HAS_EXPIRED" });
    },
    () => response(200, unauthorized),
    () => response(302, null, { location: "https://third-party.invalid/" }),
    () => response(401, unauthorized, { "content-type": "text/html" }),
    () => response(401, unauthorized, { "set-cookie": "private text" }),
    () => response(401, { ...unauthorized, request_id: "invalid" }),
    () => response(401, { ...unauthorized, request_id: [id] }),
    () => response(401, { ...unauthorized, error: { ...unauthorized.error, code: "DENIED" } }),
    () => response(401, { ...unauthorized, private: "private text" }),
    () => response(401, unauthorized, { "content-length": "99999999" }),
    () => response(401, "a".repeat(2 * 1024 * 1024)),
  ];
  for (const makeResponse of failures) {
    const calls = [];
    assert.deepEqual(
      await verifyTrialMiniApi(args, requestFixture({ "/me": makeResponse }, calls)),
      { status: "FAIL", check: "me" },
    );
    assert.deepEqual(calls, ["/me"]);
  }
});

test("empty, wrong-campus, stale, duplicate, out-of-order and overshared meal records cannot certify the deployment", async () => {
  for (const data of [
    [],
    [{ ...meal, id: "other" }],
    [{ ...meal, meal_date: "2026-11-01" }],
    [meal, meal],
    [{ ...meal, items: [...meal.items].reverse() }],
    [{ ...meal, tenant_id: "private" }],
  ]) {
    const request = requestFixture({
      "/public/meals": () => response(200, { request_id: id, data }),
    });
    assert.deepEqual(await verifyTrialMiniApi(args, request), { status: "FAIL", check: "meals" });
  }
  const wrongCampus = requestFixture({
    "/public/meals": () => response(403, { error: { code: "FORBIDDEN_SCOPE" } }),
  });
  assert.deepEqual(await verifyTrialMiniApi(args, wrongCampus), { status: "FAIL", check: "meals" });
});

test("a reachable health route or redirect fails the gateway exclusion check", async () => {
  for (const code of [200, 302, 401, 503]) {
    assert.deepEqual(
      await verifyTrialMiniApi(args, requestFixture({ "/health": () => response(code, null) })),
      { status: "FAIL", check: "health" },
    );
  }
});
