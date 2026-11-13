import assert from "node:assert/strict";
import test from "node:test";
import { URL } from "node:url";

const inviteSessionModule = await import("../src/auth/invite-session.ts").catch((error) => {
  if (error?.code === "ERR_MODULE_NOT_FOUND") return null;
  throw error;
});

function createHarness({
  baseUrl = "https://api.example.invalid",
  allowLocalHttp = false,
  storedSession = null,
  request,
} = {}) {
  assert.ok(inviteSessionModule?.InviteSession, "Taro needs an invitation session client");
  const storage = { value: storedSession, saves: [], clears: 0 };
  const session = new inviteSessionModule.InviteSession({
    baseUrl,
    allowLocalHttp,
    request,
    sessionStore: {
      load: () => storage.value,
      save: (value) => {
        storage.value = value;
        storage.saves.push(value);
      },
      clear: () => {
        storage.value = null;
        storage.clears += 1;
      },
    },
  });
  return { session, storage };
}

const token = "a".repeat(43);
const expiresAt = "2099-10-20T00:00:00.000Z";
const parentIdentity = {
  actor_id: "00000000-0000-4000-8000-000000000301",
  display_name: "合成家长甲",
  memberships: [{ status: "ACTIVE", capabilities: ["binding:apply", "binding:read"] }],
};

test("invited login verifies /me before persisting only the expiring token", async () => {
  const calls = [];
  const { session, storage } = createHarness({
    request: async (url, options) => {
      const path = new URL(url).pathname;
      calls.push({ path, options });
      if (path === "/identity/login")
        return {
          statusCode: 200,
          data: { data: { access_token: token, token_type: "Bearer", expires_at: expiresAt } },
        };
      if (path === "/me") return { statusCode: 200, data: { data: parentIdentity } };
      return { statusCode: 404, data: {} };
    },
  });

  await session.login("  parent-demo  ", "synthetic-only-password");

  assert.deepEqual(
    calls.map(({ path }) => path),
    ["/identity/login", "/me"],
  );
  assert.deepEqual(calls[0].options.data, {
    username: "parent-demo",
    password: "synthetic-only-password",
  });
  assert.equal(calls[0].options.headers.Authorization, undefined);
  assert.equal(calls[1].options.headers.Authorization, `Bearer ${token}`);
  assert.deepEqual(storage.saves, [{ accessToken: token, expiresAt }]);
  assert.equal(session.snapshot.displayName, "合成家长甲");
  assert.deepEqual(session.snapshot.roles, ["PARENT"]);
  assert.equal(session.snapshot.canWriteCareRecords, false);
  assert.doesNotMatch(
    JSON.stringify(session.snapshot),
    /password|synthetic-only-password|token|aaaa/u,
  );
});

test("invalid invitation credentials never request identity or save a session", async () => {
  const paths = [];
  const { session, storage } = createHarness({
    request: async (url) => {
      paths.push(new URL(url).pathname);
      return { statusCode: 401, data: { error: { code: "INVALID_CREDENTIALS" } } };
    },
  });

  await session.login("parent-demo", "wrong-synthetic-password");

  assert.deepEqual(paths, ["/identity/login"]);
  assert.equal(storage.value, null);
  assert.deepEqual(storage.saves, []);
  assert.notEqual(session.snapshot.status, "READY");
});

test("credentials outside the invitation API length limits never leave the client", async () => {
  let requests = 0;
  const { session } = createHarness({
    request: async () => {
      requests += 1;
      return { statusCode: 401, data: {} };
    },
  });

  await session.login("ab", "synthetic-password");
  await session.login("parent-demo", "x".repeat(129));

  assert.equal(requests, 0);
  assert.equal(session.snapshot.status, "ERROR");
  assert.match(session.snapshot.message, /填写/u);
});

test("missing or unavailable invitation services fail closed without storing a session", async () => {
  let missingOriginRequests = 0;
  const missingOrigin = createHarness({
    baseUrl: "",
    request: async () => {
      missingOriginRequests += 1;
      return { statusCode: 200, data: {} };
    },
  });

  await missingOrigin.session.login("parent-demo", "synthetic-password");

  assert.equal(missingOriginRequests, 0);
  assert.equal(missingOrigin.storage.value, null);
  assert.equal(missingOrigin.session.snapshot.status, "ERROR");
  assert.match(missingOrigin.session.snapshot.message, /尚未配置/u);

  const unavailable = createHarness({
    request: async () => ({
      statusCode: 503,
      data: { error: { code: "PROVIDER_UNAVAILABLE" } },
    }),
  });

  await unavailable.session.login("parent-demo", "synthetic-password");

  assert.equal(unavailable.storage.value, null);
  assert.equal(unavailable.session.snapshot.status, "ERROR");
  assert.match(unavailable.session.snapshot.message, /尚未配置/u);
});

test("empty WeChat storage shows a fresh sign-in prompt without treating it as expired", async () => {
  let requests = 0;
  const { session, storage } = createHarness({
    storedSession: "",
    request: async () => {
      requests += 1;
      throw new Error("An empty session must not request an identity");
    },
  });
  const freshPrompt = session.snapshot.message;

  await session.restore();

  assert.equal(session.snapshot.status, "SIGNED_OUT");
  assert.equal(session.snapshot.message, freshPrompt);
  assert.equal(requests, 0);
  assert.equal(storage.clears, 0);
});

test("expired saved sessions are removed before any API request", async () => {
  let requests = 0;
  const { session, storage } = createHarness({
    storedSession: { accessToken: token, expiresAt: "2000-01-01T00:00:00.000Z" },
    request: async () => {
      requests += 1;
      return { statusCode: 200, data: { data: parentIdentity } };
    },
  });

  await session.restore();

  assert.equal(requests, 0);
  assert.equal(storage.value, null);
  assert.equal(session.snapshot.status, "SIGNED_OUT");
});

test("restored sessions use server identity and clear on an expired server token", async () => {
  const paths = [];
  const { session, storage } = createHarness({
    storedSession: { accessToken: token, expiresAt },
    request: async (url, options) => {
      paths.push({ path: new URL(url).pathname, authorization: options.headers.Authorization });
      return { statusCode: 401, data: { error: { code: "UNAUTHENTICATED" } } };
    },
  });

  await session.restore();

  assert.deepEqual(paths, [{ path: "/me", authorization: `Bearer ${token}` }]);
  assert.equal(storage.value, null);
  assert.equal(session.snapshot.status, "SIGNED_OUT");
});

test("API origins allow HTTPS or explicitly enabled loopback HTTP only", () => {
  assert.throws(
    () => createHarness({ baseUrl: "http://api.example.invalid", allowLocalHttp: true }),
    /安全|HTTPS/u,
  );
  assert.throws(
    () => createHarness({ baseUrl: "http://127.0.0.1:4321", allowLocalHttp: false }),
    /安全|HTTPS/u,
  );
  assert.doesNotThrow(() =>
    createHarness({ baseUrl: "http://127.0.0.1:4321", allowLocalHttp: true }),
  );
});

test("logout clears the stored session and public identity", async () => {
  const paths = [];
  const { session, storage } = createHarness({
    storedSession: { accessToken: token, expiresAt },
    request: async (url, options) => {
      const path = new URL(url).pathname;
      paths.push({ path, authorization: options.headers.Authorization });
      if (path === "/me") return { statusCode: 200, data: { data: parentIdentity } };
      return { statusCode: 200, data: { data: { logged_out: true } } };
    },
  });

  await session.restore();
  await session.logout();

  assert.equal(paths.at(-1)?.path, "/identity/logout");
  assert.equal(paths.at(-1)?.authorization, `Bearer ${token}`);
  assert.equal(storage.value, null);
  assert.equal(session.snapshot.status, "SIGNED_OUT");
  assert.equal(session.snapshot.displayName, "");
});

test("authenticated reads send only a ready session token to a same-origin API path", async () => {
  const calls = [];
  const projection = {
    approvedStudents: [],
    parentControls: [],
    parentSummary: [],
    parentSummaryUpdatedAt: expiresAt,
  };
  const { session } = createHarness({
    storedSession: { accessToken: token, expiresAt },
    request: async (url, options) => {
      const path = new URL(url).pathname;
      calls.push({ path, options });
      if (path === "/me") return { statusCode: 200, data: { data: parentIdentity } };
      return { statusCode: 200, data: { data: projection } };
    },
  });

  await session.restore();
  assert.equal(
    typeof session.getAuthenticated,
    "function",
    "the verified session must expose its scoped read",
  );
  const result = await session.getAuthenticated("/parent/learning");

  assert.deepEqual(result, projection);
  assert.deepEqual(
    calls.map(({ path }) => path),
    ["/me", "/parent/learning"],
  );
  assert.equal(calls[1].options.headers.Authorization, `Bearer ${token}`);
  assert.equal(calls[1].options.headers["x-tenant-id"], undefined);
  assert.equal(calls[1].options.headers["x-campus-id"], undefined);
  assert.doesNotMatch(JSON.stringify(session.snapshot), /token|aaaa/u);
});

test("authenticated reads reject signed-out sessions and unsafe paths without sending requests", async () => {
  let requests = 0;
  const { session } = createHarness({
    request: async () => {
      requests += 1;
      return { statusCode: 200, data: { data: {} } };
    },
  });

  assert.equal(
    typeof session.getAuthenticated,
    "function",
    "the verified session must expose its scoped read",
  );
  await assert.rejects(session.getAuthenticated("/parent/learning"), /登录/u);
  assert.equal(requests, 0);

  const ready = createHarness({
    storedSession: { accessToken: token, expiresAt },
    request: async (url) => {
      requests += 1;
      return new URL(url).pathname === "/me"
        ? { statusCode: 200, data: { data: parentIdentity } }
        : { statusCode: 200, data: { data: {} } };
    },
  });
  await ready.session.restore();
  await assert.rejects(ready.session.getAuthenticated("https://outside.invalid/collect"), /路径/u);
  await assert.rejects(ready.session.getAuthenticated("//outside/collect"), /路径/u);
  await assert.rejects(ready.session.getAuthenticated("//outside.invalid/collect"), /路径/u);
  assert.equal(requests, 1);
});

test("authenticated POST is limited to a ready invite session and carries the verified bearer token", async () => {
  const calls = [];
  const applyOnlyIdentity = {
    actor_id: "00000000-0000-4000-8000-000000000302",
    display_name: "合成家长乙",
    memberships: [{ status: "ACTIVE", capabilities: ["binding:apply"] }],
  };
  const { session } = createHarness({
    storedSession: { accessToken: token, expiresAt },
    request: async (url, options) => {
      const path = new URL(url).pathname;
      calls.push({ path, options });
      if (path === "/me") return { statusCode: 200, data: { data: applyOnlyIdentity } };
      return { statusCode: 201, data: { data: { id: "synthetic" } } };
    },
  });

  await session.restore();
  assert.deepEqual(session.snapshot.roles, ["PARENT"]);
  assert.equal(
    typeof session.postAuthenticated,
    "function",
    "verified session must expose scoped POST",
  );
  const body = {
    student_candidate_ref: "00000000-0000-4000-8000-000000000301",
    relationship: "GUARDIAN",
    consent: true,
  };
  const result = await session.postAuthenticated("/guardian-binding/applications", body);

  assert.deepEqual(result, { id: "synthetic" });
  assert.deepEqual(
    calls.map(({ path }) => path),
    ["/me", "/guardian-binding/applications"],
  );
  assert.equal(calls[1].options.method, "POST");
  assert.equal(calls[1].options.headers.Authorization, `Bearer ${token}`);
  assert.equal(calls[1].options.headers["x-tenant-id"], undefined);
  assert.deepEqual(calls[1].options.data, body);
});

test("authenticated POST rejects signed-out and unsafe paths without sending a request", async () => {
  let requests = 0;
  const { session } = createHarness({
    request: async () => {
      requests += 1;
      return { statusCode: 200, data: { data: {} } };
    },
  });

  assert.equal(
    typeof session.postAuthenticated,
    "function",
    "verified session must expose scoped POST",
  );
  await assert.rejects(session.postAuthenticated("/guardian-binding/applications", {}), /登录/u);
  const ready = createHarness({
    storedSession: { accessToken: token, expiresAt },
    request: async (url) => {
      requests += 1;
      return new URL(url).pathname === "/me"
        ? { statusCode: 200, data: { data: parentIdentity } }
        : { statusCode: 200, data: { data: {} } };
    },
  });
  await ready.session.restore();
  await assert.rejects(
    ready.session.postAuthenticated("https://outside.invalid/collect", {}),
    /路径/u,
  );
  await assert.rejects(ready.session.postAuthenticated("//outside/collect", {}), /路径/u);
  assert.equal(requests, 1);
});

test("authenticated PATCH uses only a ready invite token and same-origin guarded path", async () => {
  const calls = [];
  const staffIdentity = {
    actor_id: "00000000-0000-4000-8000-000000000304",
    display_name: "合成员工乙",
    memberships: [{ status: "ACTIVE", capabilities: ["daily:read", "daily:create"] }],
  };
  const { session } = createHarness({
    storedSession: { accessToken: token, expiresAt },
    request: async (url, options) => {
      const path = new URL(url).pathname;
      calls.push({ path, options });
      if (path === "/me") return { statusCode: 200, data: { data: staffIdentity } };
      return { statusCode: 200, data: { data: { id: "synthetic-report" } } };
    },
  });

  await session.restore();
  assert.equal(
    typeof session.patchAuthenticated,
    "function",
    "verified session must expose scoped PATCH",
  );
  const body = { version: 2, values: { arrival: "LATE" } };
  const result = await session.patchAuthenticated(
    "/staff/daily-reports/00000000-0000-4000-8000-000000000304",
    body,
  );

  assert.deepEqual(result, { id: "synthetic-report" });
  assert.deepEqual(
    calls.map(({ path }) => path),
    ["/me", "/staff/daily-reports/00000000-0000-4000-8000-000000000304"],
  );
  assert.equal(calls[1].options.method, "PATCH");
  assert.equal(calls[1].options.headers.Authorization, `Bearer ${token}`);
  assert.equal(calls[1].options.headers["Content-Type"], "application/json");
  assert.equal(calls[1].options.headers["x-tenant-id"], undefined);
  assert.equal(calls[1].options.headers["x-campus-id"], undefined);
  assert.deepEqual(calls[1].options.data, body);
});

test("authenticated PATCH rejects signed-out and unsafe paths without sending a request", async () => {
  let requests = 0;
  const { session } = createHarness({
    request: async () => {
      requests += 1;
      return { statusCode: 200, data: { data: {} } };
    },
  });

  assert.equal(
    typeof session.patchAuthenticated,
    "function",
    "verified session must expose scoped PATCH",
  );
  await assert.rejects(
    session.patchAuthenticated("/staff/daily-reports/00000000-0000-4000-8000-000000000304", {}),
    /登录/u,
  );
  const ready = createHarness({
    storedSession: { accessToken: token, expiresAt },
    request: async (url) => {
      requests += 1;
      return new URL(url).pathname === "/me"
        ? { statusCode: 200, data: { data: parentIdentity } }
        : { statusCode: 200, data: { data: {} } };
    },
  });
  await ready.session.restore();
  await assert.rejects(
    ready.session.patchAuthenticated("https://outside.invalid/collect", {}),
    /路径/u,
  );
  await assert.rejects(ready.session.patchAuthenticated("//outside/collect", {}), /路径/u);
  assert.equal(requests, 1);
});

test("staff-only binding read access does not expose the parent role", async () => {
  const staffIdentity = {
    actor_id: "00000000-0000-4000-8000-000000000303",
    display_name: "合成员工甲",
    memberships: [{ status: "ACTIVE", capabilities: ["binding:read", "binding:review"] }],
  };
  const { session } = createHarness({
    storedSession: { accessToken: token, expiresAt },
    request: async (url) =>
      new URL(url).pathname === "/me"
        ? { statusCode: 200, data: { data: staffIdentity } }
        : { statusCode: 200, data: { data: {} } },
  });

  await session.restore();
  assert.deepEqual(session.snapshot.roles, ["STAFF"]);
});

test("only a verified active care writer gets the care form display permission", async () => {
  for (const [membership, expected] of [
    [{ status: "ACTIVE", capabilities: ["care:write"] }, true],
    [{ status: "INACTIVE", capabilities: ["care:write"] }, false],
    [{ status: "ACTIVE", capabilities: ["care:review", "care:publish"] }, false],
    [{ status: "ACTIVE", capabilities: "care:write" }, false],
  ]) {
    const { session } = createHarness({
      storedSession: { accessToken: token, expiresAt, canWriteCareRecords: true },
      request: async () => ({
        statusCode: 200,
        data: {
          data: {
            ...parentIdentity,
            memberships: [{ status: "ACTIVE", capabilities: ["care:review"] }, membership],
          },
        },
      }),
    });
    assert.equal(session.snapshot.canWriteCareRecords, false);
    await session.restore();
    assert.equal(session.snapshot.status, "READY");
    assert.equal(session.snapshot.canWriteCareRecords, expected);
  }
});

test("care form permission is refreshed from identity and cleared after identity errors", async () => {
  let capabilities = ["care:write"];
  let responseStatus = 200;
  const { session } = createHarness({
    storedSession: { accessToken: token, expiresAt },
    request: async () => ({
      statusCode: responseStatus,
      data: {
        data: {
          ...parentIdentity,
          memberships: [{ status: "ACTIVE", capabilities }],
        },
      },
    }),
  });
  await session.restore();
  assert.equal(session.snapshot.canWriteCareRecords, true);
  capabilities = ["care:review"];
  await session.restore();
  assert.equal(session.snapshot.canWriteCareRecords, false);
  capabilities = ["care:write"];
  await session.restore();
  assert.equal(session.snapshot.canWriteCareRecords, true);
  responseStatus = 503;
  await session.restore();
  assert.equal(session.snapshot.status, "ERROR");
  assert.equal(session.snapshot.canWriteCareRecords, false);
});

test("login exposes verified care form permission only in memory and logout clears it", async () => {
  const { session, storage } = createHarness({
    request: async (url) => ({
      statusCode: 200,
      data: {
        data:
          new URL(url).pathname === "/identity/login"
            ? { access_token: token, token_type: "Bearer", expires_at: expiresAt }
            : {
                ...parentIdentity,
                memberships: [{ status: "ACTIVE", capabilities: ["care:write"] }],
              },
      },
    }),
  });
  await session.login("synthetic-writer", "synthetic-only-password");
  assert.equal(session.snapshot.canWriteCareRecords, true);
  assert.deepEqual(storage.saves, [{ accessToken: token, expiresAt }]);
  await session.logout();
  assert.equal(session.snapshot.status, "SIGNED_OUT");
  assert.equal(session.snapshot.canWriteCareRecords, false);
});

test("only active monthly read permission grants a staff role and monthly entry", async () => {
  for (const [status, capabilities, expected] of [
    ["ACTIVE", ["feedback:read"], true],
    ["ACTIVE", ["daily:read", "feedback:create", "feedback:submit"], false],
    ["SUSPENDED", ["feedback:read"], false],
    ["ACTIVE", [["feedback:read"]], false],
  ]) {
    const { session } = createHarness({
      storedSession: { accessToken: token, expiresAt, canReadMonthlyFeedback: true },
      request: async () => ({
        statusCode: 200,
        data: { data: { ...parentIdentity, memberships: [{ status, capabilities }] } },
      }),
    });
    assert.equal(session.snapshot.canReadMonthlyFeedback, false);
    await session.restore();
    assert.equal(session.snapshot.canReadMonthlyFeedback, expected);
    assert.equal(session.snapshot.roles.includes("PARENT"), false);
    if (expected) assert.deepEqual(session.snapshot.roles, ["STAFF"]);
  }
});

test("monthly permission is not persisted and is refreshed on revocation and logout", async () => {
  let capabilities = ["feedback:read"];
  const { session, storage } = createHarness({
    request: async (url) => ({
      statusCode: 200,
      data: {
        data:
          new URL(url).pathname === "/identity/login"
            ? { access_token: token, token_type: "Bearer", expires_at: expiresAt }
            : { ...parentIdentity, memberships: [{ status: "ACTIVE", capabilities }] },
      },
    }),
  });
  await session.login("synthetic-monthly-reader", "synthetic-only-password");
  assert.equal(session.snapshot.canReadMonthlyFeedback, true);
  assert.deepEqual(storage.saves, [{ accessToken: token, expiresAt }]);
  capabilities = ["daily:read"];
  await session.restore();
  assert.equal(session.snapshot.canReadMonthlyFeedback, false);
  assert.equal(session.snapshot.status, "READY");
  await session.logout();
  assert.equal(session.snapshot.canReadMonthlyFeedback, false);
});

test("same-session business 401 clears identity and credentials for GET, POST and PATCH", async () => {
  for (const method of ["getAuthenticated", "postAuthenticated", "patchAuthenticated"]) {
    let calls = 0;
    const { session, storage } = createHarness({
      storedSession: { accessToken: token, expiresAt },
      request: async (url) => {
        calls++;
        return new URL(url).pathname === "/me"
          ? { statusCode: 200, data: { data: parentIdentity } }
          : { statusCode: 401, data: { error: { code: "UNAUTHENTICATED" } } };
      },
    });
    await session.restore();
    await assert.rejects(
      session[method]("/staff/monthly-feedback", {}),
      (error) => error.statusCode === 401,
    );
    assert.equal(session.snapshot.status, "SIGNED_OUT", method);
    assert.equal(session.snapshot.displayName, "", method);
    assert.deepEqual(session.snapshot.roles, [], method);
    assert.equal(session.snapshot.canReadMonthlyFeedback, false, method);
    assert.equal(storage.value, null, method);
    await assert.rejects(session.getAuthenticated("/staff/monthly-feedback"), /登录/u);
    assert.equal(calls, 2, method);
  }
});

test("business 403 keeps other authorized services while an old 401 cannot erase a new login", async () => {
  let complete;
  let denying = false;
  const nextToken = "b".repeat(43);
  const nextIdentity = { ...parentIdentity, display_name: "合成家长乙" };
  const { session, storage } = createHarness({
    storedSession: { accessToken: token, expiresAt },
    request: async (url, options) => {
      const path = new URL(url).pathname;
      if (path === "/identity/login")
        return {
          statusCode: 200,
          data: { data: { access_token: nextToken, token_type: "Bearer", expires_at: expiresAt } },
        };
      if (path === "/me")
        return {
          statusCode: 200,
          data: {
            data:
              options.headers.Authorization === `Bearer ${nextToken}`
                ? nextIdentity
                : parentIdentity,
          },
        };
      if (denying) return { statusCode: 403, data: { error: { code: "FORBIDDEN_SCOPE" } } };
      return new Promise((resolve) => {
        complete = resolve;
      });
    },
  });
  await session.restore();
  denying = true;
  await assert.rejects(
    session.getAuthenticated("/staff/monthly-feedback"),
    (error) => error.statusCode === 403,
  );
  assert.equal(session.snapshot.status, "READY");
  assert.notEqual(storage.value, null);
  denying = false;
  const pending = session.getAuthenticated("/staff/monthly-feedback");
  const rejected = assert.rejects(pending, (error) => error.statusCode === 401);
  await session.login("synthetic-second-account", "synthetic-only-password");
  assert.equal(session.snapshot.displayName, nextIdentity.display_name);
  complete({ statusCode: 401, data: { error: { code: "UNAUTHENTICATED" } } });
  await rejected;
  assert.equal(session.snapshot.status, "READY");
  assert.equal(session.snapshot.displayName, nextIdentity.display_name);
  assert.equal(storage.value.accessToken, nextToken);
});

const replacement = { accessToken: "b".repeat(43), expiresAt };
const secondParent = { ...parentIdentity, display_name: "合成家长乙" };
const identityResponse = (who = parentIdentity) => ({ statusCode: 200, data: { data: who } });

test("a late /me never revives or erases a replaced or removed credential; a new restore verifies it", async () => {
  for (const code of [200, 401, 403]) {
    for (const changed of [
      replacement,
      null,
      { accessToken: token, expiresAt: "2000-01-01T00:00:00Z" },
    ]) {
      const pending = Promise.withResolvers();
      let calls = 0;
      const { session, storage } = createHarness({
        storedSession: { accessToken: token, expiresAt },
        request: async () => (++calls === 1 ? pending.promise : identityResponse(secondParent)),
      });
      const first = session.restore();
      storage.value = changed;
      pending.resolve(code === 200 ? identityResponse() : { statusCode: code, data: {} });
      const result = await first;
      assert.notEqual(result.status, "READY");
      assert.deepEqual(result.roles, []);
      assert.equal(result.displayName, "");
      assert.equal(calls, 1, "no automatic retry");
      assert.equal(storage.value === changed, true, "replacement is not cleared");
      await assert.rejects(session.postAuthenticated("/parent/notices", {}), /登录/u);
      assert.equal(calls, 1);
      if (changed === replacement) {
        await session.restore();
        assert.equal(session.snapshot.displayName, secondParent.display_name);
        assert.equal(calls, 2);
      }
    }
  }
});

test("current identity rejection still clears the failed credential for both 401 and 403", async () => {
  for (const statusCode of [401, 403]) {
    const { session, storage } = createHarness({
      storedSession: { accessToken: token, expiresAt },
      request: async () => ({ statusCode, data: {} }),
    });
    await session.restore();
    assert.equal(session.snapshot.status, "SIGNED_OUT");
    assert.deepEqual(session.snapshot.roles, []);
    assert.equal(storage.value, null);
  }
});

test("stored credential deletion, replacement, changed expiry or unreadability invalidates already authorized operations", async () => {
  for (const changed of [
    null,
    replacement,
    { accessToken: token, expiresAt: "2098-10-20T00:00:00Z" },
    { accessToken: token, expiresAt: "2000-01-01T00:00:00Z" },
    "unreadable",
  ]) {
    let calls = 0;
    const { session, storage } = createHarness({
      storedSession: { accessToken: token, expiresAt },
      request: async () => {
        calls++;
        return identityResponse();
      },
    });
    await session.restore();
    assert.equal(session.snapshot.status, "READY");
    if (changed === "unreadable")
      Object.defineProperty(storage, "value", {
        get() {
          throw Error("unavailable storage");
        },
      });
    else storage.value = changed;
    for (const method of ["getAuthenticated", "postAuthenticated", "patchAuthenticated"])
      await assert.rejects(session[method]("/parent/notices", {}), /登录/u);
    assert.notEqual(session.snapshot.status, "READY");
    assert.deepEqual(session.snapshot.roles, []);
    assert.equal(calls, 1);
  }
});

test("an in-flight business call cannot return the previous parent's data or clear another stored login", async () => {
  for (const code of [200, 401, 403]) {
    let calls = 0;
    const pending = Promise.withResolvers();
    const { session, storage } = createHarness({
      storedSession: { accessToken: token, expiresAt },
      request: async (url, options) => {
        calls++;
        if (new URL(url).pathname.endsWith("/me"))
          return identityResponse(
            options.headers.Authorization.endsWith("b") ? secondParent : parentIdentity,
          );
        return pending.promise;
      },
    });
    await session.restore();
    const read = session.getAuthenticated("/parent/notices");
    storage.value = replacement;
    const failed = assert.rejects(read, (error) =>
      code === 200 ? /登录|账号/u.test(error.message) : error.statusCode === code,
    );
    pending.resolve({ statusCode: code, data: { data: ["old summary"] } });
    await failed;
    assert.equal(storage.value === replacement, true);
    assert.notEqual(session.snapshot.status, "READY");
    await session.restore();
    assert.equal(session.snapshot.displayName, secondParent.display_name);
    assert.equal(calls, 3);
  }
});

test("logout during a pending identity check removes the local credential and the old success cannot restore it", async () => {
  const checking = Promise.withResolvers(),
    paths = [];
  const { session, storage } = createHarness({
    storedSession: { accessToken: token, expiresAt },
    request: async (url) => {
      const path = new URL(url).pathname;
      paths.push(path);
      return path === "/me"
        ? checking.promise
        : { statusCode: 200, data: { data: { logged_out: true } } };
    },
  });
  const first = session.restore();
  await session.logout();
  assert.equal(storage.value === null, true);
  checking.resolve(identityResponse());
  await first;
  assert.equal(session.snapshot.status, "SIGNED_OUT");
  assert.deepEqual(session.snapshot.roles, []);
  await assert.rejects(session.postAuthenticated("/parent/notices", {}), /登录/u);
  assert.deepEqual(paths, ["/me", "/identity/logout"]);
});

test("a failed login storage write clears only the partially written credential", async () => {
  for (const replaced of [false, true]) {
    let stored = null;
    const session = new inviteSessionModule.InviteSession({
      baseUrl: "https://api.example.invalid",
      allowLocalHttp: false,
      request: async (url) =>
        new URL(url).pathname === "/me"
          ? identityResponse()
          : {
              statusCode: 200,
              data: { data: { access_token: token, token_type: "Bearer", expires_at: expiresAt } },
            },
      sessionStore: {
        load: () => stored,
        save: (value) => {
          stored = replaced ? replacement : value;
          throw Error("storage error");
        },
        clear: () => {
          stored = null;
        },
      },
    });
    await session.login("synthetic-parent", "synthetic-only-password");
    assert.notEqual(session.snapshot.status, "READY");
    assert.equal(stored === (replaced ? replacement : null), true);
  }
});

test("a late login identity response cannot overwrite or clear an account placed in storage during verification", async () => {
  for (const code of [200, 403]) {
    const checking = Promise.withResolvers(),
      started = Promise.withResolvers();
    const { session, storage } = createHarness({
      request: async (url) => {
        if (new URL(url).pathname === "/identity/login")
          return {
            statusCode: 200,
            data: { data: { access_token: token, token_type: "Bearer", expires_at: expiresAt } },
          };
        started.resolve();
        return checking.promise;
      },
    });
    const first = session.login("synthetic-parent", "synthetic-only-password");
    await started.promise;
    storage.value = replacement;
    checking.resolve(code === 200 ? identityResponse() : { statusCode: code, data: {} });
    await first;
    assert.notEqual(session.snapshot.status, "READY");
    assert.equal(storage.value === replacement, true);
  }
});

test("failed local deletion and server logout cannot revive that bearer in this process; another login remains usable", async () => {
  const old = { accessToken: "q".repeat(45), expiresAt };
  let stored = old;
  const paths = [];
  const options = {
    baseUrl: "https://api.example.invalid",
    allowLocalHttp: false,
    sessionStore: {
      load: () => stored,
      save: (value) => {
        stored = value;
      },
      clear: () => {
        throw Error("cannot delete");
      },
    },
    request: async (url, request) => {
      const path = new URL(url).pathname;
      paths.push(path);
      if (path === "/identity/logout") return { statusCode: 503, data: {} };
      if (path === "/identity/login")
        return {
          statusCode: 200,
          data: {
            data: {
              access_token: replacement.accessToken,
              expires_at: expiresAt,
              token_type: "Bearer",
            },
          },
        };
      return identityResponse(
        request.headers.Authorization.endsWith("q") ? parentIdentity : secondParent,
      );
    },
  };
  const session = new inviteSessionModule.InviteSession(options);
  await session.restore();
  assert.equal(session.snapshot.status, "READY");
  const ended = await session.logout();
  assert.notEqual(ended.status, "READY");
  assert.doesNotMatch(ended.message, /本机登录已清除|已退出登录/u);
  assert.match(ended.message, /重[启新].*|清理/u);
  assert.equal(stored === old, true);
  for (const instance of [
    session,
    new inviteSessionModule.InviteSession({
      ...options,
      sessionStore: { ...options.sessionStore },
    }),
  ]) {
    const restored = await instance.restore();
    assert.notEqual(restored.status, "READY");
    assert.deepEqual(restored.roles, []);
    await assert.rejects(instance.postAuthenticated("/parent/notices", {}), /登录/u);
  }
  assert.deepEqual(paths, ["/me", "/identity/logout"]);
  await session.login("new-parent", "synthetic-only-password");
  assert.equal(session.snapshot.displayName, secondParent.display_name);
  assert.equal(stored.accessToken === replacement.accessToken, true);
});

test("a server logout failure still reports verified local removal and leaves no usable local session", async () => {
  const { session, storage } = createHarness({
    storedSession: { accessToken: token, expiresAt },
    request: async (url) =>
      new URL(url).pathname === "/me" ? identityResponse() : { statusCode: 503, data: {} },
  });
  await session.restore();
  const ended = await session.logout();
  assert.equal(ended.status, "SIGNED_OUT");
  assert.match(ended.message, /本机登录已清除.*服务器会话可能保留/u);
  assert.equal(storage.value, null);
  assert.equal((await session.restore()).status, "SIGNED_OUT");
});
