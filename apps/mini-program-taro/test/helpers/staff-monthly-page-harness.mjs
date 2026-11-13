import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import { setImmediate } from "node:timers";
import { URL } from "node:url";
import vm from "node:vm";

const require = createRequire(new URL("../../package.json", import.meta.url));
const ts = require("typescript");
const pageUrl = new URL("../../src/pages/staff/monthly/index.tsx", import.meta.url);

export async function settleStaffMonthlyPage() {
  for (let index = 0; index < 8; index++) await new Promise((resolve) => setImmediate(resolve));
}

/** Runs the real page and client; only the Taro/React host and optional transport are substituted. */
export async function mountStaffMonthlyPage(options = {}) {
  assert.ok(fs.existsSync(pageUrl), "the staff monthly page must exist");
  const client = await import("../../src/monthly-feedback/staff-monthly.ts");
  const roles = await import("../../src/auth/role-gate.ts");
  let slots = [],
    cursor = 0,
    tree;
  const events = {},
    routes = [],
    calls = [];
  const session = options.session ?? {
    snapshot: {
      status: "READY",
      roles: options.roles ?? ["STAFF"],
      canReadMonthlyFeedback: options.canReadMonthlyFeedback ?? true,
    },
    async restore() {
      return options.restore ? options.restore(this) : this.snapshot;
    },
  };
  const transport =
    (method, name, fallback) =>
    async (...args) => {
      calls.push([method, ...args]);
      if (options[name]) return options[name](...args);
      if (typeof session[fallback] === "function") return session[fallback](...args);
      if (method === "GET") return { records: [], canCreate: true };
      throw Error(`Unexpected ${method} request`);
    };
  const facade = {
    get snapshot() {
      return session.snapshot;
    },
    restore: () => session.restore(),
    getAuthenticated: transport("GET", "get", "getAuthenticated"),
    postAuthenticated: transport("POST", "post", "postAuthenticated"),
    patchAuthenticated: transport("PATCH", "patch", "patchAuthenticated"),
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
        if (name === "@tarojs/components")
          return { Button: "Button", Picker: "Picker", Text: "Text", View: "View" };
        if (name === "@tarojs/taro") return { __esModule: true, default: taro, ...taro };
        if (name.endsWith("runtime-session")) return { inviteSession: facade };
        if (name.endsWith("role-gate")) return roles;
        if (name.endsWith("staff-monthly")) return client;
        if (name.endsWith(".css")) return {};
        throw Error(`Unexpected import: ${name}`);
      },
    },
    { filename: "staff-monthly-page.js" },
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
  const change = (field, value) => {
    render();
    const picker = nodes().find(
      (node) => node.type === "Picker" && node.props["data-monthly-field"] === field,
    );
    assert.ok(picker, `picker ${field} is visible`);
    assert.ok(!picker.props.disabled, `picker ${field} is enabled`);
    picker.props.onChange({ detail: { value } });
    render();
  };
  render();
  events.show();
  await settleStaffMonthlyPage();
  render();
  return {
    session,
    calls,
    routes,
    events,
    render,
    nodes,
    text,
    button,
    click,
    change,
    settle: settleStaffMonthlyPage,
  };
}
