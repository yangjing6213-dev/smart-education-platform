import assert from "node:assert/strict";
import test from "node:test";
import { createStaffOperationsStore } from "../dist/local-synthetic/staff-operations.js";
import { createStaffOperationsSection } from "../dist/pages/staff-operations.js";

class FakeElement {
  constructor(tagName) {
    this.tagName = tagName.toUpperCase();
    this.children = [];
    this.dataset = {};
    this.listeners = new Map();
    this.disabled = false;
    this.value = "";
  }

  append(...children) {
    for (const child of children) {
      this.children.push(child);
      if (this.tagName === "SELECT" && child.selected) this.value = child.value;
    }
  }

  replaceChildren(...children) {
    this.children = [];
    this.append(...children);
  }

  addEventListener(type, listener) {
    const listeners = this.listeners.get(type) ?? [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }

  dispatch(type) {
    const event = { preventDefault() {} };
    for (const listener of this.listeners.get(type) ?? []) listener(event);
  }
}

function descendants(element) {
  return [element, ...element.children.flatMap(descendants)];
}

test("work materials retain only synthetic fixed facts and record manual review history", () => {
  const store = createStaffOperationsStore();
  const result = store.createWorkMaterial({
    staffId: "synthetic-staff-east-001",
    period: "2026-10",
    category: "TRAINING_COMPLETED",
    responsibleRole: "CAMPUS_OWNER",
  });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.record.status, "PENDING_REVIEW");
  assert.equal(result.record.score, undefined);
  assert.equal(result.record.history.length, 0);

  const reviewed = store.reviewWorkMaterial(result.record.id, result.record.version, "REVIEWED");
  assert.equal(reviewed.ok, true);
  if (!reviewed.ok) return;
  assert.equal(reviewed.record.version, 2);
  assert.equal(reviewed.record.status, "REVIEWED");
  assert.deepEqual(reviewed.record.history, [{ version: 1, status: "PENDING_REVIEW" }]);

  const stale = store.reviewWorkMaterial(result.record.id, 1, "NEEDS_FOLLOW_UP");
  assert.deepEqual(stale, { ok: false, error: "VERSION_CONFLICT" });
});

test("invalid work material inputs fail without changing existing records", () => {
  const store = createStaffOperationsStore();
  const before = JSON.stringify(store.snapshot);

  assert.deepEqual(
    store.createWorkMaterial({
      staffId: "unknown-staff",
      period: "2026-13",
      category: "UNSUPPORTED",
      responsibleRole: "CAMPUS_OWNER",
    }),
    { ok: false, error: "INVALID_INPUT" },
  );
  assert.equal(JSON.stringify(store.snapshot), before);
});

test("recruitment follow-up uses synthetic aliases and manually tracked versioned stages", () => {
  const store = createStaffOperationsStore();
  const result = store.createRecruitmentLead({
    position: "TEACHER",
    source: "EMPLOYEE_REFERRAL",
    responsibleRole: "CAMPUS_OWNER",
    nextFollowUpDate: "2026-10-20",
  });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.match(result.record.alias, /^模拟候选人\d+$/u);
  assert.equal(result.record.stage, "TO_CONTACT");

  const updated = store.updateRecruitmentLead(result.record.id, result.record.version, {
    stage: "INTERVIEW_SCHEDULED",
    nextFollowUpDate: "2026-10-22",
  });
  assert.equal(updated.ok, true);
  if (!updated.ok) return;
  assert.equal(updated.record.version, 2);
  assert.equal(updated.record.stage, "INTERVIEW_SCHEDULED");
  assert.deepEqual(updated.record.history, [{ version: 1, stage: "TO_CONTACT" }]);

  const stale = store.updateRecruitmentLead(result.record.id, 1, {
    stage: "CONTACTED",
    nextFollowUpDate: "2026-10-23",
  });
  assert.deepEqual(stale, { ok: false, error: "VERSION_CONFLICT" });
  assert.doesNotMatch(JSON.stringify(store.snapshot), /phone|email|address|resume|score|rank/iu);
});

test("candidate input rejects free-form identity and invalid dates without changing records", () => {
  const store = createStaffOperationsStore();
  const before = JSON.stringify(store.snapshot);

  assert.deepEqual(
    store.createRecruitmentLead({
      position: "TEACHER",
      source: "EMPLOYEE_REFERRAL",
      responsibleRole: "CAMPUS_OWNER",
      nextFollowUpDate: "2026-02-30",
      name: "不应被采集",
      phone: "13800000000",
    }),
    { ok: false, error: "INVALID_INPUT" },
  );
  assert.equal(JSON.stringify(store.snapshot), before);
});

test("read-only staff operations disable controls and ignore submitted events", () => {
  const originalDocument = globalThis.document;
  const originalFormData = globalThis.FormData;
  globalThis.document = { createElement: (tagName) => new FakeElement(tagName) };
  globalThis.FormData = class {
    constructor(form) {
      this.form = form;
    }

    get(name) {
      return descendants(this.form).find((element) => element.name === name)?.value ?? null;
    }
  };

  try {
    const store = createStaffOperationsStore();
    const before = JSON.stringify(store.snapshot);
    const section = createStaffOperationsSection(store, false);
    const elements = descendants(section);
    const controls = elements.filter((element) =>
      ["SELECT", "INPUT", "BUTTON"].includes(element.tagName),
    );

    assert.ok(controls.length > 0);
    assert.ok(controls.every((control) => control.disabled));

    for (const form of elements.filter((element) => element.tagName === "FORM")) {
      form.dispatch("submit");
    }
    for (const button of elements.filter((element) => element.dataset.workMaterialAction)) {
      button.dispatch("click");
    }

    assert.equal(JSON.stringify(store.snapshot), before);
  } finally {
    globalThis.document = originalDocument;
    globalThis.FormData = originalFormData;
  }
});
