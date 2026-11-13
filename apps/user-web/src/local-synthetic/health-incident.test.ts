import assert from "node:assert/strict";
import test from "node:test";
import {
  HealthIncidentClient,
  renderHealthIncidentPanel,
  type HealthIncidentSnapshot,
} from "./health-incident.js";

test("parent health summary stays hidden until the parent opens it", () => {
  const snapshot: HealthIncidentSnapshot = {
    role: "parent",
    status: "READY",
    actorId: "parent-synthetic",
    message: "已更新本机共享健康记录。",
    records: [
      {
        id: "incident-synthetic-1",
        version: 1,
        status: "PUBLISHED",
        title: "健康跟进摘要",
        date: "2026-10-08",
        parentSummary: "这段摘要仅在打开后显示。",
        receiptStatus: "UNREAD",
        synthetic: true,
      },
    ],
  };

  const html = renderHealthIncidentPanel(snapshot);

  assert.match(html, /查看摘要/u);
  assert.doesNotMatch(html, /这段摘要仅在打开后显示/u);
});

test("health controls stay disabled until the shared service is ready", () => {
  const snapshot: HealthIncidentSnapshot = {
    role: "teacher",
    status: "CONNECTING",
    actorId: null,
    message: "正在连接本机共享健康记录…",
    records: [],
  };

  const html = renderHealthIncidentPanel(snapshot);

  assert.match(html, /name="observationCode"[^>]*disabled/u);
  assert.match(html, /data-health-create[\s\S]*<button[^>]*disabled/u);
});

test("author can edit, submit, then withdraw the same synthetic record", async () => {
  let row = {
    id: "incident-synthetic-1",
    version: 1,
    status: "DRAFT",
    statusLabel: "草稿",
    studentLabel: "模拟学生甲",
    observationCode: "ROUTINE_OBSERVATION",
    observationLabel: "日常状态观察",
    dispositionCode: "OBSERVATION_RECHECKED",
    dispositionLabel: "已重新核对观察",
    createdBy: "teacher-synthetic",
    synthetic: true,
  };
  const writes: Array<{ path: string; body: Record<string, unknown> }> = [];
  const fetcher: typeof fetch = async (input, init = {}) => {
    const url = new URL(String(input));
    let value: unknown;
    if (url.pathname === "/local/sessions") value = { handle: "h".repeat(43) };
    else if (url.pathname === "/local/session") {
      value = {
        mode: "local-synthetic",
        profile: "teacher-east",
        actorId: "teacher-synthetic",
        actions: ["health:create", "health:submit", "health:edit", "health:withdraw"],
      };
    } else if (url.pathname === "/local/health-incident-owned") value = [row];
    else if (init.method === "POST") {
      const body = JSON.parse(String(init.body)) as Record<string, unknown>;
      writes.push({ path: url.pathname, body });
      row = {
        ...row,
        version: row.version + 1,
        ...(url.pathname.endsWith("/edit")
          ? {
              observationCode: String(body.observationCode),
              observationLabel: "需要跟进",
              dispositionCode: String(body.dispositionCode),
              dispositionLabel: "已安排跟进",
            }
          : {}),
        ...(url.pathname.endsWith("/submit") ? { status: "SUBMITTED", statusLabel: "待审核" } : {}),
        ...(url.pathname.endsWith("/withdraw")
          ? { status: "WITHDRAWN", statusLabel: "作者已撤回" }
          : {}),
      };
      value = row;
    }
    return Response.json(value);
  };
  const client = new HealthIncidentClient("teacher", {
    baseUrl: "http://127.0.0.1:4317",
    fetcher,
  });

  await client.connect();
  await client.command("edit", row.id, {
    observationCode: "NEEDS_FOLLOW_UP",
    dispositionCode: "FOLLOW_UP_SCHEDULED",
  });
  await client.command("submit", row.id);
  await client.command("withdraw", row.id);

  assert.equal(writes.length, 3);
  assert.deepEqual(
    writes.map(({ path }) => path.split("/").at(-1)),
    ["edit", "submit", "withdraw"],
  );
  assert.equal(
    client.snapshot.records[0] && "statusLabel" in client.snapshot.records[0]
      ? client.snapshot.records[0].status
      : "",
    "WITHDRAWN",
  );
});

test("health client refuses non-loopback services", () => {
  assert.throws(
    () => new HealthIncidentClient("teacher", { baseUrl: "https://example.invalid:4317" }),
    /loopback/u,
  );
});

test("parent client cannot send author or reviewer actions", async () => {
  let writes = 0;
  const fetcher: typeof fetch = async (input) => {
    const url = new URL(String(input));
    const value =
      url.pathname === "/local/sessions"
        ? { handle: "p".repeat(43) }
        : url.pathname === "/local/session"
          ? {
              mode: "local-synthetic",
              profile: "parent-alpha",
              actorId: "parent-synthetic",
              actions: ["health:read", "health:ack"],
            }
          : url.pathname === "/local/health-incidents"
            ? [
                {
                  id: "incident-published-1",
                  version: 1,
                  status: "PUBLISHED",
                  title: "健康跟进摘要",
                  date: "2026-10-08",
                  parentSummary: "固定摘要。",
                  receiptStatus: "UNREAD",
                  synthetic: true,
                },
              ]
            : (writes += 1);
    return Response.json(value);
  };
  const client = new HealthIncidentClient("parent", {
    baseUrl: "http://127.0.0.1:4317",
    fetcher,
  });

  await client.connect();
  await client.command("withdraw", "incident-published-1");

  assert.equal(writes, 0);
  assert.equal(client.snapshot.status, "READY");
});
