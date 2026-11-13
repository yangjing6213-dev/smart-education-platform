"use client";

import { useEffect, useMemo, useState } from "react";
import {
  isResourceReviewProfile,
  ResourceLibraryAdminClient,
  type ManagedResource,
  type ResourceLibraryAdminSnapshot,
  type ReviewProfile,
} from "../../../local-review/resource-library";
import styles from "./resources-panel.module.css";

const PROFILE_OPTIONS: ReadonlyArray<{ value: ReviewProfile; label: string }> = [
  { value: "owner-east", label: "东校区负责人" },
  { value: "owner-west", label: "西校区负责人" },
  { value: "platform-admin", label: "平台管理员（仅匿名汇总）" },
];

const EXPIRY_CHOICES = ["2026-10-31", "2026-12-31", "2027-03-31"] as const;
type ExpiryChoice = (typeof EXPIRY_CHOICES)[number];

function expiryChoice(value: string): ExpiryChoice | "" {
  return EXPIRY_CHOICES.find((choice) => choice === value) ?? "";
}

function statusLabel(resource: ManagedResource): string {
  if (resource.status === "REVOKED") return "已撤回";
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  return resource.expiresOn < today ? "已过期" : "已发布";
}

function sourceReviewLabel(resource: ManagedResource): string {
  switch (resource.learningSourceGovernance?.reviewStatus) {
    case "PENDING_REVIEW":
      return "待复核";
    case "APPROVED":
      return "已通过";
    case "RETURNED":
      return "已退回";
    default:
      return "未纳入学习资料";
  }
}

export function ResourcesPanel({ baseUrl }: Readonly<{ baseUrl: string }>) {
  const client = useMemo(
    () =>
      new ResourceLibraryAdminClient((input, init) => fetch(new URL(String(input), baseUrl), init)),
    [baseUrl],
  );
  const [snapshot, setSnapshot] = useState<ResourceLibraryAdminSnapshot>(client.snapshot);
  const [scopeDrafts, setScopeDrafts] = useState<Record<string, ManagedResource["scope"]>>({});
  const [expiryDrafts, setExpiryDrafts] = useState<Record<string, ExpiryChoice | "">>({});

  useEffect(() => {
    let active = true;
    void client.connect("owner-east").then(() => {
      if (active) setSnapshot(client.snapshot);
    });
    return () => {
      active = false;
      client.disconnect();
    };
  }, [client]);

  async function connect(profile: ReviewProfile) {
    const pending = client.connect(profile);
    setSnapshot(client.snapshot);
    await pending;
    setScopeDrafts({});
    setExpiryDrafts({});
    setSnapshot(client.snapshot);
  }

  async function refresh() {
    const pending = client.refresh();
    setSnapshot(client.snapshot);
    await pending;
    setSnapshot(client.snapshot);
  }

  async function save(resource: ManagedResource) {
    const scope = scopeDrafts[resource.id] ?? resource.scope;
    const expiresOn = expiryDrafts[resource.id] ?? expiryChoice(resource.expiresOn);
    if (!expiresOn) return;
    const pending = client.update(
      resource.id,
      resource.version,
      scope,
      expiresOn,
      resource.classId,
    );
    setSnapshot(client.snapshot);
    await pending;
    setSnapshot(client.snapshot);
  }

  async function revoke(resource: ManagedResource) {
    const pending = client.revoke(resource.id, resource.version);
    setSnapshot(client.snapshot);
    await pending;
    setSnapshot(client.snapshot);
  }

  async function reviewSource(resource: ManagedResource, action: "APPROVE" | "RETURN") {
    const pending = client.reviewSource(resource.id, resource.version, action);
    setSnapshot(client.snapshot);
    await pending;
    setSnapshot(client.snapshot);
  }

  const busy = snapshot.status === "BUSY" || snapshot.status === "CONNECTING";

  return (
    <section aria-labelledby="resources-title" className={styles.panel}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>机构管理 · 按授权校区查看</p>
          <h1 id="resources-title">资源管理</h1>
          <p>维护已发布资源的适用范围、有效期限和学习资料来源审核。</p>
          <span className={styles.syntheticBadge}>本机合成数据</span>
        </div>
        <label className={styles.profileField}>
          管理身份
          <select
            aria-label="管理身份"
            disabled={busy}
            onChange={(event) => {
              const profile = event.currentTarget.value;
              if (isResourceReviewProfile(profile)) void connect(profile);
            }}
            value={snapshot.profile ?? "owner-east"}
          >
            {PROFILE_OPTIONS.map(({ value, label }) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </header>

      <p aria-live="polite" className={styles.message} role="status">
        {snapshot.message}
      </p>

      {snapshot.summary ? (
        <section
          aria-labelledby="resource-summary-title"
          className={styles.card}
          data-resource-summary
        >
          <p className={styles.sectionEyebrow}>平台视图 · 匿名统计</p>
          <h2 id="resource-summary-title">资源匿名汇总</h2>
          <p className={styles.description}>此身份只能查看汇总数量，不提供资源正文或负责人信息。</p>
          <dl className={styles.summaryGrid}>
            <div>
              <dt>资源总数</dt>
              <dd>{snapshot.summary.total}</dd>
            </div>
            <div>
              <dt>当前有效</dt>
              <dd>{snapshot.summary.published}</dd>
            </div>
            <div>
              <dt>已过期</dt>
              <dd>{snapshot.summary.expired}</dd>
            </div>
            <div>
              <dt>已撤回</dt>
              <dd>{snapshot.summary.revoked}</dd>
            </div>
          </dl>
        </section>
      ) : (
        <section aria-label="资源列表" className={styles.management} data-resource-management>
          <div className={styles.sectionHeading}>
            <div>
              <p className={styles.sectionEyebrow}>当前授权范围</p>
              <h2>已发布资源</h2>
            </div>
            <button
              className={styles.secondaryButton}
              disabled={busy}
              onClick={() => void refresh()}
              type="button"
            >
              刷新资源
            </button>
          </div>

          {snapshot.actions.includes("resource:manage") && snapshot.resources.length > 0 ? (
            <div className={styles.resourceGrid}>
              {snapshot.resources.map((resource) => {
                const scope = scopeDrafts[resource.id] ?? resource.scope;
                const expiresOn = expiryDrafts[resource.id] ?? expiryChoice(resource.expiresOn);
                const sourceStatus = resource.learningSourceGovernance?.reviewStatus;
                const editable = resource.status === "PUBLISHED";
                return (
                  <article aria-label={resource.title} className={styles.card} key={resource.id}>
                    <div className={styles.resourceHeading}>
                      <div>
                        <p className={styles.sectionEyebrow}>
                          {resource.grade} · {resource.subject}
                        </p>
                        <h3>{resource.title}</h3>
                      </div>
                      <span className={styles.status}>{statusLabel(resource)}</span>
                    </div>
                    <p className={styles.description}>{resource.summary}</p>
                    <p className={styles.tags}>{resource.tags.join(" · ")}</p>
                    <p className={styles.version}>
                      第 {resource.version} 版 ·{" "}
                      {resource.scope === "CLASS" ? "当前班级" : "当前校区"} · 到期：
                      {resource.expiresOn}
                    </p>
                    <p className={styles.source}>来源：{resource.sourceLabel}</p>

                    {resource.learningSourceGovernance ? (
                      <div className={styles.reviewStatus}>
                        <span>合成资料集 · 来源审核</span>
                        <strong>{sourceReviewLabel(resource)}</strong>
                        {sourceStatus === "PENDING_REVIEW" ? (
                          <div className={styles.actions}>
                            <button
                              className={styles.primaryButton}
                              disabled={busy}
                              onClick={() => void reviewSource(resource, "APPROVE")}
                              type="button"
                            >
                              通过来源复核
                            </button>
                            <button
                              className={styles.secondaryButton}
                              disabled={busy}
                              onClick={() => void reviewSource(resource, "RETURN")}
                              type="button"
                            >
                              退回来源
                            </button>
                          </div>
                        ) : null}
                      </div>
                    ) : null}

                    {editable ? (
                      <div className={styles.form}>
                        <label className={styles.field}>
                          适用范围
                          <select
                            disabled={busy}
                            onChange={(event) => {
                              const nextScope = event.currentTarget
                                .value as ManagedResource["scope"];
                              setScopeDrafts((current) => ({
                                ...current,
                                [resource.id]: nextScope,
                              }));
                            }}
                            value={scope}
                          >
                            <option value="CAMPUS">当前校区</option>
                            <option value="CLASS">当前班级</option>
                          </select>
                        </label>
                        <label className={styles.field}>
                          到期日期
                          <select
                            disabled={busy}
                            onChange={(event) => {
                              const nextExpiry = expiryChoice(event.currentTarget.value);
                              setExpiryDrafts((current) => ({
                                ...current,
                                [resource.id]: nextExpiry,
                              }));
                            }}
                            value={expiresOn}
                          >
                            <option disabled value="">
                              请选择新的到期日期
                            </option>
                            {EXPIRY_CHOICES.map((date) => (
                              <option key={date} value={date}>
                                {date}
                              </option>
                            ))}
                          </select>
                        </label>
                        <div className={styles.actions}>
                          <button
                            className={styles.primaryButton}
                            disabled={busy || !expiresOn}
                            onClick={() => void save(resource)}
                            type="button"
                          >
                            保存设置
                          </button>
                          <button
                            className={styles.dangerButton}
                            disabled={busy}
                            onClick={() => void revoke(resource)}
                            type="button"
                          >
                            撤回资源
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p className={styles.revokedNote}>
                        已撤回的资源只保留状态记录，不能再次编辑。
                      </p>
                    )}
                  </article>
                );
              })}
            </div>
          ) : (
            <p className={styles.empty}>
              {snapshot.actions.includes("resource:manage")
                ? "当前校区没有可查看的资源。"
                : snapshot.message}
            </p>
          )}
        </section>
      )}
    </section>
  );
}
