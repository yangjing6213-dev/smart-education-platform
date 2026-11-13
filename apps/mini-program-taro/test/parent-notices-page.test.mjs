import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import test from "node:test";

const require = createRequire(new URL("../package.json", import.meta.url));
const ts = require("typescript");
const pageUrl = new URL("../src/pages/parent/notices/index.tsx", import.meta.url);
const id = "00000000-0000-4000-8000-000000000339";
const notice = (receiptStatus = "UNREAD", version = 2) => ({
  id,
  version,
  status: "PUBLISHED",
  published: true,
  title: "本周活动安排",
  body: "合成通知，请阅读活动安排。",
  target: "CLASS",
  requiresAcknowledgment: true,
  receiptStatus,
  synthetic: true,
});
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
};
const settle = async () => {
  for (let i = 0; i < 8; i++) await new Promise((resolve) => setImmediate(resolve));
};

// Execute the real TSX component and its handlers using the installed TypeScript compiler.
// Only the host hooks/components, navigation and transport are replaced; the notice client is real.
async function mount(options = {}) {
  assert.ok(fs.existsSync(pageUrl), "the parent notice page must exist");
  const client = await import("../src/notices/parent-notices.ts");
  const roles = await import("../src/auth/role-gate.ts");
  let slots = [],
    cursor = 0,
    tree;
  const events = {},
    routes = [],
    calls = [];
  const session = {
    snapshot: { status: "READY", roles: options.roles ?? ["PARENT"] },
    restore: async () => (options.restore ? options.restore(session) : session.snapshot),
    getAuthenticated: async (...args) => {
      calls.push(["GET", ...args]);
      return options.get ? options.get(...args) : [notice()];
    },
    postAuthenticated: async (...args) => {
      calls.push(["POST", ...args]);
      return options.post(...args);
    },
  };
  const hooks = {
    useState(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = typeof initial === "function" ? initial() : initial;
      return [
        slots[index],
        (next) => {
          slots[index] = typeof next === "function" ? next(slots[index]) : next;
        },
      ];
    },
    useRef(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = { current: initial };
      return slots[index];
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
  const module = { exports: {} };
  const compiled = ts.transpileModule(fs.readFileSync(pageUrl, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText;
  vm.runInNewContext(
    compiled,
    {
      exports: module.exports,
      module,
      require(name) {
        if (name === "react") return hooks;
        if (name === "react/jsx-runtime") return { jsx, jsxs: jsx, Fragment: "Fragment" };
        if (name === "@tarojs/components") return { Button: "Button", Text: "Text", View: "View" };
        if (name === "@tarojs/taro") return { __esModule: true, default: taro, ...taro };
        if (name.endsWith("runtime-session")) return { inviteSession: session };
        if (name.endsWith("role-gate")) return roles;
        if (name.endsWith("parent-notices")) return client;
        if (name.endsWith(".css")) return {};
        throw new Error(`Unexpected import: ${name}`);
      },
    },
    { filename: "parent-notices-page.js" },
  );
  const render = () => {
    cursor = 0;
    tree = module.exports.default();
    return tree;
  };
  const nodes = (node = tree) =>
    Array.isArray(node)
      ? node.flatMap(nodes)
      : node && typeof node === "object"
        ? [node, ...nodes(node.props?.children)]
        : [];
  const text = (node = tree) =>
    Array.isArray(node)
      ? node.map(text).join("")
      : node && typeof node === "object"
        ? text(node.props?.children)
        : typeof node === "string" || typeof node === "number"
          ? String(node)
          : "";
  const button = (label) => nodes().find((node) => node.type === "Button" && text(node) === label);
  const click = (label) => {
    render();
    const found = button(label);
    assert.ok(found, `button ${label} is visible`);
    assert.ok(!found.props.disabled, `button ${label} is enabled`);
    found.props.onClick();
    render();
  };
  render();
  events.show();
  await settle();
  render();
  return { session, calls, routes, events, render, text, button, click };
}

test("home route opens the notice page and real buttons complete read then acknowledgment", async () => {
  const app = fs.readFileSync(new URL("../src/app.config.ts", import.meta.url), "utf8");
  const home = fs.readFileSync(
    new URL("../src/pages/parent/home/index.tsx", import.meta.url),
    "utf8",
  );
  assert.match(app, /pages\/parent\/notices\/index/u);
  assert.match(home, /pages\/parent\/notices\/index/u);
  assert.match(home, /function openNotices\(\) \{\s*contextVersion\.current \+= 1;/u);
  let status = "UNREAD";
  const page = await mount({
    get: async () => [notice(status)],
    post: async (path) => {
      status = path.endsWith("/read") ? "READ" : "ACKNOWLEDGED";
      return notice(status);
    },
  });
  assert.match(page.text(), /未读/u);
  assert.equal(page.button("确认收到"), undefined);
  page.click("标记已读");
  await settle();
  page.render();
  assert.match(page.text(), /已读/u);
  page.click("确认收到");
  await settle();
  page.render();
  assert.match(page.text(), /已确认收到/u);
  assert.equal(page.button("确认收到"), undefined);
  assert.doesNotMatch(page.text(), /00000000/u);
  assert.deepEqual(JSON.parse(JSON.stringify(page.calls.filter(([method]) => method === "POST"))), [
    ["POST", `/parent/notices/${id}/read`, { version: 2 }],
    ["POST", `/parent/notices/${id}/ack`, { version: 2 }],
  ]);
  page.click("‹ 返回家长首页");
  assert.deepEqual(page.routes, ["/pages/parent/home/index"]);
});

test("rejects staff access, offers empty and retry states, and does not echo server error text", async () => {
  const denied = await mount({ roles: ["STAFF"] });
  assert.equal(denied.calls.length, 0);
  assert.deepEqual(denied.routes, ["/pages/auth/login/index"]);
  let fail = true;
  const page = await mount({
    get: async () => {
      if (fail) throw Error("PRIVATE_TOKEN");
      return [];
    },
  });
  assert.doesNotMatch(page.text(), /PRIVATE_TOKEN/u);
  assert.ok(page.button("重新读取"));
  fail = false;
  page.click("重新读取");
  await settle();
  page.render();
  assert.match(page.text(), /暂无通知/u);
});

test("duplicate clicks send one receipt; version conflicts refresh without confirming a new version", async () => {
  const pending = deferred();
  let version = 2;
  const page = await mount({
    get: async () => [notice(version === 2 ? "READ" : "UNREAD", version)],
    post: () => pending.promise,
  });
  const handler = page.button("确认收到").props.onClick;
  handler();
  handler();
  await settle();
  page.render();
  assert.equal(page.calls.filter(([method]) => method === "POST").length, 1);
  version = 3;
  pending.reject(Object.assign(Error("conflict"), { statusCode: 409 }));
  await settle();
  page.render();
  assert.match(page.text(), /通知已更新/u);
  assert.ok(page.button("标记已读"));
  assert.equal(page.button("确认收到"), undefined);
  assert.equal(page.calls.filter(([method]) => method === "POST").length, 1);
});

test("revoked relationship and expired login remove stale notices and never show success", async () => {
  for (const statusCode of [401, 403, 404]) {
    const page = await mount({
      post: async () => {
        throw Object.assign(Error("PRIVATE"), { statusCode });
      },
    });
    page.click("标记已读");
    await settle();
    page.render();
    assert.doesNotMatch(page.text(), /本周活动安排|已确认收到|PRIVATE/u);
    assert.equal(page.button("确认收到"), undefined);
  }
});

test("hidden, unloaded or switched-account pages discard late responses and reload on return", async () => {
  for (const event of ["hide", "unload", "account"]) {
    const pending = deferred();
    let late = false;
    const page = await mount({ get: () => (late ? pending.promise : Promise.resolve([notice()])) });
    late = true;
    page.click("刷新通知");
    await settle();
    if (event === "account") page.session.snapshot = { status: "READY", roles: ["PARENT"] };
    else page.events[event]();
    pending.resolve([notice("ACKNOWLEDGED")]);
    await settle();
    page.render();
    assert.doesNotMatch(page.text(), /本周活动安排|已确认收到/u);
    if (event === "hide") {
      late = false;
      page.events.show();
      await settle();
      page.render();
      assert.match(page.text(), /本周活动安排/u);
    }
  }
});

test("old responses cannot replace a newer visit and revoked relationships can return an empty list", async () => {
  const old = deferred();
  let reads = 0;
  const page = await mount({ get: () => (++reads === 1 ? old.promise : Promise.resolve([])) });
  assert.match(page.text(), /正在读取/u);
  assert.equal(page.button("正在读取…").props.disabled, true);
  page.events.hide();
  page.events.show();
  await settle();
  page.render();
  assert.match(page.text(), /暂无通知/u);
  old.resolve([notice()]);
  await settle();
  page.render();
  assert.match(page.text(), /暂无通知/u);
  assert.doesNotMatch(page.text(), /本周活动安排/u);
});

test("leaving during a write ignores its late result and stops follow-up reads", async () => {
  for (const event of ["hide", "unload", "logout"]) {
    const pending = deferred();
    const page = await mount({ post: () => pending.promise });
    page.click("标记已读");
    await settle();
    if (event === "logout") page.session.snapshot = { status: "SIGNED_OUT", roles: [] };
    else page.events[event]();
    pending.resolve(notice("READ"));
    await settle();
    page.render();
    assert.doesNotMatch(page.text(), /本周活动安排|已记录阅读/u);
    assert.equal(page.calls.filter(([method]) => method === "GET").length, 1);
  }
});

test("returning while identity is still restoring waits for it instead of redirecting to login", async () => {
  const pending = deferred();
  let restores = 0;
  const page = await mount({
    restore: (session) => {
      restores++;
      if (restores > 1) return session.snapshot;
      session.snapshot = { status: "CHECKING", roles: [] };
      return pending.promise;
    },
  });
  page.events.hide();
  page.events.show();
  await settle();
  page.render();
  assert.deepEqual(page.routes, []);
  assert.equal(page.calls.length, 0);
  page.session.snapshot = { status: "READY", roles: ["PARENT"] };
  pending.resolve(page.session.snapshot);
  await settle();
  page.render();
  assert.match(page.text(), /本周活动安排/u);
  assert.equal(restores, 1);
});

test("busy or temporarily unavailable identity can be retried without sending notice requests", async () => {
  for (const status of ["BUSY", "CHECKING", "ERROR"]) {
    const page = await mount({
      restore: (session) => {
        session.snapshot = { status, roles: [] };
        return session.snapshot;
      },
    });
    assert.deepEqual(page.routes, []);
    assert.equal(page.calls.length, 0);
    assert.ok(page.button("重新读取"));
  }
});
