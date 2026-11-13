import assert from "node:assert/strict";
import test from "node:test";
import {
  SupplyRequestClient,
  createLocalSupplyRequestTransport,
  isSupplyRequestInput,
  renderSupplyPanel,
  type SupplyRequestSession,
  type SupplyRequestRow,
} from "./supply-request.js";

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const teacher: SupplyRequestSession = {
  profile: "teacher-east",
  label: "示例东校区教师",
  actorId: uuid(1),
  tenantId: uuid(2),
  campusId: uuid(3),
  classIds: [uuid(4)],
  actions: [
    "supply:read",
    "supply:create",
    "supply:submit",
    "supply:edit",
    "supply:cancel",
    "supply:claim",
  ],
};
const row = (patch: Partial<SupplyRequestRow> = {}): SupplyRequestRow => ({
  id: uuid(10),
  kind: "supplyRequest",
  version: 1,
  catalog: "STATIONERY_SET",
  purpose: "CLASS_ACTIVITY",
  quantity: 2,
  tenantId: teacher.tenantId,
  campusId: teacher.campusId,
  classId: teacher.classIds[0]!,
  authorLabel: teacher.label,
  status: "DRAFT",
  synthetic: true,
  ...patch,
});

function createFixture(
  options: {
    rows?: SupplyRequestRow[];
    conflictOnSubmit?: boolean;
    responsePatch?: Partial<SupplyRequestRow>;
  } = {},
) {
  let rows = options.rows ?? [];
  let nextId = 20;
  const calls: Array<{ path: string; method: string; body?: Record<string, unknown> }> = [];
  const fetcher: typeof fetch = async (input, init = {}) => {
    const path =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.pathname
          : new URL(input.url).pathname;
    const method = init.method ?? "GET";
    const body = init.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : undefined;
    calls.push({ path, method, ...(body ? { body } : {}) });
    if (path === "/local/sessions") return Response.json({ handle: "h".repeat(43) });
    if (path === "/local/session") return Response.json({ mode: "local-synthetic", ...teacher });
    if (path === "/local/supply-requests" && method === "GET")
      return Response.json(rows.map((item) => ({ ...item, ...options.responsePatch })));
    if (path === "/local/supply-requests" && method === "POST") {
      const created = row({
        ...body,
        id: uuid(nextId++),
        version: 1,
        status: "DRAFT",
      } as Partial<SupplyRequestRow>);
      rows = [...rows, created];
      return Response.json(created, { status: 201 });
    }
    const command = /^\/local\/supply-requests\/([^/]+)\/(submit|cancel|claim)$/u.exec(path);
    if (command && method === "POST") {
      if (options.conflictOnSubmit && command[2] === "submit")
        return Response.json({}, { status: 409 });
      rows = rows.map((item) =>
        item.id === command[1]
          ? {
              ...item,
              version: item.version + 1,
              status:
                command[2] === "submit"
                  ? "SUBMITTED"
                  : command[2] === "claim"
                    ? "CLAIMED"
                    : "CANCELLED",
            }
          : item,
      );
      return Response.json(rows.find((item) => item.id === command[1]) ?? {});
    }
    return Response.json({}, { status: 404 });
  };
  const client = new SupplyRequestClient(fetcher);
  return { client, calls };
}

test("只接受固定物资、固定用途与 1 到 20 份数量", () => {
  assert.equal(
    isSupplyRequestInput({ catalog: "ART_ACTIVITY_SET", purpose: "CLASS_ACTIVITY", quantity: 20 }),
    true,
  );
  for (const input of [
    { catalog: "free text", purpose: "CLASS_ACTIVITY", quantity: 1 },
    { catalog: "STATIONERY_SET", purpose: "OTHER", quantity: 1 },
    { catalog: "STATIONERY_SET", purpose: "CLASS_ACTIVITY", quantity: 21 },
  ])
    assert.equal(isSupplyRequestInput(input), false);
});

test("员工页面只显示固定选项，不提供自由填写的采购信息", () => {
  const html = renderSupplyPanel({
    status: "READY",
    session: teacher,
    rows: [],
    summary: null,
    message: "已连接本机共享服务。",
  });
  assert.match(html, /日常文具包/u);
  assert.match(html, /班级活动/u);
  assert.doesNotMatch(html, /<textarea|type="text"|采购地址|商品链接/u);
});

test("员工创建并提交同一条物资申请，命令携带当前版本", async () => {
  const { client, calls } = createFixture();
  await client.connect();
  await client.create({ catalog: "STATIONERY_SET", purpose: "CLASS_ACTIVITY", quantity: 2 });
  const created = client.snapshot.rows[0];
  assert.ok(created);
  await client.command("submit", created.id, created.version);
  assert.equal(client.snapshot.rows[0]?.id, created.id);
  assert.equal(client.snapshot.rows[0]?.status, "SUBMITTED");
  const submit = calls.find((call) => call.path.endsWith("/submit"));
  assert.equal(submit?.method, "POST");
  assert.equal(submit?.body?.version, created.version);
});

test("旧版本冲突显示刷新提示且不会自动重放提交", async () => {
  const { client, calls } = createFixture({ rows: [row()], conflictOnSubmit: true });
  await client.connect();
  await client.command("submit", uuid(10), 1);
  assert.match(client.snapshot.message, /状态已变化|刷新/u);
  assert.equal(calls.filter((call) => call.path.endsWith("/submit")).length, 1);
});

test("跨校区返回的申请全部拒绝显示", async () => {
  const foreign = row({ campusId: uuid(30) });
  const { client } = createFixture({ rows: [foreign] });
  await client.connect();
  assert.deepEqual(client.snapshot.rows, []);
  assert.equal(client.snapshot.status, "ERROR");
});

test("传输层拒绝任意外网地址和非物资接口", async () => {
  const requested: string[] = [];
  const transport = createLocalSupplyRequestTransport(async (input) => {
    requested.push(String(input));
    return Response.json({ ok: true });
  });
  assert.equal((await transport("https://example.com/local/supply-requests")).status, 403);
  assert.equal((await transport("http://127.0.0.1:4318/local/supply-requests")).status, 403);
  assert.equal((await transport("http://localhost:4317/local/supply-requests")).status, 403);
  assert.equal((await transport("/local/unrelated-endpoint")).status, 403);
  assert.deepEqual(requested, []);
});
