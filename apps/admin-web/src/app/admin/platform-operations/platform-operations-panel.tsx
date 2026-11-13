"use client";

import { useEffect, useState, type FormEvent } from "react";
import {
  PLATFORM_OPERATION_LABELS,
  PLATFORM_OPERATIONS_OPTIONS,
  createPlatformOperationsStore,
  type PlatformOperationsSnapshot,
  type PlatformPlan,
  type PlatformTenantStatus,
  type SupportCaseStatus,
} from "../../../local-synthetic/platform-operations";
import { createStaffCredentialStore } from "../../../local-synthetic/staff-credentials";
import { createStaffOperationsStore } from "../../../local-synthetic/staff-operations";
import styles from "./platform-operations.module.css";

export type PlatformOperationsMode = "AUTHORIZED" | "READ_ONLY" | "DENIED" | "CONFLICT";

type PlatformFeeSummary = {
  readonly scope: "platform";
  readonly synthetic: true;
  readonly totalDocuments: number;
  readonly activeDocuments: number;
  readonly paidDocuments: number;
  readonly unavailableDocuments: number;
  readonly documentTypes: readonly string[];
};

type PlatformFeeLedgerSummary = {
  readonly scope: "platform";
  readonly synthetic: true;
  readonly entryCount: number;
  readonly countsByType: Readonly<{ CHARGE: number; PAYMENT: number; REFUND: number }>;
};

type PlatformFeesSnapshot = {
  readonly status: "IDLE" | "CONNECTING" | "READY" | "ERROR";
  readonly profile: "platform-admin" | null;
  readonly summary: PlatformFeeSummary | null;
  readonly ledgerSummary: PlatformFeeLedgerSummary | null;
  readonly message: string;
};

const EMPTY_FEES: PlatformFeesSnapshot = {
  status: "IDLE",
  profile: null,
  summary: null,
  ledgerSummary: null,
  message: "费用汇总服务尚未连接。",
};

const SUMMARY_KEYS = [
  "activeDocuments",
  "documentTypes",
  "paidDocuments",
  "scope",
  "synthetic",
  "totalDocuments",
  "unavailableDocuments",
].join(",");
const LEDGER_KEYS = "countsByType,entryCount,scope,synthetic";
const DOCUMENT_TYPES = ["FEE_ITEM", "BILL", "RECEIPT", "AGREEMENT"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isCount(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) >= 0;
}

function parsePlatformFeeSummary(value: unknown): PlatformFeeSummary {
  if (!isRecord(value) || Object.keys(value).sort().join(",") !== SUMMARY_KEYS) {
    throw new Error("费用汇总内容无效。");
  }
  if (
    value.scope !== "platform" ||
    value.synthetic !== true ||
    !isCount(value.totalDocuments) ||
    !isCount(value.activeDocuments) ||
    !isCount(value.paidDocuments) ||
    !isCount(value.unavailableDocuments) ||
    value.activeDocuments + value.unavailableDocuments !== value.totalDocuments ||
    value.paidDocuments > value.activeDocuments ||
    !Array.isArray(value.documentTypes) ||
    !value.documentTypes.every((type) => DOCUMENT_TYPES.includes(String(type))) ||
    new Set(value.documentTypes).size !== value.documentTypes.length
  ) {
    throw new Error("费用汇总与平台匿名范围不一致。");
  }
  return value as PlatformFeeSummary;
}

function parsePlatformFeeLedgerSummary(value: unknown): PlatformFeeLedgerSummary {
  if (
    !isRecord(value) ||
    Object.keys(value).sort().join(",") !== LEDGER_KEYS ||
    !isRecord(value.countsByType) ||
    Object.keys(value.countsByType).sort().join(",") !== "CHARGE,PAYMENT,REFUND"
  ) {
    throw new Error("费用流水汇总内容无效。");
  }
  const counts = value.countsByType;
  if (
    value.scope !== "platform" ||
    value.synthetic !== true ||
    !isCount(value.entryCount) ||
    !isCount(counts.CHARGE) ||
    !isCount(counts.PAYMENT) ||
    !isCount(counts.REFUND) ||
    counts.CHARGE + counts.PAYMENT + counts.REFUND !== value.entryCount
  ) {
    throw new Error("费用流水汇总与平台匿名范围不一致。");
  }
  return value as PlatformFeeLedgerSummary;
}

async function connectPlatformFees(
  servicePort: number | null,
  signal: AbortSignal,
): Promise<PlatformFeesSnapshot> {
  if (
    !Number.isSafeInteger(servicePort) ||
    servicePort === null ||
    servicePort < 1 ||
    servicePort > 65535
  ) {
    throw new Error("本机汇总服务不可用。");
  }
  const origin = `http://127.0.0.1:${servicePort}`;
  const allowedPaths = new Set([
    "/local/sessions",
    "/local/session",
    "/local/fee-summary",
    "/local/fee-ledger-summary",
  ]);
  async function request(path: string, handle?: string, body?: object): Promise<unknown> {
    const url = new URL(path, origin);
    if (url.origin !== origin || !allowedPaths.has(url.pathname)) {
      throw new Error("费用汇总只允许访问本机合成服务。");
    }
    const headers = new Headers({ Accept: "application/json" });
    if (body) headers.set("Content-Type", "application/json");
    if (handle) headers.set("Authorization", `Bearer ${handle}`);
    const response = await fetch(url, {
      method: body ? "POST" : "GET",
      headers,
      ...(body ? { body: JSON.stringify(body) } : {}),
      cache: "no-store",
      redirect: "error",
      signal,
    });
    let result: unknown;
    try {
      result = await response.json();
    } catch {
      throw new Error("本机汇总服务返回内容无效。");
    }
    if (!response.ok) throw new Error("本机汇总服务暂不可用。");
    return result;
  }

  const created = await request("/local/sessions", undefined, { profile: "platform-admin" });
  if (
    !isRecord(created) ||
    typeof created.handle !== "string" ||
    !/^[A-Za-z0-9_-]{43}$/u.test(created.handle)
  ) {
    throw new Error("本机演示身份无效。");
  }
  const handle = created.handle;
  const session = await request("/local/session", handle);
  if (
    !isRecord(session) ||
    session.mode !== "local-synthetic" ||
    session.profile !== "platform-admin" ||
    typeof session.actorId !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(
      session.actorId,
    ) ||
    !Array.isArray(session.actions) ||
    !session.actions.every((action) => typeof action === "string")
  ) {
    throw new Error("本机演示身份没有对应的匿名汇总权限。");
  }
  const [summaryValue, ledgerValue] = await Promise.all([
    request("/local/fee-summary", handle),
    request("/local/fee-ledger-summary", handle),
  ]);
  return {
    status: "READY",
    profile: "platform-admin",
    summary: parsePlatformFeeSummary(summaryValue),
    ledgerSummary: parsePlatformFeeLedgerSummary(ledgerValue),
    message: "平台身份仅查看合成匿名数量，不显示金额或个人明细。",
  };
}

function feeSummaryIsSafe(snapshot: PlatformFeesSnapshot): boolean {
  return (
    snapshot.status === "READY" &&
    snapshot.profile === "platform-admin" &&
    snapshot.summary?.scope === "platform" &&
    snapshot.summary.synthetic === true &&
    snapshot.ledgerSummary?.scope === "platform" &&
    snapshot.ledgerSummary.synthetic === true
  );
}

function isEditable(mode: PlatformOperationsMode): boolean {
  return mode === "AUTHORIZED";
}

export function PlatformOperationsPanel({
  mode,
  servicePort,
}: Readonly<{ mode: PlatformOperationsMode; servicePort: number | null }>) {
  const [platformStore] = useState(() => createPlatformOperationsStore());
  const [platform, setPlatform] = useState<PlatformOperationsSnapshot>(
    () => platformStore.snapshot,
  );
  const [staffOperations] = useState(() => createStaffOperationsStore().snapshot);
  const [credentials] = useState(() => createStaffCredentialStore().list());
  const [fees, setFees] = useState<PlatformFeesSnapshot>(EMPTY_FEES);
  const [message, setMessage] = useState("可在本机模拟环境中调整固定选项。");

  useEffect(() => {
    if (mode === "DENIED") return;
    const controller = new AbortController();
    let active = true;
    setFees({
      ...EMPTY_FEES,
      status: "CONNECTING",
      profile: "platform-admin",
      message: "正在连接本机合成服务…",
    });
    void connectPlatformFees(servicePort, controller.signal)
      .then((snapshot) => {
        if (active) setFees(snapshot);
      })
      .catch(() => {
        if (active) {
          setFees({
            ...EMPTY_FEES,
            status: "ERROR",
            profile: "platform-admin",
            message: "本机费用汇总暂不可用，已隐藏数据。",
          });
        }
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [servicePort, mode]);

  function saveTenant(event: FormEvent<HTMLFormElement>, tenantId: string, version: number) {
    event.preventDefault();
    if (!isEditable(mode)) return;
    const values = new FormData(event.currentTarget);
    const result = platformStore.updateTenant(tenantId, version, {
      status: String(values.get("status")) as PlatformTenantStatus,
      plan: String(values.get("plan")) as PlatformPlan,
    });
    setMessage(
      result.ok
        ? "租户设置已更新；员工席位与文件空间按套餐自动调整。"
        : "资料没有变更，请刷新后重试。",
    );
    setPlatform(platformStore.snapshot);
  }

  function saveSupportCase(event: FormEvent<HTMLFormElement>, caseId: string, version: number) {
    event.preventDefault();
    if (!isEditable(mode)) return;
    const values = new FormData(event.currentTarget);
    const result = platformStore.updateSupportCase(
      caseId,
      version,
      String(values.get("status")) as SupportCaseStatus,
    );
    setMessage(result.ok ? "支持事项阶段已更新。" : "资料没有变更，请刷新后重试。");
    setPlatform(platformStore.snapshot);
  }

  const editable = isEditable(mode);
  const denied = mode === "DENIED";

  return (
    <section
      aria-busy={fees.status === "CONNECTING"}
      aria-label="平台运营管理"
      className={styles.content}
      data-platform-operations
      data-platform-operations-mode={mode}
    >
      <p aria-live="polite" className={styles.feedback} role="status">
        {message}
      </p>
      {denied ? (
        <section
          aria-labelledby="platform-denied-heading"
          className={styles.stateCard}
          role="alert"
        >
          <h2 id="platform-denied-heading">当前演示身份没有查看权限</h2>
          <p>运营资料已隐藏。切换为有权限的本机演示身份后再查看。</p>
        </section>
      ) : (
        <>
          {mode !== "AUTHORIZED" ? (
            <p className={styles.modeNotice}>
              {mode === "READ_ONLY"
                ? "当前为只读演示，无法修改资料。"
                : "当前为冲突演示，修改已关闭。"}
            </p>
          ) : null}

          <section aria-labelledby="anonymous-summary-heading" className={styles.section}>
            <header className={styles.sectionHeader}>
              <div>
                <p className={styles.eyebrow}>只显示汇总，不包含个人明细</p>
                <h2 id="anonymous-summary-heading">匿名运营汇总</h2>
              </div>
              <span>合成资料</span>
            </header>
            <div className={styles.summaryGrid}>
              <article className={styles.summaryCard}>
                <span>月度成本估算</span>
                <strong>¥{(platform.costSummary.estimatedMonthlyCents / 100).toFixed(2)}</strong>
                <small>{platform.costSummary.periodLabel}</small>
              </article>
              <article className={styles.summaryCard}>
                <span>安全事件汇总</span>
                <strong>{platform.securitySummary.deniedAccessEvents} 次访问已拒绝</strong>
                <small>
                  {platform.securitySummary.unresolvedWarnings} 项提醒待核对 ·{" "}
                  {platform.securitySummary.periodLabel}
                </small>
              </article>
            </div>
            <div
              className={styles.businessGrid}
              data-platform-fee-status={fees.status}
              aria-label="匿名业务数量汇总"
            >
              {feeSummaryIsSafe(fees) ? (
                <>
                  <article className={styles.businessCard}>
                    费用资料：{fees.summary?.totalDocuments ?? 0} 项 · 可用{" "}
                    {fees.summary?.activeDocuments ?? 0} · 已入账 {fees.summary?.paidDocuments ?? 0}{" "}
                    · 不可用 {fees.summary?.unavailableDocuments ?? 0}
                  </article>
                  <article className={styles.businessCard}>
                    费用流水：{fees.ledgerSummary?.entryCount ?? 0} 笔 · 收费{" "}
                    {fees.ledgerSummary?.countsByType.CHARGE ?? 0} · 入账{" "}
                    {fees.ledgerSummary?.countsByType.PAYMENT ?? 0} · 退款{" "}
                    {fees.ledgerSummary?.countsByType.REFUND ?? 0}
                  </article>
                </>
              ) : (
                <article className={styles.businessCard}>
                  费用汇总暂不可用；其他本机匿名示例仍可查看。
                </article>
              )}
              <article className={styles.businessCard}>
                工作材料：{staffOperations.workMaterials.length} 项 · 待复核{" "}
                {
                  staffOperations.workMaterials.filter((item) => item.status === "PENDING_REVIEW")
                    .length
                }
              </article>
              <article className={styles.businessCard}>
                资格：{credentials.length} 项 · 30 天内到期{" "}
                {credentials.filter((item) => item.expiryStatus === "DUE_SOON").length} · 已过期{" "}
                {credentials.filter((item) => item.expiryStatus === "EXPIRED").length}
              </article>
              <article className={styles.businessCard}>
                招聘跟进：{staffOperations.recruitmentLeads.length} 项 · 待联系{" "}
                {
                  staffOperations.recruitmentLeads.filter((item) => item.stage === "TO_CONTACT")
                    .length
                }{" "}
                · 已沟通{" "}
                {
                  staffOperations.recruitmentLeads.filter((item) => item.stage === "CONTACTED")
                    .length
                }
              </article>
            </div>
          </section>

          <section aria-labelledby="tenants-heading" className={styles.section}>
            <header className={styles.sectionHeader}>
              <div>
                <p className={styles.eyebrow}>固定套餐 · 自动配额</p>
                <h2 id="tenants-heading">租户套餐与配额</h2>
              </div>
              <span>{platform.tenants.length} 个模拟机构</span>
            </header>
            <div className={styles.recordGrid}>
              {platform.tenants.map((tenant, index) => (
                <article className={styles.recordCard} data-tenant-index={index} key={tenant.id}>
                  <div className={styles.recordHeading}>
                    <h3>{tenant.alias}</h3>
                    <span className={styles.status}>
                      {PLATFORM_OPERATION_LABELS.status[tenant.status]}
                    </span>
                  </div>
                  <p className={styles.quota}>
                    {PLATFORM_OPERATION_LABELS.plan[tenant.plan]} · {tenant.staffSeatLimit}{" "}
                    个员工席位 · {tenant.storageLimitGb} GB 文件空间
                  </p>
                  <form
                    className={styles.form}
                    onSubmit={(event) => saveTenant(event, tenant.id, tenant.version)}
                  >
                    <label>
                      租户状态
                      <select defaultValue={tenant.status} disabled={!editable} name="status">
                        {PLATFORM_OPERATIONS_OPTIONS.status.map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      套餐与配额
                      <select defaultValue={tenant.plan} disabled={!editable} name="plan">
                        {PLATFORM_OPERATIONS_OPTIONS.plan.map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button className={styles.primaryButton} disabled={!editable} type="submit">
                      保存租户设置
                    </button>
                  </form>
                  <p className={styles.history}>
                    版本 {tenant.version} · 本地变更 {tenant.history.length} 次
                  </p>
                </article>
              ))}
            </div>
          </section>

          <section aria-labelledby="support-heading" className={styles.section}>
            <header className={styles.sectionHeader}>
              <div>
                <p className={styles.eyebrow}>固定类别 · 手动更新阶段</p>
                <h2 id="support-heading">支持事项</h2>
              </div>
              <span>{platform.supportCases.length} 条模拟事项</span>
            </header>
            <div className={styles.recordGrid}>
              {platform.supportCases.map((supportCase, index) => {
                const tenant = platform.tenants.find((item) => item.id === supportCase.tenantId);
                return (
                  <article
                    className={styles.recordCard}
                    data-support-index={index}
                    key={supportCase.id}
                  >
                    <div className={styles.recordHeading}>
                      <h3>支持事项 {index + 1}</h3>
                      <span className={styles.status}>
                        {PLATFORM_OPERATION_LABELS.supportStatus[supportCase.status]}
                      </span>
                    </div>
                    <p className={styles.quota}>
                      {tenant?.alias ?? "机构关联缺失"} ·{" "}
                      {PLATFORM_OPERATION_LABELS.supportCategory[supportCase.category]} · 优先级
                      {PLATFORM_OPERATION_LABELS.priority[supportCase.priority]}
                    </p>
                    <form
                      className={styles.form}
                      onSubmit={(event) =>
                        saveSupportCase(event, supportCase.id, supportCase.version)
                      }
                    >
                      <label>
                        处理阶段
                        <select
                          defaultValue={supportCase.status}
                          disabled={!editable}
                          name="status"
                        >
                          {PLATFORM_OPERATIONS_OPTIONS.supportStatus.map(([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <button className={styles.secondaryButton} disabled={!editable} type="submit">
                        更新处理阶段
                      </button>
                    </form>
                    <p className={styles.history}>
                      版本 {supportCase.version} · 本地变更 {supportCase.history.length} 次
                    </p>
                  </article>
                );
              })}
            </div>
          </section>
        </>
      )}
    </section>
  );
}
