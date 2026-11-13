import { Button, Picker, Text, View } from "@tarojs/components";
import Taro, { useDidHide, useDidShow, useUnload } from "@tarojs/taro";
import { useRef, useState } from "react";
import { inviteSession } from "../../../auth/runtime-session";
import { hasRoleAccess } from "../../../auth/role-gate";
import {
  STAFF_MONTHLY_FIELDS,
  createStaffMonthlyDraft,
  editStaffMonthlyDraft,
  loadStaffMonthlyReports,
  staffMonthlyValueLabel,
  submitStaffMonthlyDraft,
  type MonthlySupplements,
  type StaffMonthlyRecord,
} from "../../../monthly-feedback/staff-monthly";
import "./index.css";

type Session = typeof inviteSession.snapshot;
type ViewState = {
  status: "LOADING" | "READY" | "ERROR" | "DENIED";
  records: readonly StaffMonthlyRecord[];
  focusedRecordId?: string;
  canCreate: boolean;
  message: string;
};
type Form = { month: string; supplements: MonthlySupplements };
type Operation =
  | { action: "create"; form: Form }
  | { action: "edit"; record: StaffMonthlyRecord; form: Form }
  | { action: "submit"; record: StaffMonthlyRecord };
const statusLabels: Record<StaffMonthlyRecord["status"], string> = {
  DRAFT: "草稿",
  SUBMITTED: "待负责人审核",
  RETURNED: "退回修改",
  CONFIRMED: "已确认，待内部发布",
  PUBLISHED: "已内部发布",
  REVIEW_REQUIRED: "来源已变化，需重新核对",
};
function initialForm(): Form {
  const date = new Date();
  return {
    month: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`,
    supplements: {
      learningParticipation: "KEEP_WATCHING",
      dailyHabits: "KEEP_WATCHING",
      activityParticipation: "KEEP_WATCHING",
      familySchoolCollaboration: "KEEP_WATCHING",
    },
  };
}
function allowed(session: Session): boolean {
  return hasRoleAccess(session, "STAFF") && session.canReadMonthlyFeedback;
}
function statusCode(error: unknown): number {
  return typeof error === "object" && error !== null && "statusCode" in error
    ? Number(error.statusCode)
    : 0;
}
const empty: ViewState = {
  status: "LOADING",
  records: [],
  canCreate: false,
  message: "正在读取班级月度总结…",
};

export default function StaffMonthlyPage() {
  const [view, setView] = useState<ViewState>(empty);
  const [form, setForm] = useState<Form>(initialForm);
  const [editing, setEditing] = useState<StaffMonthlyRecord | null>(null);
  const viewRef = useRef(view);
  const formRef = useRef(form);
  const editingRef = useRef(editing);
  const context = useRef({ active: false, generation: 0, busy: false });
  const verified = useRef<Session | null>(null);
  const restoring = useRef<ReturnType<typeof inviteSession.restore> | null>(null);

  function updateView(next: ViewState) {
    viewRef.current = next;
    setView(next);
  }
  function updateForm(next: Form) {
    formRef.current = next;
    setForm(next);
  }
  function clearEditor(month?: string) {
    editingRef.current = null;
    setEditing(null);
    const next = initialForm();
    updateForm(month ? { ...next, month } : next);
  }
  function clearPage() {
    context.current.active = false;
    context.current.generation += 1;
    context.current.busy = false;
    verified.current = null;
    clearEditor();
    updateView(empty);
  }
  function deny(message: string) {
    verified.current = null;
    clearEditor();
    updateView({ status: "DENIED", records: [], canCreate: false, message });
  }
  useDidShow(() => {
    context.current.active = true;
    void perform();
  });
  useDidHide(clearPage);
  useUnload(clearPage);

  async function perform(operation?: Operation) {
    const state = context.current;
    if (!state.active || state.busy) return;
    if (operation) {
      if (
        !verified.current ||
        inviteSession.snapshot !== verified.current ||
        !allowed(verified.current)
      ) {
        deny("登录或权限已变化，请重新读取后操作。");
        return;
      }
      const current = viewRef.current;
      if (current.status !== "READY") return;
      if (operation.action === "create") {
        if (
          !current.canCreate ||
          editingRef.current ||
          current.records.some((row) => row.month === operation.form.month)
        )
          return;
      } else {
        const row = current.records.find(
          (record) =>
            record.id === operation.record.id && record.version === operation.record.version,
        );
        if (!row?.actions.includes(operation.action)) return;
        if (operation.action === "submit" && editingRef.current) return;
        if (operation.action === "edit" && editingRef.current?.id !== row.id) return;
      }
    }
    state.busy = true;
    const generation = ++state.generation;
    const isCurrent = () => state.active && state.generation === generation;
    const previousSession = verified.current;
    let session =
      previousSession && inviteSession.snapshot === previousSession && allowed(previousSession)
        ? previousSession
        : null;
    let focusedRecordId = session ? viewRef.current.focusedRecordId : undefined;
    const sameSession = () => {
      if (!isCurrent()) return false;
      if (session && inviteSession.snapshot === session && allowed(session)) return true;
      deny("登录或权限已变化，请重新读取后操作。");
      return false;
    };
    const chosenMonth =
      operation?.action === "submit" ? operation.record.month : formRef.current.month;
    clearEditor();
    updateView({ ...empty, message: operation ? "正在保存班级月度总结…" : empty.message });
    try {
      if (!session) {
        const pending = restoring.current ?? inviteSession.restore();
        restoring.current = pending;
        try {
          session = await pending;
        } finally {
          if (restoring.current === pending) restoring.current = null;
        }
      }
      if (!isCurrent() || !session) return;
      if (
        session.status === "CHECKING" ||
        session.status === "BUSY" ||
        session.status === "ERROR"
      ) {
        verified.current = null;
        updateView({ ...empty, status: "ERROR", message: "登录状态暂时无法读取，请稍后重试。" });
        return;
      }
      if (!allowed(session)) {
        deny("请使用具有班级月度总结权限的员工账号登录。");
        return;
      }
      if (!sameSession()) return;
      let message = "仅供员工内部使用，负责人审核和内部发布请在管理网页处理。";
      if (operation) {
        try {
          if (operation.action === "create") {
            const saved = await createStaffMonthlyDraft(
              (path, body) => inviteSession.postAuthenticated(path, body),
              operation.form.month,
              operation.form.supplements,
            );
            focusedRecordId = saved.id;
            message = "总结草稿已保存，请核对后提交负责人审核。";
          } else if (operation.action === "edit") {
            const saved = await editStaffMonthlyDraft(
              (path, body) => inviteSession.patchAuthenticated(path, body),
              operation.record.id,
              operation.record.version,
              operation.form.supplements,
            );
            focusedRecordId = saved.id;
            message = "修改已保存，请核对后提交负责人审核。";
          } else {
            const submitted = await submitStaffMonthlyDraft(
              (path, body) => inviteSession.postAuthenticated(path, body),
              operation.record.id,
              operation.record.version,
            );
            focusedRecordId = submitted.id;
            message = "已提交负责人审核。";
          }
        } catch (error) {
          if (statusCode(error) !== 409) throw error;
          focusedRecordId = operation.action === "create" ? undefined : operation.record.id;
          message = "本次操作未保存，记录或来源已变化，已刷新最新版本，请重新核对后操作。";
        }
        if (!sameSession()) return;
      }
      const listing = await loadStaffMonthlyReports((path) => inviteSession.getAuthenticated(path));
      if (!sameSession()) return;
      if (session === previousSession) updateForm({ ...formRef.current, month: chosenMonth });
      verified.current = session;
      updateView({
        ...listing,
        status: "READY",
        message,
        focusedRecordId: listing.records.find((row) => row.id === focusedRecordId)?.id,
      });
    } catch (error) {
      if (!isCurrent()) return;
      verified.current = null;
      clearEditor();
      const code = statusCode(error);
      updateView({
        status: [401, 403, 404].includes(code) ? "DENIED" : "ERROR",
        records: [],
        canCreate: false,
        message:
          code === 401
            ? "登录已过期，请重新登录。"
            : code === 403 || code === 404
              ? "总结或权限已变化，请重新读取或切换账号。"
              : "班级月度总结暂时无法读取或保存，请稍后重试。",
      });
    } finally {
      if (isCurrent()) state.busy = false;
    }
  }

  function startEditing(record: StaffMonthlyRecord) {
    if (
      context.current.busy ||
      viewRef.current.status !== "READY" ||
      !record.actions.includes("edit")
    )
      return;
    if (
      !verified.current ||
      inviteSession.snapshot !== verified.current ||
      !allowed(verified.current)
    ) {
      deny("登录或权限已变化，请重新读取后操作。");
      return;
    }
    editingRef.current = record;
    setEditing(record);
    updateForm({ month: record.month, supplements: { ...record.supplements } });
  }
  function save() {
    const record = editingRef.current;
    void perform(
      record
        ? { action: "edit", record, form: formRef.current }
        : { action: "create", form: formRef.current },
    );
  }
  function choose(key: keyof MonthlySupplements, rawIndex: string | number) {
    if (context.current.busy || viewRef.current.status !== "READY") return;
    const index = Number(rawIndex);
    if (!Number.isSafeInteger(index) || index < 0) return;
    const option = STAFF_MONTHLY_FIELDS.find((field) => field.key === key)?.options[index];
    if (option)
      updateForm({
        ...formRef.current,
        supplements: { ...formRef.current.supplements, [key]: option.value },
      });
  }
  function back() {
    clearPage();
    void Taro.redirectTo({ url: "/pages/staff/workbench/index" });
  }
  const selectedRecords = view.records.filter((record) => record.month === form.month);
  const focusedRecord = selectedRecords.find((record) => record.id === view.focusedRecordId);
  const showFields = !!editing || (view.canCreate && selectedRecords.length === 0);
  const records = [
    ...(focusedRecord ? [focusedRecord] : []),
    ...selectedRecords.filter((record) => record !== focusedRecord),
    ...view.records.filter((record) => record.month !== form.month),
  ];

  return (
    <View className="staff-monthly-page" data-monthly-state={view.status}>
      <View className="staff-monthly-topbar">
        <Button className="staff-monthly-back" onClick={back}>
          ‹ 返回工作台
        </Button>
        <Text className="staff-monthly-role">员工端</Text>
      </View>
      <View className="staff-monthly-card">
        <Text className="staff-monthly-eyebrow">同芯学园 · 内部协作</Text>
        <Text className="staff-monthly-title">班级月度总结</Text>
        <Text className="staff-monthly-copy">
          按月份整理班级整体情况。这里只填写和提交，审核与内部发布由负责人在管理网页完成。
        </Text>
      </View>
      <View className="staff-monthly-card" aria-live="polite">
        <Text className="staff-monthly-copy">{view.message}</Text>
        <View className="staff-monthly-actions">
          <Button
            className="staff-monthly-button"
            disabled={view.status === "LOADING" || !!editing}
            onClick={() => void perform()}
          >
            {view.status === "LOADING"
              ? "正在读取…"
              : view.status === "READY"
                ? "刷新"
                : "重新读取"}
          </Button>
          {view.status === "DENIED" ? (
            <Button
              className="staff-monthly-button staff-monthly-secondary"
              onClick={() => {
                clearPage();
                void Taro.redirectTo({ url: "/pages/auth/login/index" });
              }}
            >
              重新登录
            </Button>
          ) : null}
        </View>
      </View>
      {view.status === "READY" && (view.canCreate || editing || records.length > 0) ? (
        <View className="staff-monthly-card" data-monthly-form>
          <Text className="staff-monthly-heading">
            {editing ? "修改总结草稿" : showFields ? "填写总结草稿" : "查看班级总结"}
          </Text>
          <Text className="staff-monthly-label">月份</Text>
          <Picker
            data-monthly-field="month"
            mode="date"
            fields="month"
            value={form.month}
            disabled={!!editing}
            onChange={(event) => {
              const month = String(event.detail.value);
              if (!editingRef.current && /^(?:19|20|21)\d{2}-(?:0[1-9]|1[0-2])$/u.test(month))
                updateForm({ ...formRef.current, month });
            }}
          >
            <View className="staff-monthly-picker">{form.month}</View>
          </Picker>
          {showFields &&
            STAFF_MONTHLY_FIELDS.map((field) => (
              <View className="staff-monthly-field" key={field.key}>
                <Text className="staff-monthly-label">{field.label}</Text>
                <Picker
                  data-monthly-field={field.key}
                  mode="selector"
                  range={field.options.map((option) => option.label)}
                  value={Math.max(
                    0,
                    field.options.findIndex(
                      (option) => option.value === form.supplements[field.key],
                    ),
                  )}
                  onChange={(event) => choose(field.key, event.detail.value)}
                >
                  <View className="staff-monthly-picker">
                    <Text>{staffMonthlyValueLabel(field.key, form.supplements[field.key])}</Text>
                    <Text>⌄</Text>
                  </View>
                </Picker>
              </View>
            ))}
          {!showFields ? (
            <Text className="staff-monthly-copy">
              {selectedRecords.length
                ? "所选月份的总结已列在下方。"
                : "该月暂无总结，可切换月份查看。"}
            </Text>
          ) : null}
          {editing ? (
            <Text className="staff-monthly-copy">请先保存或取消修改，再提交负责人审核。</Text>
          ) : null}
          {showFields ? (
            <View className="staff-monthly-actions">
              <Button className="staff-monthly-button" onClick={save}>
                {editing ? "保存修改" : "保存总结草稿"}
              </Button>
              {editing ? (
                <Button
                  className="staff-monthly-button staff-monthly-secondary"
                  onClick={() => clearEditor(formRef.current.month)}
                >
                  取消修改
                </Button>
              ) : null}
            </View>
          ) : null}
        </View>
      ) : null}
      {view.status === "READY" && view.records.length === 0 ? (
        <View className="staff-monthly-card">
          <Text className="staff-monthly-heading">暂无班级月度总结</Text>
          <Text className="staff-monthly-copy">保存后可在这里查看草稿和处理进度。</Text>
        </View>
      ) : null}
      {view.status === "READY"
        ? records.map((record) => (
            <View
              className="staff-monthly-card"
              key={record.id}
              data-monthly-row={record.id}
              data-monthly-status={record.status}
            >
              <Text className="staff-monthly-heading">
                {record.month} · {record.classRef}
              </Text>
              <Text className="staff-monthly-status">
                {statusLabels[record.status]} · 第 {record.version} 版
              </Text>
              {STAFF_MONTHLY_FIELDS.map((field) => (
                <Text className="staff-monthly-copy" key={field.key}>
                  {field.label}：{staffMonthlyValueLabel(field.key, record.supplements[field.key])}
                </Text>
              ))}
              <Text className="staff-monthly-copy">
                来源汇总：成长记录 {record.sourceCounts.GROWTH_RECORD} 条，到校记录{" "}
                {record.sourceCounts.ATTENDANCE_OVERVIEW} 条，工作日报{" "}
                {record.sourceCounts.STAFF_DAILY} 条。
              </Text>
              <View className="staff-monthly-actions">
                {record.actions.includes("edit") ? (
                  <Button
                    className="staff-monthly-button staff-monthly-secondary"
                    disabled={!!editing}
                    onClick={() => startEditing(record)}
                  >
                    {record.status === "DRAFT" ? "编辑草稿" : "核对并修改"}
                  </Button>
                ) : null}
                {record.actions.includes("submit") ? (
                  <Button
                    className="staff-monthly-button"
                    disabled={!!editing}
                    onClick={() => void perform({ action: "submit", record })}
                  >
                    提交负责人审核
                  </Button>
                ) : null}
              </View>
            </View>
          ))
        : null}
      <Text className="staff-monthly-footnote">班级内部总结，不作为孩子个人报告向家长展示。</Text>
    </View>
  );
}
