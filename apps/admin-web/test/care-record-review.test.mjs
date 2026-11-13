import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { URL } from "node:url";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

async function loadPageModel() {
  const source = await readFile(
    new URL("../src/pages/care-record-review.tsx", import.meta.url),
    "utf8",
  );
  const output = ts.transpile(source, {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2020,
  });
  return import(`data:text/javascript;base64,${Buffer.from(output).toString("base64")}`);
}

test("CareRecord admin projection keeps scoped review rows minimal", async () => {
  const { projectCareRecordAdminView, renderCareRecordReview } = await loadPageModel();
  const view = projectCareRecordAdminView({
    actor: {
      role: "CAMPUS_REVIEWER",
      status: "ACTIVE",
      tenantId: "tenant-a",
      authorizedCampusIds: ["campus-a"],
      authorizedClassIds: ["class-a"],
    },
    records: [
      {
        id: "care-a",
        version: 1,
        status: "SUBMITTED",
        tenantId: "tenant-a",
        campusId: "campus-a",
        classId: "class-a",
        summaryLabel: "模拟待审核",
      },
      {
        id: "care-b",
        status: "SUBMITTED",
        tenantId: "tenant-a",
        campusId: "campus-b",
        classId: "class-b",
        summaryLabel: "不应显示",
      },
      {
        id: "care-published",
        version: 2,
        status: "CONFIRMED",
        tenantId: "tenant-a",
        campusId: "campus-a",
        classId: "class-a",
        summaryLabel: "已审核记录",
        published: false,
      },
    ],
  });
  assert.equal(view.mode, "SCOPED_REVIEW");
  assert.deepEqual(
    view.rows.map((row) => row.id),
    ["care-a", "care-published"],
  );
  assert.equal(view.counts.SUBMITTED, 1);
  assert.equal(view.rows.find((row) => row.id === "care-published")?.published, false);
  assert.match(
    renderCareRecordReview(view, "CAMPUS_REVIEWER"),
    /data-admin-care-record-action="CONFIRM"/u,
  );
  assert.match(renderCareRecordReview(view), /data-admin-care-record-action="PUBLISH"/u);
});

test("admin reviewer actions recheck role, exact scope, state, and version", async () => {
  const { reviewAdminCareRecord } = await loadPageModel();
  const actor = {
    role: "CAMPUS_REVIEWER",
    status: "ACTIVE",
    tenantId: "tenant-a",
    authorizedCampusIds: ["campus-a"],
    authorizedClassIds: ["class-a"],
  };
  const records = [
    {
      id: "care-a",
      version: 3,
      status: "SUBMITTED",
      tenantId: "tenant-a",
      campusId: "campus-a",
      classId: "class-a",
      summaryLabel: "模拟日报",
    },
    {
      id: "care-foreign",
      version: 1,
      status: "SUBMITTED",
      tenantId: "tenant-a",
      campusId: "campus-b",
      classId: "class-b",
      summaryLabel: "范围外",
    },
    {
      id: "care-return",
      version: 5,
      status: "SUBMITTED",
      tenantId: "tenant-a",
      campusId: "campus-a",
      classId: "class-a",
      summaryLabel: "模拟待退回日报",
    },
  ];
  const confirmed = reviewAdminCareRecord({
    actor,
    records,
    id: "care-a",
    version: 3,
    decision: "CONFIRM",
  });
  assert.equal(confirmed.ok, true);
  assert.equal(confirmed.records[0].status, "CONFIRMED");
  assert.equal(confirmed.records[0].version, 4);

  const replayed = reviewAdminCareRecord({
    actor,
    records: confirmed.records,
    id: "care-a",
    version: 4,
    decision: "RETURN",
  });
  assert.equal(replayed.ok, false);
  assert.equal(replayed.error, "INVALID_STATE");
  assert.deepEqual(replayed.records, confirmed.records);

  const returned = reviewAdminCareRecord({
    actor,
    records,
    id: "care-return",
    version: 5,
    decision: "RETURN",
  });
  assert.equal(returned.ok, true);
  assert.equal(returned.records[2].status, "RETURNED");
  assert.equal(returned.records[2].version, 6);

  const stale = reviewAdminCareRecord({
    actor,
    records,
    id: "care-a",
    version: 2,
    decision: "RETURN",
  });
  assert.equal(stale.ok, false);
  assert.equal(stale.error, "STALE");
  assert.deepEqual(stale.records, records);

  const foreign = reviewAdminCareRecord({
    actor,
    records,
    id: "care-foreign",
    version: 1,
    decision: "CONFIRM",
  });
  assert.equal(foreign.ok, false);
  assert.equal(foreign.error, "OUT_OF_SCOPE");
  assert.deepEqual(foreign.records, records);

  const platform = reviewAdminCareRecord({
    actor: { role: "PLATFORM_ADMIN", status: "ACTIVE" },
    records,
    id: "care-a",
    version: 3,
    decision: "CONFIRM",
  });
  assert.equal(platform.ok, false);
  assert.equal(platform.error, "FORBIDDEN");
  assert.deepEqual(platform.records, records);
});

test("platform administrator gets aggregate-only counts, never individual care details", async () => {
  const { projectCareRecordAdminView, renderCareRecordReview } = await loadPageModel();
  const view = projectCareRecordAdminView({
    actor: { role: "PLATFORM_ADMIN", status: "ACTIVE" },
    records: [{ id: "private-id", status: "SUBMITTED", summaryLabel: "private body" }],
  });
  assert.equal(view.mode, "AGGREGATE_ONLY");
  assert.equal(view.rows.length, 0);
  assert.equal(view.counts.SUBMITTED, 1);
  assert.doesNotMatch(JSON.stringify(view), /private-id|private body/);
  const html = renderCareRecordReview(view, "PLATFORM_ADMIN");
  assert.match(html, /匿名统计/u);
  assert.doesNotMatch(html, /private-id|private body/u);
  assert.doesNotMatch(html, /admin-care-record-profile/u);
});

test("Next.js review page shows revocation only from server actions and asks before hiding parent access", async () => {
  const source = await readFile(
    new URL("../src/app/admin/care-record-review/care-record-review-panel.tsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /record\.actions\.includes\("revoke-publication"\)/u);
  assert.match(source, /window\.confirm/u);
  assert.match(source, /client\.revokePublication\(record\.id, record\.version\)/u);
});
