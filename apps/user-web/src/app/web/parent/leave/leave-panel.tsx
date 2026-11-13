"use client";

import { useEffect, useRef, useState } from "react";
import {
  LeaveClient,
  type LeaveInput,
  type LeaveRole,
  type LeaveSnapshot,
} from "../../../../local-synthetic/leave-client";
import sharedStyles from "../binding/parent-binding-panel.module.css";
import styles from "../home/parent-home.module.css";
import leaveStyles from "./leave-panel.module.css";

const initialSnapshot: LeaveSnapshot = {
  status: "IDLE",
  role: null,
  displayName: "",
  bindings: [],
  requests: [],
  message: "请使用项目提供的受邀账号登录。",
};
const initialInput: LeaveInput = {
  bindingId: "",
  startDate: "",
  endDate: "",
  reason: "FAMILY_ARRANGEMENT",
};
const reasonLabels = {
  FAMILY_ARRANGEMENT: "家庭安排",
  TEMPORARY_MATTER: "临时事务",
} as const;
const statusLabels = {
  SUBMITTED: "待审核",
  CONFIRMED: "已确认请假",
  RETURNED: "已退回，待修改",
  WITHDRAWN: "已撤回",
} as const;

export function LeavePanel({ role }: { readonly role: LeaveRole }) {
  const clientRef = useRef<{ client: LeaveClient; busy: boolean } | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [input, setInput] = useState(initialInput);
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    const client = new LeaveClient({ role, baseUrl: window.location.origin });
    const current = { client, busy: false };
    clientRef.current = current;
    const restore = client.restore();
    setSnapshot(client.snapshot);
    void restore.then(() => {
      if (clientRef.current === current) setSnapshot(client.snapshot);
    });
    return () => {
      if (clientRef.current === current) clientRef.current = null;
      client.disconnect();
    };
  }, [role]);

  const perform = async (action: (client: LeaveClient) => Promise<void>) => {
    const current = clientRef.current;
    if (!current || current.busy) return;
    current.busy = true;
    try {
      const work = action(current.client);
      setSnapshot(current.client.snapshot);
      await work;
      if (clientRef.current !== current) return;
      const next = current.client.snapshot;
      setSnapshot(next);
      setEditingId((id) =>
        next.status === "READY" &&
        next.requests.some((row) => row.id === id && row.status === "RETURNED")
          ? id
          : null,
      );
    } catch {
      if (clientRef.current !== current) return;
      setEditingId(null);
      const next = current.client.snapshot;
      setSnapshot(
        next.status === "IDLE" || next.status === "CONNECTING"
          ? { ...initialSnapshot, status: "ERROR", message: "本机请假服务暂不可用，请稍后重试。" }
          : next,
      );
    } finally {
      if (clientRef.current === current) current.busy = false;
    }
  };
  const updateInput = <Field extends keyof LeaveInput>(field: Field, value: LeaveInput[Field]) =>
    setInput((current) => ({ ...current, [field]: value }));
  const busy = snapshot.status === "CONNECTING" || snapshot.status === "BUSY";
  const editing = snapshot.requests.find(
    (row) => row.id === editingId && row.status === "RETURNED",
  );
  const selectedIndex = Math.max(
    0,
    snapshot.bindings.findIndex((row) => row.id === (editing?.bindingId ?? input.bindingId)),
  );
  const selectedBinding = snapshot.bindings[selectedIndex];
  const pending = snapshot.requests.filter((row) => row.status === "SUBMITTED").length;

  return (
    <section
      aria-labelledby={`leave-${role}-title`}
      aria-busy={busy}
      className={styles.panel}
      data-leave-role={role}
      data-leave-state={snapshot.status}
    >
      <div className={styles.sectionHeading}>
        <p className={styles.kicker}>
          {role === "parent" ? "与机构同步安排" : "负责班级 · 逐项核对"}
        </p>
        <h2 id={`leave-${role}-title`}>{role === "parent" ? "申请与处理结果" : "请假审核列表"}</h2>
        <p>
          {role === "parent"
            ? "提交后等待员工审核，处理结果需要单独确认知悉。"
            : "仅查看负责范围内的申请，确认或退回由员工逐项决定。"}
        </p>
      </div>
      <div className={styles.toolbar}>
        <p className={styles.status} role="status" aria-live="polite">
          {snapshot.role ? `${snapshot.displayName} · ${snapshot.message}` : snapshot.message}
        </p>
        {snapshot.role ? (
          <>
            <button
              className={`${sharedStyles.secondaryButton} ${styles.actionButton}`}
              data-leave-refresh
              disabled={busy}
              onClick={() => void perform((client) => client.refresh())}
              type="button"
            >
              {busy ? "正在更新…" : role === "parent" ? "刷新请假记录" : "刷新审核列表"}
            </button>
            <button
              className={`${sharedStyles.secondaryButton} ${styles.actionButton}`}
              data-leave-logout
              disabled={busy}
              onClick={() => void perform((client) => client.logout())}
              type="button"
            >
              退出登录
            </button>
          </>
        ) : null}
      </div>

      {snapshot.role === null ? (
        <div className={styles.stateCard}>
          <h3>{busy ? "正在核对账号" : "使用受邀账号进入服务"}</h3>
          <p>登录后，系统会核对当前账号的权限，再显示可以查看的请假记录。</p>
          {!busy ? (
            <a
              className={`${sharedStyles.primaryButton} ${styles.actionButton}`}
              data-leave-login-link
              href={`/web/login?next=${encodeURIComponent(role === "parent" ? "/web/parent/leave" : "/web/staff/leave")}`}
            >
              前往账号登录
            </a>
          ) : null}
        </div>
      ) : snapshot.status === "ERROR" || snapshot.status === "DENIED" ? (
        <div className={styles.stateCard} role="alert">
          <h3>暂时无法查看请假记录</h3>
          <p>已清除当前显示的申请和处理结果，请重新登录后核对当前状态。</p>
        </div>
      ) : snapshot.status !== "READY" ? (
        <p className={styles.stateCard}>正在读取当前可查看的请假记录…</p>
      ) : role === "parent" && snapshot.bindings.length === 0 ? (
        <div className={styles.stateCard}>
          <h3>尚无已审核的孩子关系</h3>
          <p>关系审核通过后，才能提交请假申请并查看相关结果。</p>
          <a className={sharedStyles.backLink} href="/web/parent/binding">
            查看关系绑定与授权
          </a>
        </div>
      ) : (
        <>
          {role === "parent" ? (
            <form
              className={styles.recordCard}
              data-leave-form
              ref={formRef}
              onSubmit={(event) => {
                event.preventDefault();
                if (!selectedBinding) return;
                const fields = {
                  startDate: input.startDate,
                  endDate: input.endDate,
                  reason: input.reason,
                };
                void perform((client) =>
                  editing
                    ? client.resubmit(editing.id, editing.version, fields)
                    : client.apply({ ...fields, bindingId: selectedBinding.id }),
                );
              }}
            >
              <div className={styles.recordHeading}>
                <h3>{editing ? "修改退回的申请" : "提交请假申请"}</h3>
              </div>
              <p className={styles.recordMeta}>
                可填写2026年至2029年的日期；起止日期最多相隔30天（含首尾共31日）。
                {editing ? "本次修改不能更换孩子。" : "提交后由负责员工审核。"}
              </p>
              <div className={leaveStyles.fields}>
                <label>
                  孩子
                  <select
                    disabled={!!editing}
                    name="bindingId"
                    onChange={(event) =>
                      updateInput(
                        "bindingId",
                        snapshot.bindings[Number(event.currentTarget.value)]?.id ?? "",
                      )
                    }
                    required
                    value={String(selectedIndex)}
                  >
                    {snapshot.bindings.map((binding, index) => (
                      <option key={binding.id} value={String(index)}>
                        {binding.studentLabel} · {binding.classLabel}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  请假原因
                  <select
                    name="reason"
                    onChange={(event) =>
                      updateInput("reason", event.currentTarget.value as LeaveInput["reason"])
                    }
                    required
                    value={input.reason}
                  >
                    <option value="FAMILY_ARRANGEMENT">家庭安排</option>
                    <option value="TEMPORARY_MATTER">临时事务</option>
                  </select>
                </label>
                <label>
                  开始日期
                  <input
                    name="startDate"
                    onChange={(event) => updateInput("startDate", event.currentTarget.value)}
                    required
                    type="date"
                    value={input.startDate}
                  />
                </label>
                <label>
                  结束日期
                  <input
                    name="endDate"
                    onChange={(event) => updateInput("endDate", event.currentTarget.value)}
                    required
                    type="date"
                    value={input.endDate}
                  />
                </label>
              </div>
              <div className={leaveStyles.actions}>
                <button
                  className={`${sharedStyles.primaryButton} ${styles.actionButton}`}
                  disabled={busy}
                  type="submit"
                >
                  {editing ? "修改并重新提交" : "提交请假申请"}
                </button>
                {editing ? (
                  <button
                    className={`${sharedStyles.secondaryButton} ${styles.actionButton}`}
                    data-leave-action="cancel-edit"
                    onClick={() => {
                      setEditingId(null);
                      setInput(initialInput);
                    }}
                    type="button"
                  >
                    取消编辑
                  </button>
                ) : null}
              </div>
            </form>
          ) : (
            <p className={styles.stateCard}>待审核：{pending} 项。仅待审核申请可确认或退回修改。</p>
          )}

          <section
            aria-label={role === "parent" ? "我的请假记录" : "班级请假记录"}
            className={styles.recordList}
          >
            {snapshot.requests.length === 0 ? (
              <p className={styles.stateCard}>当前没有可查看的请假记录。</p>
            ) : (
              snapshot.requests.map((row) => (
                <article
                  className={styles.recordCard}
                  data-leave-record
                  data-leave-status={row.status}
                  data-leave-acknowledged={row.acknowledged}
                  key={row.id}
                >
                  <div className={styles.recordHeading}>
                    <h3>{row.studentLabel}</h3>
                    <span className={styles.receipt}>{statusLabels[row.status]}</span>
                  </div>
                  <p className={styles.recordMeta}>
                    {role === "staff"
                      ? `班级：${row.classLabel} · 监护人：${row.guardianLabel}`
                      : `监护人：${row.guardianLabel}`}
                  </p>
                  <dl className={styles.details}>
                    <div className={styles.detailItem}>
                      <dt>请假日期</dt>
                      <dd>
                        <time dateTime={row.startDate}>{row.startDate}</time> 至{" "}
                        <time dateTime={row.endDate}>{row.endDate}</time>
                      </dd>
                    </div>
                    <div className={styles.detailItem}>
                      <dt>请假原因</dt>
                      <dd>{reasonLabels[row.reason]}</dd>
                    </div>
                  </dl>
                  {row.acknowledged ? (
                    <p className={styles.acknowledged}>家长已确认知悉</p>
                  ) : row.status === "CONFIRMED" || row.status === "RETURNED" ? (
                    <p className={styles.recordMeta}>等待家长确认知悉</p>
                  ) : null}
                  <div className={leaveStyles.actions}>
                    {role === "staff" && row.status === "SUBMITTED" ? (
                      <>
                        <button
                          className={`${sharedStyles.primaryButton} ${styles.actionButton}`}
                          data-leave-action="confirm"
                          disabled={busy}
                          onClick={() =>
                            void perform((client) => client.review(row.id, row.version, "confirm"))
                          }
                          type="button"
                        >
                          确认请假
                        </button>
                        <button
                          className={`${sharedStyles.secondaryButton} ${styles.actionButton}`}
                          data-leave-action="return"
                          disabled={busy}
                          onClick={() =>
                            void perform((client) => client.review(row.id, row.version, "return"))
                          }
                          type="button"
                        >
                          退回修改
                        </button>
                      </>
                    ) : null}
                    {role === "parent" && row.status === "RETURNED" ? (
                      <button
                        className={`${sharedStyles.primaryButton} ${styles.actionButton}`}
                        data-leave-action="edit"
                        disabled={busy}
                        onClick={() => {
                          setEditingId(row.id);
                          setInput({
                            bindingId: row.bindingId,
                            startDate: row.startDate,
                            endDate: row.endDate,
                            reason: row.reason,
                          });
                          formRef.current
                            ?.querySelector<HTMLInputElement>('input[name="startDate"]')
                            ?.focus();
                        }}
                        type="button"
                      >
                        修改并重新提交
                      </button>
                    ) : null}
                    {role === "parent" &&
                    (row.status === "SUBMITTED" || row.status === "RETURNED") ? (
                      <button
                        className={`${sharedStyles.secondaryButton} ${styles.actionButton}`}
                        data-leave-action="withdraw"
                        disabled={busy}
                        onClick={() => {
                          if (clientRef.current?.busy) return;
                          if (
                            window.confirm(
                              `确认撤回${row.studentLabel}在${row.startDate}至${row.endDate}的请假申请？`,
                            )
                          )
                            void perform((client) => client.withdraw(row.id, row.version));
                        }}
                        type="button"
                      >
                        撤回申请
                      </button>
                    ) : null}
                    {role === "parent" &&
                    (row.status === "CONFIRMED" || row.status === "RETURNED") &&
                    !row.acknowledged ? (
                      <button
                        className={`${sharedStyles.secondaryButton} ${styles.actionButton}`}
                        data-leave-action="acknowledge"
                        disabled={busy}
                        onClick={() =>
                          void perform((client) => client.acknowledge(row.id, row.version))
                        }
                        type="button"
                      >
                        确认知悉
                      </button>
                    ) : null}
                  </div>
                </article>
              ))
            )}
          </section>
        </>
      )}
    </section>
  );
}
