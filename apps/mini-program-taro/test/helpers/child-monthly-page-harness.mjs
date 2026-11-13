import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import { setImmediate } from "node:timers";
import { URL } from "node:url";
import vm from "node:vm";

const require = createRequire(new URL("../../package.json", import.meta.url));
const ts = require("typescript");

export async function settleChildMonthlyPage() {
  for (let index = 0; index < 10; index++) await new Promise((resolve) => setImmediate(resolve));
}

export async function mountChildMonthlyPage(role, options = {}) {
  assert.ok(role === "staff" || role === "parent", "page role must be staff or parent");
  const pageUrl = new URL(`../../src/pages/${role}/child-monthly/index.tsx`, import.meta.url);
  assert.ok(fs.existsSync(pageUrl), `the ${role} child monthly page must exist`);
  const client = await import("../../src/monthly-feedback/child-monthly.ts");
  const roles = await import("../../src/auth/role-gate.ts");
  let slots = [],
    cursor = 0,
    tree;
  const events = {},
    routes = [],
    calls = [];
  const roleName = role.toUpperCase();
  const snapshot = options.snapshot ?? {
    status: "READY",
    roles: [roleName],
    canReadMonthlyFeedback: true,
  };
  const session = options.session ?? {
    get snapshot() {
      return snapshot;
    },
    async restore() {
      return options.restore ? options.restore(this) : snapshot;
    },
    getAuthenticated: async (path) => {
      calls.push(["GET", path]);
      if (options.get) return options.get(path);
      if (path === "/guardian-relationships") return [];
      if (path.endsWith("/monthly-reports")) return { records: [] };
      return { records: [], students: [] };
    },
    postAuthenticated: async (path, body) => {
      calls.push(["POST", path, body]);
      if (options.post) return options.post(path, body);
      return {};
    },
    patchAuthenticated: async (path, body) => {
      calls.push(["PATCH", path, body]);
      if (options.patch) return options.patch(path, body);
      return {};
    },
  };
  const facade = {
    get snapshot() {
      return session.snapshot;
    },
    restore: () => session.restore(),
    getAuthenticated: async (path) => {
      calls.push(["GET", path]);
      return options.get ? options.get(path) : session.getAuthenticated(path);
    },
    postAuthenticated: async (path, body) => {
      calls.push(["POST", path, body]);
      return options.post ? options.post(path, body) : session.postAuthenticated(path, body);
    },
    patchAuthenticated: async (path, body) => {
      calls.push(["PATCH", path, body]);
      return options.patch ? options.patch(path, body) : session.patchAuthenticated(path, body);
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
    navigateTo: ({ url }) => {
      routes.push(url);
      return Promise.resolve();
    },
    showModal: async () => ({ confirm: options.confirm ?? true }),
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
        if (name === "@tarojs/components")
          return { Button: "Button", Picker: "Picker", Text: "Text", View: "View" };
        if (name === "@tarojs/taro") return { __esModule: true, default: taro, ...taro };
        if (name.endsWith("runtime-session")) return { inviteSession: facade };
        if (name.endsWith("role-gate")) return roles;
        if (name.endsWith("child-monthly")) return client;
        if (name.endsWith(".css")) return {};
        throw Error(`Unexpected import: ${name}`);
      },
    },
    { filename: `${role}-child-monthly-page.js` },
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
  const click = async (label) => {
    render();
    const found = button(label);
    assert.ok(found, `button ${label} is visible`);
    assert.ok(!found.props.disabled, `button ${label} is enabled`);
    found.props.onClick();
    await settleChildMonthlyPage();
    render();
  };
  const choose = async (field, value) => {
    render();
    const picker = nodes().find(
      (node) => node.type === "Picker" && node.props["data-child-monthly-field"] === field,
    );
    assert.ok(picker, `picker ${field} is visible`);
    assert.ok(!picker.props.disabled, `picker ${field} is enabled`);
    picker.props.onChange({ detail: { value } });
    render();
    await settleChildMonthlyPage();
  };
  render();
  events.show();
  await settleChildMonthlyPage();
  render();
  return { session, calls, routes, events, render, nodes, text, button, click, choose, settle: settleChildMonthlyPage };
}
