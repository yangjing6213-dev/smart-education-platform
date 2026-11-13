import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { setImmediate } from "node:timers";
import { fileURLToPath, pathToFileURL } from "node:url";
import vm from "node:vm";

// Runs the real TSX, binding helpers and role gate. Only the React/Taro host,
// invited session and transport are replaced. No filesystem or network writes.
export async function mountParentBindingPage(options = {}) {
  const rootDir = path.resolve(
    options.rootDir ?? process.env.PARENT_BINDING_SOURCE_ROOT ?? fileURLToPath(new URL("../../../../", import.meta.url)),
  );
  const appDir = path.join(rootDir, "apps/mini-program-taro");
  const require = createRequire(path.join(appDir, "package.json"));
  const ts = require("typescript");
  const pagePath = path.join(appDir, "src/pages/parent/binding/index.tsx");
  const binding = await import(pathToFileURL(path.join(appDir, "src/binding/parent-binding.ts")));
  const roleGate = await import(pathToFileURL(path.join(appDir, "src/auth/role-gate.ts")));
  const calls = [];
  const routes = [];
  const slots = [];
  const events = {};
  let cursor = 0;
  let tree;
  let pendingEffects = [];
  let disposed = false;
  const session = options.session ?? {
    snapshot: { status: "READY", roles: ["PARENT"] },
    async restore() {
      return this.snapshot;
    },
  };
  const transport = (method, option, fallback) => async (...args) => {
    calls.push([method, ...args]);
    if (options[option]) return options[option](...args);
    if (typeof session[fallback] === "function") return session[fallback](...args);
    throw new Error(`Unexpected ${method} request: ${args[0]}`);
  };
  const facade = {
    get snapshot() {
      return session.snapshot;
    },
    restore: () => session.restore(),
    getAuthenticated: transport("GET", "get", "getAuthenticated"),
    postAuthenticated: transport("POST", "post", "postAuthenticated"),
  };
  const hooks = {
    useState(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = typeof initial === "function" ? initial() : initial;
      return [slots[index], (next) => {
        if (!disposed) slots[index] = typeof next === "function" ? next(slots[index]) : next;
      }];
    },
    useRef(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = { current: initial };
      return slots[index];
    },
    useEffect(effect, dependencies) {
      const index = cursor++;
      const prior = slots[index];
      const changed = !prior || dependencies === undefined ||
        dependencies.length !== prior.dependencies?.length ||
        dependencies.some((value, position) => !Object.is(value, prior.dependencies[position]));
      if (changed) {
        const current = { dependencies, cleanup: prior?.cleanup };
        slots[index] = current;
        pendingEffects.push(() => {
          current.cleanup?.();
          current.cleanup = effect();
        });
      }
    },
  };
  const taro = {
    redirectTo: async ({ url }) => { routes.push(url); },
    navigateTo: async ({ url }) => { routes.push(url); },
    navigateBack: async () => { routes.push("BACK"); },
    showModal: async () => ({ confirm: options.confirm ?? true }),
    useDidShow: (handler) => { events.show = handler; },
    useDidHide: (handler) => { events.hide = handler; },
    useUnload: (handler) => { events.unload = handler; },
  };
  const jsx = (type, props) => ({ type, props });
  const module = { exports: {} };
  const compiled = ts.transpileModule(fs.readFileSync(pagePath, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText;
  vm.runInNewContext(compiled, {
    exports: module.exports,
    module,
    require(name) {
      if (name === "react") return hooks;
      if (name === "react/jsx-runtime") return { jsx, jsxs: jsx, Fragment: "Fragment" };
      if (name === "@tarojs/components") {
        return Object.fromEntries(
          ["Button", "Checkbox", "CheckboxGroup", "Picker", "Text", "View"].map((name) => [name, name]),
        );
      }
      if (name === "@tarojs/taro") return { __esModule: true, default: taro, ...taro };
      if (name.endsWith("runtime-session")) return { inviteSession: facade };
      if (name.endsWith("role-gate")) return roleGate;
      if (name.endsWith("parent-binding")) return binding;
      if (name.endsWith(".css")) return {};
      throw new Error(`Unexpected page import: ${name}`);
    },
  }, { filename: pagePath });

  function render() {
    if (disposed) return tree;
    cursor = 0;
    tree = module.exports.default();
    const effects = pendingEffects;
    pendingEffects = [];
    for (const effect of effects) effect();
    return tree;
  }
  function walk(node) {
    if (Array.isArray(node)) return node.flatMap(walk);
    return node && typeof node === "object" ? [node, ...walk(node.props?.children)] : [];
  }
  function readText(node) {
    if (Array.isArray(node)) return node.map(readText).join("");
    if (node && typeof node === "object") return readText(node.props?.children);
    return typeof node === "string" || typeof node === "number" ? String(node) : "";
  }
  const nodes = () => walk(tree);
  const text = () => readText(tree);
  const button = (label) => nodes().find(
    (node) => node.type === "Button" && readText(node).trim() === label,
  );
  const byClass = (name) => nodes().filter(
    (node) => typeof node.props?.className === "string" &&
      node.props.className.split(/\s+/u).includes(name),
  );
  function click(label) {
    render();
    const found = button(label);
    assert.ok(found, `button ${label} is visible`);
    assert.ok(!found.props.disabled, `button ${label} is enabled`);
    found.props.onClick();
    render();
  }
  function consent(confirmed) {
    render();
    const control = nodes().find((node) => node.type === "CheckboxGroup");
    assert.ok(control, "guardian consent checkbox is visible");
    control.props.onChange({ detail: { value: confirmed ? ["guardian-consent"] : [] } });
    render();
  }
  function show() {
    render();
    events.show?.();
    render();
  }
  function hide() {
    events.hide?.();
  }
  function unmount() {
    if (disposed) return;
    events.unload?.();
    for (const slot of slots) slot?.cleanup?.();
    disposed = true;
  }
  async function settle() {
    for (let index = 0; index < 10; index++) {
      await new Promise((resolve) => setImmediate(resolve));
      render();
    }
  }
  render();
  show();
  await settle();
  return { rootDir, calls, routes, events, session, render, nodes, text, button, byClass,
    click, consent, show, hide, unmount, settle };
}
