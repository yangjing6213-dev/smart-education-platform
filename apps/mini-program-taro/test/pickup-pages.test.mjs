import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = async (path) => {
  try {
    return await readFile(new URL(path, import.meta.url), "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") return "";
    throw error;
  }
};

test("Taro registers pickup pages and both role entry points link to the flow", async () => {
  const [appConfig, parentHome, staffHome] = await Promise.all([
    read("../src/app.config.ts"),
    read("../src/pages/parent/home/index.tsx"),
    read("../src/pages/staff/workbench/index.tsx"),
  ]);
  assert.match(appConfig, /pages\/parent\/pickup\/index/u);
  assert.match(appConfig, /pages\/staff\/pickup\/index/u);
  assert.match(parentHome, /pages\/parent\/pickup\/index/u);
  assert.match(parentHome, /接送授权/u);
  assert.match(staffHome, /pages\/staff\/pickup\/index/u);
  assert.match(staffHome, /接送核验/u);
});

test("parent pickup page manages approved-child authorizations and displays an expiring QR in memory", async () => {
  const page = await read("../src/pages/parent/pickup/index.tsx");
  assert.match(page, /hasRoleAccess\(session, "PARENT"\)/u);
  assert.match(page, /loadParentPickup/u);
  assert.match(page, /createParentPickupAuthorization/u);
  assert.match(page, /activateParentPickupAuthorization/u);
  assert.match(page, /revokeParentPickupAuthorization/u);
  assert.match(page, /issueParentPickupCredential/u);
  assert.match(page, /<Canvas\b/u);
  assert.match(page, /expiresAt/u);
  assert.match(page, /Taro\.showModal/u);
  assert.doesNotMatch(
    page,
    /setStorageSync|setStorage\s*\(|credential=.*url|console\.(?:log|error)/u,
  );
});

test("staff pickup page scans or accepts a credential, previews minimal labels and blocks incomplete confirmation", async () => {
  const page = await read("../src/pages/staff/pickup/index.tsx");
  assert.match(page, /hasRoleAccess\(session, "STAFF"\)/u);
  assert.match(page, /Taro\.scanCode/u);
  assert.match(page, /previewStaffPickupCredential/u);
  assert.match(page, /studentLabel/u);
  assert.match(page, /classLabel/u);
  assert.match(page, /recipientLabel/u);
  assert.match(page, /confirmStaffPickupCredential/u);
  assert.match(
    page,
    /const allChecksComplete = checks\.student\s*&&\s*checks\.recipient\s*&&\s*checks\.authorization/u,
  );
  assert.match(page, /核对学生本人/u);
  assert.match(page, /核对接送人/u);
  assert.match(page, /确认有效授权/u);
  assert.doesNotMatch(
    page,
    /setStorageSync|setStorage\s*\(|credential=.*url|console\.(?:log|error)/u,
  );
});

import { createRequire } from "node:module";
import { setImmediate } from "node:timers";
import vm from "node:vm";
import { InviteSession } from "../src/auth/invite-session.ts";
import * as roles from "../src/auth/role-gate.ts";
import * as pickup from "../src/pickup/parent-pickup.ts";
import * as qr from "../src/pickup/credential-qr.ts";
const ts = createRequire(import.meta.url)("typescript");
function compilePage(source) {
  return ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText;
}
const compiledPage = compilePage(await read("../src/pages/parent/pickup/index.tsx"));
const staffPage = compilePage(await read("../src/pages/staff/pickup/index.tsx"));
const settle = () => new Promise((resolve) => setImmediate(resolve));
const uuid = (n) => "00000000-0000-4000-8000-" + String(n).padStart(12, "0");
const credential = () => ({
  credential: "S".repeat(43),
  expiresAt: new Date(Date.now() + 120000).toISOString(),
});
function projection(account, status) {
  const n = account === "A" ? 100 : 200;
  const binding = {
    id: uuid(n),
    version: 1,
    studentId: uuid(n + 1),
    studentLabel: "合成接送孩子" + account,
    classLabel: "合成班级",
    status: "APPROVED",
  };
  return {
    bindings: [binding],
    records: [],
    authorizations: [
      {
        id: uuid(n + 2),
        version: 3,
        bindingId: binding.id,
        studentId: binding.studentId,
        studentLabel: binding.studentLabel,
        classLabel: binding.classLabel,
        status,
        currentlyValid: status === "ACTIVE",
        recipient: "pickup-alpha",
        recipientLabel: "示例接送人甲",
        type: "TEMPORARY",
        startDate: "2026-11-01",
        endDate: "2026-11-01",
        startTime: "15:00",
        endTime: "19:00",
      },
    ],
  };
}

// Execute the real page, session, role gate, pickup client and QR encoder with an in-memory UI host.
function mountPickup({
  holdFirstIdentity = false,
  staff = false,
  role = staff ? "STAFF" : "PARENT",
} = {}) {
  const slots = [],
    effects = [],
    events = {},
    identities = [],
    redirects = [],
    reads = [],
    writes = [],
    modals = [],
    scans = [],
    timers = new Map();
  const tokenFor = (c) => ({
    accessToken: c.repeat(48),
    expiresAt: new Date(Date.now() + 3600000).toISOString(),
  });
  let stored = tokenFor("A"),
    cursor,
    tree,
    draws = 0,
    nextTimer = 0;
  const session = new InviteSession({
    baseUrl: "http://127.0.0.1:4317",
    allowLocalHttp: true,
    sessionStore: {
      load: () => stored,
      save: (v) => {
        stored = v;
      },
      clear: () => {
        stored = null;
      },
    },
    request: async (url, options) => {
      const account = options.headers.Authorization.endsWith("A") ? "A" : "B",
        path = new URL(url).pathname;
      if (path === "/me") {
        const pending = Promise.withResolvers();
        identities.push({ account, reply: pending.resolve });
        const statusCode =
          holdFirstIdentity && identities.length === 1 ? await pending.promise : 200;
        return {
          statusCode,
          data: {
            data: {
              actor_id: uuid(account === "A" ? 301 : 302),
              display_name: "同名合成家长",
              memberships: [
                { status: "ACTIVE", capabilities: [role === "STAFF" ? "daily:read" : "care:read"] },
              ],
            },
          },
        };
      }
      const queued = Promise.withResolvers();
      (options.method === "GET" ? reads : writes).push({
        account,
        path,
        body: options.data,
        reply: (value, statusCode = 200) => queued.resolve({ statusCode, data: { data: value } }),
      });
      return queued.promise;
    },
  });
  const hooks = {
    useState(value) {
      const i = cursor++;
      if (!(i in slots)) slots[i] = typeof value === "function" ? value() : value;
      return [
        slots[i],
        (next) => {
          slots[i] = typeof next === "function" ? next(slots[i]) : next;
        },
      ];
    },
    useRef(value) {
      return (slots[cursor++] ??= { current: value });
    },
    useEffect(effect, deps) {
      const i = cursor++,
        old = slots[i];
      if (!old || deps.some((v, n) => !Object.is(v, old.deps[n]))) {
        slots[i] = { deps };
        effects.push(() => {
          old?.cleanup?.();
          slots[i].cleanup = effect();
        });
      }
    },
  };
  const taro = {
    useDidHide: (fn) => {
      events.hide = fn;
    },
    useDidShow: (fn) => {
      events.show = fn;
    },
    useUnload: (fn) => {
      events.unload = fn;
    },
    redirectTo: ({ url }) => redirects.push(url),
    navigateBack: () => redirects.push("back"),
    scanCode: () => {
      const scan = Promise.withResolvers();
      scans.push(scan);
      return scan.promise;
    },
    showModal: () => {
      const modal = Promise.withResolvers();
      modals.push(modal);
      return modal.promise;
    },
    createCanvasContext: () => ({
      setFillStyle() {},
      fillRect() {},
      draw() {
        draws++;
      },
    }),
  };
  const jsx = (type, props) => ({ type, props });
  const modules = {
    react: hooks,
    "react/jsx-runtime": { jsx, jsxs: jsx, Fragment: "Fragment" },
    "@tarojs/components": Object.fromEntries(
      ["Button", "Canvas", "Picker", "Text", "View", "Input", "Checkbox", "CheckboxGroup"].map(
        (type) => [type, type],
      ),
    ),
    "@tarojs/taro": taro,
    "../../../auth/runtime-session": { inviteSession: session },
    "../../../auth/role-gate": roles,
    "../../../pickup/parent-pickup": pickup,
    "../../../pickup/credential-qr": qr,
    "./index.css": {},
  };
  const module = { exports: {} };
  vm.runInNewContext(staff ? staffPage : compiledPage, {
    module,
    exports: module.exports,
    require: (name) => {
      assert.ok(Object.hasOwn(modules, name), name);
      return modules[name];
    },
    setTimeout(fn) {
      const key = ++nextTimer;
      timers.set(key, fn);
      return key;
    },
    clearTimeout(key) {
      timers.delete(key);
    },
  });
  function render() {
    cursor = 0;
    tree = module.exports.default();
    for (const fn of effects.splice(0)) fn();
  }
  function nodes(n) {
    if (!n || typeof n !== "object") return [];
    if (Array.isArray(n)) return n.flatMap(nodes);
    return [n, ...nodes(n.props.children)];
  }
  function text(n) {
    if (n == null) return "";
    if (typeof n !== "object") return String(n);
    if (Array.isArray(n)) return n.map(text).join("");
    return text(n.props.children);
  }
  function button(label) {
    return nodes(tree).find((n) => n.type === "Button" && text(n) === label);
  }
  render();
  events.show?.();
  return {
    identities,
    redirects,
    reads,
    writes,
    modals,
    scans,
    control: (type) => nodes(tree).find((n) => n.type === type),
    async flush() {
      await settle();
      render();
    },
    timers,
    events,
    render,
    text: () => text(tree),
    draws: () => draws,
    canvas: () => nodes(tree).some((n) => n.type === "Canvas"),
    button,
    click(label) {
      const node = button(label);
      assert.ok(node && !node.props.disabled, label);
      node.props.onClick();
    },
    setStoredAccount(account) {
      stored = tokenFor(account);
    },
    async switchAccount() {
      stored = tokenFor("B");
      await session.restore();
      assert.equal(session.snapshot.status, "READY");
    },
    async finishRead(account = "A", status = "ACTIVE") {
      await settle();
      reads.at(-1).reply(projection(account, status));
      await settle();
      render();
    },
  };
}

test("a late pickup read cannot put one parent's child on another same-named parent's page", async () => {
  const p = mountPickup();
  await settle();
  assert.equal(p.reads[0].account, "A");
  await p.switchAccount();
  await p.finishRead();
  assert.doesNotMatch(p.text(), /合成接送孩子A/u);
});
test("show waits for an obsolete identity check and verifies the newly stored account before reading", async () => {
  const p = mountPickup({ holdFirstIdentity: true });
  await settle();
  assert.deepEqual(
    p.identities.map((i) => i.account),
    ["A"],
  );
  p.events.hide();
  p.render();
  p.setStoredAccount("B");
  p.events.show();
  await settle();
  assert.equal(p.identities.length, 1);
  p.identities[0].reply(200);
  await settle();
  assert.deepEqual(
    p.identities.map((i) => i.account),
    ["A", "B"],
  );
  assert.deepEqual(
    p.reads.map((r) => r.account),
    ["B"],
  );
  await p.finishRead("B");
  assert.match(p.text(), /合成接送孩子B/u);
  assert.equal(p.redirects.length, 0);
});
test("a late business 401 from the previous parent cannot require the new parent to log in", async () => {
  const p = mountPickup();
  await settle();
  assert.equal(p.reads[0].account, "A");
  await p.switchAccount();
  p.reads[0].reply({}, 401);
  await settle();
  p.render();
  assert.equal(p.button("重新登录"), undefined);
  assert.doesNotMatch(p.text(), /登录已过期|合成接送孩子A/u);
  assert.equal(p.redirects.length, 0);
  p.click("刷新");
  await p.finishRead("B");
  assert.match(p.text(), /合成接送孩子B/u);
});
test("a late credential cannot draw the previous parent's QR after identity changes", async () => {
  const p = mountPickup();
  await p.finishRead();
  p.click("生成接送二维码");
  assert.equal(p.writes[0].account, "A");
  await p.switchAccount();
  p.writes[0].reply(credential());
  await settle();
  p.render();
  assert.equal(p.canvas(), false);
  assert.equal(p.draws(), 0);
  assert.doesNotMatch(p.text(), /合成接送孩子A/u);
});
for (const [label, status] of [
  ["撤销授权", "ACTIVE"],
  ["启用授权", "DRAFT"],
]) {
  test(label + " cannot be sent under a new identity after an older confirmation", async () => {
    const p = mountPickup();
    await p.finishRead("A", status);
    p.click(label);
    await p.switchAccount();
    p.modals[0].resolve({ confirm: true });
    await settle();
    p.render();
    assert.equal(p.writes.length, 0);
    assert.doesNotMatch(p.text(), /合成接送孩子A/u);
  });
}
test("hide clears an issued QR, reentry loads the new parent, and unload discards a late read", async () => {
  const p = mountPickup();
  await p.finishRead();
  const old = p.button("生成接送二维码");
  old.props.onClick();
  old.props.onClick();
  assert.equal(p.writes.length, 1);
  assert.equal(p.writes[0].path, "/parent/pickup/authorizations/" + uuid(102) + "/credential");
  assert.equal(p.writes[0].body.version, 3);
  p.writes[0].reply(credential());
  await settle();
  p.render();
  assert.ok(p.canvas());
  assert.equal(p.draws(), 1);
  assert.equal(p.timers.size, 1);
  p.events.hide?.();
  p.render();
  assert.equal(p.canvas(), false);
  assert.equal(p.timers.size, 0);
  await p.switchAccount();
  p.events.show();
  await p.finishRead("B");
  assert.match(p.text(), /合成接送孩子B/u);
  old.props.onClick();
  assert.equal(p.writes.length, 1);
  p.click("刷新");
  await settle();
  p.events.unload();
  p.reads.at(-1).reply(projection("B", "ACTIVE"));
  await settle();
  p.render();
  assert.doesNotMatch(p.text(), /合成接送孩子[AB]/u);
});
test("expiry clears the QR and a denied refresh cannot leave the previous code active", async () => {
  const p = mountPickup();
  await p.finishRead();
  p.click("生成接送二维码");
  p.writes[0].reply(credential());
  await settle();
  p.render();
  assert.ok(p.canvas());
  [...p.timers.values()][0]();
  p.render();
  assert.equal(p.canvas(), false);
  p.click("生成接送二维码");
  p.writes[1].reply(credential());
  await settle();
  p.render();
  assert.ok(p.canvas());
  p.click("刷新");
  await settle();
  p.reads.at(-1).reply({}, 403);
  await settle();
  p.render();
  assert.equal(p.canvas(), false);
  assert.equal(p.timers.size, 0);
  assert.doesNotMatch(p.text(), /合成接送孩子A/u);
});

test("current parent creates, enables and revokes a draft through the page, with one write per confirmation", async () => {
  const p = mountPickup();
  await p.finishRead("A", "DRAFT");
  p.click("保存接送安排");
  assert.equal(p.writes[0].path, "/parent/pickup/authorizations");
  assert.equal(p.writes[0].body.bindingId, uuid(100));
  p.writes[0].reply(projection("A", "DRAFT").authorizations[0]);
  await p.finishRead("A", "DRAFT");
  for (const [button, action, next] of [
    ["启用授权", "activate", "ACTIVE"],
    ["撤销授权", "revoke", "REVOKED"],
  ]) {
    const previous = p.writes.length;
    p.click(button);
    p.modals.at(-1).resolve({ confirm: true });
    await settle();
    assert.equal(p.writes.length, previous + 1);
    const write = p.writes.at(-1);
    assert.equal(write.account, "A");
    assert.equal(write.path, "/parent/pickup/authorizations/" + uuid(102) + "/" + action);
    assert.equal(write.body.version, 3);
    write.reply(projection("A", next).authorizations[0]);
    await p.finishRead("A", next);
  }
  assert.match(p.text(), /已撤销/u);
});
test("a signed-out pickup read offers login, and no fee or QR data survives", async () => {
  const p = mountPickup();
  await p.finishRead();
  p.click("刷新");
  await settle();
  p.reads.at(-1).reply({}, 401);
  await settle();
  p.render();
  assert.ok(p.button("重新登录"));
  assert.equal(p.canvas(), false);
  assert.doesNotMatch(p.text(), /合成接送孩子A/u);
});

const staffLabels = (child) => ({
  studentLabel: "合成学生" + child,
  classLabel: "合成班级",
  recipientLabel: "合成接送人" + child,
});
const syntheticCode = (n) => n.repeat(43);
const checkLabels = {
  student: "核对学生本人",
  recipient: "核对接送人",
  authorization: "确认有效授权",
};
const allChecked = Object.keys(checkLabels);
async function staffReady(options) {
  const p = mountPickup({ staff: true, ...options });
  await p.flush();
  return p;
}
function enterCode(p, code) {
  p.control("Input").props.onInput({ detail: { value: code } });
  p.render();
}
function checkRow(p, key, checked) {
  const label = checkLabels[key];
  const state = checked ? "已核对" : "待核对";
  const row = p.button(label + state);
  assert.ok(row, label + "应整行可点击且显示" + state);
  assert.equal(row.props.ariaRole, "checkbox");
  assert.ok(row.props.ariaLabel.includes(label));
  assert.equal(row.props.ariaChecked, checked);
  return row;
}
function check(p, values = allChecked) {
  for (const key of allChecked) {
    const checked = !!p.button(checkLabels[key] + "已核对");
    const row = checkRow(p, key, checked);
    if (checked !== values.includes(key)) row.props.onClick();
  }
  p.render();
}
async function preview(p, child = "甲", code = syntheticCode("X")) {
  enterCode(p, code);
  p.click("查询接送信息");
  p.writes.at(-1).reply(staffLabels(child));
  await p.flush();
}

test("staff credential input retains the last native edit before a render", async () => {
  const p = await staffReady();
  const input = p.control("Input");
  for (const letter of ["X", "Y"]) {
    input.props.onInput({ detail: { value: syntheticCode(letter) } });
  }
  p.render();
  p.click("查询接送信息");
  assert.equal(p.writes.length, 1);
  assert.ok(p.writes[0].body.credential === syntheticCode("Y"));
});

test("unchecking a required item before the next render prevents staff confirmation", async () => {
  const p = await staffReady();
  await preview(p);
  const [student, recipient, authorization] = allChecked.map((key) => checkRow(p, key, false));
  for (const row of [student, recipient, authorization, recipient]) row.props.onClick();
  p.render();
  checkRow(p, "student", true);
  checkRow(p, "recipient", false);
  checkRow(p, "authorization", true);
  const button = p.button("确认离校");
  if (!button.props.disabled) button.props.onClick();
  await p.flush();
  assert.equal(p.modals.length, 0);
  assert.equal(p.writes.length, 1);
});

test("taps from an old staff preview cannot check a new entry or a replaced employee's form", async () => {
  const p = await staffReady();
  await preview(p);
  const oldRows = allChecked.map((key) => checkRow(p, key, false));
  p.click("取消并重新扫码");
  p.render();
  await preview(p, "乙", syntheticCode("Y"));
  for (const row of oldRows) row.props.onClick();
  p.render();
  for (const key of allChecked) checkRow(p, key, false);
  assert.match(p.text(), /合成学生乙/u);
  const currentRow = checkRow(p, "student", false);
  await p.switchAccount();
  currentRow.props.onClick();
  p.render();
  assert.doesNotMatch(p.text(), /合成学生乙|已核对/u);
  assert.ok(p.button("重新确认账号"));
  assert.equal(p.modals.length, 0);
  assert.equal(p.writes.length, 2);
});

test("staff scans and previews without checking out, then explicitly checks three items before one confirmation", async () => {
  const p = await staffReady();
  p.click("扫描接送二维码");
  p.scans[0].resolve({ result: syntheticCode("X") });
  await p.flush();
  assert.equal(p.writes.length, 0);
  p.click("查询接送信息");
  assert.match(p.writes[0].path, /\/preview$/u);
  p.writes[0].reply(staffLabels("甲"));
  await p.flush();
  assert.match(p.text(), /合成学生甲/u);
  check(p, ["student", "recipient"]);
  const confirm = p.button("确认离校");
  if (!confirm.props.disabled) confirm.props.onClick();
  await p.flush();
  assert.equal(p.modals.length, 0);
  assert.equal(p.writes.length, 1);
  check(p);
  p.click("确认离校");
  p.modals[0].resolve({ confirm: false });
  await p.flush();
  assert.equal(p.writes.length, 1);
  assert.match(p.text(), /合成学生甲/u);
  const checked = p.button("确认离校");
  checked.props.onClick();
  checked.props.onClick();
  await p.flush();
  assert.equal(p.modals.length, 2, "one confirmation dialog per action");
  p.modals[1].resolve({ confirm: true });
  await p.flush();
  assert.equal(p.writes.length, 2);
  assert.match(p.writes[1].path, /\/confirm$/u);
  assert.equal(p.writes[1].body.credential === syntheticCode("X"), true);
  assert.deepEqual(Object.values(p.writes[1].body.checks), [true, true, true]);
  p.writes[1].reply({ id: uuid(408), status: "COMPLETED" });
  await p.flush();
  checked.props.onClick();
  await p.flush();
  assert.equal(p.modals.length, 2);
  assert.equal(p.writes.length, 2);
  assert.match(p.text(), /离校状态已更新/u);
  assert.doesNotMatch(p.text(), /合成学生甲|合成接送人甲/u);
});

test("a staff preview is bound to the entered credential, not a later edit or older response", async () => {
  const p = await staffReady();
  enterCode(p, syntheticCode("X"));
  p.click("查询接送信息");
  enterCode(p, syntheticCode("Y"));
  p.click("查询接送信息");
  assert.equal(p.writes[1].body.credential === syntheticCode("Y"), true);
  p.writes[1].reply(staffLabels("乙"));
  await p.flush();
  p.writes[0].reply(staffLabels("甲"));
  await p.flush();
  assert.doesNotMatch(p.text(), /合成学生甲|合成接送人甲/u);
  assert.match(p.text(), /合成学生乙/u);
  check(p);
  p.click("确认离校");
  p.modals.at(-1).resolve({ confirm: true });
  await p.flush();
  assert.equal(p.writes.at(-1).body.credential === syntheticCode("Y"), true);
});

test("old staff modals cannot complete a handoff after reauthentication, hiding, unloading or returning", async () => {
  for (const exit of ["switch", "hide", "unload", "back"]) {
    const p = await staffReady();
    await preview(p);
    check(p);
    p.click("确认离校");
    if (exit === "switch") await p.switchAccount();
    else if (exit === "back") p.click("‹ 返回员工工作台");
    else p.events[exit]?.();
    p.render();
    p.modals[0].resolve({ confirm: true });
    await p.flush();
    assert.equal(p.writes.length, 1, exit);
    assert.doesNotMatch(p.text(), /合成学生甲|合成接送人甲/u);
    if (exit === "switch" || exit === "hide") {
      if (exit === "switch") p.click("重新确认账号");
      else {
        await p.switchAccount();
        p.events.show();
      }
      await p.flush();
      await preview(p, "乙", syntheticCode("Y"));
      assert.equal(p.writes.at(-1).account, "B");
      assert.match(p.text(), /合成学生乙/u);
    }
  }
});

test("a cancelled or late camera cannot apply a credential to a replacement staff account", async () => {
  const p = await staffReady();
  const scan = p.button("扫描接送二维码");
  scan.props.onClick();
  scan.props.onClick();
  await p.flush();
  assert.equal(p.scans.length, 1);
  p.scans[0].reject(Error("cancel"));
  await p.flush();
  assert.equal(p.writes.length, 0);
  p.click("扫描接送二维码");
  await p.switchAccount();
  p.scans[1].resolve({ result: syntheticCode("X") });
  await p.flush();
  assert.equal(p.writes.length, 0);
  assert.equal(!!p.control("Input")?.props.value, false);
  assert.ok(!p.button("查询接送信息") || p.button("查询接送信息").props.disabled);
  const fresh = await staffReady({ role: "PARENT" });
  assert.equal(fresh.writes.length, 0);
  assert.ok(!fresh.button("扫描接送二维码") || fresh.button("扫描接送二维码").props.disabled);
});

test("denied or stale handoffs clear labels and require fresh checks without replay", async () => {
  for (const code of [401, 403, 404, 409, 503]) {
    const p = await staffReady();
    await preview(p);
    check(p);
    p.click("确认离校");
    p.modals[0].resolve({ confirm: true });
    await p.flush();
    p.writes[1].reply({}, code);
    await p.flush();
    assert.doesNotMatch(p.text(), /合成学生甲|合成接送人甲|离校状态已更新/u);
    assert.equal(p.button("确认离校"), undefined);
    assert.equal(p.writes.length, 2);
    if (code === 401) {
      p.click("重新登录");
      assert.deepEqual(p.redirects, ["/pages/auth/login/index"]);
    } else assert.equal(p.button("重新登录"), undefined);
  }
});

test("a hidden staff lookup, scan or completion cannot replace a later employee's preview", async () => {
  for (const action of ["preview", "scan", "confirm"]) {
    for (const code of action === "scan" ? [200] : [200, 401, 403]) {
      const p = await staffReady();
      if (action === "scan") p.click("扫描接送二维码");
      else if (action === "preview") {
        enterCode(p, syntheticCode("X"));
        p.click("查询接送信息");
      } else {
        await preview(p);
        check(p);
        p.click("确认离校");
        p.modals[0].resolve({ confirm: true });
        await p.flush();
      }
      const old = p.writes.at(-1);
      p.events.hide();
      await p.switchAccount();
      p.events.show();
      await p.flush();
      await preview(p, "乙", syntheticCode("Y"));
      if (action === "scan") p.scans[0].resolve({ result: syntheticCode("X") });
      else
        old.reply(
          action === "preview" ? staffLabels("甲") : { id: uuid(411), status: "COMPLETED" },
          code,
        );
      await p.flush();
      assert.match(p.text(), /合成学生乙/u);
      assert.doesNotMatch(p.text(), /合成学生甲|已过期|离校状态已更新/u);
      assert.equal(p.button("重新登录"), undefined);
    }
  }
});
