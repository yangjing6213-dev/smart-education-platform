import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  CARE_RECORD_STATUSES,
  createCareRecordDraft,
  createInitialCareRecordState,
  createSyntheticCareRecordContext,
  publishCareRecord,
  projectCareRecordsForParent,
  renderParentCareRecordPanel,
  renderCareRecordStaffPanel,
  renderSharedParentCareRecordPanel,
  readCareRecord,
  reviewCareRecord,
  submitCareRecord,
  resubmitCareRecord,
  withdrawCareRecord,
  acknowledgeCareRecord,
  batchReviewCareRecords,
  revokeCareRecordPublication,
  toParentUpdatesCareRecords,
  type CareRecordValues,
} from "./care-record-workflow.js";

const values: CareRecordValues = {
  arrival: "ARRIVED_AS_PLANNED",
  homework: "COMPLETED",
  meal: "FINISHED",
  rest: "RESTED",
  activity: "PARTICIPATED",
  wellbeing: "ROUTINE",
};

function submittedRecord() {
  const context = createSyntheticCareRecordContext("TEACHER");
  const draft = createCareRecordDraft(createInitialCareRecordState(), context, values);
  assert.equal(draft.ok, true);
  const submitted = submitCareRecord(draft.state, context, draft.record!.id, draft.record!.version);
  assert.equal(submitted.ok, true);
  return { state: submitted.state, record: submitted.record! };
}

test("CareRecord keeps exactly the six V3 states and refuses free-form fields", () => {
  assert.deepEqual(CARE_RECORD_STATUSES, [
    "DRAFT",
    "SUBMITTED",
    "CONFIRMED",
    "RETURNED",
    "CANCELLED",
    "EXCEPTION_PENDING",
  ]);
  const context = createSyntheticCareRecordContext("TEACHER");
  const invalid = createCareRecordDraft(createInitialCareRecordState(), context, {
    ...values,
    homework: "真实学生的自由文本",
  });
  assert.equal(invalid.ok, false);
  assert.equal(invalid.state.records.length, 0);
});

test("teacher submit, reviewer confirm and explicit publish gate the parent projection", () => {
  const { state, record } = submittedRecord();
  const reviewer = createSyntheticCareRecordContext("CAMPUS_REVIEWER");
  const confirmed = reviewCareRecord(state, reviewer, record.id, record.version, "CONFIRM");
  assert.equal(confirmed.record?.status, "CONFIRMED");
  assert.deepEqual(
    projectCareRecordsForParent(confirmed.state, createSyntheticCareRecordContext("GUARDIAN"))
      .records,
    [],
  );

  const published = publishCareRecord(
    confirmed.state,
    reviewer,
    record.id,
    confirmed.record!.version,
  );
  const parent = createSyntheticCareRecordContext("GUARDIAN");
  assert.equal(projectCareRecordsForParent(published.state, parent).records.length, 1);
  const read = readCareRecord(published.state, parent, record.id, published.record!.version);
  assert.equal(read.ok, true);
  const acknowledged = acknowledgeCareRecord(
    read.state,
    parent,
    record.id,
    published.record!.version,
  );
  assert.equal(acknowledged.receipt, "ACKNOWLEDGED");
  assert.equal(acknowledged.state.records[0]?.status, "CONFIRMED");
});

test("published daily record adapter preserves the active synthetic scope", () => {
  const { state, record } = submittedRecord();
  const reviewer = createSyntheticCareRecordContext("CAMPUS_REVIEWER");
  const confirmed = reviewCareRecord(state, reviewer, record.id, record.version, "CONFIRM");
  const published = publishCareRecord(
    confirmed.state,
    reviewer,
    record.id,
    confirmed.record!.version,
  );
  const [parentRecord] = toParentUpdatesCareRecords(published.state);
  assert.ok(parentRecord);
  assert.deepEqual(
    [parentRecord.tenantId, parentRecord.campusId, parentRecord.classId, parentRecord.studentId],
    [record.tenantId, record.campusId, record.classId, record.studentId],
  );
  assert.equal(parentRecord.date, "2026-09-30");
});

test("parent must open the published record before separate acknowledgement", () => {
  const { state, record } = submittedRecord();
  const reviewer = createSyntheticCareRecordContext("CAMPUS_REVIEWER");
  const confirmed = reviewCareRecord(state, reviewer, record.id, record.version, "CONFIRM");
  const published = publishCareRecord(
    confirmed.state,
    reviewer,
    record.id,
    confirmed.record!.version,
  );
  const publishedRecord = published.state.records[0]!;
  const parent = createSyntheticCareRecordContext("GUARDIAN");
  const unreadPage = renderParentCareRecordPanel(published.state, parent);
  assert.match(unreadPage, /data-parent-care-record-action="read"/u);
  assert.doesNotMatch(unreadPage, /data-parent-care-record-action="acknowledge"/u);

  const read = readCareRecord(published.state, parent, publishedRecord.id, publishedRecord.version);
  assert.equal(read.ok, true);
  const readPage = renderParentCareRecordPanel(read.state, parent);
  assert.match(readPage, /已打开，尚未确认知悉/u);
  assert.match(readPage, /data-parent-care-record-action="acknowledge"/u);
  assert.ok(readPage.includes(`data-parent-care-record-version="${publishedRecord.version}"`));

  const acknowledged = acknowledgeCareRecord(
    read.state,
    parent,
    publishedRecord.id,
    publishedRecord.version,
  );
  const acknowledgedPage = renderParentCareRecordPanel(acknowledged.state, parent);
  assert.match(acknowledgedPage, /已在本机确认知悉/u);
  assert.doesNotMatch(acknowledgedPage, /data-parent-care-record-action="acknowledge"/u);
});

test("shared parent panel presents only service records with separate read and acknowledgement actions", () => {
  const record = {
    id: "123e4567-e89b-42d3-a456-426614174000",
    version: 4,
    date: "2026-10-10",
    studentLabel: "示例学生甲",
    values: {
      arrival: "按计划到校",
      homework: "已完成整理",
      meal: "按示例完成用餐",
      rest: "完成休息",
      activity: "参与活动",
      wellbeing: "日常状态",
    },
    receipt: "UNREAD" as const,
  };
  const unread = renderSharedParentCareRecordPanel([record], "已连接", false);
  assert.match(unread, /data-parent-care-record-action="read"/u);
  assert.match(unread, /示例学生甲/u);
  const read = renderSharedParentCareRecordPanel([{ ...record, receipt: "READ" }], "已打开", false);
  assert.match(read, /data-parent-care-record-action="acknowledge"/u);
  assert.match(read, /确认知悉/u);
  assert.doesNotMatch(renderSharedParentCareRecordPanel([], "服务不可用"), /示例学生甲/u);
});

test("shared staff panel hides local role switching and keeps service state explicit", () => {
  const html = renderCareRecordStaffPanel(
    createInitialCareRecordState(),
    "TEACHER",
    values,
    "已连接本机服务",
    true,
  );
  assert.match(html, /data-care-record-refresh/u);
  assert.match(html, /已连接本机服务/u);
  assert.doesNotMatch(html, /data-care-record-role/u);
  assert.match(html, /保存草稿/u);
});

test("returned records require fixed-option resubmission and may be withdrawn", () => {
  const { state, record } = submittedRecord();
  const reviewer = createSyntheticCareRecordContext("CAMPUS_REVIEWER");
  const returned = reviewCareRecord(state, reviewer, record.id, record.version, "RETURN");
  assert.equal(returned.record?.status, "RETURNED");
  const teacher = createSyntheticCareRecordContext("TEACHER");
  const resubmitted = resubmitCareRecord(
    returned.state,
    teacher,
    record.id,
    returned.record!.version,
    values,
  );
  assert.equal(resubmitted.record?.status, "SUBMITTED");
  const cancelled = withdrawCareRecord(
    resubmitted.state,
    teacher,
    record.id,
    resubmitted.record!.version,
  );
  assert.equal(cancelled.record?.status, "CANCELLED");
});

test("batch validation is atomic when one record is stale or outside reviewer scope", () => {
  const { state, record } = submittedRecord();
  const reviewer = createSyntheticCareRecordContext("CAMPUS_REVIEWER");
  const denied = batchReviewCareRecords(state, reviewer, [
    { id: record.id, version: record.version, decision: "CONFIRM" },
    { id: record.id, version: record.version + 1, decision: "RETURN" },
  ]);
  assert.equal(denied.ok, false);
  assert.deepEqual(denied.state.records, state.records);

  const foreign = createSyntheticCareRecordContext("CAMPUS_REVIEWER", {
    campusId: "campus-synthetic-foreign",
  });
  const outOfScope = batchReviewCareRecords(state, foreign, [
    { id: record.id, version: record.version, decision: "CONFIRM" },
  ]);
  assert.equal(outOfScope.ok, false);
  assert.deepEqual(outOfScope.state.records, state.records);
});

test("revocation hides the published summary and clears its receipt; invalid roles fail closed", () => {
  const { state, record } = submittedRecord();
  const reviewer = createSyntheticCareRecordContext("CAMPUS_REVIEWER");
  const confirmed = reviewCareRecord(state, reviewer, record.id, record.version, "CONFIRM");
  const published = publishCareRecord(
    confirmed.state,
    reviewer,
    record.id,
    confirmed.record!.version,
  );
  const parent = createSyntheticCareRecordContext("GUARDIAN");
  const read = readCareRecord(published.state, parent, record.id, published.record!.version);
  const revoked = revokeCareRecordPublication(
    read.state,
    reviewer,
    record.id,
    published.record!.version,
  );
  assert.equal(projectCareRecordsForParent(revoked.state, parent).records.length, 0);
  assert.equal(revoked.state.receipts.length, 0);
  const denied = reviewCareRecord(
    state,
    createSyntheticCareRecordContext("GUARDIAN"),
    record.id,
    record.version,
    "CONFIRM",
  );
  assert.equal(denied.ok, false);
});

test("workflow source has no network or persistent-storage calls", async () => {
  const source = await readFile(
    new URL("../../src/pages/care-record-workflow.ts", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(
    source,
    /\bfetch\s*\(|XMLHttpRequest|WebSocket|localStorage|sessionStorage|indexedDB|sendBeacon/,
  );
});
