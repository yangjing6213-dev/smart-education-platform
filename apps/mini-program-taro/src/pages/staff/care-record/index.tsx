import { Button, Picker, Text, View } from "@tarojs/components";
import Taro from "@tarojs/taro";
import { useEffect, useRef, useState } from "react";
import { inviteSession } from "../../../auth/runtime-session";
import { hasRoleAccess } from "../../../auth/role-gate";
import {
  CARE_RECORD_FIELDS,
  careRecordValueLabel,
  createStaffCareRecord,
  loadStaffCareRecords,
  runStaffCareAction,
  type CareRecordValues,
  type CareReviewDecision,
  type CareRecordStudent,
  type StaffCareRecord,
} from "../../../care-record/care-record";
import "./index.css";

type PageStatus = "LOADING" | "READY" | "ERROR";

const INITIAL_VALUES: CareRecordValues = {
  arrival: "ARRIVED_AS_PLANNED",
  homework: "COMPLETED",
  meal: "FINISHED",
  rest: "RESTED",
  activity: "PARTICIPATED",
  wellbeing: "ROUTINE",
};

const STATUS_LABEL: Record<StaffCareRecord["status"], string> = {
  DRAFT: "草稿",
  SUBMITTED: "待审核",
  RETURNED: "退回修改",
  CONFIRMED: "审核通过",
  CANCELLED: "已撤回",
  EXCEPTION_PENDING: "待复核",
};

function errorMessage(error: unknown): string {
  if (typeof error === "object" && error !== null && "statusCode" in error) {
    const code = Number(error.statusCode);
    if (code === 401) return "登录状态已过期，请重新登录后查看。";
    if (code === 403) return "当前账号没有成长记录审核或填写权限。";
    if (code === 409) return "记录状态已变化，请刷新后再试。";
    if (code === 503) return "机构服务暂未连接，请稍后再试。";
  }
  return error instanceof Error && error.message.includes("成长记录")
    ? error.message
    : "成长记录暂时无法读取或提交，请稍后重试。";
}

function today(): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function StaffCareRecordPage() {
  const [status, setStatus] = useState<PageStatus>("LOADING");
  const [message, setMessage] = useState("正在读取当前员工有权处理的成长记录…");
  const [records, setRecords] = useState<StaffCareRecord[]>([]);
  const [students, setStudents] = useState<CareRecordStudent[]>([]);
  const [studentId, setStudentId] = useState("");
  const [serviceDate, setServiceDate] = useState(today());
  const [values, setValues] = useState<CareRecordValues>(INITIAL_VALUES);
  const [resubmitId, setResubmitId] = useState("");
  const [busyId, setBusyId] = useState("");
  const [busy, setBusy] = useState(false);
  const mounted = useRef(false);
  const inFlight = useRef(false);

  useEffect(() => {
    mounted.current = true;
    void loadInitial();
    return () => {
      mounted.current = false;
    };
  }, []);

  async function loadInitial() {
    const session = await inviteSession.restore();
    if (!mounted.current) return;
    if (!hasRoleAccess(session, "STAFF")) {
      void Taro.redirectTo({ url: "/pages/auth/login/index" });
      return;
    }
    await refresh();
  }

  async function refresh(resultMessage?: string) {
    if (!hasRoleAccess(inviteSession.snapshot, "STAFF")) {
      void Taro.redirectTo({ url: "/pages/auth/login/index" });
      return;
    }
    setStatus("LOADING");
    try {
      const result = await loadStaffCareRecords(
        (path) => inviteSession.getAuthenticated(path),
        inviteSession.snapshot.canWriteCareRecords,
      );
      if (!mounted.current) return;
      setRecords(result.records);
      setStudents(result.students);
      setStudentId((current) => current || result.students[0]?.id || "");
      setMessage(
        resultMessage ??
          (result.records.length ? "仅显示当前员工有权处理的记录。" : "当前范围内暂无成长记录。"),
      );
      setStatus("READY");
    } catch (error) {
      if (!mounted.current) return;
      setMessage(errorMessage(error));
      setStatus("ERROR");
    }
  }

  function updateValue<K extends keyof CareRecordValues>(key: K, value: CareRecordValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  async function createDraft() {
    if (inFlight.current || !studentId) return;
    if (!hasRoleAccess(inviteSession.snapshot, "STAFF")) {
      void Taro.redirectTo({ url: "/pages/auth/login/index" });
      return;
    }
    inFlight.current = true;
    setBusy(true);
    try {
      const record = await createStaffCareRecord(
        (path, body) => inviteSession.postAuthenticated(path, body),
        students,
        studentId,
        serviceDate,
        values,
      );
      if (!mounted.current) return;
      setRecords((current) => [record, ...current.filter((item) => item.id !== record.id)]);
      setMessage("成长记录草稿已保存。请核对后提交审核。");
      setValues(INITIAL_VALUES);
      setServiceDate(today());
    } catch (error) {
      if (mounted.current) setMessage(errorMessage(error));
    } finally {
      inFlight.current = false;
      if (mounted.current) setBusy(false);
    }
  }

  async function submitAction(
    record: StaffCareRecord,
    action: "submit" | "resubmit" | "publish" | "withdraw" | "revoke-publication",
    decision?: CareReviewDecision,
  ) {
    if (inFlight.current) return;
    if (!hasRoleAccess(inviteSession.snapshot, "STAFF")) {
      void Taro.redirectTo({ url: "/pages/auth/login/index" });
      return;
    }
    const title =
      action === "submit"
        ? "提交审核"
        : action === "resubmit"
          ? "提交修改"
          : action === "publish"
            ? "单独发布"
            : action === "withdraw"
              ? "撤回记录"
              : "撤销发布";
    const content =
      action === "publish"
        ? `将已审核的${record.student_display_ref}成长记录单独发布给家长。`
        : action === "revoke-publication"
          ? `撤销后，家长将立即无法查看${record.student_display_ref}的这条成长记录；重新发布后会产生新的待查看回执。`
          : action === "withdraw"
            ? `撤回后将取消${record.student_display_ref}的这条成长记录，家长无法查看。`
            : action === "resubmit"
              ? `将${record.student_display_ref}修改后的成长记录重新提交审核。`
              : `将${record.student_display_ref}的成长记录提交给其他员工审核。`;
    inFlight.current = true;
    setBusyId(record.id);
    try {
      const confirmation = await Taro.showModal({
        title,
        content,
        confirmText: title,
        cancelText: "再检查",
      });
      if (!confirmation.confirm) return;
      const updated = await runStaffCareAction(
        (path, body) => inviteSession.postAuthenticated(path, body),
        record,
        action,
        decision,
        action === "resubmit" ? values : undefined,
      );
      if (!mounted.current) return;
      setRecords((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      setMessage(
        action === "publish"
          ? "成长记录已发布，家长可以查看。"
          : action === "withdraw"
            ? "成长记录已撤回。"
            : action === "revoke-publication"
              ? "发布已撤销，家长暂时无法查看。"
              : action === "submit" || action === "resubmit"
                ? "成长记录已提交审核。"
                : "审核结果已保存。请由授权员工单独发布。",
      );
      if (action === "resubmit") setResubmitId("");
    } catch (error) {
      if (mounted.current) setMessage(errorMessage(error));
    } finally {
      inFlight.current = false;
      if (mounted.current) setBusyId("");
    }
  }

  async function review(record: StaffCareRecord, decision: CareReviewDecision) {
    if (inFlight.current) return;
    if (!hasRoleAccess(inviteSession.snapshot, "STAFF")) {
      void Taro.redirectTo({ url: "/pages/auth/login/index" });
      return;
    }
    const label = decision === "confirm" ? "审核通过" : "退回修改";
    inFlight.current = true;
    setBusyId(record.id);
    try {
      const confirmation = await Taro.showModal({
        title: `确认${label}`,
        content: `确认${record.student_display_ref}的成长记录并${label}？`,
        confirmText: label,
        cancelText: "再检查",
      });
      if (!confirmation.confirm) return;
      const updated = await runStaffCareAction(
        (path, body) => inviteSession.postAuthenticated(path, body),
        record,
        "review",
        decision,
      );
      if (!mounted.current) return;
      setRecords((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      setMessage(
        decision === "confirm"
          ? "审核已通过；发布还需由授权员工单独完成。"
          : "已退回修改，填写员工可以更新后重新提交。",
      );
    } catch (error) {
      if (mounted.current) setMessage(errorMessage(error));
    } finally {
      inFlight.current = false;
      if (mounted.current) setBusyId("");
    }
  }

  function prepareResubmit(record: StaffCareRecord) {
    setResubmitId(record.id);
    setServiceDate(record.service_date);
    setValues(record.values);
    setMessage(`已载入${record.student_display_ref}的退回记录；调整固定选项后重新提交。`);
  }

  return (
    <View className="staff-care-page">
      <View className="staff-care-intro">
        <Text className="staff-care-eyebrow">员工端 · 成长记录</Text>
        <Text className="staff-care-title">填写与审核</Text>
        <Text className="staff-care-copy">
          记录使用固定选项；提交后由其他授权员工审核，通过后再单独发布给家长。
        </Text>
      </View>

      <View className="staff-care-heading">
        <View>
          <Text className="staff-care-section-title">建立每日记录</Text>
          <Text className="staff-care-message">{message}</Text>
        </View>
        <Button
          className="staff-care-refresh"
          disabled={status === "LOADING" || busy}
          onClick={() => void refresh()}
        >
          刷新
        </Button>
      </View>

      {status === "LOADING" ? (
        <View className="staff-care-state">
          <Text className="staff-care-copy">正在读取…</Text>
        </View>
      ) : null}
      {status === "ERROR" ? (
        <View className="staff-care-state">
          <Text className="staff-care-state-title">暂时无法读取</Text>
          <Text className="staff-care-copy">{message}</Text>
          <Button className="staff-care-button" onClick={() => void refresh()}>
            重新读取
          </Button>
        </View>
      ) : null}

      {status === "READY" ? (
        <View className="staff-care-form">
          <Text className="staff-care-form-title">填写一份成长记录草稿</Text>
          {!students.length ? (
            <Text className="staff-care-copy">
              当前账号没有填写权限或可选学生；仍可处理下方有权审核的记录。
            </Text>
          ) : (
            <>
              <Text className="staff-care-field-label">学生</Text>
              <Picker
                mode="selector"
                range={students.map(
                  (student) => `${student.student_display_ref} · ${student.class_ref}`,
                )}
                value={Math.max(
                  0,
                  students.findIndex((student) => student.id === studentId),
                )}
                onChange={(event) => {
                  const selected = students[Number(event.detail.value)];
                  if (selected) setStudentId(selected.id);
                }}
              >
                <View className="staff-care-picker">
                  <Text>
                    {students.find((student) => student.id === studentId)?.student_display_ref ??
                      "选择负责范围内的学生"}
                  </Text>
                  <Text className="staff-care-picker-arrow">⌄</Text>
                </View>
              </Picker>

              <Text className="staff-care-field-label">记录日期</Text>
              <Picker
                mode="date"
                value={serviceDate}
                onChange={(event) => setServiceDate(event.detail.value)}
              >
                <View className="staff-care-picker">
                  <Text>{serviceDate}</Text>
                  <Text className="staff-care-picker-arrow">⌄</Text>
                </View>
              </Picker>

              {CARE_RECORD_FIELDS.map((field) => {
                const selected = field.options.findIndex(
                  (option) => option.value === values[field.key],
                );
                return (
                  <View className="staff-care-field" key={field.key}>
                    <Text className="staff-care-field-label">{field.label}</Text>
                    <Picker
                      mode="selector"
                      range={field.options.map((option) => option.label)}
                      value={Math.max(0, selected)}
                      onChange={(event) => {
                        const option = field.options[Number(event.detail.value)];
                        if (option)
                          updateValue(
                            field.key,
                            option.value as CareRecordValues[typeof field.key],
                          );
                      }}
                    >
                      <View className="staff-care-picker">
                        <Text>{careRecordValueLabel(field.key, values[field.key])}</Text>
                        <Text className="staff-care-picker-arrow">⌄</Text>
                      </View>
                    </Picker>
                  </View>
                );
              })}

              {resubmitId ? (
                <View className="staff-care-form-actions">
                  <Button
                    className="staff-care-button"
                    disabled={busy}
                    loading={busy}
                    onClick={() => {
                      const target = records.find((record) => record.id === resubmitId);
                      if (target) void submitAction(target, "resubmit");
                    }}
                  >
                    提交修改并复审
                  </Button>
                  <Button
                    className="staff-care-button staff-care-button-secondary"
                    disabled={busy}
                    onClick={() => setResubmitId("")}
                  >
                    取消修改
                  </Button>
                </View>
              ) : (
                <Button
                  className="staff-care-button"
                  disabled={busy || !studentId}
                  loading={busy}
                  onClick={() => void createDraft()}
                >
                  保存为草稿
                </Button>
              )}
            </>
          )}
        </View>
      ) : null}

      <View className="staff-care-list-heading">
        <Text className="staff-care-section-title">记录与审核进度</Text>
        <Text className="staff-care-copy">列表和操作均来自机构服务当前授权范围。</Text>
      </View>
      {status === "READY" && records.length === 0 ? (
        <View className="staff-care-state">
          <Text className="staff-care-copy">当前范围内暂无成长记录。</Text>
        </View>
      ) : null}
      {status === "READY"
        ? records.map((record) => (
            <View className="staff-care-card" key={record.id}>
              <View className="staff-care-card-heading">
                <View>
                  <Text className="staff-care-record-title">{record.student_display_ref}</Text>
                  <Text className="staff-care-meta">
                    {record.class_ref} · {record.service_date}
                  </Text>
                </View>
                <Text
                  className={`staff-care-status staff-care-status-${record.status.toLowerCase()}`}
                >
                  {record.published ? "已发布" : STATUS_LABEL[record.status]}
                </Text>
              </View>
              <View className="staff-care-values">
                {CARE_RECORD_FIELDS.map((field) => (
                  <Text className="staff-care-value" key={field.key}>
                    {field.label} {careRecordValueLabel(field.key, record.values[field.key])}
                  </Text>
                ))}
              </View>
              <View className="staff-care-actions">
                {record.actions.includes("submit") ? (
                  <Button
                    className="staff-care-button"
                    disabled={!!busyId}
                    loading={busyId === record.id}
                    onClick={() => void submitAction(record, "submit")}
                  >
                    提交审核
                  </Button>
                ) : null}
                {record.actions.includes("review") ? (
                  <>
                    <Button
                      className="staff-care-button"
                      disabled={!!busyId}
                      loading={busyId === record.id}
                      onClick={() => void review(record, "confirm")}
                    >
                      审核通过
                    </Button>
                    <Button
                      className="staff-care-button staff-care-button-secondary"
                      disabled={!!busyId}
                      onClick={() => void review(record, "return")}
                    >
                      退回修改
                    </Button>
                  </>
                ) : null}
                {record.actions.includes("resubmit") ? (
                  <Button
                    className="staff-care-button"
                    disabled={!!busyId}
                    onClick={() => prepareResubmit(record)}
                  >
                    {resubmitId === record.id ? "正在修改" : "修改并重新提交"}
                  </Button>
                ) : null}
                {record.actions.includes("publish") ? (
                  <Button
                    className="staff-care-button"
                    disabled={!!busyId}
                    loading={busyId === record.id}
                    onClick={() => void submitAction(record, "publish")}
                  >
                    单独发布
                  </Button>
                ) : null}
                {record.actions.includes("withdraw") ? (
                  <Button
                    className="staff-care-button staff-care-button-secondary"
                    disabled={!!busyId}
                    loading={busyId === record.id}
                    onClick={() => void submitAction(record, "withdraw")}
                  >
                    撤回记录
                  </Button>
                ) : null}
                {record.actions.includes("revoke-publication") ? (
                  <Button
                    className="staff-care-button staff-care-button-secondary"
                    disabled={!!busyId}
                    loading={busyId === record.id}
                    onClick={() => void submitAction(record, "revoke-publication")}
                  >
                    撤销发布
                  </Button>
                ) : null}
                {!record.actions.some((action) => action !== "edit") ? (
                  <Text className="staff-care-no-action">
                    当前步骤暂不可操作；如刚完成审核，请刷新记录。
                  </Text>
                ) : null}
              </View>
            </View>
          ))
        : null}

      <Button
        className="staff-care-button staff-care-button-secondary staff-care-back"
        onClick={() => void Taro.navigateBack()}
      >
        返回工作台
      </Button>
    </View>
  );
}
