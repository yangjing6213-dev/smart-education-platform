"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  createLocalStaffCredentialsTransport,
  isStaffCredentialProfile,
  STAFF_CREDENTIAL_CATEGORY_LABELS,
  STAFF_CREDENTIAL_PROFILE_OPTIONS,
  STAFF_CREDENTIAL_ROLE_LABELS,
  StaffCredentialsReviewClient,
  type CredentialCategory,
  type ResponsibleRole,
  type StaffCredentialProfile,
  type StaffCredentialRow,
  type StaffCredentialSnapshot,
} from "../../../local-review/staff-credentials-review";
import styles from "./staff-credentials.module.css";

const EMPTY: StaffCredentialSnapshot = {
  status: "IDLE",
  message: "请选择模拟负责人查看授权校区的资格材料。",
  profile: "owner-east",
  label: "",
  actorId: "",
  tenantId: "",
  campusId: "",
  actions: [],
  staff: [],
  records: [],
};

const EXPIRY_LABELS = {
  VALID: "有效",
  EXPIRING_SOON: "30 天内到期",
  EXPIRED: "已过期",
} as const;

const categoryOptions = Object.entries(STAFF_CREDENTIAL_CATEGORY_LABELS) as [
  CredentialCategory,
  string,
][];
const roleOptions = Object.entries(STAFF_CREDENTIAL_ROLE_LABELS) as [ResponsibleRole, string][];

export function StaffCredentialsPanel({ servicePort }: Readonly<{ servicePort: number }>) {
  const client = useMemo(
    () => new StaffCredentialsReviewClient(createLocalStaffCredentialsTransport(servicePort)),
    [servicePort],
  );
  const [snapshot, setSnapshot] = useState<StaffCredentialSnapshot>(EMPTY);
  const [profile, setProfile] = useState<StaffCredentialProfile>("owner-east");
  const [selectedStaffKey, setSelectedStaffKey] = useState("staff-0");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("正在连接本机资格材料服务…");
  const inFlight = useRef(false);

  useEffect(() => {
    let active = true;
    void client.connect("owner-east").then(() => {
      if (!active) return;
      setSnapshot(client.snapshot);
      setFeedback(client.snapshot.message);
    });
    return () => {
      active = false;
      client.disconnect();
    };
  }, [client]);

  const employees = snapshot.staff.filter((member) => member.status === "ACTIVE");
  const employeeByKey = new Map(employees.map((member, index) => [`staff-${index}`, member]));

  async function run(action: () => Promise<unknown>, successMessage: string) {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    try {
      await action();
      const next = client.snapshot;
      setSnapshot(next);
      setFeedback(next.status === "READY" ? successMessage : next.message);
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  function selectProfile(event: React.ChangeEvent<HTMLSelectElement>) {
    const nextProfile = event.currentTarget.value;
    if (!isStaffCredentialProfile(nextProfile) || inFlight.current) return;
    setProfile(nextProfile);
    setSelectedStaffKey("staff-0");
    void run(() => client.connect(nextProfile), "已切换负责人范围。");
  }

  function createCredential(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const staff = employeeByKey.get(selectedStaffKey);
    if (!staff) {
      setFeedback("当前校区没有可添加资格材料的在职模拟员工。");
      return;
    }
    const data = new FormData(event.currentTarget);
    const category = String(data.get("category")) as CredentialCategory;
    const issueDate = String(data.get("issueDate") ?? "");
    const expiryDate = String(data.get("expiryDate") ?? "");
    const responsibleRole = String(data.get("responsibleRole")) as ResponsibleRole;
    void run(
      () =>
        client.create({ staffId: staff.actorId, category, issueDate, expiryDate, responsibleRole }),
      "资格材料已新增。到期状态只作提醒。",
    );
    event.currentTarget.reset();
  }

  function updateCredential(event: FormEvent<HTMLFormElement>, row: StaffCredentialRow) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const issueDate = String(data.get("issueDate") ?? "");
    const expiryDate = String(data.get("expiryDate") ?? "");
    const responsibleRole = String(data.get("responsibleRole")) as ResponsibleRole;
    void run(
      () => client.update(row.id, row.version, { issueDate, expiryDate, responsibleRole }),
      "资格材料已更新。到期状态只作提醒。",
    );
  }

  const ready = snapshot.status === "READY";
  const canManage = ready && snapshot.actions.includes("membership:manage");
  const counts = {
    VALID: snapshot.records.filter((row) => row.expiryStatus === "VALID").length,
    EXPIRING_SOON: snapshot.records.filter((row) => row.expiryStatus === "EXPIRING_SOON").length,
    EXPIRED: snapshot.records.filter((row) => row.expiryStatus === "EXPIRED").length,
  };

  return (
    <section
      aria-busy={busy || snapshot.status === "CONNECTING"}
      aria-labelledby="staff-credentials-heading"
      className={styles.panel}
      data-staff-credentials-state={snapshot.status}
      data-staff-credentials-profile={snapshot.profile}
    >
      <div className={styles.toolbar}>
        <div>
          <p className={styles.eyebrow}>负责人管理 · 仅当前授权校区</p>
          <h2 id="staff-credentials-heading">资格材料与到期提醒</h2>
          <p>仅显示固定类别、日期和责任岗位，不收集证件号码或附件。</p>
        </div>
        <button
          className={styles.secondaryButton}
          data-credential-refresh
          disabled={busy || !ready}
          onClick={() => void run(() => client.refresh(), "资格材料已刷新。")}
          type="button"
        >
          刷新资料
        </button>
      </div>

      <div className={styles.profileRow}>
        <label htmlFor="staff-credentials-profile">当前负责人</label>
        <select
          disabled={busy}
          id="staff-credentials-profile"
          value={profile}
          onChange={selectProfile}
        >
          {STAFF_CREDENTIAL_PROFILE_OPTIONS.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      <p
        className={
          snapshot.status === "ERROR" || snapshot.status === "DENIED"
            ? styles.error
            : styles.message
        }
        role={snapshot.status === "ERROR" || snapshot.status === "DENIED" ? "alert" : "status"}
      >
        {feedback}
      </p>
      {ready ? (
        <p className={styles.scope}>当前身份：{snapshot.label} · 仅显示此身份可管理的校区资料</p>
      ) : null}

      {snapshot.status === "ERROR" || snapshot.status === "DENIED" ? (
        <div className={styles.stateCard}>
          <h3>暂时无法读取资格材料</h3>
          <p>已清空上次显示的记录。重新连接后再核对当前范围。</p>
          <button
            className={styles.primaryButton}
            data-credential-reconnect
            disabled={busy}
            onClick={() => void run(() => client.connect(profile), "资格材料已重新连接。")}
            type="button"
          >
            重新连接
          </button>
        </div>
      ) : ready && !canManage ? (
        <p className={styles.empty}>当前身份没有资格材料管理权限。</p>
      ) : ready && snapshot.staff.length === 0 ? (
        <p className={styles.empty}>当前授权校区暂无可管理的员工资料。</p>
      ) : ready ? (
        <>
          <div className={styles.counts} aria-label="资格有效状态数量">
            {Object.entries({ VALID: "有效", EXPIRING_SOON: "30 天内到期", EXPIRED: "已过期" }).map(
              ([key, label]) => (
                <div className={styles.count} key={key}>
                  <span>{label}</span>
                  <strong>{counts[key as keyof typeof counts]}</strong>
                </div>
              ),
            )}
          </div>

          {canManage ? (
            <form className={styles.createForm} data-credential-create onSubmit={createCredential}>
              <h3>新增资格材料</h3>
              <label>
                员工
                <select
                  data-credential-staff
                  disabled={busy || employees.length === 0}
                  onChange={(event) => setSelectedStaffKey(event.currentTarget.value)}
                  value={selectedStaffKey}
                >
                  {employees.map((member, index) => (
                    <option key={`staff-${index}`} value={`staff-${index}`}>
                      {member.label} · {member.role}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                材料类别
                <select
                  data-credential-category
                  defaultValue="TEACHING_QUALIFICATION"
                  name="category"
                >
                  {categoryOptions.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                签发日期
                <input data-credential-issue-date name="issueDate" required type="date" />
              </label>
              <label>
                到期日期
                <input data-credential-expiry-date name="expiryDate" required type="date" />
              </label>
              <label>
                责任岗位
                <select
                  data-credential-responsible-role
                  defaultValue="CAMPUS_OWNER"
                  name="responsibleRole"
                >
                  {roleOptions.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <button
                className={styles.primaryButton}
                disabled={busy || employees.length === 0}
                type="submit"
              >
                新增资格材料
              </button>
            </form>
          ) : null}

          <div className={styles.records}>
            {snapshot.records.map((row, index) => (
              <article className={styles.record} data-staff-credential-row={index} key={row.id}>
                <div className={styles.recordHeader}>
                  <div>
                    <p className={styles.eyebrow}>
                      {row.staffRole} · {STAFF_CREDENTIAL_CATEGORY_LABELS[row.category]}
                    </p>
                    <h3>{row.staffLabel}</h3>
                  </div>
                  <span className={styles.status} data-credential-status={row.expiryStatus}>
                    {EXPIRY_LABELS[row.expiryStatus]}
                  </span>
                </div>
                <dl className={styles.details}>
                  <div>
                    <dt>签发日期</dt>
                    <dd>{row.issueDate}</dd>
                  </div>
                  <div>
                    <dt>到期日期</dt>
                    <dd>{row.expiryDate}</dd>
                  </div>
                  <div>
                    <dt>责任岗位</dt>
                    <dd>{STAFF_CREDENTIAL_ROLE_LABELS[row.responsibleRole]}</dd>
                  </div>
                  <div>
                    <dt>记录版本</dt>
                    <dd>{row.version}</dd>
                  </div>
                </dl>
                <details className={styles.history} data-credential-history>
                  <summary>更新记录（{row.history.length}）</summary>
                  {row.history.length ? (
                    <ul>
                      {row.history.map((event) => (
                        <li key={`${event.version}-${event.updatedAt}`}>
                          {event.updatedAt.slice(0, 10)} · 版本 {event.version}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p>暂无修改记录。</p>
                  )}
                </details>
                {canManage ? (
                  <details className={styles.edit} data-credential-edit>
                    <summary>修改日期或责任岗位</summary>
                    <form onSubmit={(event) => updateCredential(event, row)}>
                      <label>
                        签发日期
                        <input defaultValue={row.issueDate} name="issueDate" required type="date" />
                      </label>
                      <label>
                        到期日期
                        <input
                          defaultValue={row.expiryDate}
                          name="expiryDate"
                          required
                          type="date"
                        />
                      </label>
                      <label>
                        责任岗位
                        <select defaultValue={row.responsibleRole} name="responsibleRole">
                          {roleOptions.map(([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <button className={styles.secondaryButton} disabled={busy} type="submit">
                        保存变更
                      </button>
                    </form>
                  </details>
                ) : null}
              </article>
            ))}
            {snapshot.records.length === 0 ? (
              <p className={styles.empty}>当前校区暂无资格材料。</p>
            ) : null}
          </div>
        </>
      ) : (
        <p className={styles.empty}>正在读取当前负责人的校区资料…</p>
      )}
    </section>
  );
}
