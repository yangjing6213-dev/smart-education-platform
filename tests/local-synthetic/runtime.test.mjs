import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { once } from "node:events";
import { request as httpRequest } from "node:http";
import { fileURLToPath, URL } from "node:url";
import { setTimeout, clearTimeout } from "node:timers";
import process from "node:process";
import test from "node:test";
import { buildLocalSyntheticServer } from "../../apps/api/dist/src/local-synthetic/server.js";

const root = fileURLToPath(new URL("../../", import.meta.url));
const launcher = fileURLToPath(new URL("../../scripts/start-local-synthetic.mjs", import.meta.url));
function transport(url, options = {}) {
  return new Promise((resolve, reject) => {
    const req = httpRequest(
      url,
      { method: options.method ?? "GET", headers: options.headers ?? {} },
      (response) => {
        let body = "";
        response.setEncoding("utf8");
        response.on("data", (chunk) => {
          body += chunk;
        });
        response.on("end", () =>
          resolve({
            status: response.statusCode,
            headers: response.headers,
            json: async () => (body ? JSON.parse(body) : null),
          }),
        );
        response.on("error", reject);
      },
    );
    req.on("error", reject);
    req.end(options.body);
  });
}
async function http(base, method, path, payload, handle) {
  const response = await transport(base + path, {
    method,
    headers: {
      ...(payload ? { "Content-Type": "application/json" } : {}),
      ...(handle ? { Authorization: `Bearer ${handle}` } : {}),
    },
    ...(payload ? { body: JSON.stringify(payload) } : {}),
  });
  return { status: response.status, body: await response.json() };
}
async function startProcess() {
  const child = spawn(process.execPath, [launcher, "--local-synthetic", "--port", "0"], {
    cwd: root,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  let output = "",
    errors = "";
  const ready = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      child.kill();
      reject(new Error("Local service startup timed out."));
    }, 60000);
    child.stderr.on("data", (chunk) => {
      errors += chunk.toString();
    });
    child.once("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.once("exit", (code) => {
      clearTimeout(timeout);
      reject(new Error(`Local service exited ${code}: ${errors}`));
    });
    child.stdout.on("data", (chunk) => {
      output += chunk.toString();
      for (const line of output.split(/\r?\n/)) {
        if (!line.startsWith('{"status":"ready"')) continue;
        clearTimeout(timeout);
        resolve(JSON.parse(line));
      }
    });
  });
  return {
    child,
    ready,
    stop: async () => {
      if (child.exitCode === null) {
        const exit = once(child, "exit");
        child.kill();
        await exit;
      }
    },
  };
}

test("real loopback HTTP uses one object across separate guardian/reviewer sessions", async () => {
  const app = await buildLocalSyntheticServer({
    mode: "local-synthetic",
    allowedOrigins: ["http://127.0.0.1:4173"],
  });
  const base = await app.start(0);
  try {
    assert.equal(new URL(base).hostname, "127.0.0.1");
    const foreignOrigin = await transport(base + "/local/profiles", {
      headers: { Origin: "https://foreign.invalid" },
    });
    assert.equal(foreignOrigin.status, 403);
    const preflight = await transport(base + "/local/sessions", {
      method: "OPTIONS",
      headers: {
        Origin: "http://127.0.0.1:4173",
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "content-type, authorization",
      },
    });
    assert.equal(preflight.status, 204);
    assert.equal(preflight.headers["access-control-allow-origin"], "http://127.0.0.1:4173");
    const p = (await http(base, "POST", "/local/sessions", { profile: "parent-alpha" })).body
      .handle;
    const o = (await http(base, "POST", "/local/sessions", { profile: "owner-east" })).body.handle;
    assert.notEqual(p, o);
    const callP = (method, path, body) => http(base, method, path, body, p);
    const callO = (method, path, body) => http(base, method, path, body, o);
    let response = await callP("POST", "/local/binding-applications", {
      student: "student-alpha",
      relationship: "GUARDIAN",
    });
    assert.equal(response.status, 201);
    const binding = response.body;
    assert.deepEqual(
      (await callO("GET", "/local/binding-applications")).body.map((row) => row.id),
      [binding.id],
    );
    const approved = (
      await callO("POST", `/local/binding-applications/${binding.id}/review`, {
        version: binding.version,
        action: "approve",
      })
    ).body;
    response = await callP("POST", "/local/leave-requests", {
      bindingId: binding.id,
      startDate: "2026-10-12",
      endDate: "2026-10-13",
      reason: "FAMILY_ARRANGEMENT",
    });
    assert.equal(response.status, 201);
    const leaveId = response.body.id;
    assert.deepEqual(
      (await callO("GET", "/local/leave-requests")).body.map((row) => row.id),
      [leaveId],
    );
    let row = (
      await callO("POST", `/local/leave-requests/${leaveId}/review`, {
        version: response.body.version,
        action: "return",
      })
    ).body;
    row = (
      await callP("POST", `/local/leave-requests/${leaveId}/receipt`, { version: row.version })
    ).body;
    assert.equal(row.acknowledged, true);
    row = (
      await callP("PATCH", `/local/leave-requests/${leaveId}`, {
        version: row.version,
        startDate: "2026-10-12",
        endDate: "2026-10-13",
        reason: "TEMPORARY_MATTER",
      })
    ).body;
    assert.equal(row.acknowledged, false);
    row = (
      await callO("POST", `/local/leave-requests/${leaveId}/review`, {
        version: row.version,
        action: "confirm",
      })
    ).body;
    assert.equal((await callP("GET", `/local/leave-requests/${leaveId}`)).body.acknowledged, false);
    row = (
      await callP("POST", `/local/leave-requests/${leaveId}/receipt`, { version: row.version })
    ).body;
    assert.equal(row.acknowledged, true);
    assert.equal(
      (
        await callP("POST", `/local/binding-applications/${approved.id}/release`, {
          version: approved.version,
        })
      ).status,
      200,
    );
    assert.equal((await callO("GET", `/local/leave-requests/${leaveId}`)).status, 403);
    assert.deepEqual((await callP("GET", "/local/leave-requests")).body, []);
  } finally {
    await app.close();
  }
});

test("launcher refuses implicit/remote startup; a process restart invalidates old sessions and data", async () => {
  for (const args of [
    [],
    ["--local-synthetic", "--host", "0.0.0.0"],
    ["--local-synthetic", "--origin", "https://external.invalid"],
  ]) {
    const result = spawnSync(process.execPath, [launcher, ...args], {
      cwd: root,
      encoding: "utf8",
      windowsHide: true,
      timeout: 20000,
    });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /local-synthetic|loopback|Unsupported/);
  }
  const first = await startProcess();
  let oldHandle;
  let oldInviteToken;
  try {
    assert.equal(first.ready.mode, "local-synthetic");
    assert.equal(first.ready.clearedOnRestart, true);
    const inviteCredentials = first.ready.inviteCredentials;
    assert.ok(inviteCredentials?.parent?.username && inviteCredentials.parent.password);
    assert.ok(inviteCredentials?.staff?.username && inviteCredentials.staff.password);
    const parentLogin = await http(first.ready.apiBaseUrl, "POST", "/identity/login", {
      username: inviteCredentials.parent.username,
      password: inviteCredentials.parent.password,
    });
    assert.equal(parentLogin.status, 200);
    oldInviteToken = parentLogin.body.data.access_token;
    const application = await http(
      first.ready.apiBaseUrl,
      "POST",
      "/guardian-binding/applications",
      {
        student_candidate_ref: "00000000-0000-4000-8000-0000000000c8",
        relationship: "GUARDIAN",
        consent: true,
      },
      oldInviteToken,
    );
    assert.equal(application.status, 201);
    const staffLogin = await http(first.ready.apiBaseUrl, "POST", "/identity/login", {
      username: inviteCredentials.staff.username,
      password: inviteCredentials.staff.password,
    });
    assert.equal(staffLogin.status, 200);
    const staffToken = staffLogin.body.data.access_token;
    const pending = await http(
      first.ready.apiBaseUrl,
      "GET",
      "/staff/guardian-binding/applications",
      undefined,
      staffToken,
    );
    assert.equal(pending.status, 200);
    assert.equal(pending.body.data.length, 1);
    const reviewed = await http(
      first.ready.apiBaseUrl,
      "POST",
      `/staff/guardian-binding/applications/${application.body.data.id}/review`,
      { version: pending.body.data[0].version, action: "approve" },
      staffToken,
    );
    assert.equal(reviewed.status, 200);
    const parentApplications = await http(
      first.ready.apiBaseUrl,
      "GET",
      "/guardian-binding/applications",
      undefined,
      oldInviteToken,
    );
    assert.equal(parentApplications.status, 200);
    assert.equal(parentApplications.body.data[0].status, "APPROVED");
    oldHandle = (
      await http(first.ready.baseUrl, "POST", "/local/sessions", { profile: "parent-beta" })
    ).body.handle;
    assert.equal(
      (
        await http(
          first.ready.baseUrl,
          "POST",
          "/local/binding-applications",
          { student: "student-beta", relationship: "GUARDIAN" },
          oldHandle,
        )
      ).status,
      201,
    );
  } finally {
    await first.stop();
  }
  const second = await startProcess();
  try {
    assert.equal(
      (await http(second.ready.apiBaseUrl, "GET", "/me", undefined, oldInviteToken)).status,
      401,
    );
    const emptyApplications = await http(
      second.ready.apiBaseUrl,
      "GET",
      "/guardian-binding/applications",
      undefined,
      (
        await http(second.ready.apiBaseUrl, "POST", "/identity/login", {
          username: second.ready.inviteCredentials.parent.username,
          password: second.ready.inviteCredentials.parent.password,
        })
      ).body.data.access_token,
    );
    assert.deepEqual(emptyApplications.body.data, []);
    assert.equal(
      (await http(second.ready.baseUrl, "GET", "/local/session", undefined, oldHandle)).status,
      401,
    );
    const handle = (
      await http(second.ready.baseUrl, "POST", "/local/sessions", { profile: "parent-alpha" })
    ).body.handle;
    assert.notEqual(handle, oldHandle);
    assert.deepEqual(
      (await http(second.ready.baseUrl, "GET", "/local/binding-applications", undefined, handle))
        .body,
      [],
    );
  } finally {
    await second.stop();
  }
});

test("real HTTP care record stays private until separate publication and retracts immediately", async () => {
  const app = await buildLocalSyntheticServer({ mode: "local-synthetic" });
  const base = await app.start(0);
  try {
    const p = (await http(base, "POST", "/local/sessions", { profile: "parent-alpha" })).body
      .handle;
    const t = (await http(base, "POST", "/local/sessions", { profile: "teacher-east" })).body
      .handle;
    const o = (await http(base, "POST", "/local/sessions", { profile: "owner-east" })).body.handle;
    const binding = (
      await http(
        base,
        "POST",
        "/local/binding-applications",
        { student: "student-alpha", relationship: "GUARDIAN" },
        p,
      )
    ).body;
    assert.equal(
      (
        await http(
          base,
          "POST",
          `/local/binding-applications/${binding.id}/review`,
          { version: binding.version, action: "approve" },
          o,
        )
      ).status,
      200,
    );
    let result = await http(
      base,
      "POST",
      "/local/care-records",
      {
        student: "student-alpha",
        date: "2026-10-14",
        values: {
          arrival: "ARRIVED_AS_PLANNED",
          homework: "COMPLETED",
          meal: "FINISHED",
          rest: "RESTED",
          activity: "PARTICIPATED",
          wellbeing: "ROUTINE",
        },
      },
      t,
    );
    assert.equal(result.status, 201);
    let row = result.body;
    result = await http(
      base,
      "POST",
      `/local/care-records/${row.id}/submit`,
      { version: row.version },
      t,
    );
    assert.equal(result.status, 200);
    row = result.body;
    assert.equal((await http(base, "GET", "/local/care-records", undefined, o)).body[0].id, row.id);
    row = (
      await http(
        base,
        "POST",
        `/local/care-records/${row.id}/review`,
        { version: row.version, action: "confirm" },
        o,
      )
    ).body;
    assert.equal(row.status, "CONFIRMED");
    assert.deepEqual((await http(base, "GET", "/local/care-records", undefined, p)).body, []);
    row = (
      await http(base, "POST", `/local/care-records/${row.id}/publish`, { version: row.version }, o)
    ).body;
    let view = (await http(base, "GET", `/local/care-records/${row.id}`, undefined, p)).body;
    assert.equal(view.id, row.id);
    assert.equal(view.values.homework, "已完成整理");
    assert.equal(view.receipt, "UNREAD");
    assert.equal(Object.hasOwn(view, "history"), false);
    const body = {
      bindingId: binding.id,
      version: row.version,
      publicationVersion: row.publicationVersion,
    };
    view = (
      await http(
        base,
        "POST",
        `/local/care-records/${row.id}/receipt`,
        { ...body, action: "read" },
        p,
      )
    ).body;
    assert.equal(view.receipt, "READ");
    view = (
      await http(
        base,
        "POST",
        `/local/care-records/${row.id}/receipt`,
        { ...body, action: "acknowledge" },
        p,
      )
    ).body;
    assert.equal(view.receipt, "ACKNOWLEDGED");
    assert.equal(
      (
        await http(
          base,
          "POST",
          `/local/care-records/${row.id}/revoke-publication`,
          { version: row.version },
          o,
        )
      ).status,
      200,
    );
    assert.equal(
      (await http(base, "GET", `/local/care-records/${row.id}`, undefined, p)).status,
      403,
    );
    assert.equal(
      (
        await http(
          base,
          "POST",
          `/local/care-records/${row.id}/receipt`,
          { ...body, action: "acknowledge" },
          p,
        )
      ).status,
      403,
    );
  } finally {
    await app.close();
  }
});
