"use client";

import { useEffect, useRef, useState } from "react";
import {
  ParentInviteConsentClient,
  type ConsentPurposeKey,
  type ParentConsentSnapshot,
  type ParentPrivacyRequestType,
} from "../../../../pages/parent-consent";
import styles from "./parent-binding-panel.module.css";

const initialSnapshot: ParentConsentSnapshot = {
  status: "CONNECTING",
  bindingStatus: "NONE",
  policies: [],
  consents: [],
  privacyRequests: [],
  message: "正在连接家长服务…",
};

const purposeLabels: Record<ConsentPurposeKey, string> = {
  CARE_RECORD: "成长记录",
  HEALTH_SUPPORT: "健康协作",
  LEARNING_SUPPORT: "学习摘要",
};

const requestTypes: readonly {
  readonly key: ParentPrivacyRequestType;
  readonly label: string;
}[] = [
  { key: "ACCESS", label: "查阅资料" },
  { key: "CORRECT", label: "更正资料" },
  { key: "COPY", label: "获取资料副本" },
  { key: "DELETE", label: "删除申请" },
];

const requestStatusLabels = {
  SUBMITTED: "等待负责人查看",
  IN_REVIEW: "负责人处理中",
  SIMULATED_COMPLETE: "本机处理流程已完成",
  WITHDRAWN: "已撤回",
} as const;

export function ParentBindingPanel() {
  const clientRef = useRef<ParentInviteConsentClient | null>(null);
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [busy, setBusy] = useState(false);
  const [grantConfirmations, setGrantConfirmations] = useState<
    Partial<Record<ConsentPurposeKey, boolean>>
  >({});
  const [revokeConfirmations, setRevokeConfirmations] = useState<Record<number, boolean>>({});
  const [releaseConfirmation, setReleaseConfirmation] = useState(false);

  useEffect(() => {
    const client = new ParentInviteConsentClient({ baseUrl: window.location.origin });
    clientRef.current = client;
    let active = true;
    void client.connect().then(() => {
      if (active) setSnapshot(client.snapshot);
    });
    return () => {
      active = false;
      client.disconnect();
      clientRef.current = null;
    };
  }, []);

  const perform = async (action: (client: ParentInviteConsentClient) => Promise<void>) => {
    const client = clientRef.current;
    if (!client || busy) return;
    setBusy(true);
    await action(client);
    setSnapshot(client.snapshot);
    setBusy(false);
  };

  const ready = snapshot.status === "READY" && !busy;

  return (
    <section
      aria-label="家长关系与授权服务"
      className={styles.panel}
      data-parent-binding-state={snapshot.status}
      data-binding-status={snapshot.bindingStatus}
    >
      <div className={styles.toolbar}>
        <p className={styles.status} data-parent-status role="status" aria-live="polite">
          {snapshot.message}
        </p>
        <button
          className={styles.secondaryButton}
          disabled={busy || snapshot.status === "CONNECTING"}
          id="parent-binding-refresh"
          onClick={() => void perform((client) => client.refresh())}
          type="button"
        >
          {busy ? "正在更新…" : "刷新状态"}
        </button>
      </div>

      {snapshot.status === "ERROR" ? (
        <div className={styles.stateCard} role="alert">
          <h2>暂时无法连接家长服务</h2>
          <p>请使用受邀账号登录，或稍后重新连接。</p>
          <a
            className={styles.primaryButton}
            data-parent-binding-login
            href="/web/login?next=%2Fweb%2Fparent%2Fbinding"
          >
            使用受邀账号登录
          </a>
          <button
            className={styles.primaryButton}
            disabled={busy}
            onClick={() => void perform((client) => client.connect())}
            type="button"
          >
            重新连接
          </button>
        </div>
      ) : snapshot.status !== "READY" ? (
        <p className={styles.stateCard}>正在载入本机关系状态…</p>
      ) : snapshot.bindingStatus === "NONE" ? (
        <div className={styles.stateCard}>
          <p className={styles.kicker}>关系状态 · 尚未申请</p>
          <h2>先提交监护关系申请</h2>
          <p>申请对象为虚构的“示例学生甲”。提交后由本机审核角色确认。</p>
          <button
            className={styles.primaryButton}
            data-parent-binding-submit
            disabled={!ready}
            onClick={() => void perform((client) => client.applyBinding())}
            type="button"
          >
            提交关系申请
          </button>
        </div>
      ) : snapshot.bindingStatus === "PENDING" ? (
        <div className={styles.stateCard}>
          <p className={styles.kicker}>关系状态 · 待审核</p>
          <h2>申请已提交，等待机构审核</h2>
          <p>审核通过后，本页才会显示固定用途和个人信息申请入口。</p>
          <p className={styles.syntheticNote}>示例学生甲 · 监护人 · 本机合成申请</p>
        </div>
      ) : snapshot.bindingStatus === "ENDED" && snapshot.relationship?.status === "RELEASED" ? (
        <div className={styles.stateCard} data-parent-relationship-released>
          <p className={styles.kicker}>关系状态 · 已解除</p>
          <h2>监护关系已结束</h2>
          <p>这项关系已在本机演示中解除。固定用途和个人信息申请入口已关闭。</p>
          <p className={styles.syntheticNote}>
            解除记录版本 {snapshot.relationship.version} · 示例数据
          </p>
          <button
            className={styles.primaryButton}
            data-parent-binding-submit
            disabled={!ready}
            onClick={() => void perform((client) => client.applyBinding())}
            type="button"
          >
            重新申请关系
          </button>
        </div>
      ) : snapshot.bindingStatus === "REJECTED" || snapshot.bindingStatus === "ENDED" ? (
        <div className={styles.stateCard}>
          <p className={styles.kicker}>
            关系状态 · {snapshot.bindingStatus === "REJECTED" ? "未通过" : "已结束"}
          </p>
          <h2>当前没有有效的监护关系</h2>
          <p>如需继续，请重新提交本机合成关系申请。</p>
          <button
            className={styles.primaryButton}
            data-parent-binding-submit
            disabled={!ready}
            onClick={() => void perform((client) => client.applyBinding())}
            type="button"
          >
            重新提交申请
          </button>
        </div>
      ) : (
        <>
          <div className={styles.stateCard}>
            <p className={styles.kicker}>关系状态 · 已审核</p>
            <h2>监护关系已确认</h2>
            <p>示例学生甲 · 监护人</p>
            <p className={styles.syntheticNote}>仅显示当前审核通过的本机合成关系。</p>
          </div>

          <div className={styles.releaseCard} data-parent-relationship-release>
            <p className={styles.kicker}>关系管理</p>
            <h2>解除监护关系</h2>
            <p>解除后将关闭本页的用途授权和个人信息申请入口。此操作只作用于本机合成数据。</p>
            <label className={styles.confirmation}>
              <input
                checked={releaseConfirmation}
                data-parent-relationship-release-confirm
                onChange={(event) => setReleaseConfirmation(event.currentTarget.checked)}
                type="checkbox"
              />
              <span>我确认解除示例学生甲的监护关系</span>
            </label>
            <button
              className={styles.secondaryButton}
              data-parent-relationship-release-submit
              disabled={
                !ready || !releaseConfirmation || snapshot.relationship?.status !== "ACTIVE"
              }
              onClick={() => void perform((client) => client.releaseRelationship(true))}
              type="button"
            >
              {busy ? "正在解除…" : "确认解除关系"}
            </button>
          </div>

          <section aria-labelledby="parent-consent-title" className={styles.section}>
            <div className={styles.sectionHeading}>
              <div>
                <p className={styles.kicker}>已审核关系可见</p>
                <h2 id="parent-consent-title">固定用途说明</h2>
              </div>
            </div>
            <div className={styles.cardGrid}>
              {snapshot.policies.map((policy) => {
                const index = snapshot.consents
                  .map((consent) => consent.purposeKey)
                  .lastIndexOf(policy.key);
                const consent = index >= 0 ? snapshot.consents[index] : undefined;
                const activeConsent = consent?.status === "ACTIVE";
                return (
                  <article
                    className={styles.itemCard}
                    data-parent-consent-key={policy.key}
                    data-consent-state={activeConsent ? "ACTIVE" : "INACTIVE"}
                    key={policy.key}
                  >
                    <p className={styles.kicker}>用途 · {policy.noticeVersion}</p>
                    <h3>{purposeLabels[policy.key]}</h3>
                    <p>{policy.necessity}</p>
                    <p className={styles.muted}>涉及示例资料：{policy.dataClasses.join("、")}</p>
                    <p className={styles.muted}>{policy.retentionNotice}</p>
                    {activeConsent && consent ? (
                      <>
                        <p className={styles.stateLabel}>
                          当前状态：已同意 · 版本 {consent.version}
                        </p>
                        <p className={styles.muted}>
                          期限 {consent.retentionDays} 天，至 {consent.retainUntil.slice(0, 10)}
                        </p>
                        <label className={styles.confirmation}>
                          <input
                            checked={revokeConfirmations[index] ?? false}
                            onChange={(event) => {
                              const checked = event.currentTarget.checked;
                              setRevokeConfirmations((current) => ({
                                ...current,
                                [index]: checked,
                              }));
                            }}
                            type="checkbox"
                          />
                          <span>我确认撤回本机演示授权</span>
                        </label>
                        <button
                          className={styles.secondaryButton}
                          disabled={!ready || !revokeConfirmations[index]}
                          onClick={() => void perform((client) => client.revoke(index, true))}
                          type="button"
                        >
                          撤回授权
                        </button>
                      </>
                    ) : (
                      <>
                        <label className={styles.confirmation}>
                          <input
                            checked={grantConfirmations[policy.key] ?? false}
                            data-parent-consent-confirm={policy.key}
                            onChange={(event) => {
                              const checked = event.currentTarget.checked;
                              setGrantConfirmations((current) => ({
                                ...current,
                                [policy.key]: checked,
                              }));
                            }}
                            type="checkbox"
                          />
                          <span>我已阅读并确认用途与本机演示期限</span>
                        </label>
                        <button
                          className={styles.primaryButton}
                          data-parent-consent-grant={policy.key}
                          disabled={!ready || !grantConfirmations[policy.key]}
                          onClick={() => void perform((client) => client.grant(policy.key, true))}
                          type="button"
                        >
                          确认并授权
                        </button>
                      </>
                    )}
                  </article>
                );
              })}
            </div>
          </section>

          <section aria-labelledby="parent-privacy-title" className={styles.section}>
            <div className={styles.sectionHeading}>
              <div>
                <p className={styles.kicker}>仅记录合成申请</p>
                <h2 id="parent-privacy-title">个人信息申请</h2>
              </div>
            </div>
            <p className={styles.muted}>
              申请仅进入本机审核队列。不会查阅、复制、更正或删除真实资料，dataChanged=false。
            </p>
            <div className={styles.requestList}>
              {requestTypes.map(({ key, label }) => {
                const request = [...snapshot.privacyRequests]
                  .reverse()
                  .find((item) => item.type === key);
                const canWithdraw =
                  request?.status === "SUBMITTED" || request?.status === "IN_REVIEW";
                const canSubmit =
                  !request ||
                  request.status === "WITHDRAWN" ||
                  request.status === "SIMULATED_COMPLETE";
                return (
                  <article
                    className={styles.requestRow}
                    data-parent-privacy-type={key}
                    data-request-state={request?.status ?? "NONE"}
                    key={key}
                  >
                    <div>
                      <h3>{label}</h3>
                      <p className={styles.muted}>
                        {request ? requestStatusLabels[request.status] : "尚未提交"}
                      </p>
                    </div>
                    {canWithdraw ? (
                      <button
                        className={styles.secondaryButton}
                        data-parent-privacy-withdraw={key}
                        disabled={!ready}
                        onClick={() =>
                          void perform((client) =>
                            client.withdrawPrivacyRequest(
                              request ? snapshot.privacyRequests.indexOf(request) : -1,
                            ),
                          )
                        }
                        type="button"
                      >
                        撤回申请
                      </button>
                    ) : (
                      <button
                        className={styles.secondaryButton}
                        data-parent-privacy-request={key}
                        disabled={!ready || !canSubmit}
                        onClick={() => void perform((client) => client.submitPrivacyRequest(key))}
                        type="button"
                      >
                        {request && !canSubmit ? "申请处理中" : "提交申请"}
                      </button>
                    )}
                  </article>
                );
              })}
            </div>
            <p className={styles.footnote}>
              本页面仅用于本机流程验证，不会处理真实账号或真实个人资料。
            </p>
          </section>
        </>
      )}
    </section>
  );
}
