"use client";

import { useEffect, useMemo, useState } from "react";
import {
  MealsInviteClient,
  type AdminMealPayload,
  type AdminMealRecord,
  type AdminMealType,
} from "./meals-invite-client";
import styles from "./meals-panel.module.css";

type MealDraft = {
  meal_date: string;
  meal_type: AdminMealType;
  items: string;
  notes: string;
};

const MEAL_TYPES: ReadonlyArray<{ value: AdminMealType; label: string }> = [
  { value: "BREAKFAST", label: "早餐" },
  { value: "LUNCH", label: "午餐" },
  { value: "SNACK", label: "加餐" },
  { value: "DINNER", label: "晚餐" },
];

const STATUS_LABEL: Readonly<Record<AdminMealRecord["status"], string>> = {
  DRAFT: "草稿",
  PUBLISHED: "已发布",
  UNPUBLISHED: "已下架",
};

function emptyDraft(): MealDraft {
  return { meal_date: "", meal_type: "LUNCH", items: "", notes: "" };
}

function mealDraft(record: AdminMealRecord): MealDraft {
  return {
    meal_date: record.meal_date,
    meal_type: record.meal_type,
    items: record.items.join("\n"),
    notes: record.notes,
  };
}

function payloadFrom(draft: MealDraft): AdminMealPayload | null {
  const items = draft.items
    .split(/\r?\n/u)
    .map((item) => item.trim())
    .filter(Boolean);
  if (
    !draft.meal_date ||
    items.length === 0 ||
    items.length > 12 ||
    items.some((item) => item.length > 120)
  )
    return null;
  return {
    meal_date: draft.meal_date,
    meal_type: draft.meal_type,
    items,
    notes: draft.notes.trim(),
  };
}

function typeLabel(type: AdminMealType): string {
  return MEAL_TYPES.find((item) => item.value === type)?.label ?? "餐食";
}

function errorMessage(error: unknown): string {
  const code = error instanceof Error ? error.message : "UNAVAILABLE";
  if (code === "VERSION_MISMATCH") return "这份餐食已被更新，请刷新后再继续。";
  if (code === "VALIDATION_FAILED") return "餐食内容未通过检查，请核对日期和菜品。";
  if (code === "CONFLICT_STATE") return "当前状态不能执行此操作，请先刷新餐食列表。";
  if (code === "UNAUTHENTICATED") return "请先使用机构邀请账号登录，再管理当前校区的餐食。";
  if (["FORBIDDEN", "FORBIDDEN_SCOPE", "NOT_FOUND", "NOT_FOUND_SCOPED"].includes(code))
    return "当前账号无权处理这份餐食，请检查所属校区和权限。";
  return "餐食服务暂不可用，请稍后刷新重试。";
}

export function MealsPanel() {
  const client = useMemo(() => new MealsInviteClient(), []);
  const [records, setRecords] = useState<readonly AdminMealRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<MealDraft>(emptyDraft);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(true);
  const [message, setMessage] = useState("正在读取当前校区的餐食…");
  const [error, setError] = useState("");

  const selected = records.find((record) => record.id === selectedId) ?? null;
  const hasUnsavedChanges =
    selected !== null &&
    (draft.meal_date !== selected.meal_date ||
      draft.meal_type !== selected.meal_type ||
      draft.items !== selected.items.join("\n") ||
      draft.notes !== selected.notes);
  const editable =
    client.canWrite &&
    (!selected || (selected.status !== "PUBLISHED" && selected.actions.includes("edit")));
  const canSave = ready && !busy && editable && Boolean(payloadFrom(draft));
  const canPublish =
    ready &&
    !busy &&
    !hasUnsavedChanges &&
    client.canPublish &&
    selected?.actions.includes("publish");
  const canUnpublish =
    ready && !busy && client.canPublish && selected?.actions.includes("unpublish");

  useEffect(() => {
    let active = true;
    void client
      .connect()
      .then((rows) => {
        if (!active) return;
        setRecords(rows);
        setReady(true);
        setMessage("已连接当前校区的餐食管理服务。");
      })
      .catch((reason: unknown) => {
        if (!active) return;
        setMessage("");
        setError(errorMessage(reason));
      })
      .finally(() => {
        if (active) setBusy(false);
      });
    return () => {
      active = false;
      client.disconnect();
    };
  }, [client]);

  function selectRecord(record: AdminMealRecord) {
    setSelectedId(record.id);
    setDraft(mealDraft(record));
    setError("");
    setMessage(
      `${typeLabel(record.meal_type)} · ${record.meal_date} · ${STATUS_LABEL[record.status]}`,
    );
  }

  function startNew() {
    setSelectedId(null);
    setDraft(emptyDraft());
    setError("");
    setMessage("填写日期、餐次和菜品后保存草稿。");
  }

  function replaceRecord(updated: AdminMealRecord) {
    setRecords((current) => [updated, ...current.filter((record) => record.id !== updated.id)]);
    setSelectedId(updated.id);
    setDraft(mealDraft(updated));
  }

  function fail(reason: unknown) {
    setError(errorMessage(reason));
    setMessage("");
    if (reason instanceof Error && reason.message === "VALIDATION_FAILED") return;
    setReady(false);
    if (
      reason instanceof Error &&
      ["UNAUTHENTICATED", "FORBIDDEN", "FORBIDDEN_SCOPE", "INVALID_API_RESPONSE"].includes(
        reason.message,
      )
    ) {
      setRecords([]);
      setSelectedId(null);
      setDraft(emptyDraft());
    }
  }

  async function saveDraft() {
    if (!canSave) return;
    const payload = payloadFrom(draft);
    if (!payload) {
      setError("请选择日期，并至少填写一道菜品（最多 12 道）。");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const updated = selected
        ? await client.updateDraft(selected.id, selected.version, payload)
        : await client.createDraft(payload);
      replaceRecord(updated);
      setMessage("草稿已保存。");
    } catch (reason) {
      fail(reason);
    } finally {
      setBusy(false);
    }
  }

  async function changeStatus(action: "publish" | "unpublish") {
    if (!selected || (action === "publish" ? !canPublish : !canUnpublish)) return;
    setBusy(true);
    setError("");
    try {
      const updated =
        action === "publish"
          ? await client.publish(selected.id, selected.version)
          : await client.unpublish(selected.id, selected.version);
      replaceRecord(updated);
      setMessage(action === "publish" ? "餐食已发布。" : "餐食已下架，可继续修改。");
    } catch (reason) {
      fail(reason);
    } finally {
      setBusy(false);
    }
  }

  async function refresh() {
    if (busy) return;
    setBusy(true);
    setReady(false);
    setRecords([]);
    setDraft(emptyDraft());
    setError("");
    try {
      const rows = await client.connect();
      setRecords(rows);
      setReady(true);
      const current = rows.find((record) => record.id === selectedId) ?? null;
      if (current) setDraft(mealDraft(current));
      else {
        setSelectedId(null);
        setDraft(emptyDraft());
      }
      setMessage(`已刷新，共 ${rows.length} 份餐食。`);
    } catch (reason) {
      fail(reason);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="meals-title" className={styles.panel}>
      <header className={styles.header}>
        <p className={styles.eyebrow}>餐食管理 · 当前负责校区</p>
        <h1 id="meals-title">餐食内容管理</h1>
        <p>维护当前校区的每日菜单。已发布的菜单需先下架，再修改内容。</p>
        <span className={styles.syntheticBadge}>本机合成数据</span>
      </header>

      <div className={styles.workspace}>
        <section aria-labelledby="meal-list-title" className={styles.card}>
          <div className={styles.sectionHeader}>
            <div>
              <p className={styles.sectionEyebrow}>当前校区</p>
              <h2 id="meal-list-title">餐食列表</h2>
            </div>
            <div className={styles.toolbar}>
              <button
                className={styles.secondaryButton}
                disabled={busy}
                onClick={() => void refresh()}
                type="button"
              >
                刷新餐食
              </button>
              <button
                className={styles.primaryButton}
                disabled={!ready || busy}
                onClick={startNew}
                type="button"
              >
                新建餐食
              </button>
            </div>
          </div>

          <p aria-live="polite" className={styles.message} role="status">
            {message}
          </p>
          {error ? (
            <p className={styles.error} role="alert">
              {error}
              {!ready ? <a href="/admin/login?next=%2Fadmin%2Fmeals">使用机构账号登录</a> : null}
            </p>
          ) : null}

          {records.length ? (
            <ul aria-label="餐食列表" className={styles.list}>
              {records.map((record) => (
                <li className={styles.mealRow} key={record.id}>
                  <div className={styles.mealRowHeading}>
                    <div>
                      <p className={styles.rowDate}>
                        {record.meal_date} · {typeLabel(record.meal_type)}
                      </p>
                      <h3>{record.items.join("、")}</h3>
                    </div>
                    <span className={`${styles.status} ${styles[`status_${record.status}`]}`}>
                      {STATUS_LABEL[record.status]}
                    </span>
                  </div>
                  {record.notes ? <p className={styles.notes}>{record.notes}</p> : null}
                  <div className={styles.rowFooter}>
                    <span>版本 v{record.version}</span>
                    <button
                      className={styles.textButton}
                      disabled={busy || !ready}
                      onClick={() => selectRecord(record)}
                      type="button"
                    >
                      {record.status === "PUBLISHED" ? "查看" : "编辑"}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.empty}>当前校区暂无餐食记录，请新建一份草稿。</p>
          )}
        </section>

        <section aria-labelledby="meal-editor-title" className={styles.card}>
          <div className={styles.sectionHeader}>
            <div>
              <p className={styles.sectionEyebrow}>草稿与发布</p>
              <h2 id="meal-editor-title">{selected ? "编辑餐食" : "新建餐食"}</h2>
            </div>
            {selected ? (
              <span className={`${styles.status} ${styles[`status_${selected.status}`]}`}>
                {STATUS_LABEL[selected.status]} · v{selected.version}
              </span>
            ) : null}
          </div>

          <form
            className={styles.form}
            onSubmit={(event) => {
              event.preventDefault();
              void saveDraft();
            }}
          >
            <label className={styles.field}>
              日期
              <input
                aria-label="日期"
                disabled={!ready || busy || !editable}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, meal_date: event.target.value }))
                }
                required
                type="date"
                value={draft.meal_date}
              />
            </label>
            <label className={styles.field}>
              餐次
              <select
                aria-label="餐次"
                disabled={!ready || busy || !editable}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    meal_type: event.target.value as AdminMealType,
                  }))
                }
                value={draft.meal_type}
              >
                {MEAL_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.field}>
              菜品（每行一道）
              <textarea
                aria-label="菜品（每行一道）"
                disabled={!ready || busy || !editable}
                maxLength={500}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, items: event.target.value }))
                }
                placeholder="例如：模拟米饭\n模拟时蔬"
                required
                rows={4}
                value={draft.items}
              />
              <span className={styles.hint}>最多 12 道菜品，每道最多 120 字；每行填写一道。</span>
            </label>
            <label className={styles.field}>
              菜单说明
              <textarea
                aria-label="菜单说明"
                disabled={!ready || busy || !editable}
                maxLength={500}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, notes: event.target.value }))
                }
                rows={3}
                value={draft.notes}
              />
            </label>
            {hasUnsavedChanges ? (
              <p className={styles.hint}>内容已修改，请先保存草稿再发布。</p>
            ) : null}
            <div aria-label="餐食操作" className={styles.actions}>
              <button className={styles.primaryButton} disabled={!canSave} type="submit">
                保存草稿
              </button>
              <button
                className={styles.secondaryButton}
                disabled={!canPublish}
                onClick={() => void changeStatus("publish")}
                type="button"
              >
                发布
              </button>
              <button
                className={styles.secondaryButton}
                disabled={!canUnpublish}
                onClick={() => void changeStatus("unpublish")}
                type="button"
              >
                下架
              </button>
            </div>
          </form>
        </section>
      </div>

      <p className={styles.footnote}>
        本页仅处理当前账号负责校区的餐食。本次验证使用合成资料，不包含真实学生信息。
      </p>
    </section>
  );
}
