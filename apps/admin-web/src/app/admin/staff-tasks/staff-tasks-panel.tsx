"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  STAFF_TASK_CODES,
  STAFF_TASK_RESULTS,
  StaffTasksInviteClient,
  taskFormOptions,
  type AdminTaskSnapshot,
} from "./staff-tasks-client.ts";
import styles from "./staff-tasks.module.css";

const initialSnapshot: AdminTaskSnapshot = {
  status: "CONNECTING",
  session: null,
  tasks: [],
  review: [],
  choices: [],
  canAssign: false,
  message: "正在确认任务管理权限…",
  error: null,
};
const errorSnapshot: AdminTaskSnapshot = {
  ...initialSnapshot,
  status: "ERROR",
  message: "任务服务暂不可用，请重新连接。",
};
const statusLabels = {
  ASSIGNED: "待员工领取",
  CLAIMED: "员工已领取",
  IN_PROGRESS: "处理中",
  COMPLETED: "待负责人检查",
  CHECKED: "已验收",
  RETURNED: "已退回处理",
  CANCELLED: "已取消",
} as const;
const priorities = [
  ["NORMAL", "普通"],
  ["IMPORTANT", "重要"],
  ["URGENT", "紧急"],
] as const;
type Connection = { client: StaffTasksInviteClient; busy: boolean };

function createConnection(): Connection {
  return {
    client: new StaffTasksInviteClient(),
    busy: false,
  };
}

function visibleSnapshot(client: StaffTasksInviteClient): AdminTaskSnapshot {
  const next = client.snapshot;
  if (next.status === "ERROR") {
    client.disconnect();
    return { ...errorSnapshot, message: next.error ?? next.message };
  }
  return next.status === "READY"
    ? next
    : { ...initialSnapshot, status: next.status, message: next.message };
}

export function StaffTasksPanel() {
  const clientRef = useRef<Connection | null>(null);
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [listView, setListView] = useState<"all" | "review">("all");
  const [assigneeIndex, setAssigneeIndex] = useState(0);

  useEffect(() => {
    let disposed = false;
    const connect = async () => {
      let current: Connection | null = null;
      try {
        current = createConnection();
        current.busy = true;
        clientRef.current = current;
        setSnapshot(initialSnapshot);
        await current.client.connect();
        if (!disposed && clientRef.current === current)
          setSnapshot(visibleSnapshot(current.client));
      } catch {
        if (disposed || (current && clientRef.current !== current)) return;
        current?.client.disconnect();
        setSnapshot(errorSnapshot);
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

  const perform = async (action: (client: StaffTasksInviteClient) => Promise<void>) => {
    let current = clientRef.current;
    if (current?.busy) return;
    try {
      if (!current) {
        current = createConnection();
        clientRef.current = current;
      }
      current.busy = true;
      setAssigneeIndex(0);
      setSnapshot({ ...initialSnapshot, status: "BUSY", message: "正在更新任务资料…" });
      await action(current.client);
      if (clientRef.current === current) setSnapshot(visibleSnapshot(current.client));
    } catch {
      if (current && clientRef.current !== current) return;
      current?.client.disconnect();
      setSnapshot(errorSnapshot);
    } finally {
      if (current && clientRef.current === current) current.busy = false;
    }
  };

  const { assignees, targets } = taskFormOptions(snapshot.choices, assigneeIndex);
  const selectedAssignee = assignees[assigneeIndex];

  const submitForm = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (clientRef.current?.busy || snapshot.status !== "READY") return;
    const data = new FormData(event.currentTarget);
    const index = (name: string) => {
      const value = data.get(name);
      return typeof value === "string" && /^\d+$/u.test(value) ? Number(value) : -1;
    };
    const code = STAFF_TASK_CODES[index("code")];
    const assignee = assignees[index("assigneeId")];
    const target = targets[index("target")];
    const priority = priorities[index("priority")];
    const dueDate = data.get("dueDate");
    if (!code || !assignee || !target || !priority || typeof dueDate !== "string" || !dueDate) {
      setSnapshot({ ...snapshot, message: "请完整选择任务资料和截止日期。" });
      return;
    }
    setListView("all");
    void perform((client) =>
      client.create({
        code: code[0],
        assigneeRef: assignee.actorId,
        classRef: target.classRef,
        targetType: target.targetType,
        targetRef: target.targetRef,
        dueDate,
        priority: priority[0],
      }),
    );
  };

  const busy = snapshot.status === "CONNECTING" || snapshot.status === "BUSY";
  const rows = listView === "review" ? snapshot.review : snapshot.tasks;

  return (
    <section
      className={styles.panel}
      aria-label="任务分派与检查"
      aria-busy={busy}
      data-admin-task-state={snapshot.status}
    >
      <div className={styles.toolbar}>
        <p className={styles.message} role="status" aria-live="polite">
          {snapshot.message}
        </p>
        <button
          className={styles.secondaryButton}
          data-admin-task-refresh
          disabled={busy}
          onClick={() =>
            void perform((client) =>
              client.snapshot.status === "READY" ? client.refresh() : client.connect(),
            )
          }
          type="button"
        >
          {busy
            ? "正在更新…"
            : snapshot.status === "ERROR" || snapshot.status === "IDLE"
              ? "重新连接"
              : "刷新任务"}
        </button>
      </div>
      {["ERROR", "UNAUTHENTICATED", "FORBIDDEN"].includes(snapshot.status) ? (
        <div className={styles.stateCard} role="alert">
          <h2>暂时无法查看任务</h2>
          {snapshot.status === "UNAUTHENTICATED" ? (
            <Link href="/admin/login?next=%2Fadmin%2Fstaff-tasks" prefetch={false}>
              登录管理工作台
            </Link>
          ) : null}
          <p>之前显示的任务与选项已清除。请重新连接并核对当前任务状态，再决定下一步操作。</p>
        </div>
      ) : snapshot.status !== "READY" ? (
        <p className={styles.stateCard}>正在读取当前校区的任务和可分派选项…</p>
      ) : (
        <>
          {snapshot.canAssign ? (
            <form className={styles.form} data-admin-task-form onSubmit={submitForm}>
              <h2>分派新任务</h2>
              <p>选择经办员工和任务对象。分派后，员工可以在工作台领取并处理。</p>
              <div className={styles.fields}>
                <label htmlFor="admin-task-code">
                  任务类别
                  <select id="admin-task-code" name="code" defaultValue="0" required>
                    {STAFF_TASK_CODES.map(([, label], index) => (
                      <option key={index} value={index}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <label htmlFor="admin-task-assignee">
                  经办员工
                  <select
                    id="admin-task-assignee"
                    name="assigneeId"
                    value={assigneeIndex}
                    onChange={(event) => setAssigneeIndex(Number(event.currentTarget.value))}
                    disabled={assignees.length === 0}
                    required
                  >
                    {assignees.map((person, index) => (
                      <option key={person.actorId} value={index}>
                        {person.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label htmlFor="admin-task-target">
                  任务对象
                  <select
                    id="admin-task-target"
                    name="target"
                    key={assigneeIndex}
                    defaultValue="0"
                    disabled={targets.length === 0}
                    required
                  >
                    {targets.map((target, index) => (
                      <option key={index} value={index}>
                        {target.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label htmlFor="admin-task-date">
                  截止日期
                  <input id="admin-task-date" name="dueDate" type="date" required />
                </label>
                <label htmlFor="admin-task-priority">
                  优先级
                  <select id="admin-task-priority" name="priority" defaultValue="0" required>
                    {priorities.map(([, label], index) => (
                      <option key={index} value={index}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              {assignees.length === 0 ? (
                <p>当前没有可分派的员工。</p>
              ) : targets.length === 0 ? (
                <p>当前员工没有可分派的任务对象。</p>
              ) : null}
              <button
                className={styles.primaryButton}
                disabled={!selectedAssignee || targets.length === 0}
                type="submit"
              >
                分派任务
              </button>
            </form>
          ) : (
            <p className={styles.stateCard}>当前身份没有任务分派权限。</p>
          )}

          <div className={styles.listHeading}>
            <h2>当前校区任务</h2>
            <div className={styles.actions} aria-label="任务列表范围">
              <button
                className={styles.viewButton}
                data-admin-task-view="all"
                aria-pressed={listView === "all"}
                onClick={() => setListView("all")}
                type="button"
              >
                全部任务（{snapshot.tasks.length}）
              </button>
              <button
                className={styles.viewButton}
                data-admin-task-view="review"
                aria-pressed={listView === "review"}
                onClick={() => setListView("review")}
                type="button"
              >
                待检查（{snapshot.review.length}）
              </button>
            </div>
          </div>
          {rows.length === 0 ? (
            <p className={styles.stateCard}>
              {listView === "review" ? "当前没有待检查的任务。" : "当前校区还没有任务。"}
            </p>
          ) : (
            <div className={styles.list}>
              {rows.map((task, index) => {
                const canCheck = task.actions.includes("check");
                const canCancel = task.actions.includes("cancel");
                const result = STAFF_TASK_RESULTS.find(([code]) => code === task.result)?.[1];
                const resultLabel =
                  task.status === "COMPLETED" || task.status === "CHECKED"
                    ? "完成结果"
                    : task.status === "CANCELLED"
                      ? "取消前提交结果"
                      : "上次提交结果（本轮待重新提交）";
                return (
                  <article
                    className={styles.card}
                    data-admin-task-card={index}
                    data-admin-task-status={task.status}
                    key={task.id}
                  >
                    <div className={styles.cardHeading}>
                      <h3>{task.title}</h3>
                      <span className={styles.badge}>{statusLabels[task.status]}</span>
                    </div>
                    <dl className={styles.details}>
                      <div>
                        <dt>任务对象</dt>
                        <dd>{task.targetLabel}</dd>
                      </div>
                      <div>
                        <dt>经办员工</dt>
                        <dd>{task.assigneeLabel}</dd>
                      </div>
                      <div>
                        <dt>截止日期</dt>
                        <dd>
                          <time dateTime={task.dueDate}>{task.dueDate}</time>
                        </dd>
                      </div>
                      <div>
                        <dt>优先级</dt>
                        <dd>{priorities.find(([code]) => code === task.priority)?.[1]}</dd>
                      </div>
                      <div>
                        <dt>时效</dt>
                        <dd>{task.overdue ? "已逾期" : "未逾期"}</dd>
                      </div>
                      <div>
                        <dt>{result ? resultLabel : "完成结果"}</dt>
                        <dd>{result ?? "尚未提交"}</dd>
                      </div>
                    </dl>
                    {canCheck || canCancel ? (
                      <div className={styles.actions}>
                        {canCheck ? (
                          <>
                            <button
                              className={styles.primaryButton}
                              data-admin-task-action="confirm"
                              onClick={() =>
                                void perform((client) =>
                                  client.review(task.id, task.version, "CONFIRM"),
                                )
                              }
                              type="button"
                            >
                              验收通过
                            </button>
                            <button
                              className={styles.secondaryButton}
                              data-admin-task-action="return"
                              onClick={() =>
                                void perform((client) =>
                                  client.review(task.id, task.version, "RETURN"),
                                )
                              }
                              type="button"
                            >
                              退回处理
                            </button>
                          </>
                        ) : null}
                        {canCancel ? (
                          <button
                            className={styles.secondaryButton}
                            data-admin-task-action="cancel"
                            onClick={() =>
                              void perform((client) =>
                                client.review(task.id, task.version, "CANCEL"),
                              )
                            }
                            type="button"
                          >
                            取消任务
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>
          )}
        </>
      )}
    </section>
  );
}
