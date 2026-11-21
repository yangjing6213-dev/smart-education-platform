"use client";

import { useEffect, useRef, useState } from "react";
import { STAFF_TASK_RESULTS } from "../../../../local-synthetic/task-assignment";
import {
  InviteStaffTaskClient,
  type InviteStaffTaskSnapshot,
} from "../../../../local-synthetic/invite-staff-task-client";
import { InviteSessionClient } from "../../../../local-synthetic/invite-session";
import sharedStyles from "../../parent/binding/parent-binding-panel.module.css";
import styles from "../../parent/home/parent-home.module.css";
import workbenchStyles from "./staff-workbench.module.css";

const initialSnapshot: InviteStaffTaskSnapshot = {
  status: "CONNECTING",
  tasks: [],
  message: "正在核对受邀员工身份…",
};
const statusLabels = {
  ASSIGNED: "待领取",
  CLAIMED: "已领取",
  IN_PROGRESS: "处理中",
  COMPLETED: "待负责人检查",
  CHECKED: "已验收",
  RETURNED: "已退回",
  CANCELLED: "已取消",
} as const;
const priorityLabels = { NORMAL: "普通", IMPORTANT: "重要", URGENT: "紧急" } as const;
type Connection = { client: InviteStaffTaskClient; busy: boolean };

function createConnection(): Connection {
  const baseUrl = window.location.origin;
  return {
    client: new InviteStaffTaskClient({ baseUrl }),
    busy: false,
  };
}

function visibleSnapshot(client: InviteStaffTaskClient): InviteStaffTaskSnapshot {
  return client.snapshot;
}

export function StaffWorkbenchPanel() {
  const clientRef = useRef<Connection | null>(null);
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [services, setServices] = useState<string[]>([]);

  useEffect(() => {
    let disposed = false;
    const connect = async () => {
      let current: Connection | null = null;
      try {
        current = createConnection();
        current.busy = true;
        clientRef.current = current;
        await current.client.restore();
        if (!disposed && clientRef.current === current)
          setSnapshot(visibleSnapshot(current.client));
      } catch {
        if (disposed || (current && clientRef.current !== current)) return;
        current?.client.disconnect();
        setSnapshot({
          ...initialSnapshot,
          status: "ERROR",
          message: "工作任务暂时无法读取，请重试。",
        });
      } finally {
        if (current && clientRef.current === current) current.busy = false;
      }
    };
    void connect();
    return () => {
      disposed = true;
      const current = clientRef.current;
      clientRef.current = null;
      current?.client.disconnect();
    };
  }, []);

  useEffect(() => {
    let disposed = false;
    const invite = new InviteSessionClient({ baseUrl: window.location.origin });
    void invite.restore().then(() => {
      if (!disposed) setServices(invite.snapshot.services.map((service) => service.href));
      invite.disconnect();
    });
    return () => {
      disposed = true;
      invite.disconnect();
    };
  }, []);

  const perform = async (action: (client: InviteStaffTaskClient) => Promise<void>) => {
    let current = clientRef.current;
    if (current?.busy) return;
    try {
      if (!current) {
        current = createConnection();
        clientRef.current = current;
      }
      current.busy = true;
      setSnapshot({ ...initialSnapshot, status: "BUSY", message: "正在更新工作任务…" });
      await action(current.client);
      if (clientRef.current === current) setSnapshot(visibleSnapshot(current.client));
    } catch {
      if (current && clientRef.current !== current) return;
      current?.client.disconnect();
      setSnapshot({
        ...initialSnapshot,
        status: "ERROR",
        message: "工作任务暂时无法读取，请重试。",
      });
    } finally {
      if (current && clientRef.current === current) current.busy = false;
    }
  };

  const busy = snapshot.status === "CONNECTING" || snapshot.status === "BUSY";

  return (
    <section
      aria-labelledby="staff-workbench-title"
      aria-busy={busy}
      className={styles.panel}
      data-staff-workbench-state={snapshot.status}
    >
      <div className={styles.sectionHeading}>
        <p className={styles.kicker}>一步一步处理分配任务</p>
        <h2 id="staff-workbench-title">我的工作任务</h2>
        <p>只显示当前受邀账号在授权校区内可处理的任务。</p>
      </div>
      <div className={styles.toolbar}>
        <p className={styles.status} role="status" aria-live="polite">
          {snapshot.message}
        </p>
        {services.includes("/web/staff/binding") ? (
          <a
            className={`${sharedStyles.secondaryButton} ${styles.actionButton}`}
            href="/web/staff/binding"
          >
            审核家长关系申请
          </a>
        ) : null}
        {services.includes("/web/staff/care") ? (
          <a
            className={`${sharedStyles.secondaryButton} ${styles.actionButton}`}
            data-staff-care-entry
            href="/web/staff/care"
          >
            填写成长记录
          </a>
        ) : null}
        {services.includes("/web/staff/care-review") ? (
          <a
            className={`${sharedStyles.secondaryButton} ${styles.actionButton}`}
            data-staff-care-review-entry
            href="/web/staff/care-review"
          >
            审核成长记录
          </a>
        ) : null}
        {services.includes("/web/staff/daily") ? (
          <a
            className={`${sharedStyles.secondaryButton} ${styles.actionButton}`}
            data-staff-daily-entry
            href="/web/staff/daily"
          >
            填写工作日报
          </a>
        ) : null}
        {services.includes("/web/staff/monthly") ? (
          <a
            className={`${sharedStyles.secondaryButton} ${styles.actionButton}`}
            data-staff-monthly-entry
            href="/web/staff/monthly"
          >
            班级月度总结
          </a>
        ) : null}
        {services.includes("/web/staff/resources") && (
          <a className={sharedStyles.secondaryButton} href="/web/staff/resources">
            教学资源
          </a>
        )}
        {services.includes("/web/staff/guides") && (
          <a className={sharedStyles.secondaryButton} href="/web/staff/guides">
            新员工指南
          </a>
        )}
        {services.includes("/web/staff/pickup") ? (
          <a
            className={`${sharedStyles.secondaryButton} ${styles.actionButton}`}
            data-staff-pickup-entry
            href="/web/staff/pickup"
          >
            接送核验
          </a>
        ) : null}
        <button
          className={`${sharedStyles.secondaryButton} ${styles.actionButton}`}
          data-staff-workbench-refresh
          disabled={busy}
          onClick={() =>
            void perform((client) =>
              client.snapshot.status === "READY" ? client.refresh() : client.restore(),
            )
          }
          type="button"
        >
          {busy
            ? "正在更新…"
            : snapshot.status === "ERROR" ||
                snapshot.status === "IDLE" ||
                snapshot.status === "DENIED"
              ? "重新连接"
              : "刷新任务"}
        </button>
      </div>

      {snapshot.status === "ERROR" || snapshot.status === "DENIED" || snapshot.status === "IDLE" ? (
        <div className={styles.stateCard} role="alert">
          <h3>{snapshot.status === "IDLE" ? "请先登录" : "暂时无法查看工作任务"}</h3>
          <p>{snapshot.message}</p>
          {snapshot.status === "IDLE" ? (
            <a href="/web/login?next=%2Fweb%2Fstaff%2Fworkbench">使用受邀员工账号登录</a>
          ) : null}
        </div>
      ) : snapshot.status !== "READY" ? (
        <p className={styles.stateCard}>正在读取分配给你的工作任务…</p>
      ) : snapshot.tasks.length === 0 ? (
        <p className={styles.stateCard}>当前没有分配给你的任务。</p>
      ) : (
        <div className={styles.recordList}>
          {snapshot.tasks.map((task, index) => {
            const claim = task.actions.includes("claim");
            const start = task.actions.includes("start");
            const complete = task.actions.includes("complete");
            const resultLabel = STAFF_TASK_RESULTS.find(([value]) => value === task.result)?.[1];
            return (
              <article
                className={styles.recordCard}
                data-staff-workbench-task={index}
                data-staff-task-status={task.status}
                key={task.id}
              >
                <div className={styles.recordHeading}>
                  <h3>{task.title}</h3>
                  <span className={styles.receipt}>{statusLabels[task.status]}</span>
                </div>
                <dl className={styles.details}>
                  <div className={styles.detailItem}>
                    <dt>任务目标</dt>
                    <dd>{task.targetLabel}</dd>
                  </div>
                  <div className={styles.detailItem}>
                    <dt>截止日期</dt>
                    <dd>
                      <time dateTime={task.dueDate}>{task.dueDate}</time>
                    </dd>
                  </div>
                  <div className={styles.detailItem}>
                    <dt>优先级</dt>
                    <dd>{priorityLabels[task.priority]}</dd>
                  </div>
                  <div className={styles.detailItem}>
                    <dt>时效</dt>
                    <dd>{task.overdue ? "已逾期" : "未逾期"}</dd>
                  </div>
                  {resultLabel ? (
                    <div className={styles.detailItem}>
                      <dt>
                        {task.status === "COMPLETED" || task.status === "CHECKED"
                          ? "完成结果"
                          : task.status === "CANCELLED"
                            ? "取消前提交结果"
                            : "上次提交结果（本轮待重新提交）"}
                      </dt>
                      <dd>{resultLabel}</dd>
                    </div>
                  ) : null}
                </dl>
                {claim || start ? (
                  <div className={workbenchStyles.actions}>
                    {claim ? (
                      <button
                        className={`${sharedStyles.primaryButton} ${styles.actionButton}`}
                        data-staff-workbench-action="claim"
                        disabled={busy}
                        onClick={() =>
                          void perform((client) => client.command("claim", task.id, task.version))
                        }
                        type="button"
                      >
                        领取任务
                      </button>
                    ) : null}
                    {start ? (
                      <button
                        className={`${sharedStyles.primaryButton} ${styles.actionButton}`}
                        data-staff-workbench-action="start"
                        disabled={busy}
                        onClick={() =>
                          void perform((client) => client.command("start", task.id, task.version))
                        }
                        type="button"
                      >
                        开始任务
                      </button>
                    ) : null}
                  </div>
                ) : null}
                {complete ? (
                  <form
                    className={workbenchStyles.completionForm}
                    onSubmit={(event) => {
                      event.preventDefault();
                      const value = new FormData(event.currentTarget).get("result");
                      const result = STAFF_TASK_RESULTS.find(([code]) => code === value);
                      if (result)
                        void perform((client) =>
                          client.command("complete", task.id, task.version, result[0]),
                        );
                    }}
                  >
                    <label>
                      完成结果
                      <select
                        data-staff-workbench-result
                        defaultValue={STAFF_TASK_RESULTS[0][0]}
                        disabled={busy}
                        name="result"
                        required
                      >
                        {STAFF_TASK_RESULTS.map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button
                      className={`${sharedStyles.primaryButton} ${styles.actionButton}`}
                      data-staff-workbench-action="complete"
                      disabled={busy}
                      type="submit"
                    >
                      提交完成
                    </button>
                  </form>
                ) : null}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
