import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import vm from "node:vm";
import test from "node:test";
import { URL } from "node:url";
import { InviteSession } from "../src/auth/invite-session.ts";
import * as roles from "../src/auth/role-gate.ts";
import * as health from "../src/health/health-incidents.ts";

const read = async (path) => {
  try {
    return await readFile(new URL(path, import.meta.url), "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") return "";
    throw error;
  }
};

test("Taro registers health report and parent notices from their role homes", async () => {
  const [appConfig, workbench, parentHome] = await Promise.all([
    read("../src/app.config.ts"),
    read("../src/pages/staff/workbench/index.tsx"),
    read("../src/pages/parent/home/index.tsx"),
  ]);

  assert.match(appConfig, /pages\/staff\/health-report\/index/u);
  assert.match(appConfig, /pages\/parent\/health-notices\/index/u);
  assert.match(workbench, /pages\/staff\/health-report\/index/u);
  assert.match(workbench, /健康事项上报/u);
  assert.match(parentHome, /pages\/parent\/health-notices\/index/u);
  assert.match(parentHome, /健康消息/u);
});

const ts = createRequire(import.meta.url)("typescript");
const compiled = ts.transpileModule(await read("../src/pages/parent/health-notices/index.tsx"), {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    jsx: ts.JsxEmit.ReactJSX,
    target: ts.ScriptTarget.ES2022,
    esModuleInterop: true,
  },
}).outputText;
const staffPageCompiled = ts.transpileModule(
  await read("../src/pages/staff/health-report/index.tsx"),
  {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  },
).outputText;
const tick = () => new Promise((resolve) => setImmediate(resolve));
const noticeId = "00000000-0000-4000-8000-000000000410";
const healthNotice = (account = "A", receiptStatus = "READ", version = 3) => ({
  id: noticeId,
  version,
  receiptStatus,
  status: "PUBLISHED",
  studentLabel: "student-" + account,
  parentSummary: "summary-" + account,
  updatedAt: "2026-10-31T12:00:00Z",
  synthetic: true,
});

// Exercise the real page, permission checks, invite session and health client with an in-memory transport.
async function mountHealth({ role = "PARENT", pauseIdentity = false } = {}) {
  const slots = [],
    events = {},
    effects = [],
    calls = [],
    identities = [],
    routes = [];
  const token = (account) => ({
    accessToken: account.repeat(48),
    expiresAt: new Date(Date.now() + 3600000).toISOString(),
  });
  let stored = token("a"),
    cursor = 0,
    tree;
  const session = new InviteSession({
    baseUrl: "http://127.0.0.1:4317",
    allowLocalHttp: true,
    sessionStore: {
      load: () => stored,
      save: (next) => {
        stored = next;
      },
      clear: () => {
        stored = null;
      },
    },
    request: async (url, options) => {
      const path = new URL(url).pathname,
        account = options.headers.Authorization.endsWith("a") ? "A" : "B";
      if (path === "/me") {
        if (pauseIdentity) await new Promise((resolve) => identities.push(resolve));
        return {
          statusCode: 200,
          data: {
            data: {
              actor_id: "00000000-0000-4000-8000-00000000030" + (account === "A" ? "1" : "2"),
              display_name: "同名合成账号",
              memberships: [
                {
                  status: "ACTIVE",
                  capabilities: [role === "PARENT" ? "care:read" : "daily:read"],
                },
              ],
            },
          },
        };
      }
      assert.match(path, /^\/parent\/health-incidents(?:\/|$)/u);
      return new Promise((resolve) =>
        calls.push({
          method: options.method,
          path,
          body: options.data,
          account,
          respond: (statusCode, data) => resolve({ statusCode, data: { data } }),
        }),
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
      if (name === "@tarojs/taro") return { __esModule: true, default: taro, ...taro };
      if (name === "@tarojs/components") return { Button: "Button", View: "View", Text: "Text" };
      if (name.endsWith("/runtime-session")) return { inviteSession: session };
      if (name.endsWith("/role-gate")) return roles;
      if (name.endsWith("/health-incidents")) return health;
      if (name.endsWith(".css")) return {};
      throw Error("Unexpected import " + name);
    },
  });
  const render = () => {
    cursor = 0;
    tree = exports.default();
  };
  const text = (node) =>
    Array.isArray(node)
      ? node.map(text).join("")
      : node?.props
        ? text(node.props.children)
        : typeof node === "string"
          ? node
          : "";
  const nodes = (node) =>
    Array.isArray(node)
      ? node.flatMap(nodes)
      : node?.props
        ? [node, ...nodes(node.props.children)]
        : [];
  const button = (label) => nodes(tree).find((n) => n.type === "Button" && text(n) === label);
  const flush = async () => {
    await tick();
    render();
  };
  const event = async (name) => {
    events[name]?.();
    await flush();
  };
  render();
  for (const effect of effects) effect();
  await event("show");
  return {
    session,
    calls,
    identities,
    routes,
    event,
    button,
    text: () => text(tree),
    flush,
    click: async (label) => {
      const node = button(label);
      assert.ok(node && !node.props.disabled, label);
      node.props.onClick();
      await flush();
    },
    respond: async (index, code, data) => {
      assert.ok(calls[index], "expected request " + index);
      calls[index].respond(code, data);
      await flush();
    },
    switchParent: async () => {
      stored = token("b");
      await session.restore();
      render();
    },
    changeStoredParent: () => {
      stored = token("b");
    },
  };
}

const staffStudent = {
  id: "00000000-0000-4000-8000-000000000401",
  studentLabel: "合成学生甲",
};
const staffDraft = {
  id: "00000000-0000-4000-8000-000000000420",
  version: 5,
  status: "DRAFT",
  statusLabel: "草稿",
  studentId: staffStudent.id,
  observationCode: "NEEDS_FOLLOW_UP",
  dispositionCode: "FOLLOW_UP_SCHEDULED",
  synthetic: true,
};

async function mountStaffHealthReport() {
  const slots = [],
    effects = [],
    requests = [];
  let cursor = 0,
    tree;
  const session = {
    restore: async () => ({
      status: "READY",
      displayName: "合成员工甲",
      roles: ["STAFF"],
      canWriteCareRecords: false,
      canReadMonthlyFeedback: false,
      message: "",
    }),
    getAuthenticated: async (path) => {
      requests.push({ method: "GET", path });
      if (path === "/staff/health-incidents/students") return [staffStudent];
      if (path === "/staff/health-incidents/drafts") return [staffDraft];
      throw new Error("Unexpected synthetic staff GET " + path);
    },
    postAuthenticated: (path, body) =>
      new Promise((resolve) => requests.push({ method: "POST", path, body, respond: resolve })),
  };
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
  const taro = { redirectTo: () => Promise.resolve() };
  const jsx = (type, props) => ({ type, props });
  const exports = {};
  vm.runInNewContext(staffPageCompiled, {
    exports,
    module: { exports },
    require(name) {
      if (name === "react") return hooks;
      if (name === "react/jsx-runtime") return { jsx, jsxs: jsx, Fragment: "Fragment" };
      if (name === "@tarojs/taro") return { __esModule: true, default: taro, ...taro };
      if (name === "@tarojs/components")
        return { Button: "Button", Picker: "Picker", Text: "Text", View: "View" };
      if (name.endsWith("/runtime-session")) return { inviteSession: session };
      if (name.endsWith("/role-gate")) return roles;
      if (name.endsWith("/health-incidents")) return health;
      if (name.endsWith(".css")) return {};
      throw Error("Unexpected staff page import " + name);
    },
  });
  const render = () => {
    cursor = 0;
    tree = exports.default();
  };
  const text = (node) =>
    Array.isArray(node)
      ? node.map(text).join("")
      : node?.props
        ? text(node.props.children)
        : typeof node === "string"
          ? node
          : "";
  const nodes = (node) =>
    Array.isArray(node)
      ? node.flatMap(nodes)
      : node?.props
        ? [node, ...nodes(node.props.children)]
        : [];
  const flush = async () => {
    await tick();
    await tick();
    render();
  };
  render();
  for (const effect of effects) effect();
  await flush();
  await flush();
  return {
    requests,
    button: (label) => nodes(tree).find((node) => node.type === "Button" && text(node) === label),
    draftPicker: () =>
      nodes(tree).find(
        (node) =>
          node.type === "Picker" &&
          Array.isArray(node.props.range) &&
          node.props.range[0] === "选择草稿或新建记录",
      ),
    text: () => text(tree),
    flush,
    render,
  };
}

test("health summaries and receipt actions disappear when a pending read changes parents", async () => {
  for (const code of [200, 401]) {
    const page = await mountHealth();
    await page.switchParent();
    await page.respond(0, code, [healthNotice()]);
    assert.doesNotMatch(page.text(), /student-A|summary-A|登录状态已过期/u);
    assert.equal(page.button("确认知悉"), undefined);
    assert.equal(page.session.snapshot.status, "READY");
    await page.click("刷新消息");
    assert.equal(page.calls[1].account, "B");
    await page.respond(1, 200, [healthNotice("B")]);
    assert.match(page.text(), /summary-B/u);
  }
});

test("a new visit rechecks the selected parent after an older identity check", async () => {
  const page = await mountHealth({ pauseIdentity: true });
  await page.event("hide");
  page.changeStoredParent();
  await page.event("show");
  page.identities[0]();
  await page.flush();
  assert.equal(page.calls.length, 0);
  assert.equal(page.identities.length, 2);
  page.identities[1]();
  await page.flush();
  assert.equal(page.calls[0].account, "B");
});

test("a late list success or error cannot replace the next visit's newly loaded list", async () => {
  for (const code of [200, 401]) {
    const page = await mountHealth();
    await page.event("hide");
    await page.switchParent();
    await page.event("show");
    await page.respond(1, 200, [healthNotice("B")]);
    await page.respond(0, code, [healthNotice()]);
    assert.match(page.text(), /student-B|summary-B/u);
    assert.doesNotMatch(page.text(), /student-A|summary-A/u);
    assert.equal(page.session.snapshot.status, "READY");
    assert.ok(page.button("确认知悉"));
    await page.event("hide");
    assert.doesNotMatch(page.text(), /student-B|summary-B/u);
    assert.equal(page.button("确认知悉"), undefined);
  }
});

test("an old confirmation or delayed receipt cannot affect the newly visible parent's summary", async () => {
  for (const code of [200, 401, 403]) {
    const page = await mountHealth();
    await page.respond(0, 200, [healthNotice()]);
    const oldButton = page.button("确认知悉");
    oldButton.props.onClick();
    oldButton.props.onClick();
    await page.flush();
    assert.equal(page.calls.filter((c) => c.method === "POST").length, 1);
    await page.event("hide");
    assert.doesNotMatch(page.text(), /summary-A|student-A/u);
    await page.switchParent();
    await page.event("show");
    assert.equal(page.calls[2].account, "B");
    await page.respond(2, 200, [healthNotice("B")]);
    await page.respond(1, code, healthNotice("A", "ACKNOWLEDGED"));
    oldButton.props.onClick();
    await page.flush();
    assert.equal(page.calls.length, 3);
    assert.match(page.text(), /summary-B/u);
    assert.doesNotMatch(page.text(), /summary-A|student-A|登录状态已过期|权限|已确认知悉/u);
    assert.ok(page.button("确认知悉"));
    assert.deepEqual(page.routes, []);
  }
  const page = await mountHealth();
  await page.respond(0, 200, [healthNotice()]);
  const old = page.button("确认知悉");
  await page.switchParent();
  old.props.onClick();
  await page.flush();
  assert.equal(page.calls.filter((c) => c.method === "POST").length, 0);
  assert.doesNotMatch(page.text(), /summary-A|student-A/u);
});

test("losing read or receipt access removes all summaries and actions; only 401 leads to login", async () => {
  for (const action of ["刷新消息", "确认知悉"]) {
    for (const code of [401, 403, 503]) {
      const page = await mountHealth();
      await page.respond(0, 200, [healthNotice()]);
      await page.click(action);
      await page.respond(1, code);
      assert.doesNotMatch(page.text(), /summary-A|student-A/u);
      assert.equal(page.button("确认知悉"), undefined);
      if (code === 401) {
        await page.click("重新登录");
        assert.deepEqual(page.routes, ["/pages/auth/login/index"]);
      } else {
        assert.equal(page.button("重新登录"), undefined);
        await page.click("刷新消息");
        await page.respond(2, 200, []);
        assert.match(page.text(), /暂无|有新内容/u);
      }
    }
  }
  const staff = await mountHealth({ role: "STAFF" });
  assert.equal(staff.calls.length, 0);
  const page = await mountHealth();
  await page.event("unload");
  await page.respond(0, 200, [healthNotice()]);
  assert.doesNotMatch(page.text(), /summary-A|student-A/u);
});

test("read then explicitly acknowledge the current version once and recover from a conflict without replay", async () => {
  const page = await mountHealth();
  await page.respond(0, 200, [healthNotice("A", "UNREAD")]);
  assert.equal(page.button("确认知悉"), undefined);
  const oldRead = page.button("查看并标记已读");
  oldRead.props.onClick();
  oldRead.props.onClick();
  await page.flush();
  assert.equal(page.calls.length, 2);
  assert.equal(page.calls[1].path, "/parent/health-incidents/" + noticeId + "/read");
  assert.deepEqual(page.calls[1].body, { version: 3 });
  await page.respond(1, 200, healthNotice("A", "READ"));
  await page.respond(2, 200, [healthNotice("A", "READ")]);
  oldRead.props.onClick();
  await page.flush();
  assert.equal(page.calls.length, 3);
  const oldAck = page.button("确认知悉");
  await page.click("确认知悉");
  assert.equal(page.calls[3].path, "/parent/health-incidents/" + noticeId + "/ack");
  assert.deepEqual(page.calls[3].body, { version: 3 });
  await page.respond(3, 409);
  await page.respond(4, 200, [healthNotice("A", "UNREAD", 4)]);
  oldAck.props.onClick();
  await page.flush();
  assert.equal(page.calls.length, 5);
  assert.equal(page.button("确认知悉"), undefined);
  await page.click("查看并标记已读");
  assert.deepEqual(page.calls[5].body, { version: 4 });
  await page.respond(5, 200, healthNotice("A", "READ", 4));
  await page.respond(6, 200, [healthNotice("A", "READ", 4)]);
  const ack = page.button("确认知悉");
  ack.props.onClick();
  ack.props.onClick();
  await page.flush();
  assert.equal(page.calls.length, 8);
  assert.deepEqual(page.calls[7].body, { version: 4 });
  await page.respond(7, 200, healthNotice("A", "ACKNOWLEDGED", 4));
  await page.respond(8, 200, [healthNotice("A", "ACKNOWLEDGED", 4)]);
  assert.match(page.text(), /已确认知悉/u);
  assert.equal(page.button("确认知悉"), undefined);
});

test("staff page restores a scoped saved draft and submits its current version", async () => {
  const page = await read("../src/pages/staff/health-report/index.tsx");

  assert.match(page, /hasRoleAccess\(session, "STAFF"\)/u);
  assert.match(page, /loadStaffStudents/u);
  assert.match(page, /loadStaffDrafts/u);
  assert.match(page, /mode="selector"/u);
  assert.match(page, /resumeDraft/u);
  assert.match(page, /setStudentIndex/u);
  assert.match(page, /setObservationIndex/u);
  assert.match(page, /setDispositionIndex/u);
  assert.match(page, /createStaffDraft/u);
  assert.match(page, /submitStaffDraft\(draft\.id, draft\.version\)/u);
  assert.match(page, /保存草稿/u);
  assert.match(page, /提交审核/u);
  assert.match(page, /继续填写|继续草稿/u);
  assert.match(page, /runHealthIncidentSingleFlight\(inFlight, async \(\) =>/u);
  assert.equal((page.match(/runHealthIncidentSingleFlight\(inFlight/g) ?? []).length, 2);
  assert.match(page, /busy/u);
});

test("staff page sends only one submit request when a saved draft is tapped twice while pending", async () => {
  const page = await mountStaffHealthReport();
  const picker = page.draftPicker();

  assert.ok(picker, "the loaded synthetic saved draft selector is rendered");
  picker.props.onChange({ detail: { value: "1" } });
  page.render();

  const submit = page.button("提交审核");
  assert.ok(submit && !submit.props.disabled, "the resumed draft can be submitted");
  submit.props.onClick();
  await page.flush();
  submit.props.onClick();
  await page.flush();

  const posts = page.requests.filter((request) => request.method === "POST");
  assert.equal(posts.length, 1);
  assert.equal(posts[0].path, "/staff/health-incidents/00000000-0000-4000-8000-000000000420/submit");
  assert.deepEqual(posts[0].body, { version: 5 });

  posts[0].respond({
    id: staffDraft.id,
    version: 6,
    status: "SUBMITTED",
    statusLabel: "待审核",
    synthetic: true,
  });
  await page.flush();
  assert.match(page.text(), /已提交审核/u);
});

test("parent page renders only published summaries and requires read before acknowledgement", async () => {
  const page = await read("../src/pages/parent/health-notices/index.tsx");

  assert.match(page, /hasRoleAccess\(session, "PARENT"\)/u);
  assert.match(page, /loadParentNotices/u);
  assert.match(page, /useDidShow/u);
  assert.match(page, /refreshNotices/u);
  assert.match(page, /刷新消息|刷新/u);
  assert.match(page, /正在刷新/u);
  assert.match(page, /notice\.status === "PUBLISHED"/u);
  assert.match(page, /notice\.studentLabel/u);
  assert.match(page, /notice\.parentSummary/u);
  assert.match(page, /markParentNoticeRead/u);
  assert.match(page, /acknowledgeParentNotice/u);
  assert.match(page, /receiptStatus === "READ"/u);
  assert.doesNotMatch(page, /observationLabel|dispositionLabel|reviewedBy/u);
});
