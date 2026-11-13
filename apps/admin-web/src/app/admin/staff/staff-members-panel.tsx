"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import {
  createLocalMembershipTransport,
  isMembershipManagementProfile,
  MembershipManagementClient,
} from "../../../local-review/membership-management";
import styles from "./staff-members.module.css";

type MembershipProfile = "owner-east" | "owner-west" | "owner-other-tenant";
type MembershipStatus = "ACTIVE" | "SUSPENDED" | "REVOKED";
type Snapshot = MembershipManagementClient["snapshot"];

const initialSnapshot: Snapshot = {
  status: "IDLE",
  message: "正在连接本机成员服务…",
  profile: "owner-east",
  label: "",
  actorId: "",
  tenantId: "",
  campusId: "",
  actions: [],
  memberships: [],
  events: [],
};

const profileOptions: readonly (readonly [MembershipProfile, string])[] = [
  ["owner-east", "模拟东校区负责人"],
  ["owner-west", "模拟西校区负责人"],
  ["owner-other-tenant", "模拟另一机构负责人"],
];

const statusLabels: Readonly<Record<MembershipStatus, string>> = {
  ACTIVE: "正常",
  SUSPENDED: "已停用",
  REVOKED: "已撤销",
};

function statusLabel(status: MembershipStatus): string {
  return statusLabels[status];
}

export function StaffMembersPanel({ servicePort }: Readonly<{ servicePort: number }>) {
  const clientRef = useRef<MembershipManagementClient | null>(null);
  const busyRef = useRef(false);
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [profile, setProfile] = useState<MembershipProfile>("owner-east");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const client = new MembershipManagementClient(createLocalMembershipTransport(servicePort));
    clientRef.current = client;
    busyRef.current = true;
    setBusy(true);
    const connecting = client.connect("owner-east");
    setSnapshot(client.snapshot);
    void connecting.finally(() => {
      if (clientRef.current !== client) return;
      busyRef.current = false;
      setBusy(false);
      setSnapshot(client.snapshot);
    });
    return () => {
      clientRef.current = null;
      busyRef.current = false;
      client.disconnect();
    };
  }, [servicePort]);

  function perform(operation: (client: MembershipManagementClient) => Promise<unknown>): void {
    const client = clientRef.current;
    if (!client || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    const pending = operation(client);
    setSnapshot(client.snapshot);
    void pending.finally(() => {
      if (clientRef.current !== client) return;
      busyRef.current = false;
      setBusy(false);
      setSnapshot(client.snapshot);
    });
  }

  function changeProfile(event: ChangeEvent<HTMLSelectElement>): void {
    const selected = event.currentTarget.value;
    if (busyRef.current || !isMembershipManagementProfile(selected)) return;
    setProfile(selected);
    perform((client) => client.connect(selected));
  }

  function changeStatus(actorId: string, status: MembershipStatus): void {
    if (status === "REVOKED" && !window.confirm("撤销后此示例成员无法再次登录，确定继续吗？"))
      return;
    perform((client) => client.setStatus(actorId, status));
  }

  const canManage = snapshot.actions.includes("membership:manage");
  const labelByActor = new Map(
    snapshot.memberships.map((member) => [member.actorId, member.label]),
  );

  return (
    <section
      className={styles.panel}
      data-staff-members-panel
      data-staff-members-state={snapshot.status}
      aria-busy={busy}
      aria-labelledby="staff-members-title"
    >
      <div className={styles.toolbar}>
        <div>
          <p className={styles.eyebrow}>成员管理 · 仅限当前身份的校区</p>
          <h2 id="staff-members-title">本校区员工</h2>
          <p>岗位与班级范围只供查看；状态变更会记录在本机示例服务中。</p>
        </div>
        <button
          className={styles.secondaryButton}
          data-staff-members-refresh
          disabled={busy || snapshot.status !== "READY"}
          onClick={() => perform((client) => client.refresh())}
          type="button"
        >
          刷新名单
        </button>
      </div>

      <div className={styles.profileRow}>
        <label htmlFor="staff-members-profile">当前管理身份</label>
        <select
          id="staff-members-profile"
          data-staff-members-profile
          value={profile}
          onChange={changeProfile}
          disabled={busy}
        >
          {profileOptions.map(([value, label]) => (
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
        {snapshot.message}
      </p>
      {snapshot.status === "READY" ? (
        <p className={styles.scope}>当前身份：{snapshot.label} · 只显示该身份获授权校区的员工</p>
      ) : null}

      {snapshot.status === "ERROR" || snapshot.status === "DENIED" ? (
        <div className={styles.stateCard}>
          <h3>暂时无法查看员工</h3>
          <p>名单已清空。请重新连接后核对当前校区的成员状态。</p>
          <button
            className={styles.primaryButton}
            data-staff-members-reconnect
            disabled={busy}
            onClick={() => perform((client) => client.connect(profile))}
            type="button"
          >
            重新连接
          </button>
        </div>
      ) : snapshot.status === "READY" && !canManage ? (
        <p className={styles.stateCard} role="status">
          当前身份没有员工成员管理权限。
        </p>
      ) : snapshot.status === "READY" && snapshot.memberships.length === 0 ? (
        <p className={styles.empty}>当前授权校区暂无可管理员工。</p>
      ) : snapshot.status === "READY" ? (
        <div className={styles.list} data-staff-members-list>
          {snapshot.memberships.map((member, index) => (
            <article
              className={styles.memberCard}
              data-staff-member-row={index}
              key={member.actorId}
            >
              <div className={styles.memberHeading}>
                <div>
                  <p className={styles.eyebrow}>本机合成成员</p>
                  <h3>{member.label}</h3>
                </div>
                <span className={styles.badge} data-staff-member-status={member.status}>
                  {statusLabel(member.status)}
                </span>
              </div>
              <dl className={styles.details}>
                <div>
                  <dt>岗位</dt>
                  <dd>{member.role}</dd>
                </div>
                <div>
                  <dt>校区范围</dt>
                  <dd>当前授权校区</dd>
                </div>
                <div>
                  <dt>班级范围</dt>
                  <dd>{member.classIds.length} 个授权班级</dd>
                </div>
              </dl>
              {canManage && member.status !== "REVOKED" ? (
                <div className={styles.actions}>
                  {member.status === "ACTIVE" ? (
                    <button
                      className={styles.secondaryButton}
                      data-staff-member-action="SUSPENDED"
                      disabled={busy}
                      onClick={() => changeStatus(member.actorId, "SUSPENDED")}
                      type="button"
                    >
                      停用
                    </button>
                  ) : (
                    <button
                      className={styles.secondaryButton}
                      data-staff-member-action="ACTIVE"
                      disabled={busy}
                      onClick={() => changeStatus(member.actorId, "ACTIVE")}
                      type="button"
                    >
                      恢复
                    </button>
                  )}
                  <button
                    className={styles.dangerButton}
                    data-staff-member-action="REVOKED"
                    disabled={busy}
                    onClick={() => changeStatus(member.actorId, "REVOKED")}
                    type="button"
                  >
                    撤销账号
                  </button>
                </div>
              ) : null}
            </article>
          ))}
        </div>
      ) : (
        <p className={styles.empty}>正在读取当前授权校区的员工名单…</p>
      )}

      {snapshot.status === "READY" ? (
        <section className={styles.history} aria-labelledby="staff-members-history-title">
          <h3 id="staff-members-history-title">成员状态记录</h3>
          {snapshot.events.length ? (
            <ul>
              {snapshot.events
                .slice()
                .reverse()
                .map((event, index) => (
                  <li data-staff-member-event={index} key={`${event.occurredAt}-${index}`}>
                    {labelByActor.get(event.targetActorId) ?? "成员"}：
                    {statusLabel(event.fromStatus)} → {statusLabel(event.toStatus)}
                  </li>
                ))}
            </ul>
          ) : (
            <p>暂无状态变更记录。</p>
          )}
        </section>
      ) : null}
      <p className={styles.footnote}>员工状态只影响本机合成数据，不会创建真实账号或发送通知。</p>
    </section>
  );
}
