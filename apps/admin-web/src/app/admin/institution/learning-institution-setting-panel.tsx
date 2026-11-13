"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  LearningInstitutionSettingAdminClient,
  type LearningInstitutionSettingSnapshot,
} from "../../../local-review/learning-institution-setting";
import styles from "./learning-institution-setting.module.css";

export function LearningInstitutionSettingPanel() {
  const client = useMemo(() => new LearningInstitutionSettingAdminClient(), []);
  const [snapshot, setSnapshot] = useState<LearningInstitutionSettingSnapshot>(client.snapshot);
  const load = useCallback(async () => {
    const pending = client.connect();
    setSnapshot(client.snapshot);
    await pending;
    setSnapshot(client.snapshot);
  }, [client]);

  useEffect(() => {
    void load();
    return () => client.disconnect();
  }, [client, load]);

  const setting = snapshot.setting;
  const busy = snapshot.status === "CONNECTING" || snapshot.status === "BUSY";
  return (
    <section
      aria-labelledby="learning-institution-setting-title"
      className={styles.panel}
      data-learning-institution-setting
      data-learning-institution-setting-state={snapshot.status}
    >
      <header className={styles.heading}>
        <div>
          <p className={styles.eyebrow}>校区设置</p>
          <h2 id="learning-institution-setting-title">机构学习辅助</h2>
          <p>设置本校区是否允许学习辅助。使用时仍需符合监护同意和家长监督要求。</p>
        </div>
        <span
          className={styles.badge}
          data-enabled={setting?.enabled ?? false}
          data-learning-institution-setting-status
        >
          {setting ? (setting.enabled ? "已开启" : "已关闭") : busy ? "读取中" : "尚未读取"}
        </span>
      </header>
      <p className={styles.message} role="status" aria-live="polite">
        {snapshot.message}
      </p>
      {setting && (snapshot.status === "READY" || snapshot.status === "BUSY") ? (
        <button
          aria-pressed={setting.enabled}
          className={styles.toggle}
          data-learning-institution-setting-toggle
          disabled={busy}
          onClick={() => {
            void client.setEnabled(!setting.enabled).then(() => setSnapshot(client.snapshot));
            setSnapshot(client.snapshot);
          }}
          type="button"
        >
          {busy ? "正在保存…" : setting.enabled ? "关闭学习辅助" : "开启学习辅助"}
        </button>
      ) : null}
      {snapshot.status === "UNAUTHENTICATED" ? (
        <a className={styles.toggle} href="/admin/login?next=%2Fadmin%2Finstitution">
          登录机构账号
        </a>
      ) : null}
      {!busy ? (
        <button className={styles.toggle} onClick={() => void load()} type="button">
          重新读取设置
        </button>
      ) : null}
      <p className={styles.note}>
        设置保存后会保留。正式练习入口尚未开放，当前开启设置不会自动启动学生练习。
      </p>
    </section>
  );
}
