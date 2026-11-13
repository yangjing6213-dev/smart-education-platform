import assert from "node:assert/strict";
import test from "node:test";
import { createPlatformOperationsStore } from "../src/local-synthetic/platform-operations.ts";
import { createStaffCredentialStore } from "../src/local-synthetic/staff-credentials.ts";

const CREDENTIAL_SCOPE = {
  tenantId: "tenant-synthetic-a",
  campusId: "campus-synthetic-east",
};

test("credential records keep fixed scope and reject caller-supplied scope", () => {
  const store = createStaffCredentialStore(() => "2026-10-10");
  assert.ok(
    store
      .list()
      .every(
        (record) =>
          record.tenantId === CREDENTIAL_SCOPE.tenantId &&
          record.campusId === CREDENTIAL_SCOPE.campusId,
      ),
  );

  const draft = {
    staffId: "staff-teacher-one",
    category: "TEACHER_QUALIFICATION",
    issueDate: "2026-01-01",
    expiryDate: "2027-01-01",
    responsibleRole: "CAMPUS_OWNER",
  };
  const beforeForgedCreate = JSON.stringify(store.list());
  assert.deepEqual(
    store.create({ ...draft, tenantId: "tenant-forged", campusId: "campus-forged" }),
    { ok: false, error: "INVALID_INPUT" },
  );
  assert.equal(JSON.stringify(store.list()), beforeForgedCreate);

  const created = store.create(draft);
  assert.equal(created.ok, true);
  if (!created.ok) return;
  assert.equal(created.record.tenantId, CREDENTIAL_SCOPE.tenantId);
  assert.equal(created.record.campusId, CREDENTIAL_SCOPE.campusId);

  const beforeForgedUpdate = JSON.stringify(store.list());
  assert.deepEqual(
    store.update(created.record.id, created.record.version, {
      ...draft,
      tenantId: "tenant-forged",
    }),
    { ok: false, error: "INVALID_INPUT" },
  );
  assert.equal(JSON.stringify(store.list()), beforeForgedUpdate);

  const updated = store.update(created.record.id, created.record.version, {
    ...draft,
    expiryDate: "2027-02-01",
  });
  assert.equal(updated.ok, true);
  if (!updated.ok) return;
  assert.equal(updated.record.tenantId, CREDENTIAL_SCOPE.tenantId);
  assert.equal(updated.record.campusId, CREDENTIAL_SCOPE.campusId);
});

test("platform support cases belong to known tenants and status changes preserve ownership", () => {
  const store = createPlatformOperationsStore();
  const snapshot = store.snapshot;
  const tenantIds = new Set(snapshot.tenants.map((tenant) => tenant.id));
  assert.ok(
    snapshot.supportCases.every(
      (supportCase) =>
        typeof supportCase.tenantId === "string" && tenantIds.has(supportCase.tenantId),
    ),
  );

  const initial = snapshot.supportCases[0];
  assert.ok(initial);
  const beforeForgedUpdate = JSON.stringify(store.snapshot);
  assert.deepEqual(
    store.updateSupportCase(initial.id, initial.version, {
      status: "CLOSED",
      tenantId: "tenant-forged",
    }),
    { ok: false, error: "INVALID_INPUT" },
  );
  assert.equal(JSON.stringify(store.snapshot), beforeForgedUpdate);

  const result = store.updateSupportCase(initial.id, initial.version, "IN_PROGRESS");
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.record.tenantId, initial.tenantId);
  assert.ok(tenantIds.has(result.record.tenantId));
});
