import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import vm from "node:vm";
import test from "node:test";
import { InviteSession } from "../src/auth/invite-session.ts";
import * as roles from "../src/auth/role-gate.ts";

const feesModule = await import("../src/fees/parent-fees.ts").catch((error) => {
  if (error?.code === "ERR_MODULE_NOT_FOUND") return null;
  throw error;
});
const feePage = await readFile(
  new URL("../src/pages/parent/fees/index.tsx", import.meta.url),
  "utf8",
);
const appConfig = await readFile(new URL("../src/app.config.ts", import.meta.url), "utf8");
const parentHome = await readFile(
  new URL("../src/pages/parent/home/index.tsx", import.meta.url),
  "utf8",
);

test("parent fee page is registered, role-gated, read-only, and returns to the parent home", () => {
  assert.match(appConfig, /pages\/parent\/fees\/index/u);
  assert.match(parentHome, /费用信息/u);
  assert.match(parentHome, /pages\/parent\/fees\/index/u);
  assert.match(feePage, /inviteSession\.restore\(\)/u);
  assert.match(feePage, /hasRoleAccess\(session, "PARENT"\)/u);
  assert.match(feePage, /inviteSession\.getAuthenticated\(path\)/u);
  assert.doesNotMatch(feePage, /postAuthenticated|patchAuthenticated/u);
  assert.match(feePage, /pages\/parent\/home\/index/u);
  assert.match(feePage, /useState<PageStatus>\("LOADING"\)/u);
  assert.match(feePage, /status === "ERROR"/u);
  assert.match(feePage, /model\.empty/u);
  assert.match(feePage, /model\.documents\.map/u);
  assert.match(feePage, /不处理支付、退款或签约/u);
});

function feesFixture(studentLabel = "合成学生甲", amount = 480) {
  return {
    bindingApplications: [],
    documents: [
      {
        id: "00000000-0000-4000-8000-000000000342",
        version: 1,
        documentType: "BILL",
        title: "十月服务费用",
        studentId: "00000000-0000-4000-8000-000000000341",
        studentAlias: "student-00000000",
        studentLabel,
        status: "AVAILABLE",
        amount,
        currency: "CNY",
        period: "2026-10",
        sourceVersion: 1,
        validFrom: "2026-10-01",
        validTo: "2026-10-31",
        available: true,
        summary: "本地合成费用说明。",
        synthetic: true,
      },
    ],
    ledger: {
      scope: "parent",
      synthetic: true,
      entries: [
        {
          id: "00000000-0000-4000-8000-000000000345",
          type: "CHARGE",
          amountMinor: amount * 100,
          currency: "CNY",
          period: "2026-10",
          occurredOn: "2026-10-01",
          documentId: "00000000-0000-4000-8000-000000000342",
          documentVersion: 1,
          studentAlias: "student-00000000",
          studentLabel,
          synthetic: true,
        },
      ],
      reconciliation: {
        chargeMinor: amount * 100,
        paymentMinor: 0,
        refundMinor: 0,
        balanceDueMinor: amount * 100,
        currency: "CNY",
      },
    },
  };
}

test("parent fee page model shows the read-only amount, period and safe student label", async () => {
  assert.ok(feesModule?.loadParentFees, "the parent fee reader must exist");
  assert.ok(feesModule?.buildParentFeesPageModel, "the parent fee page model must exist");
  const loaded = await feesModule.loadParentFees(async () => feesFixture());

  const model = feesModule.buildParentFeesPageModel(loaded);
  assert.deepEqual(model, {
    empty: false,
    balanceText: "¥480.00",
    documents: [
      {
        key: "00000000-0000-4000-8000-000000000342",
        title: "十月服务费用",
        studentLabel: "合成学生甲",
        period: "2026-10",
        statusText: "待查看",
        amountText: "¥480.00",
        validityText: "有效期至 2026-10-31",
        summary: "本地合成费用说明。",
      },
    ],
  });
  assert.equal(JSON.stringify(model).includes("00000000-0000-4000-8000-000000000341"), false);
});

test("parent fee page model displays a clear empty state without inventing a balance", () => {
  assert.ok(feesModule?.buildParentFeesPageModel, "the parent fee page model must exist");
  assert.deepEqual(
    feesModule.buildParentFeesPageModel({
      documents: [],
      reconciliation: {
        chargeMinor: 0,
        paymentMinor: 0,
        refundMinor: 0,
        balanceDueMinor: 0,
        currency: "CNY",
      },
    }),
    { empty: true, balanceText: "¥0.00", documents: [] },
  );
});

// Real page, invite session, role gate and fee projection. Only the UI host, token store and transport are local doubles.
const require = createRequire(import.meta.url);
const ts = require("typescript");
const compiled = ts.transpileModule(feePage, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    jsx: ts.JsxEmit.ReactJSX,
    target: ts.ScriptTarget.ES2022,
    esModuleInterop: true,
  },
}).outputText;
const settle = () => new Promise((resolve) => setImmediate(resolve));
async function mountFees({ rolesAllowed = true, pauseIdentity = false } = {}) {
  const tokenFor = (name) => ({
    accessToken: name.repeat(48),
    expiresAt: new Date(Date.now() + 3600000).toISOString(),
  });
  const reads = [],
    readAccounts = [],
    identityChecks = [],
    routes = [],
    slots = [],
    effects = [],
    events = {};
  let stored = tokenFor("a"),
    cursor,
    tree;
  const session = new InviteSession({
    baseUrl: "http://127.0.0.1:4317",
    allowLocalHttp: true,
    sessionStore: {
      load: () => stored,
      clear: () => {
        stored = null;
      },
      save: (next) => {
        stored = next;
      },
    },
    request: async (url, options) => {
      assert.equal(options.method, "GET");
      const path = new URL(url).pathname;
      if (path === "/me") {
        if (pauseIdentity) await new Promise((resolve) => identityChecks.push(resolve));
        return {
          statusCode: 200,
          data: {
            data: {
              actor_id: options.headers.Authorization.endsWith("a")
                ? "00000000-0000-4000-8000-000000000301"
                : "00000000-0000-4000-8000-000000000302",
              display_name: "合成账号",
              memberships: [
                { status: "ACTIVE", capabilities: rolesAllowed ? ["care:read"] : ["daily:read"] },
              ],
            },
          },
        };
      }
      assert.equal(path, "/parent/fees");
      readAccounts.push(options.headers.Authorization.endsWith("a") ? "A" : "B");
      return new Promise((resolve) =>
        reads.push((statusCode, data) => resolve({ statusCode, data: { data } })),
      );
    },
  });
  const hooks = {
    useState(initial) {
      const i = cursor++;
      if (!(i in slots)) slots[i] = typeof initial === "function" ? initial() : initial;
      return [
        slots[i],
        (next) => {
          slots[i] = typeof next === "function" ? next(slots[i]) : next;
        },
      ];
    },
    useRef(initial) {
      return (slots[cursor++] ??= { current: initial });
    },
    useEffect(fn) {
      const i = cursor++;
      if (!(i in slots)) {
        slots[i] = true;
        effects.push(fn);
      }
    },
  };
  const taro = {
    redirectTo: ({ url }) => {
      routes.push(url);
      return Promise.resolve();
    },
    useDidShow: (fn) => {
      events.show = fn;
    },
    useDidHide: (fn) => {
      events.hide = fn;
    },
    useUnload: (fn) => {
      events.unload = fn;
    },
  };
  const jsx = (type, props) => ({ type, props });
  const exports = {};
  vm.runInNewContext(compiled, {
    exports,
    module: { exports },
    require(name) {
      if (name === "react") return hooks;
      if (name === "react/jsx-runtime") return { jsx, jsxs: jsx, Fragment: "Fragment" };
      if (name === "@tarojs/components") return { Button: "Button", Text: "Text", View: "View" };
      if (name === "@tarojs/taro") return { __esModule: true, default: taro, ...taro };
      if (name.endsWith("/runtime-session")) return { inviteSession: session };
      if (name.endsWith("/role-gate")) return roles;
      if (name.endsWith("/parent-fees")) return feesModule;
      if (name.endsWith(".css")) return {};
      throw Error("Unexpected import " + name);
    },
  });
  const render = () => {
    cursor = 0;
    tree = exports.default();
  };
  const visible = (n) =>
    Array.isArray(n)
      ? n.map(visible).join("")
      : n && typeof n === "object"
        ? visible(n.props.children)
        : typeof n === "string"
          ? n
          : "";
  const nodes = (n) =>
    Array.isArray(n)
      ? n.flatMap(nodes)
      : n && typeof n === "object"
        ? [n, ...nodes(n.props.children)]
        : [];
  const button = (label) => nodes(tree).find((n) => n.type === "Button" && visible(n) === label);
  const event = async (name) => {
    events[name]?.();
    await settle();
    render();
  };
  render();
  for (const effect of effects) effect();
  await event("show");
  return {
    reads,
    readAccounts,
    identityChecks,
    routes,
    event,
    button,
    text: () => visible(tree),
    session,
    selectNextStoredParent: () => {
      stored = tokenFor("b");
    },
    replaceParent: async () => {
      stored = tokenFor("b");
      await session.restore();
      render();
    },
    respond: async (index, status, data) => {
      reads[index](status, data);
      await settle();
      render();
    },
    click: async (label) => {
      const hit = button(label);
      assert.ok(hit, label);
      hit.props.onClick();
      await settle();
      render();
    },
  };
}

test("a pending fee read cannot display the old parent's bill after the active parent changes", async () => {
  for (const status of [200, 401]) {
    const page = await mountFees();
    await page.replaceParent();
    await page.respond(0, status, feesFixture());
    assert.doesNotMatch(page.text(), /合成学生甲|480\.00|登录状态已过期/u);
    assert.equal(page.session.snapshot.status, "READY");
    assert.deepEqual(page.routes, []);
    await page.click("重新读取");
    await page.respond(1, 200, feesFixture("合成学生乙", 75));
    assert.match(page.text(), /合成学生乙/u);
    assert.match(page.text(), /75\.00/u);
  }
});

test("a parent change during initial identity verification is rechecked on the next show", async () => {
  const page = await mountFees({ pauseIdentity: true });
  assert.equal(page.identityChecks.length, 1);
  await page.event("hide");
  page.selectNextStoredParent();
  await page.event("show");
  page.identityChecks[0]();
  await settle();
  assert.deepEqual(page.readAccounts, []);
  assert.equal(page.identityChecks.length, 2);
  page.identityChecks[1]();
  await settle();
  assert.deepEqual(page.readAccounts, ["B"]);
  await page.respond(0, 200, feesFixture("合成学生乙", 75));
  assert.match(page.text(), /合成学生乙/u);
});

test("hiding clears the fee model; an earlier success or 401 never replaces a newer parent's result", async () => {
  for (const status of [200, 401]) {
    const page = await mountFees();
    await page.event("hide");
    await page.replaceParent();
    await page.event("show");
    assert.equal(page.reads.length, 2);
    await page.respond(1, 200, feesFixture("合成学生乙", 75));
    await page.respond(0, status, feesFixture());
    assert.match(page.text(), /合成学生乙/u);
    assert.doesNotMatch(page.text(), /合成学生甲|480\.00|登录状态已过期/u);
    await page.event("hide");
    assert.doesNotMatch(page.text(), /合成学生乙|75\.00/u);
  }
});

test("unload and return prevent late fee responses from reopening the bill or navigating", async () => {
  for (const exit of ["unload", "back"]) {
    const page = await mountFees();
    if (exit === "unload") await page.event(exit);
    else await page.click("‹ 返回家长首页");
    await page.respond(0, 200, feesFixture());
    assert.doesNotMatch(page.text(), /合成学生甲|480\.00/u);
    assert.deepEqual(page.routes, exit === "back" ? ["/pages/parent/home/index"] : []);
  }
});

test("current 401 leads to login, while 403 and service errors show safe recovery and back", async () => {
  for (const [code, label] of [
    [401, "登录"],
    [403, "权限"],
    [503, "服务"],
  ]) {
    const page = await mountFees();
    await page.respond(0, code);
    assert.ok(page.text().includes(label));
    assert.ok(page.button("‹ 返回家长首页"));
    if (code === 401) {
      assert.equal(page.session.snapshot.status, "SIGNED_OUT");
      await page.click("重新登录");
      assert.deepEqual(page.routes, ["/pages/auth/login/index"]);
    } else {
      assert.equal(page.button("重新登录"), undefined);
      assert.equal(page.session.snapshot.status, "READY");
      await page.click("重新读取");
      await page.respond(1, 200, feesFixture());
      assert.match(page.text(), /480\.00/u);
    }
  }
  const staff = await mountFees({ rolesAllowed: false });
  assert.equal(staff.reads.length, 0);
});
