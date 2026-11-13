import assert from "node:assert/strict";
import test from "node:test";
import {
  HealthIncidentReviewClient,
  renderHealthIncidentReview,
} from "../dist/local-review/health-incident-shared.js";

function fixture() {
  const state = {
    row: {
      id: "incident-synthetic-1",
      version: 1,
      status: "SUBMITTED",
      statusLabel: "待审核",
      published: false,
      tenantId: "tenant-synthetic-a",
      campusId: "campus-synthetic-east",
      classId: "class-synthetic-a",
      studentLabel: "模拟学生甲",
      observationCode: "NEEDS_FOLLOW_UP",
      observationLabel: "需要跟进",
      dispositionCode: "FOLLOW_UP_SCHEDULED",
      dispositionLabel: "已安排跟进",
      summaryCode: null,
      synthetic: true,
    },
    writes: [],
  };
  const session = {
    profile: "owner-east",
    label: "模拟校区负责人",
    actorId: "owner-synthetic",
    tenantId: state.row.tenantId,
    campusId: state.row.campusId,
    classIds: [state.row.classId],
    actions: ["health:review", "health:supplement", "health:publish", "health:revoke"],
  };
  const transport = async (path, init = {}) => {
    let value;
    if (path === "/local/sessions") value = { handle: "h".repeat(43) };
    else if (path === "/local/session") value = session;
    else if (path === "/local/health-incident-review") value = [state.row];
    else if (path.endsWith("/review")) {
      const body = JSON.parse(String(init.body));
      state.writes.push(body);
      state.row = {
        ...state.row,
        version: state.row.version + 1,
        status: body.action === "ESCALATE" ? "EXCEPTION_PENDING" : "CONFIRMED",
        statusLabel: body.action === "ESCALATE" ? "需负责人继续跟进" : "已审核",
      };
      value = state.row;
    }
    return { ok: true, status: 200, json: async () => JSON.parse(JSON.stringify(value)) };
  };
  return { state, transport };
}

test("owner can escalate a shared record once, then continue review from the same queue", async () => {
  const { state, transport } = fixture();
  const client = new HealthIncidentReviewClient(transport);

  await client.connect("CAMPUS_REVIEWER");
  assert.match(renderHealthIncidentReview(client.snapshot, true), /标记人工跟进/u);
  await client.review("incident-synthetic-1", 1, "ESCALATE");

  assert.equal(client.snapshot.rows[0]?.status, "EXCEPTION_PENDING");
  assert.equal(state.writes.length, 1);
  await assert.rejects(client.review("incident-synthetic-1", 2, "ESCALATE"), /ACTION_UNAVAILABLE/u);
  await client.review("incident-synthetic-1", 2, "CONFIRM");
  assert.equal(client.snapshot.rows[0]?.status, "CONFIRMED");
  assert.equal(state.writes.length, 2);
});

test("platform role sees aggregate only and cannot act on individual health records", async () => {
  const { transport } = fixture();
  const client = new HealthIncidentReviewClient(transport);

  await client.connect("PLATFORM_ADMIN");
  const html = renderHealthIncidentReview(client.snapshot, true);

  assert.match(html, /匿名统计/u);
  assert.doesNotMatch(html, /incident-synthetic-1|模拟学生甲/u);
  assert.doesNotMatch(html, /data-health-incident-action/u);
});
