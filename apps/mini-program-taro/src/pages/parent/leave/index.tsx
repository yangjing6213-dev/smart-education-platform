import { Button, Picker, Text, View } from "@tarojs/components";
import Taro from "@tarojs/taro";
import { useEffect, useRef, useState } from "react";
import { inviteSession } from "../../../auth/runtime-session";
import { hasRoleAccess } from "../../../auth/role-gate";
import {
  loadParentLearningSummary,
  type ParentLearningStudentSummary,
} from "../../../learning/parent-learning-summary";
import {
  createParentLeaveRequest,
  loadParentLeaveRequests,
  runParentLeaveAction,
  type LeaveReasonCategory,
  type ParentLeaveAction,
  type ParentLeaveRequest,
} from "../../../leave/leave-requests";
import "./index.css";

type PageStatus = "LOADING" | "READY" | "ERROR";
type LeaveStudent = Pick<ParentLearningStudentSummary, "studentId" | "studentLabel">;

const DEFAULT_REASON_CATEGORY: LeaveReasonCategory = "FAMILY_ARRANGEMENT";
const REASON_CATEGORIES: readonly LeaveReasonCategory[] = [DEFAULT_REASON_CATEGORY, "TEMPORARY_MATTER"];
const REASON_LABELS: readonly string[] = ["家庭安排", "临时事项"];

const STATUS_LABEL: Record<ParentLeaveRequest["status"], string> = {
  SUBMITTED: "等待员工审核",
  RETURNED: "需要补充后重提",
  CONFIRMED: "已确认",
  WITHDRAWN: "已撤回",
};

function currentDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function errorMessage(error: unknown): string {
  if (typeof error === "object" && error !== null && "statusCode" in error) {
    const statusCode = Number(error.statusCode);
    if (statusCode === 401) return "登录状态已过期，请重新登录后查看。";
    if (statusCode === 403) return "当前账号没有查看或提交请假申请的权限，请联系机构负责人。";
    if (statusCode === 404) return "没有找到当前账号已确认关联的学生，请先完成家长关系审核。";
    if (statusCode === 409) return "申请状态已变化，请刷新列表后再操作。";
    if (statusCode === 503) return "机构服务暂未连接，请稍后再试。";
  }
  return error instanceof Error && error.message.includes("请假")
    ? error.message
    : "请假申请暂时无法读取或提交，请稍后重试。";
}

function showDate(value: string): string {
  const [year, month, day] = value.split("-");
  return `${year}年${Number(month)}月${Number(day)}日`;
}

export default function ParentLeavePage() {
  const [status, setStatus] = useState<PageStatus>("LOADING");
  const [message, setMessage] = useState("正在读取已关联学生和请假申请…");
  const [students, setStudents] = useState<LeaveStudent[]>([]);
  const [requests, setRequests] = useState<ParentLeaveRequest[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [startDate, setStartDate] = useState(currentDate());
  const [endDate, setEndDate] = useState(currentDate());
  const [reasonCategory, setReasonCategory] = useState<LeaveReasonCategory>(DEFAULT_REASON_CATEGORY);
  const [editingRequest, setEditingRequest] = useState<ParentLeaveRequest | null>(null);
  const [busyId, setBusyId] = useState("");
  const mounted = useRef(false);
  const inFlight = useRef(false);

  useEffect(() => {
    mounted.current = true;
    void loadInitial();
    return () => {
      mounted.current = false;
    };
  }, []);

  async function loadData(resultMessage?: string) {
    if (!hasRoleAccess(inviteSession.snapshot, "PARENT")) {
      void Taro.redirectTo({ url: "/pages/auth/login/index" });
      return;
    }
    setStatus("LOADING");
    try {
      const [learning, leaveRequests] = await Promise.all([
        loadParentLearningSummary((path) => inviteSession.getAuthenticated(path)),
        loadParentLeaveRequests((path) => inviteSession.getAuthenticated(path)),
      ]);
      if (!mounted.current) return;
      const approvedStudents = learning.approvedStudents.map(({ studentId, studentLabel }) => ({
        studentId,
        studentLabel,
      }));
      setStudents(approvedStudents);
      setRequests(leaveRequests);
      setSelectedStudentId((current) =>
        approvedStudents.some((student) => student.studentId === current)
          ? current
          : (approvedStudents[0]?.studentId ?? ""),
      );
      setMessage(resultMessage ?? (approvedStudents.length
        ? "仅为已确认关联的学生提交申请。申请及审核结果由机构服务保存。"
        : "暂无已确认关联的学生，请先完成关系审核。"));
      setStatus("READY");
    } catch (error) {
      if (!mounted.current) return;
      setMessage(errorMessage(error));
      setStatus("ERROR");
    }
  }

  async function loadInitial() {
    try {
      const session = await inviteSession.restore();
      if (!mounted.current) return;
      if (!hasRoleAccess(session, "PARENT")) {
        void Taro.redirectTo({ url: "/pages/auth/login/index" });
        return;
      }
      await loadData();
    } catch (error) {
      if (!mounted.current) return;
      setMessage(errorMessage(error));
      setStatus("ERROR");
    }
  }

  async function refresh() {
    if (inFlight.current) return;
    if (!hasRoleAccess(inviteSession.snapshot, "PARENT")) {
      void Taro.redirectTo({ url: "/pages/auth/login/index" });
      return;
    }
    await loadData("请假申请列表已更新。");
  }

  async function submit() {
    if (inFlight.current || busyId || status !== "READY") return;
    const student = students.find((item) => item.studentId === selectedStudentId);
    if (!student) {
      setMessage("请先选择已确认关联的学生。");
      return;
    }
    if (!hasRoleAccess(inviteSession.snapshot, "PARENT")) {
      void Taro.redirectTo({ url: "/pages/auth/login/index" });
      return;
    }
    inFlight.current = true;
    setBusyId("FORM");
    try {
      if (editingRequest) {
        await runParentLeaveAction(
          (path, body) => inviteSession.postAuthenticated(path, body),
          editingRequest,
          "resubmit",
          { startDate, endDate, reasonCategory },
        );
        if (!mounted.current) return;
        setEditingRequest(null);
        await loadData("申请已重新提交，当前状态已更新。");
      } else {
        await createParentLeaveRequest(
          (path, body) => inviteSession.postAuthenticated(path, body),
          { studentId: student.studentId, startDate, endDate, reasonCategory },
        );
        if (!mounted.current) return;
        await loadData("申请已提交，当前状态已更新。");
      }
    } catch (error) {
      if (mounted.current) setMessage(errorMessage(error));
    } finally {
      inFlight.current = false;
      if (mounted.current) setBusyId("");
    }
  }

  function beginResubmit(request: ParentLeaveRequest) {
    if (!request.actions.includes("resubmit") || busyId || inFlight.current) return;
    if (!students.some((student) => student.studentId === request.studentId)) {
      setMessage("当前关联已变化，暂时不能重新提交这条申请。");
      return;
    }
    setSelectedStudentId(request.studentId);
    setStartDate(request.startDate);
    setEndDate(request.endDate);
    setReasonCategory(request.reasonCategory);
    setEditingRequest(request);
    setMessage("请核对并修改退回申请，再提交审核。");
    void Taro.pageScrollTo({ scrollTop: 0, duration: 200 });
  }

  async function runAction(request: ParentLeaveRequest, action: ParentLeaveAction) {
    if (action === "resubmit") {
      beginResubmit(request);
      return;
    }
    if (!request.actions.includes(action) || inFlight.current || busyId) return;
    if (!hasRoleAccess(inviteSession.snapshot, "PARENT")) {
      void Taro.redirectTo({ url: "/pages/auth/login/index" });
      return;
    }
    const actionName = action === "withdraw" ? "撤回" : "确认已查看";
    const confirmation = await Taro.showModal({
      title: `确认${actionName}`,
      content: action === "withdraw" ? "撤回后，员工将不再审核这条申请。" : "确认已查看本次请假申请结果。",
      confirmText: actionName,
      cancelText: "再看看",
    });
    if (!confirmation.confirm || inFlight.current) return;
    inFlight.current = true;
    setBusyId(request.id);
    try {
      await runParentLeaveAction(
        (path, body) => inviteSession.postAuthenticated(path, body),
        request,
        action,
      );
      if (!mounted.current) return;
      await loadData(action === "withdraw" ? "申请已撤回，状态已更新。" : "已确认查看申请结果。 ");
    } catch (error) {
      if (mounted.current) setMessage(errorMessage(error));
    } finally {
      inFlight.current = false;
      if (mounted.current) setBusyId("");
    }
  }

  const selectedStudent = students.find((student) => student.studentId === selectedStudentId);
  const studentLabels = students.map((student) => student.studentLabel);
  const selectedReasonIndex = Math.max(0, REASON_CATEGORIES.indexOf(reasonCategory));

  return (
    <View className="parent-leave-page">
      <View className="leave-brand">
        <View className="leave-brand-mark">心</View>
        <View>
          <Text className="leave-brand-name">同芯学园</Text>
          <Text className="leave-brand-subtitle">TONG XIN XUE YUAN</Text>
        </View>
      </View>

      <View className="leave-card">
        <Text className="leave-eyebrow">家长端 · 请假服务</Text>
        <Text className="leave-title">请假申请</Text>
        <Text className="leave-copy">选择已确认关联的学生和日期，提交后可在本页查看审核结果。</Text>
        <Text className={`leave-message${status === "ERROR" ? " leave-error" : ""}`}>{message}</Text>
      </View>

      {status === "LOADING" ? (
        <View className="leave-card">
          <Text className="leave-copy">正在读取请假申请…</Text>
        </View>
      ) : null}

      {status === "ERROR" ? (
        <View className="leave-card">
          <Text className="leave-section-title">暂时无法读取</Text>
          <Button className="leave-button" onClick={() => void refresh()}>重新读取</Button>
        </View>
      ) : null}

      {status === "READY" && students.length > 0 ? (
        <View className="leave-card">
          <Text className="leave-section-title">{editingRequest ? "修改退回申请" : "填写申请"}</Text>
          <View className="leave-field">
            <Text className="leave-field-label">学生</Text>
            <Picker
              mode="selector"
              range={studentLabels}
              disabled={!!editingRequest || !!busyId}
              onChange={(event) => {
                const student = students[Number(event.detail.value)];
                if (student) setSelectedStudentId(student.studentId);
              }}
            >
              <View className="leave-picker">{selectedStudent?.studentLabel ?? "请选择学生"}</View>
            </Picker>
          </View>
          <View className="leave-date-row">
            <View className="leave-field">
              <Text className="leave-field-label">开始日期</Text>
              <Picker mode="date" value={startDate} onChange={(event) => setStartDate(event.detail.value)}>
                <View className="leave-picker">{showDate(startDate)}</View>
              </Picker>
            </View>
            <View className="leave-field">
              <Text className="leave-field-label">结束日期</Text>
              <Picker mode="date" value={endDate} onChange={(event) => setEndDate(event.detail.value)}>
                <View className="leave-picker">{showDate(endDate)}</View>
              </Picker>
            </View>
          </View>
          <View className="leave-field">
            <Text className="leave-field-label">申请原因</Text>
            <Picker
              mode="selector"
              range={[...REASON_LABELS]}
              value={selectedReasonIndex}
              onChange={(event) => setReasonCategory(REASON_CATEGORIES[Number(event.detail.value)] ?? DEFAULT_REASON_CATEGORY)}
            >
              <View className="leave-picker">{REASON_LABELS[selectedReasonIndex]}</View>
            </Picker>
          </View>
          <Button
            className="leave-button"
            disabled={!!busyId || !selectedStudent}
            loading={busyId === "FORM"}
            onClick={() => void submit()}
          >
            {editingRequest ? "重新提交审核" : "提交请假申请"}
          </Button>
          {editingRequest ? (
            <Button
              className="leave-button leave-button-secondary"
              disabled={!!busyId}
              onClick={() => setEditingRequest(null)}
            >
              取消修改
            </Button>
          ) : null}
        </View>
      ) : null}

      {status === "READY" && students.length === 0 ? (
        <View className="leave-card">
          <Text className="leave-section-title">暂无已确认关联的学生</Text>
          <Text className="leave-copy">完成家长关系审核后，就可以在这里提交请假申请。</Text>
        </View>
      ) : null}

      {status === "READY" ? (
        <View>
          <View className="leave-card">
            <Text className="leave-section-title">申请记录</Text>
            <Button className="leave-button leave-button-secondary" disabled={!!busyId} onClick={() => void refresh()}>
              刷新申请
            </Button>
          </View>
          {requests.length === 0 ? (
            <View className="leave-card"><Text className="leave-copy">目前没有请假申请。</Text></View>
          ) : requests.map((request) => (
            <View className="leave-card" key={request.id}>
              <Text className="leave-eyebrow">{STATUS_LABEL[request.status]}</Text>
              <Text className="leave-student">{request.studentLabel}</Text>
              <Text className="leave-meta">{showDate(request.startDate)} 至 {showDate(request.endDate)}</Text>
              <Text className="leave-meta">申请原因：{request.reasonCategory === "FAMILY_ARRANGEMENT" ? "家庭安排" : "临时事项"}</Text>
              <Text className="leave-meta">{request.acknowledged ? "已确认查看结果" : "结果知悉：待确认"}</Text>
              {request.actions.some((action) => ["withdraw", "resubmit", "acknowledge"].includes(action)) ? (
                <View className="leave-action-row">
                  {request.actions.includes("withdraw") ? (
                    <Button className="leave-button leave-button-secondary" disabled={!!busyId} onClick={() => void runAction(request, "withdraw")}>撤回</Button>
                  ) : null}
                  {request.actions.includes("resubmit") ? (
                    <Button className="leave-button" disabled={!!busyId} onClick={() => void runAction(request, "resubmit")}>修改并重提</Button>
                  ) : null}
                  {request.actions.includes("acknowledge") ? (
                    <Button className="leave-button" disabled={!!busyId} onClick={() => void runAction(request, "acknowledge")}>确认已查看</Button>
                  ) : null}
                </View>
              ) : null}
            </View>
          ))}
        </View>
      ) : null}

      <Text className="leave-footnote">请假申请仅显示当前账号已获准查看的学生与记录。</Text>
    </View>
  );
}
