import {
  PLATFORM_OPERATION_LABELS,
  PLATFORM_OPERATIONS_OPTIONS,
  type PlatformOperationsSnapshot,
  type PlatformTenantStatus,
  type PlatformPlan,
  type SupportCaseStatus,
} from "../local-synthetic/platform-operations.js";
import type { AdminFeesSnapshot } from "../local-review/fees.js";
import type { StaffCredential } from "../local-synthetic/staff-credentials.js";
import type { StaffOperationsSnapshot } from "../local-synthetic/staff-operations.js";

type PlatformOperationsStore = ReturnType<
  typeof import("../local-synthetic/platform-operations.js").createPlatformOperationsStore
>;

export type PlatformBusinessSource = {
  fees: AdminFeesSnapshot;
  staffOperations: StaffOperationsSnapshot;
  credentials: readonly Pick<StaffCredential, "expiryStatus">[];
};

type PlatformFeesCounts = {
  documents: number;
  activeDocuments: number;
  paidDocuments: number;
  unavailableDocuments: number;
  ledgerEntries: number;
  charges: number;
  payments: number;
  refunds: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(
  value: unknown,
  keys: readonly string[],
): value is Record<string, unknown> {
  return (
    isRecord(value) &&
    Object.keys(value).sort().join(",") === keys.slice().sort().join(",")
  );
}

function isCount(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function platformFeesCounts(
  snapshot: AdminFeesSnapshot,
): PlatformFeesCounts | null {
  const summary = snapshot.summary;
  const ledger = snapshot.ledgerSummary;
  const summaryKeys = [
    "activeDocuments",
    "documentTypes",
    "paidDocuments",
    "scope",
    "synthetic",
    "totalDocuments",
    "unavailableDocuments",
  ];
  const ledgerKeys = ["countsByType", "entryCount", "scope", "synthetic"];
  if (
    !["READY", "BUSY"].includes(snapshot.status) ||
    snapshot.profile !== "platform-admin" ||
    !hasExactKeys(summary, summaryKeys) ||
    !hasExactKeys(ledger, ledgerKeys) ||
    summary.scope !== "platform" ||
    summary.synthetic !== true ||
    ledger.scope !== "platform" ||
    ledger.synthetic !== true ||
    !Array.isArray(summary.documentTypes) ||
    ![
      summary.totalDocuments,
      summary.activeDocuments,
      summary.paidDocuments,
      summary.unavailableDocuments,
    ].every(isCount) ||
    summary.activeDocuments + summary.unavailableDocuments !==
      summary.totalDocuments ||
    summary.paidDocuments > summary.activeDocuments ||
    !hasExactKeys(ledger.countsByType, ["CHARGE", "PAYMENT", "REFUND"])
  )
    return null;

  const counts = ledger.countsByType;
  if (
    ![counts.CHARGE, counts.PAYMENT, counts.REFUND, ledger.entryCount].every(
      isCount,
    ) ||
    counts.CHARGE + counts.PAYMENT + counts.REFUND !== ledger.entryCount
  )
    return null;

  return {
    documents: summary.totalDocuments,
    activeDocuments: summary.activeDocuments,
    paidDocuments: summary.paidDocuments,
    unavailableDocuments: summary.unavailableDocuments,
    ledgerEntries: ledger.entryCount,
    charges: counts.CHARGE,
    payments: counts.PAYMENT,
    refunds: counts.REFUND,
  };
}
function node<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const item = document.createElement(tag);
  if (className) item.className = className;
  if (text !== undefined) item.textContent = text;
  return item;
}

function addSelect<T extends readonly (readonly [string, string])[]>(
  form: HTMLFormElement,
  labelText: string,
  name: string,
  options: T,
  selected: string,
  disabled: boolean,
): void {
  const label = node("label", "field", labelText);
  const select = node("select");
  select.name = name;
  select.required = true;
  select.disabled = disabled;
  for (const [value, text] of options) {
    const option = node("option", undefined, text);
    option.value = value;
    option.selected = value === selected;
    select.append(option);
  }
  label.append(select);
  form.append(label);
}

export function createPlatformOperationsSection(
  store: PlatformOperationsStore,
  editable: boolean,
  businessSource?: PlatformBusinessSource,
): HTMLElement {
  const section = node("section", "panel");
  section.dataset.platformOperations = "true";
  let message = editable
    ? "所有操作只更新当前页面中的合成资料。"
    : "当前为只读权限，不能修改平台运营资料。";

  const render = (): void => {
    const snapshot: PlatformOperationsSnapshot = store.snapshot;
    section.replaceChildren(
      node("h2", undefined, "平台运营概览"),
      node("p", "notice", "合成数据 · 本地演示 · 不展示学生、家长或员工明细"),
      node("p", "notice", message),
      node("h3", undefined, "匿名汇总"),
    );

    const summary = node("div", "actions");
    summary.append(
      node(
        "article",
        "panel",
        `成本估算：¥${(snapshot.costSummary.estimatedMonthlyCents / 100).toFixed(2)} · ${snapshot.costSummary.periodLabel}`,
      ),
      node(
        "article",
        "panel",
        `安全汇总：拒绝访问 ${snapshot.securitySummary.deniedAccessEvents} 次，待核对提醒 ${snapshot.securitySummary.unresolvedWarnings} 项 · ${snapshot.securitySummary.periodLabel}`,
      ),
    );
    section.append(summary);

    if (businessSource) {
      const fees = platformFeesCounts(businessSource.fees);
      const businessSummary = node("div", "actions");
      if (fees) {
        businessSummary.append(
          node(
            "article",
            "panel",
            `费用资料：${fees.documents} 项 · 可用 ${fees.activeDocuments} · 已记录入账 ${fees.paidDocuments} · 不可用 ${fees.unavailableDocuments}`,
          ),
          node(
            "article",
            "panel",
            `费用流水：${fees.ledgerEntries} 笔 · 收费 ${fees.charges} · 入账 ${fees.payments} · 退款 ${fees.refunds}`,
          ),
        );
      } else {
        const feeStatus = businessSource.fees.status;
        const feeMessage =
          feeStatus === "CONNECTING" || feeStatus === "IDLE"
            ? "费用统计正在连接本机服务…"
            : "费用统计暂不可用，数量已隐藏；离开后重新进入可重试。";
        businessSummary.append(node("article", "panel notice", feeMessage));
      }

      const workMaterials = businessSource.staffOperations.workMaterials;
      const recruitmentLeads = businessSource.staffOperations.recruitmentLeads;
      const credentials = businessSource.credentials;
      businessSummary.append(
        node(
          "article",
          "panel",
          `工作材料：${workMaterials.length} 项 · 待复核 ${workMaterials.filter((item) => item.status === "PENDING_REVIEW").length}`,
        ),
        node(
          "article",
          "panel",
          `证照：${credentials.length} 项 · 30 天内到期 ${credentials.filter((item) => item.expiryStatus === "DUE_SOON").length} · 已过期 ${credentials.filter((item) => item.expiryStatus === "EXPIRED").length}`,
        ),
        node(
          "article",
          "panel",
          `招聘跟进：${recruitmentLeads.length} 项 · 待联系 ${recruitmentLeads.filter((item) => item.stage === "TO_CONTACT").length} · 已沟通 ${recruitmentLeads.filter((item) => item.stage === "CONTACTED").length}`,
        ),
      );
      section.append(node("h3", undefined, "业务数量汇总"), businessSummary);
    }

    section.append(node("h3", undefined, "租户套餐与配额"));
    for (const tenant of snapshot.tenants) {
      const card = node("article", "panel");
      card.dataset.platformTenantId = tenant.id;
      card.append(
        node("h4", undefined, tenant.alias),
        node(
          "p",
          "summary",
          `${PLATFORM_OPERATION_LABELS.status[tenant.status]} · ${PLATFORM_OPERATION_LABELS.plan[tenant.plan]} · ${tenant.staffSeatLimit} 个员工席位 · ${tenant.storageLimitGb} GB 文件空间`,
        ),
      );
      const form = node("form", "actions");
      form.dataset.tenantUpdate = "true";
      form.dataset.version = String(tenant.version);
      addSelect(
        form,
        "租户状态",
        "status",
        PLATFORM_OPERATIONS_OPTIONS.status,
        tenant.status,
        !editable,
      );
      addSelect(
        form,
        "套餐与配额",
        "plan",
        PLATFORM_OPERATIONS_OPTIONS.plan,
        tenant.plan,
        !editable,
      );
      const save = node("button", "publish", "保存租户设置");
      save.type = "submit";
      save.disabled = !editable;
      form.append(save);
      form.addEventListener("submit", (event) => {
        event.preventDefault();
        if (!editable) return;
        const values = new FormData(form);
        const result = store.updateTenant(tenant.id, tenant.version, {
          status: String(values.get("status")) as PlatformTenantStatus,
          plan: String(values.get("plan")) as PlatformPlan,
        });
        message = result.ok
          ? "租户设置已在本机更新并记录版本。"
          : "资料未变更，请刷新后重试。";
        render();
      });
      card.append(
        form,
        node(
          "p",
          "notice",
          `版本 ${tenant.version} · 本地变更 ${tenant.history.length} 次`,
        ),
      );
      section.append(card);
    }

    section.append(node("h3", undefined, "支持事项"));
    for (const supportCase of snapshot.supportCases) {
      const tenant = snapshot.tenants.find((candidate) => candidate.id === supportCase.tenantId);
      const card = node("article", "panel");
      card.dataset.supportCaseId = supportCase.id;
      card.append(
        node("h4", undefined, supportCase.id),
        node("p", "summary", `所属机构：${tenant?.alias ?? "机构关联缺失"}`),
        node(
          "p",
          "summary",
          `${PLATFORM_OPERATION_LABELS.supportCategory[supportCase.category]} · ${PLATFORM_OPERATION_LABELS.priority[supportCase.priority]} · ${PLATFORM_OPERATION_LABELS.supportStatus[supportCase.status]}`,
        ),
      );
      const form = node("form", "actions");
      form.dataset.supportUpdate = "true";
      const select = node("select");
      select.name = "status";
      select.required = true;
      select.disabled = !editable;
      for (const [value, text] of PLATFORM_OPERATIONS_OPTIONS.supportStatus) {
        const option = node("option", undefined, text);
        option.value = value;
        option.selected = value === supportCase.status;
        select.append(option);
      }
      const label = node("label", "field", "处理阶段");
      label.append(select);
      form.append(label);
      const save = node("button", "save", "更新处理阶段");
      save.type = "submit";
      save.disabled = !editable;
      form.append(save);
      form.addEventListener("submit", (event) => {
        event.preventDefault();
        if (!editable) return;
        const status = new FormData(form).get("status");
        const result = store.updateSupportCase(
          supportCase.id,
          supportCase.version,
          String(status) as SupportCaseStatus,
        );
        message = result.ok
          ? "支持事项阶段已在本机更新。"
          : "资料未变更，请刷新后重试。";
        render();
      });
      card.append(
        form,
        node(
          "p",
          "notice",
          `版本 ${supportCase.version} · 本地变更 ${supportCase.history.length} 次`,
        ),
      );
      section.append(card);
    }
  };

  render();
  return section;
}
