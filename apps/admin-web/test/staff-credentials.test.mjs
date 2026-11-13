import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { URL } from "node:url";
import test from "node:test";
import {
  createStaffCredentialStore,
  credentialExpiryStatus,
} from "../dist/local-synthetic/staff-credentials.js";

const TODAY = "2026-10-07";
const pageSource = readFileSync(
  new URL("../src/pages/staff-credentials.ts", import.meta.url),
  "utf8",
);
const entrySource = readFileSync(new URL("../src/main.ts", import.meta.url), "utf8");

const validDraft = {
  staffId: "staff-teacher-one",
  category: "TEACHER_QUALIFICATION",
  issueDate: "2026-01-01",
  expiryDate: "2027-01-01",
  responsibleRole: "CAMPUS_OWNER",
};

test("the initial credential list is synthetic, campus-scoped, and includes no identity details", () => {
  const store = createStaffCredentialStore(() => TODAY);
  const rows = store.list();
  assert.equal(rows.length, 2);
  assert.equal(rows[0].staffName, "模拟教师一号");
  assert.equal(rows[0].expiryStatus, "DUE_SOON");
  assert.equal(rows[1].expiryStatus, "VALID");
  assert.ok(rows.every((row) => row.synthetic === true));
  assert.ok(rows.every((row) => !("credentialNumber" in row) && !("attachment" in row)));
});

test("expiry reminders use the fixed 30-day boundary without changing staff status", () => {
  assert.equal(credentialExpiryStatus("2026-10-06", TODAY), "EXPIRED");
  assert.equal(credentialExpiryStatus("2026-11-06", TODAY), "DUE_SOON");
  assert.equal(credentialExpiryStatus("2026-11-07", TODAY), "VALID");
});

test("creation and update increment versions and append a small history", () => {
  const store = createStaffCredentialStore(() => TODAY);
  const created = store.create(validDraft);
  assert.equal(created.ok, true);
  if (!created.ok) return;
  assert.equal(created.record.version, 1);
  assert.deepEqual(
    created.record.history.map((event) => event.action),
    ["CREATED"],
  );

  const updated = store.update(created.record.id, created.record.version, {
    ...validDraft,
    expiryDate: "2027-02-01",
  });
  assert.equal(updated.ok, true);
  if (!updated.ok) return;
  assert.equal(updated.record.version, 2);
  assert.deepEqual(
    updated.record.history.map((event) => event.action),
    ["CREATED", "UPDATED"],
  );
});

test("invalid dates, reversed ranges, stale versions, and free-text fields fail closed", () => {
  const store = createStaffCredentialStore(() => TODAY);
  assert.equal(store.create({ ...validDraft, issueDate: "2026-02-30" }).ok, false);
  assert.equal(store.create({ ...validDraft, issueDate: "2027-02-01" }).ok, false);
  assert.equal(store.create({ ...validDraft, notes: "real employee detail" }).ok, false);
  const created = store.create(validDraft);
  assert.equal(created.ok, true);
  if (!created.ok) return;
  const stale = store.update(created.record.id, 0, validDraft);
  assert.deepEqual(stale, { ok: false, error: "VERSION_CONFLICT" });
  assert.equal(store.find(created.record.id)?.version, 1);
});

test("the existing staff route exposes the local page without network or browser persistence", () => {
  assert.match(entrySource, /path === "\/admin\/staff"/u);
  assert.match(entrySource, /createStaffCredentialsSection\(/u);
  assert.match(pageSource, /资格材料与到期提醒/u);
  assert.match(pageSource, /新增资格材料/u);
  assert.match(pageSource, /保存变更/u);
  assert.doesNotMatch(pageSource, /fetch\(|XMLHttpRequest|localStorage|sessionStorage|indexedDB/u);
});

test("existing management controls keep state-specific action labels and audit conflicts", () => {
  assert.equal((entrySource.match(/"unpublishAction" in view/gu) ?? []).length, 3);
  assert.match(entrySource, /mode === "CONFLICT" \? "CONFLICT" : "READY"/u);
});
