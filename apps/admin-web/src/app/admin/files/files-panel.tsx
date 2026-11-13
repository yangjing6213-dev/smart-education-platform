"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createLocalMediaTransport,
  MEDIA_ASSET_PROFILE_OPTIONS,
  MediaAssetsAdminClient,
  type MediaAssetRow,
  type MediaAssetsAdminSnapshot,
  type MediaAssetsProfile,
} from "../../../local-review/media-assets";
import styles from "./files.module.css";

const STATUS_LABEL: Record<MediaAssetRow["status"], string> = {
  AVAILABLE: "可用",
  REFERENCED: "已引用",
  EXPIRED: "已过期",
  ARCHIVED: "已归档",
  REVOKED: "已撤回",
  DELETED: "本机软删除",
};

const TYPE_LABEL: Record<MediaAssetRow["type"], string> = {
  IMAGE: "图片占位素材",
  DOCUMENT: "文档占位素材",
};

const ACTION_LABEL: Record<string, string> = {
  ACCESS_CHECK: "查看权限校验",
  REPLACE_REFERENCE: "更换引用",
  ARCHIVE: "归档",
  REVOKE: "撤回",
  SOFT_DELETE: "软删除标记",
};

const OUTCOME_LABEL: Record<string, string> = {
  ALLOWED: "允许",
  DENIED: "拒绝",
  SUCCESS: "完成",
  REFERENCE_CONFLICT: "仍有引用",
  CONFIRMATION_REQUIRED: "等待确认",
};

function summaryItems(snapshot: MediaAssetsAdminSnapshot) {
  if (!snapshot.summary) return [];
  return [
    ["合成素材总数", snapshot.summary.total],
    ["可用", snapshot.summary.available],
    ["已引用", snapshot.summary.referenced],
    ["已过期", snapshot.summary.expired],
    ["已归档", snapshot.summary.archived],
    ["已撤回", snapshot.summary.revoked],
    ["本机软删除", snapshot.summary.deleted],
  ] as const;
}

function profileLabel(profile: string): string {
  return (
    MEDIA_ASSET_PROFILE_OPTIONS.find(([value]) => value === profile)?.[1] ??
    "本机身份"
  );
}

export function FilesPanel({
  baseUrl,
  readOnly,
}: Readonly<{ baseUrl: string; readOnly: boolean }>) {
  const client = useMemo(
    () =>
      new MediaAssetsAdminClient(
        createLocalMediaTransport(4319, (input, init) =>
          fetch(new URL(String(input), baseUrl), init),
        ),
      ),
    [baseUrl],
  );
  const [selectedProfile, setSelectedProfile] =
    useState<MediaAssetsProfile>("owner-east");
  const [snapshot, setSnapshot] = useState<MediaAssetsAdminSnapshot>(
    client.snapshot,
  );
  const [targetAliases, setTargetAliases] = useState<Record<string, string>>(
    {},
  );
  const [confirmedRevocations, setConfirmedRevocations] = useState<
    Record<string, boolean>
  >({});

  const connect = useCallback(
    async (profile: MediaAssetsProfile) => {
      const pending = client.connect(profile);
      setSnapshot(client.snapshot);
      await pending;
      setSnapshot(client.snapshot);
    },
    [client],
  );

  useEffect(() => {
    void connect(selectedProfile);
    return () => client.disconnect();
  }, [client, connect, selectedProfile]);

  const run = useCallback(
    async (action: () => Promise<void>) => {
      const pending = action();
      setSnapshot(client.snapshot);
      await pending;
      setSnapshot(client.snapshot);
    },
    [client],
  );

  const refresh = useCallback(() => run(() => client.refresh()), [client, run]);
  const canManage =
    !readOnly &&
    snapshot.status === "READY" &&
    snapshot.actions.includes("media:manage");
  const canCheck =
    !readOnly &&
    snapshot.status === "READY" &&
    (snapshot.actions.includes("media:read") ||
      snapshot.actions.includes("media:manage"));
  const showAssets = snapshot.profile !== "platform-admin";

  return (
    <section
      className={styles.panel}
      data-media-assets
      data-media-assets-state={snapshot.status}
      aria-label="文件与引用管理"
    >
      <div className={styles.toolbar}>
        <label className={styles.profileField}>
          <span>本机演示身份</span>
          <select
            value={selectedProfile}
            onChange={(event) => {
              setSelectedProfile(
                event.currentTarget.value as MediaAssetsProfile,
              );
              setTargetAliases({});
              setConfirmedRevocations({});
            }}
          >
            {MEDIA_ASSET_PROFILE_OPTIONS.map(([profile, label]) => (
              <option key={profile} value={profile}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <button
          className={styles.secondaryButton}
          disabled={
            snapshot.status === "CONNECTING" || snapshot.status === "BUSY"
          }
          onClick={() => void refresh()}
          type="button"
        >
          刷新资料
        </button>
      </div>
      <p className={styles.status} role="status" aria-live="polite">
        {snapshot.message}
      </p>
      <p className={styles.scopeNote}>
        负责人只看到当前校区的资料，并且范围限定在当前租户；平台管理员只看匿名汇总。所有操作只改本机合成记录。
      </p>
      {readOnly ? (
        <p className={styles.readOnlyNote}>
          当前为只读查看，所有操作按钮已关闭。
        </p>
      ) : null}

      {snapshot.status === "READY" &&
      snapshot.profile === "platform-admin" &&
      snapshot.summary ? (
        <section
          className={styles.summary}
          aria-labelledby="media-summary-heading"
          data-media-anonymous-summary
        >
          <div className={styles.sectionHeading}>
            <div>
              <h2 id="media-summary-heading">匿名汇总</h2>
              <p>
                平台管理员只查看本机合成素材数量，不显示文件名称、校区、引用位置或个人资料。
              </p>
            </div>
          </div>
          <div className={styles.summaryGrid}>
            {summaryItems(snapshot).map(([label, value]) => (
              <article className={styles.metric} key={label}>
                <span>{label}</span>
                <strong>{value}</strong>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {snapshot.status === "READY" && showAssets ? (
        <>
          {snapshot.assets.length ? (
            <section className={styles.assetGrid} aria-label="本校区合成素材">
              {snapshot.assets.map((asset) => {
                const active = ["AVAILABLE", "REFERENCED", "EXPIRED"].includes(
                  asset.status,
                );
                const hasReferences = asset.references.length > 0;
                const selectedTarget = snapshot.assets.find(
                  ({ alias }) => alias === targetAliases[asset.alias],
                );
                const replacementTargets = snapshot.assets.filter(
                  (target) =>
                    target.alias !== asset.alias &&
                    target.type === asset.type &&
                    target.status === "AVAILABLE",
                );
                return (
                  <article
                    className={styles.assetCard}
                    data-media-asset-title={asset.title}
                    key={asset.alias}
                  >
                    <header className={styles.assetHeading}>
                      <div>
                        <p className={styles.assetType}>
                          {TYPE_LABEL[asset.type]}
                        </p>
                        <h2>{asset.title}</h2>
                      </div>
                      <span className={styles.badge}>
                        {STATUS_LABEL[asset.status]}
                      </span>
                    </header>
                    <p className={styles.assetMeta}>
                      有效期至 {asset.expiresOn} · 第 {asset.version} 版
                    </p>
                    <section
                      className={styles.references}
                      aria-label="当前引用"
                    >
                      <h3>当前引用</h3>
                      {hasReferences ? (
                        <ul>
                          {asset.references.map((reference) => (
                            <li key={reference.label}>{reference.label}</li>
                          ))}
                        </ul>
                      ) : (
                        <p>暂无引用</p>
                      )}
                    </section>
                    {asset.references.map((reference, index) => {
                      const selectId = `${asset.alias}-replacement-${index}`;
                      return (
                        <div
                          className={styles.replaceRow}
                          key={reference.label}
                        >
                          <label htmlFor={selectId}>
                            替换{reference.label}引用
                          </label>
                          <select
                            id={selectId}
                            aria-label={`替换${reference.label}引用`}
                            disabled={
                              !canManage || replacementTargets.length === 0
                            }
                            value={targetAliases[asset.alias] ?? ""}
                            onChange={(event) => {
                              const value = event.currentTarget.value;
                              setTargetAliases((current) => ({
                                ...current,
                                [asset.alias]: value,
                              }));
                            }}
                          >
                            <option value="">选择同类型可用素材</option>
                            {replacementTargets.map((target) => (
                              <option key={target.alias} value={target.alias}>
                                {target.title}
                              </option>
                            ))}
                          </select>
                          <button
                            className={styles.actionButton}
                            data-media-action="replace-reference"
                            disabled={!canManage || !selectedTarget}
                            onClick={() =>
                              selectedTarget &&
                              void run(() =>
                                client.replaceReference(
                                  asset.id,
                                  asset.version,
                                  reference.id,
                                  selectedTarget,
                                ),
                              )
                            }
                            type="button"
                          >
                            替换这处引用
                          </button>
                        </div>
                      );
                    })}
                    {hasReferences ? (
                      <label className={styles.confirmation}>
                        <input
                          checked={confirmedRevocations[asset.alias] ?? false}
                          disabled={!canManage}
                          onChange={(event) => {
                            const checked = event.currentTarget.checked;
                            setConfirmedRevocations((current) => ({
                              ...current,
                              [asset.alias]: checked,
                            }));
                          }}
                          type="checkbox"
                        />
                        确认撤回会影响仍引用此素材的页面
                      </label>
                    ) : null}
                    <div className={styles.actions}>
                      <button
                        className={styles.secondaryButton}
                        data-media-action="access-check"
                        disabled={!canCheck}
                        onClick={() =>
                          void run(() =>
                            client.checkAccess(asset.id, asset.version),
                          )
                        }
                        type="button"
                      >
                        校验查看权限
                      </button>
                      {asset.status === "AVAILABLE" ||
                      asset.status === "EXPIRED" ? (
                        <button
                          className={styles.secondaryButton}
                          data-media-action="archive"
                          disabled={!canManage || hasReferences}
                          onClick={() =>
                            void run(() =>
                              client.archive(asset.id, asset.version),
                            )
                          }
                          type="button"
                        >
                          归档
                        </button>
                      ) : null}
                      {active ? (
                        <button
                          className={styles.secondaryButton}
                          data-media-action="revoke"
                          disabled={
                            !canManage ||
                            (hasReferences &&
                              !confirmedRevocations[asset.alias])
                          }
                          onClick={() =>
                            void run(() =>
                              client.revoke(
                                asset.id,
                                asset.version,
                                confirmedRevocations[asset.alias] ?? false,
                              ),
                            )
                          }
                          type="button"
                        >
                          撤回素材
                        </button>
                      ) : null}
                      {asset.status === "ARCHIVED" ? (
                        <button
                          className={styles.secondaryButton}
                          data-media-action="soft-delete"
                          disabled={!canManage || hasReferences}
                          onClick={() =>
                            void run(() =>
                              client.softDelete(asset.id, asset.version),
                            )
                          }
                          type="button"
                        >
                          标记为软删除
                        </button>
                      ) : null}
                    </div>
                  </article>
                );
              })}
            </section>
          ) : (
            <p className={styles.empty}>当前授权校区暂无合成素材。</p>
          )}
          <section className={styles.events} aria-label="本机文件操作记录">
            <h2>本机操作记录</h2>
            <p>只记录合成代号、动作、结果和时间，不保存文件内容或地址。</p>
            {snapshot.events.length ? (
              <ul>
                {snapshot.events.map((event, index) => (
                  <li key={`${event.occurredAt}-${index}`}>
                    <time>{event.occurredAt}</time>
                    <span>{profileLabel(event.actorProfile)}</span>
                    <span>{ACTION_LABEL[event.action] ?? "文件操作"}</span>
                    <span>{OUTCOME_LABEL[event.outcome] ?? "已记录"}</span>
                    <span>{event.assetAlias}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p>暂无本机操作记录。</p>
            )}
          </section>
        </>
      ) : null}
    </section>
  );
}
