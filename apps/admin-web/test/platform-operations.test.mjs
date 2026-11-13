import assert from "node:assert/strict";
import test from "node:test";
import { createPlatformOperationsStore } from "../dist/local-synthetic/platform-operations.js";
import { createPlatformOperationsSection } from "../dist/pages/platform-operations.js";

class FakeElement {
  constructor(tagName) {
    this.tagName = tagName.toUpperCase();
    this.children = [];
    this.dataset = {};
    this.listeners = new Map();
    this.disabled = false;
  }

  append(...children) {
    this.children.push(...children);
  }

  replaceChildren(...children) {
    this.children = [...children];
  }

  addEventListener(type, listener) {
    const listeners = this.listeners.get(type) ?? [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }

  dispatch(type) {
    for (const listener of this.listeners.get(type) ?? [])
      listener({ preventDefault() {} });
  }
}

function descendants(element) {
  return [element, ...element.children.flatMap(descendants)];
}

test("tenant status and plan changes are manual, versioned, and use fixed quotas", () => {
  const store = createPlatformOperationsStore();
  const initial = store.snapshot.tenants[0];
  assert.ok(initial);
  assert.equal(initial.status, "ACTIVE");
  assert.equal(initial.plan, "STANDARD");

  const result = store.updateTenant(initial.id, initial.version, {
    status: "SUSPENDED",
    plan: "BASIC",
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.record.status, "SUSPENDED");
  assert.equal(result.record.plan, "BASIC");
  assert.equal(result.record.staffSeatLimit, 12);
  assert.equal(result.record.storageLimitGb, 40);
  assert.deepEqual(result.record.history, [
    { version: 1, status: "ACTIVE", plan: "STANDARD" },
  ]);

  assert.deepEqual(
    store.updateTenant(initial.id, 1, { status: "ACTIVE", plan: "STANDARD" }),
    {
      ok: false,
      error: "VERSION_CONFLICT",
    },
  );
});

test("tenant changes reject non-preset plans and extra identity fields without mutation", () => {
  const store = createPlatformOperationsStore();
  const before = JSON.stringify(store.snapshot);
  const initial = store.snapshot.tenants[0];
  assert.ok(initial);

  assert.deepEqual(
    store.updateTenant(initial.id, initial.version, {
      status: "SUSPENDED",
      plan: "CUSTOM",
      studentName: "不应进入平台汇总",
    }),
    { ok: false, error: "INVALID_INPUT" },
  );
  assert.equal(JSON.stringify(store.snapshot), before);
});

test("support cases move through fixed manual statuses and reject stale versions", () => {
  const store = createPlatformOperationsStore();
  const initial = store.snapshot.supportCases[0];
  assert.ok(initial);
  assert.equal(initial.status, "OPEN");

  const result = store.updateSupportCase(
    initial.id,
    initial.version,
    "IN_PROGRESS",
  );
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.record.status, "IN_PROGRESS");
  assert.deepEqual(result.record.history, [{ version: 1, status: "OPEN" }]);
  assert.deepEqual(store.updateSupportCase(initial.id, 1, "CLOSED"), {
    ok: false,
    error: "VERSION_CONFLICT",
  });
});

test("platform summaries remain synthetic aggregates without student or contact detail", () => {
  const snapshot = createPlatformOperationsStore().snapshot;
  assert.equal(snapshot.tenants.length, 2);
  assert.equal(snapshot.supportCases.length, 2);
  assert.equal(snapshot.costSummary.estimatedMonthlyCents, 4800);
  assert.equal(snapshot.costSummary.isSynthetic, true);
  assert.equal(snapshot.securitySummary.deniedAccessEvents, 3);
  assert.equal("students" in snapshot, false);
  assert.doesNotMatch(
    JSON.stringify(snapshot),
    /studentName|phone|email|address|contact/iu,
  );
});

test("read-only platform page disables every control and ignores form submission", () => {
  const originalDocument = globalThis.document;
  globalThis.document = {
    createElement: (tagName) => new FakeElement(tagName),
  };

  try {
    const store = createPlatformOperationsStore();
    const before = JSON.stringify(store.snapshot);
    const section = createPlatformOperationsSection(store, false);
    const elements = descendants(section);
    const controls = elements.filter((element) =>
      ["SELECT", "BUTTON"].includes(element.tagName),
    );

    assert.ok(controls.length > 0);
    assert.ok(controls.every((control) => control.disabled));

    for (const form of elements.filter(
      (element) => element.tagName === "FORM",
    )) {
      form.dispatch("submit");
    }

    assert.equal(JSON.stringify(store.snapshot), before);
  } finally {
    globalThis.document = originalDocument;
  }
});

function platformFeesSnapshot(overrides = {}) {
  return {
    status: "READY",
    profile: "platform-admin",
    summary: {
      scope: "platform",
      synthetic: true,
      totalDocuments: 4,
      activeDocuments: 2,
      paidDocuments: 1,
      unavailableDocuments: 2,
      documentTypes: ["FEE_ITEM", "BILL"],
    },
    ledgerSummary: {
      scope: "platform",
      synthetic: true,
      entryCount: 4,
      countsByType: { CHARGE: 2, PAYMENT: 1, REFUND: 1 },
    },
    message: "平台身份只查看匿名数量。",
    ...overrides,
  };
}

function platformBusinessSource(overrides = {}) {
  return {
    fees: platformFeesSnapshot(),
    staffOperations: {
      workMaterials: [
        {
          id: "PRIVATE_MATERIAL_ID",
          staffId: "PRIVATE_STAFF_ID",
          status: "PENDING_REVIEW",
        },
        {
          id: "PRIVATE_MATERIAL_ID_2",
          staffId: "PRIVATE_STAFF_ID",
          status: "REVIEWED",
        },
      ],
      recruitmentLeads: [
        {
          id: "PRIVATE_LEAD_ID",
          alias: "PRIVATE_CANDIDATE",
          stage: "TO_CONTACT",
        },
        {
          id: "PRIVATE_LEAD_ID_2",
          alias: "PRIVATE_CANDIDATE_2",
          stage: "CONTACTED",
        },
      ],
    },
    credentials: [
      {
        id: "PRIVATE_CREDENTIAL_ID",
        staffName: "PRIVATE_STAFF_NAME",
        expiryStatus: "DUE_SOON",
      },
      {
        id: "PRIVATE_CREDENTIAL_ID_2",
        staffName: "PRIVATE_STAFF_NAME",
        expiryStatus: "EXPIRED",
      },
      {
        id: "PRIVATE_CREDENTIAL_ID_3",
        staffName: "PRIVATE_STAFF_NAME",
        expiryStatus: "VALID",
      },
    ],
    ...overrides,
  };
}

test("platform business summary shows anonymous counts and no record details", () => {
  const originalDocument = globalThis.document;
  globalThis.document = {
    createElement: (tagName) => new FakeElement(tagName),
  };

  try {
    const section = createPlatformOperationsSection(
      createPlatformOperationsStore(),
      false,
      platformBusinessSource(),
    );
    const rendered = descendants(section)
      .map((element) => element.textContent ?? "")
      .join(" ");

    assert.match(rendered, /费用资料：4 项/u);
    assert.match(rendered, /收费 2.*入账 1.*退款 1/u);
    assert.match(rendered, /工作材料：2 项.*待复核 1/u);
    assert.match(rendered, /证照：3 项.*30 天内到期 1.*已过期 1/u);
    assert.match(rendered, /招聘跟进：2 项.*待联系 1.*已沟通 1/u);
    assert.doesNotMatch(rendered, /PRIVATE_|99999|9876\.54/u);
  } finally {
    globalThis.document = originalDocument;
  }
});

test("platform business summary hides stale or non-platform fee counts", () => {
  const originalDocument = globalThis.document;
  globalThis.document = {
    createElement: (tagName) => new FakeElement(tagName),
  };

  try {
    const invalidSnapshots = [
      platformFeesSnapshot({ profile: "owner-east" }),
      platformFeesSnapshot({ status: "ERROR" }),
      platformFeesSnapshot({
        summary: {
          scope: "campus",
          synthetic: true,
          totalDocuments: 99999,
          activeDocuments: 99999,
          paidDocuments: 99999,
          unavailableDocuments: 0,
          amountTotal: 9876.54,
          amountCurrency: "CNY",
          documentTypes: ["FEE_ITEM"],
        },
      }),
    ];

    for (const fees of invalidSnapshots) {
      const section = createPlatformOperationsSection(
        createPlatformOperationsStore(),
        false,
        platformBusinessSource({ fees }),
      );
      const rendered = descendants(section)
        .map((element) => element.textContent ?? "")
        .join(" ");

      assert.match(rendered, /费用统计暂不可用.*重新进入可重试/u);
      assert.doesNotMatch(rendered, /99999|9876\.54|收费 2/u);
      assert.match(rendered, /工作材料：2 项/u);
    }
  } finally {
    globalThis.document = originalDocument;
  }
});
