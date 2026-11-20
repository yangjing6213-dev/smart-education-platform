import assert from "node:assert/strict";
import test from "node:test";
import { InviteSessionClient, inviteNextPath, projectIdentity } from "./invite-session.js";

const actorId = "00000000-0000-4000-8000-000000000401";
const parentCapabilities = ["binding:read", "leave:apply", "leave:read"];
const identity = (
  memberships: unknown = [{ status: "ACTIVE", capabilities: parentCapabilities }],
) => ({
  actor_id: actorId,
  display_name: "合成家长",
  memberships,
});
const success = (data: unknown) => Response.json({ data });
const loginResponse = () => success({ token_type: "Bearer", expires_at: "2035-01-01T00:00:00Z" });

test("invite login sends credentials only to its same-origin cookie proxy and exposes safe destinations", async () => {
  const calls: { path: string; body: unknown }[] = [];
  const client = new InviteSessionClient({
    baseUrl: "https://care.example.invalid",
    fetcher: async (input, init) => {
      const url = new URL(String(input));
      assert.equal(url.origin, "https://care.example.invalid");
      assert.equal(init?.credentials, "same-origin");
      assert.equal(init?.cache, "no-store");
      assert.equal(init?.redirect, "error");
      assert.equal(new Headers(init?.headers).has("authorization"), false);
      calls.push({ path: url.pathname, body: init?.body ? JSON.parse(String(init.body)) : null });
      return url.pathname.endsWith("/login") ? loginResponse() : success(identity());
    },
  });
  await client.login(" synthetic-account ", "test-only-secret");
  assert.deepEqual(calls, [
    {
      path: "/api-local/identity/login",
      body: { username: "synthetic-account", password: "test-only-secret" },
    },
    { path: "/api-local/me", body: null },
  ]);
  assert.equal(client.snapshot.status, "READY");
  assert.deepEqual(client.snapshot.services, [
    { href: "/web/parent/learning", label: "学习摘要" },
    { href: "/web/parent/monthly", label: "月度反馈" },
    { href: "/web/parent/fees", label: "费用与流水" },
    { href: "/web/parent/leave", label: "请假申请" },
  ]);
  assert.doesNotMatch(JSON.stringify(client.snapshot), /secret|password|token|00000000/u);
});

test("expired-cookie restore consumes its unauthorized response and stays anonymous", async () => {
  const paths: string[] = [];
  const response = Response.json({ error: { code: "UNAUTHENTICATED" } }, { status: 401 });
  const client = new InviteSessionClient({
    baseUrl: "http://127.0.0.1:3000",
    fetcher: async (input) => {
      paths.push(new URL(String(input)).pathname);
      return response;
    },
  });
  await client.restore();
  assert.equal(client.snapshot.status, "IDLE");
  assert.deepEqual(client.snapshot.services, []);
  assert.deepEqual(paths, ["/api-local/me"]);
  assert.equal(response.bodyUsed, true);
});

test("inactive or split membership grants never unlock a service", async () => {
  const cases = [
    {
      memberships: [{ status: "SUSPENDED", capabilities: parentCapabilities }],
      expectedStatus: "DENIED",
      expectedServices: [],
    },
    {
      memberships: [
        { status: "ACTIVE", capabilities: ["binding:read"] },
        { status: "ACTIVE", capabilities: ["leave:apply", "leave:read"] },
      ],
      expectedStatus: "READY",
      expectedServices: [
        { href: "/web/parent/learning", label: "学习摘要" },
        { href: "/web/parent/monthly", label: "月度反馈" },
        { href: "/web/parent/fees", label: "费用与流水" },
      ],
    },
  ] as const;
  for (const { memberships, expectedStatus, expectedServices } of cases) {
    const client = new InviteSessionClient({
      baseUrl: "http://127.0.0.1:3000",
      fetcher: async (input) =>
        String(input).endsWith("/me")
          ? success(identity(memberships))
          : success({ logged_out: true }),
    });
    await client.restore();
    assert.equal(client.snapshot.status, expectedStatus);
    assert.deepEqual(client.snapshot.services, expectedServices);
  }
});

test("an active binding:read membership receives parent read-only destinations", async () => {
  const client = new InviteSessionClient({
    baseUrl: "http://127.0.0.1:3000",
    fetcher: async () => success(identity([{ status: "ACTIVE", capabilities: ["binding:read"] }])),
  });

  await client.restore();

  assert.equal(client.snapshot.status, "READY");
  assert.deepEqual(client.snapshot.services, [
    { href: "/web/parent/learning", label: "学习摘要" },
    { href: "/web/parent/monthly", label: "月度反馈" },
    { href: "/web/parent/fees", label: "费用与流水" },
  ]);
});

test("an active binding:read membership receives the monthly summary invitation destination", async () => {
  const client = new InviteSessionClient({
    baseUrl: "http://127.0.0.1:3000",
    fetcher: async () => success(identity([{ status: "ACTIVE", capabilities: ["binding:read"] }])),
  });

  await client.restore();

  assert.deepEqual(client.snapshot.services, [
    { href: "/web/parent/learning", label: "学习摘要" },
    { href: "/web/parent/monthly", label: "月度反馈" },
    { href: "/web/parent/fees", label: "费用与流水" },
  ]);
  assert.equal(inviteNextPath("/web/parent/monthly"), "/web/parent/monthly");
});

test("an active binding:read membership receives the parent fees invitation destination", async () => {
  const client = new InviteSessionClient({
    baseUrl: "http://127.0.0.1:3000",
    fetcher: async () => success(identity([{ status: "ACTIVE", capabilities: ["binding:read"] }])),
  });

  await client.restore();

  assert.equal(client.snapshot.status, "READY");
  assert.deepEqual(client.snapshot.services, [
    { href: "/web/parent/learning", label: "学习摘要" },
    { href: "/web/parent/monthly", label: "月度反馈" },
    { href: "/web/parent/fees", label: "费用与流水" },
  ]);
  assert.equal(inviteNextPath("/web/parent/fees" as never), "/web/parent/fees");
});

test("only an active care:read membership receives the parent growth-record destination", async () => {
  const client = new InviteSessionClient({
    baseUrl: "http://127.0.0.1:3000",
    fetcher: async () => success(identity([{ status: "ACTIVE", capabilities: ["care:read"] }])),
  });

  await client.restore();

  assert.equal(client.snapshot.status, "READY");
  assert.deepEqual(client.snapshot.services, [{ href: "/web/parent/home", label: "成长记录" }]);
  assert.equal(inviteNextPath("/web/parent/home"), "/web/parent/home");
});

test("a binding destination requires apply and read capabilities in one active membership", async () => {
  const required = ["binding:apply", "binding:read"];
  for (const memberships of [
    [{ status: "ACTIVE", capabilities: required }],
    [{ status: "ACTIVE", capabilities: required.slice(0, 1) }],
    [
      { status: "ACTIVE", capabilities: ["binding:apply"] },
      { status: "ACTIVE", capabilities: ["binding:read"] },
    ],
  ]) {
    const client = new InviteSessionClient({
      baseUrl: "http://127.0.0.1:3000",
      fetcher: async () => success(identity(memberships)),
    });
    await client.restore();
    if (memberships.length === 1 && memberships[0]?.capabilities.length === 2) {
      assert.deepEqual(client.snapshot.services, [
        { href: "/web/parent/learning", label: "学习摘要" },
        { href: "/web/parent/monthly", label: "月度反馈" },
        { href: "/web/parent/fees", label: "费用与流水" },
        { href: "/web/parent/binding", label: "关系绑定与授权" },
        { href: "/web/parent/pickup", label: "接送授权" },
      ]);
    } else {
      assert.equal(
        client.snapshot.services.some((service) => String(service.href) === "/web/parent/binding"),
        false,
      );
    }
  }
  assert.equal(inviteNextPath("/web/parent/binding" as never), "/web/parent/binding");
});

test("pickup return path is granted only by one active binding membership", async () => {
  const allowed = ["binding:apply", "binding:read"];
  const cases = [
    { memberships: [{ status: "ACTIVE", capabilities: allowed }], expected: true },
    { memberships: [{ status: "INACTIVE", capabilities: allowed }], expected: false },
    { memberships: [{ status: "ACTIVE", capabilities: ["binding:read"] }], expected: false },
    {
      memberships: [
        { status: "ACTIVE", capabilities: ["binding:apply"] },
        { status: "ACTIVE", capabilities: ["binding:read"] },
      ],
      expected: false,
    },
  ];

  for (const { memberships, expected } of cases) {
    const client = new InviteSessionClient({
      baseUrl: "http://127.0.0.1:3000",
      fetcher: async () => success(identity(memberships)),
    });
    await client.restore();
    assert.equal(
      client.snapshot.services.some((service) => String(service.href) === "/web/parent/pickup"),
      expected,
    );
  }
  assert.equal(inviteNextPath("/web/parent/pickup"), "/web/parent/pickup");
});

test("staff workbench and relationship review destinations require their invite capabilities", async () => {
  const cases = [
    {
      memberships: [{ status: "ACTIVE", capabilities: ["task:read", "binding:review"] }],
      expected: [
        { href: "/web/staff/workbench", label: "员工工作台" },
        { href: "/web/staff/binding", label: "关系审核" },
      ],
    },
    {
      memberships: [{ status: "ACTIVE", capabilities: ["task:read"] }],
      expected: [{ href: "/web/staff/workbench", label: "员工工作台" }],
    },
    {
      memberships: [{ status: "ACTIVE", capabilities: ["binding:review"] }],
      expected: [{ href: "/web/staff/binding", label: "关系审核" }],
    },
    {
      memberships: [{ status: "INACTIVE", capabilities: ["task:read", "binding:review"] }],
      expected: [],
    },
  ];

  for (const { memberships, expected } of cases) {
    const client = new InviteSessionClient({
      baseUrl: "http://127.0.0.1:3000",
      fetcher: async () => success(identity(memberships)),
    });
    await client.restore();
    assert.deepEqual(client.snapshot.services, expected);
  }

  assert.equal(inviteNextPath("/web/staff/workbench" as never), "/web/staff/workbench");
  assert.equal(inviteNextPath("/web/staff/binding" as never), "/web/staff/binding");
  assert.equal(inviteNextPath("/web/staff/workbench?profile=teacher-east" as never), null);
});

test("staff care destination requires an active care:write membership and an exact return path", async () => {
  const cases = [
    {
      memberships: [{ status: "ACTIVE", capabilities: ["care:write"] }],
      expected: [{ href: "/web/staff/care", label: "成长记录" }],
    },
    {
      memberships: [{ status: "ACTIVE", capabilities: ["task:read"] }],
      expected: [{ href: "/web/staff/workbench", label: "员工工作台" }],
    },
    { memberships: [{ status: "INACTIVE", capabilities: ["care:write"] }], expected: [] },
  ];

  for (const { memberships, expected } of cases) {
    const client = new InviteSessionClient({
      baseUrl: "http://127.0.0.1:3000",
      fetcher: async () => success(identity(memberships)),
    });
    await client.restore();
    assert.deepEqual(client.snapshot.services, expected);
  }

  assert.equal(inviteNextPath("/web/staff/care" as never), "/web/staff/care");
  assert.equal(inviteNextPath("/web/staff/care?profile=teacher-east" as never), null);
});

test("staff care review destination requires an active care:review membership", async () => {
  const cases = [
    {
      memberships: [{ status: "ACTIVE", capabilities: ["care:review"] }],
      expected: [{ href: "/web/staff/care-review", label: "成长记录审核" }],
    },
    {
      memberships: [{ status: "ACTIVE", capabilities: ["care:write"] }],
      expected: [{ href: "/web/staff/care", label: "成长记录" }],
    },
    {
      memberships: [{ status: "INACTIVE", capabilities: ["care:review"] }],
      expected: [],
    },
  ];

  for (const { memberships, expected } of cases) {
    const client = new InviteSessionClient({
      baseUrl: "https://care.example.invalid",
      fetcher: async (input) =>
        new URL(String(input)).pathname === "/api-local/me"
          ? success(identity(memberships))
          : success({}),
    });
    await client.restore();
    assert.deepEqual(client.snapshot.services, expected);
  }

  assert.equal(inviteNextPath("/web/staff/care-review" as never), "/web/staff/care-review");
  assert.equal(inviteNextPath("/web/staff/care-review?profile=owner-east" as never), null);
});

test("staff daily destination requires daily read, create, and submit in one active membership", async () => {
  const cases = [
    {
      memberships: [
        { status: "ACTIVE", capabilities: ["daily:read", "daily:create", "daily:submit"] },
      ],
      expected: [{ href: "/web/staff/daily", label: "工作日报" }],
    },
    {
      memberships: [
        { status: "ACTIVE", capabilities: ["daily:create"] },
        { status: "ACTIVE", capabilities: ["daily:read", "daily:submit"] },
      ],
      expected: [],
    },
    {
      memberships: [{ status: "ACTIVE", capabilities: ["daily:read", "daily:create"] }],
      expected: [],
    },
    {
      memberships: [
        { status: "INACTIVE", capabilities: ["daily:read", "daily:create", "daily:submit"] },
      ],
      expected: [],
    },
  ];

  for (const { memberships, expected } of cases) {
    const client = new InviteSessionClient({
      baseUrl: "http://127.0.0.1:3000",
      fetcher: async () => success(identity(memberships)),
    });
    await client.restore();
    assert.deepEqual(client.snapshot.services, expected);
  }

  assert.equal(inviteNextPath("/web/staff/daily" as never), "/web/staff/daily");
  assert.equal(inviteNextPath("/web/staff/daily?profile=teacher-east" as never), null);
});

test("staff monthly destination accepts active feedback read without granting write capabilities", async () => {
  for (const [status, capabilities, expected] of [
    [
      "ACTIVE",
      ["feedback:read"],
      [
        { href: "/web/staff/monthly", label: "班级月度总结" },
        { href: "/web/staff/child-monthly", label: "孩子个人月报" },
      ],
    ],
    ["ACTIVE", ["feedback:create", "feedback:submit"], []],
    ["SUSPENDED", ["feedback:read"], []],
  ] as const) {
    const client = new InviteSessionClient({
      baseUrl: "http://127.0.0.1:3000",
      fetcher: async () => success(identity([{ status, capabilities }])),
    });
    await client.restore();
    assert.deepEqual(client.snapshot.services, expected);
  }
  assert.equal(inviteNextPath("/web/staff/monthly"), "/web/staff/monthly");
  assert.equal(inviteNextPath("/web/staff/monthly?role=STAFF"), null);
  assert.equal(inviteNextPath("/web/staff/child-monthly"), "/web/staff/child-monthly");
  assert.equal(inviteNextPath("/web/staff/child-monthly?role=STAFF"), null);
});

test("staff pickup destination follows the active attendance writer permission", async () => {
  for (const [status, capabilities, expected] of [
    ["ACTIVE", ["attendance:write"], [{ href: "/web/staff/pickup", label: "接送核验" }]],
    ["ACTIVE", ["task:read"], [{ href: "/web/staff/workbench", label: "员工工作台" }]],
    ["SUSPENDED", ["attendance:write"], []],
  ] as const) {
    const client = new InviteSessionClient({
      baseUrl: "http://127.0.0.1:3000",
      fetcher: async () => success(identity([{ status, capabilities }])),
    });
    await client.restore();
    assert.deepEqual(client.snapshot.services, expected);
  }
  assert.equal(inviteNextPath("/web/staff/pickup"), "/web/staff/pickup");
  assert.equal(inviteNextPath("/web/staff/pickup?role=STAFF"), null);
});

test("navigation uses the shared identity projection and hides monthly links without active read access", () => {
  for (const [status, capabilities, allowed] of [
    ["ACTIVE", ["feedback:read"], true],
    ["ACTIVE", ["task:read", "feedback:create", "feedback:submit"], false],
    ["SUSPENDED", ["feedback:read"], false],
  ] as const) {
    const trusted = identity([
      { status, capabilities },
      { status: "ACTIVE", capabilities: ["task:read"] },
    ]);
    assert.equal(
      projectIdentity(trusted).services.some((service) => service.href === "/web/staff/monthly"),
      allowed,
    );
    assert.equal(
      projectIdentity(trusted).services.some(
        (service) => service.href === "/web/staff/child-monthly",
      ),
      allowed,
    );
  }
  assert.throws(() => projectIdentity({ memberships: [] }));
});

test("wrong credentials and malformed token-bearing login results clear the session safely", async () => {
  for (const response of [
    () => Response.json({ error: { code: "INVALID_CREDENTIALS" } }, { status: 401 }),
    () =>
      success({
        token_type: "Bearer",
        access_token: "must-not-reach-browser",
        expires_at: "2035-01-01T00:00:00Z",
      }),
  ]) {
    const paths: string[] = [];
    const client = new InviteSessionClient({
      baseUrl: "http://127.0.0.1:3000",
      fetcher: async (input) => {
        const path = new URL(String(input)).pathname;
        paths.push(path);
        return path.endsWith("/login") ? response() : success({ logged_out: true });
      },
    });
    await client.login("synthetic-account", "test-only-secret");
    assert.notEqual(client.snapshot.status, "READY");
    assert.deepEqual(client.snapshot.services, []);
    assert.deepEqual(paths, ["/api-local/identity/login", "/api-local/identity/logout"]);
    assert.doesNotMatch(JSON.stringify(client.snapshot), /must-not-reach-browser/u);
  }
});

test("a duplicate login is ignored and a late identity response cannot restore a disconnected client", async () => {
  let resolveLogin!: (response: Response) => void;
  let loginCalls = 0;
  const client = new InviteSessionClient({
    baseUrl: "http://127.0.0.1:3000",
    fetcher: async (input) => {
      if (String(input).endsWith("/login")) {
        loginCalls += 1;
        return new Promise<Response>((resolve) => {
          resolveLogin = resolve;
        });
      }
      return success(identity());
    },
  });
  const operation = client.login("synthetic-account", "test-only-secret");
  await client.login("synthetic-account", "test-only-secret");
  assert.equal(loginCalls, 1);
  client.disconnect();
  resolveLogin(loginResponse());
  await operation;
  assert.equal(client.snapshot.status, "IDLE");
  assert.deepEqual(client.snapshot.services, []);
});

test("only exact known return paths and safe web origins are accepted", () => {
  assert.equal(inviteNextPath("/web/parent/leave"), "/web/parent/leave");
  assert.equal(inviteNextPath("/web/staff/leave"), "/web/staff/leave");
  assert.equal(inviteNextPath("/web/parent/home"), "/web/parent/home");
  assert.equal(inviteNextPath("/web/parent/learning" as never), "/web/parent/learning");
  assert.equal(inviteNextPath("/web/parent/fees" as never), "/web/parent/fees");
  assert.equal(inviteNextPath("/web/parent/pickup"), "/web/parent/pickup");
  for (const value of [
    null,
    "https://example.invalid",
    "//example.invalid",
    "/web/staff/leave?role=staff",
    "/web/parent/pickup?role=parent",
    "/web/parent/fees?return=external",
    "javascript:alert(1)",
  ])
    assert.equal(inviteNextPath(value), null);
  for (const baseUrl of [
    "http://care.example.invalid",
    "https://user:secret@care.example.invalid",
    "https://care.example.invalid/elsewhere",
    "https://care.example.invalid?role=staff",
  ])
    assert.throws(() => new InviteSessionClient({ baseUrl }));
});

test("an unreachable logout stays unconfirmed and can be retried without exposing services", async () => {
  let logoutAttempts = 0;
  const client = new InviteSessionClient({
    baseUrl: "http://127.0.0.1:3000",
    fetcher: async (input) => {
      if (String(input).endsWith("/logout")) {
        logoutAttempts += 1;
        if (logoutAttempts === 1) throw new Error("test-owned network failure");
        return success({ logged_out: true });
      }
      return success(identity());
    },
  });
  await client.restore();
  await client.logout();
  assert.equal(client.snapshot.status, "LOGOUT_FAILED");
  assert.deepEqual(client.snapshot.services, []);
  await client.logout();
  assert.equal(logoutAttempts, 2);
  assert.equal(client.snapshot.status, "IDLE");
});
