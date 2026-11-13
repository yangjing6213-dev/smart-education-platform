import { Button, Picker, Text, View } from "@tarojs/components";
import Taro, { useDidHide, useDidShow, useUnload } from "@tarojs/taro";
import { useRef, useState } from "react";
import { inviteSession } from "../../../auth/runtime-session";
import { hasRoleAccess } from "../../../auth/role-gate";
import {
  CHILD_MONTHLY_FIELDS,
  CHILD_MONTHLY_OPTIONS,
  childMonthlyValueLabel,
  createStaffChildMonthlyReport,
  editStaffChildMonthlyReport,
  loadStaffChildMonthlyReports,
  submitStaffChildMonthlyReport,
  type ChildMonthlyStaffReport,
  type ChildMonthlyStaffList,
  type ChildMonthlySupplements,
} from "../../../monthly-feedback/child-monthly";
import "./index.css";

type PageState = ChildMonthlyStaffList & {
  status: "LOADING" | "READY" | "ERROR" | "DENIED";
  message: string;
};
type Form = { studentId: string; month: string; supplements: ChildMonthlySupplements };
type Session = typeof inviteSession.snapshot;
type Operation =
  | { action: "create"; form: Form }
  | { action: "edit"; record: ChildMonthlyStaffReport; form: Form }
  | { action: "submit"; record: ChildMonthlyStaffReport };

const empty: PageState = {
  status: "LOADING",
  students: [],
  records: [],
  message: "正在读取有权处理的孩子月报…",
};

const statusLabels: Record<ChildMonthlyStaffReport["status"], string> = {
  DRAFT: "草稿",
  SUBMITTED: "待负责人审核",
  RETURNED: "退回修改",
  CONFIRMED: "已审核",
  PUBLISHED: "已发布",
  REVIEW_REQUIRED: "资料更新，需重新核对",
};

function newForm(studentId = ""): Form {
  const date = new Date();
  return {
    studentId,
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

function messageFor(error: unknown): string {
  const code = statusCode(error);
  if (code === 401) return "登录状态已过期，请重新登录。";
  if (code === 403) return "当前账号没有填写孩子月报的权限。";
  if (code === 404) return "孩子或月报已变化，请重新读取。";
  return "孩子月报暂时无法读取或保存，请稍后重试。";
}

export default function StaffChildMonthlyPage() {
  const [view, setView] = useState<PageState>(empty);
  const [form, setForm] = useState<Form>(newForm);
  const [editing, setEditing] = useState<ChildMonthlyStaffReport | null>(null);
  const viewRef = useRef(view);
  const formRef = useRef(form);
  const editingRef = useRef(editing);
  const context = useRef({ active: false, busy: false, generation: 0 });
  const verified = useRef<Session | null>(null);

  function updateView(next: PageState) {
    viewRef.current = next;
    setView(next);
  }

  function updateForm(next: Form) {
    formRef.current = next;
    setForm(next);
  }

  function clearEditor(studentId = "") {
    editingRef.current = null;
    setEditing(null);
    updateForm(newForm(studentId));
  }

  function clearPage() {
    context.current.active = false;
    context.current.busy = false;
    context.current.generation += 1;
    verified.current = null;
    clearEditor();
    updateView(empty);
  }

  function denied(message: string) {
    verified.current = null;
    clearEditor();
    updateView({ ...empty, status: "DENIED", message });
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
        !allowed(verified.current) ||
        viewRef.current.status !== "READY"
      ) {
        denied("登录或权限已变化，请重新读取后操作。");
        return;
      }
      if (operation.action !== "create") {
        const current = viewRef.current.records.find(
          (item) => item.id === operation.record.id && item.version === operation.record.version,
        );
        if (!current?.actions.includes(operation.action)) return;
      } else if (
        !operation.form.studentId ||
        !viewRef.current.students.some((student) => student.id === operation.form.studentId) ||
        viewRef.current.records.some(
          (record) =>
            record.studentId === operation.form.studentId && record.month === operation.form.month,
        )
      ) {
        return;
      }
    }

    state.busy = true;
    const generation = ++state.generation;
    const isCurrent = () => state.active && state.generation === generation;
    let session = operation ? verified.current : null;
    const sameSession = () => {
      if (!isCurrent()) return false;
      if (session && inviteSession.snapshot === session && allowed(session)) return true;
      denied("登录或权限已变化，请重新读取后操作。");
      return false;
    };
    const pendingMessage =
      operation?.action === "submit"
        ? "正在提交负责人审核…"
        : operation
          ? "正在保存孩子月报…"
          : "正在读取有权处理的孩子月报…";
    clearEditor();
    updateView({ ...empty, message: pendingMessage });
    try {
      if (!operation) session = await inviteSession.restore();
      if (!isCurrent() || !session) return;
      if (session.status === "CHECKING" || session.status === "BUSY" || session.status === "ERROR") {
        verified.current = null;
        updateView({ ...empty, status: "ERROR", message: "登录状态暂时无法读取，请稍后重试。" });
        return;
      }
      if (!allowed(session)) {
        denied("请使用已开通孩子月报权限的员工账号登录。");
        void Taro.redirectTo({ url: "/pages/auth/login/index" });
        return;
      }
      if (!sameSession()) return;

      let resultMessage = "只填写和提交孩子月报；负责人审核、发布由管理网页完成。";
      if (operation) {
        try {
          if (operation.action === "create") {
            await createStaffChildMonthlyReport(
              (path, body) => inviteSession.postAuthenticated(path, body),
              operation.form,
            );
            resultMessage = "月报草稿已保存，请核对后提交负责人审核。";
          } else if (operation.action === "edit") {
            await editStaffChildMonthlyReport(
              (path, body) => inviteSession.patchAuthenticated(path, body),
              operation.record.id,
              operation.record.version,
              operation.form.supplements,
            );
            resultMessage = "修改已保存，请核对后提交负责人审核。";
          } else {
            await submitStaffChildMonthlyReport(
              (path, body) => inviteSession.postAuthenticated(path, body),
              operation.record.id,
              operation.record.version,
            );
            resultMessage = "已提交负责人审核。";
          }
        } catch (error) {
          if (statusCode(error) !== 409) throw error;
          resultMessage = "记录或来源已变化，本次没有重复提交。已刷新最新版本，请重新核对。";
        }
        if (!sameSession()) return;
      }

      const listing = await loadStaffChildMonthlyReports((path) =>
        inviteSession.getAuthenticated(path),
      );
      if (!sameSession()) return;
      const currentStudent = listing.students.some((student) => student.id === formRef.current.studentId)
        ? formRef.current.studentId
        : (listing.students[0]?.id ?? "");
      verified.current = session;
      clearEditor(currentStudent);
      updateView({ ...listing, status: "READY", message: resultMessage });
    } catch (error) {
      if (!isCurrent()) return;
      const code = statusCode(error);
      if (code === 401 || code === 403 || code === 404) {
        denied(messageFor(error));
        if (code === 401) void Taro.redirectTo({ url: "/pages/auth/login/index" });
      } else {
        verified.current = null;
        updateView({ ...empty, status: "ERROR", message: messageFor(error) });
      }
    } finally {
      if (isCurrent()) state.busy = false;
    }
  }

  function choose(field: string, rawIndex: string | number) {
    if (context.current.busy || viewRef.current.status !== "READY") return;
    if (field === "month") {
      const month = String(rawIndex);
      if (!editingRef.current && /^(?:19|20|21)\d{2}-(?:0[1-9]|1[0-2])$/u.test(month))
        updateForm({ ...formRef.current, month });
      return;
    }
    const index = Number(rawIndex);
    if (!Number.isSafeInteger(index) || index < 0) return;
    if (field === "student") {
      const student = viewRef.current.students[index];
      if (student && !editingRef.current) updateForm({ ...formRef.current, studentId: student.id });
      return;
    }
    const definition = CHILD_MONTHLY_FIELDS.find((item) => item.key === field);
    const option = CHILD_MONTHLY_OPTIONS[index];
    if (definition && option)
      updateForm({
        ...formRef.current,
        supplements: { ...formRef.current.supplements, [definition.key]: option.value },
      });
  }

  function startEditing(record: ChildMonthlyStaffReport) {
    if (context.current.busy || viewRef.current.status !== "READY" || !record.actions.includes("edit"))
      return;
    if (!verified.current || inviteSession.snapshot !== verified.current || !allowed(verified.current)) {
      denied("登录或权限已变化，请重新读取后操作。");
      return;
    }
    editingRef.current = record;
    setEditing(record);
    updateForm({ studentId: record.studentId, month: record.month, supplements: { ...record.supplements } });
  }

  function save() {
    const record = editingRef.current;
    void perform(
      record
        ? { action: "edit", record, form: formRef.current }
        : { action: "create", form: formRef.current },
    );
  }

  async function submit(record: ChildMonthlyStaffReport) {
    if (context.current.busy || !record.actions.includes("submit")) return;
    const confirmation = await Taro.showModal({
      title: "提交月报审核",
      content: `提交${record.studentLabel} ${record.month}的月报，交由负责人审核？`,
      confirmText: "提交审核",
      cancelText: "再检查一下",
    });
    if (!confirmation.confirm) return;
    void perform({ action: "submit", record });
  }

  function back() {
    clearPage();
    void Taro.redirectTo({ url: "/pages/staff/workbench/index" });
  }

  const selectedStudent = view.students.find((student) => student.id === form.studentId);
  const selectedStudentIndex = Math.max(0, view.students.findIndex((student) => student.id === form.studentId));
  const monthExists = view.records.some(
    (record) => record.studentId === form.studentId && record.month === form.month,
  );

  return (
    <View className="child-monthly-page" data-child-monthly-state={view.status}>
      <View className="child-monthly-topbar">
        <Button className="child-monthly-back" onClick={back}>‹ 返回工作台</Button>
        <Text className="child-monthly-role">员工端</Text>
      </View>
      <View className="child-monthly-card">
        <Text className="child-monthly-eyebrow">同芯学园 · 孩子成长</Text>
        <Text className="child-monthly-title">孩子月度报告</Text>
        <Text className="child-monthly-copy">
          按月份整理每位孩子的四项成长摘要。保存草稿后可提交负责人审核。
        </Text>
      </View>
      <View className="child-monthly-card" aria-live="polite">
        <Text className="child-monthly-copy">{view.message}</Text>
        <View className="child-monthly-actions">
          <Button
            className="child-monthly-button"
            disabled={view.status === "LOADING" || !!editing}
            onClick={() => void perform()}
          >
            {view.status === "LOADING" ? "正在读取…" : view.status === "READY" ? "刷新" : "重新读取"}
          </Button>
          {view.status === "DENIED" ? (
            <Button
              className="child-monthly-button child-monthly-secondary"
              onClick={() => void Taro.redirectTo({ url: "/pages/auth/login/index" })}
            >重新登录</Button>
          ) : null}
        </View>
      </View>
      {view.status === "READY" && view.students.length > 0 ? (
        <View className="child-monthly-card" data-child-monthly-form>
          <Text className="child-monthly-heading">{editing ? "修改月报草稿" : "填写月报草稿"}</Text>
          <Text className="child-monthly-label">孩子</Text>
          <Picker
            data-child-monthly-field="student"
            mode="selector"
            range={view.students.map((student) => `${student.displayRef} · ${student.classRef}`)}
            value={selectedStudentIndex}
            disabled={!!editing || context.current.busy}
            onChange={(event) => choose("student", event.detail.value)}
          >
            <View className="child-monthly-picker">{selectedStudent?.displayRef ?? "请选择孩子"}　⌄</View>
          </Picker>
          <Text className="child-monthly-label">月份</Text>
          <Picker
            data-child-monthly-field="month"
            mode="date"
            fields="month"
            value={form.month}
            disabled={!!editing || context.current.busy}
            onChange={(event) => choose("month", event.detail.value)}
          >
            <View className="child-monthly-picker">{form.month}　⌄</View>
          </Picker>
          {CHILD_MONTHLY_FIELDS.map((field) => (
            <View className="child-monthly-field" key={field.key}>
              <Text className="child-monthly-label">{field.label}</Text>
              <Picker
                data-child-monthly-field={field.key}
                mode="selector"
                range={CHILD_MONTHLY_OPTIONS.map((option) => option.label)}
                value={Math.max(
                  0,
                  CHILD_MONTHLY_OPTIONS.findIndex(
                    (option) => option.value === form.supplements[field.key],
                  ),
                )}
                disabled={context.current.busy}
                onChange={(event) => choose(field.key, event.detail.value)}
              >
                <View className="child-monthly-picker">
                  <Text>{childMonthlyValueLabel(form.supplements[field.key])}</Text>
                  <Text>⌄</Text>
                </View>
              </Picker>
            </View>
          ))}
          {!editing && monthExists ? (
            <Text className="child-monthly-copy">该孩子本月已有报告，请在下方查看或修改现有草稿。</Text>
          ) : null}
          {editing ? <Text className="child-monthly-copy">保存修改后，请重新提交负责人审核。</Text> : null}
          <View className="child-monthly-actions">
            <Button
              className="child-monthly-button"
              disabled={context.current.busy || (!editing && monthExists)}
              onClick={save}
            >
              {editing ? "保存修改" : "保存月报草稿"}
            </Button>
            {editing ? (
              <Button className="child-monthly-button child-monthly-secondary" onClick={() => clearEditor(formRef.current.studentId)}>
                取消修改
              </Button>
            ) : null}
          </View>
        </View>
      ) : null}
      {view.status === "READY" && view.students.length === 0 ? (
        <View className="child-monthly-card">
          <Text className="child-monthly-heading">暂无可填写的孩子</Text>
          <Text className="child-monthly-copy">请确认当前员工账号已获授权访问相应校区和班级。</Text>
        </View>
      ) : null}
      {view.status === "READY" && view.records.length === 0 ? (
        <View className="child-monthly-card">
          <Text className="child-monthly-heading">暂无孩子月报</Text>
          <Text className="child-monthly-copy">保存草稿后可在这里查看处理进度。</Text>
        </View>
      ) : null}
      {view.status === "READY"
        ? view.records.map((record) => (
            <View className="child-monthly-card" key={record.id} data-child-monthly-row={record.id}>
              <Text className="child-monthly-heading">{record.studentLabel} · {record.month}</Text>
              <Text className="child-monthly-status">{statusLabels[record.status]} · 第 {record.version} 版</Text>
              {CHILD_MONTHLY_FIELDS.map((field) => (
                <Text className="child-monthly-copy" key={field.key}>
                  {field.label}：{childMonthlyValueLabel(record.supplements[field.key])}
                </Text>
              ))}
              <Text className="child-monthly-copy">
                来源汇总：成长记录 {record.sourceCounts.GROWTH_RECORD} 条，到校记录 {record.sourceCounts.ATTENDANCE_OVERVIEW} 条。
              </Text>
              <View className="child-monthly-actions">
                {record.actions.includes("edit") ? (
                  <Button className="child-monthly-button child-monthly-secondary" disabled={!!editing || context.current.busy} onClick={() => startEditing(record)}>
                    修改草稿
                  </Button>
                ) : null}
                {record.actions.includes("submit") ? (
                  <Button className="child-monthly-button" disabled={!!editing || context.current.busy} onClick={() => void submit(record)}>
                    提交负责人审核
                  </Button>
                ) : null}
              </View>
            </View>
          ))
        : null}
      <Text className="child-monthly-footnote">员工只填写并提交；审核、退回和发布由负责人在管理网页处理。</Text>
    </View>
  );
}
