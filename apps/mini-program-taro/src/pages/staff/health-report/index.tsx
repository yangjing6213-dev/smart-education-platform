import { Button, Picker, Text, View } from "@tarojs/components";
import Taro from "@tarojs/taro";
import { useEffect, useRef, useState } from "react";
import { inviteSession } from "../../../auth/runtime-session";
import { hasRoleAccess } from "../../../auth/role-gate";
import {
  createHealthIncidentClient,
  HEALTH_INCIDENT_DISPOSITIONS,
  HEALTH_INCIDENT_OBSERVATIONS,
  runHealthIncidentSingleFlight,
  type HealthIncidentDispositionCode,
  type HealthIncidentDraft,
  type HealthIncidentObservationCode,
  type HealthIncidentSavedDraft,
  type HealthIncidentStudentOption,
} from "../../../health/health-incidents";
import "./index.css";

type PageStatus = "LOADING" | "READY" | "ERROR";

const client = createHealthIncidentClient({
  get: (path) => inviteSession.getAuthenticated(path),
  post: (path, body) => inviteSession.postAuthenticated(path, body),
});

function errorMessage(error: unknown): string {
  if (typeof error === "object" && error !== null && "statusCode" in error) {
    const statusCode = Number(error.statusCode);
    if (statusCode === 401) return "登录状态已过期，请重新登录后继续。";
    if (statusCode === 403) return "当前账号没有健康事项上报权限，请联系机构负责人。";
    if (statusCode === 409) return "记录状态已变化，请刷新后再操作。";
    if (statusCode === 503) return "机构服务暂未连接，请稍后重试。";
  }
  return error instanceof Error && error.message.includes("格式暂不可用")
    ? error.message
    : "健康事项暂时无法保存，请检查网络后重试。";
}

export default function StaffHealthReportPage() {
  const [status, setStatus] = useState<PageStatus>("LOADING");
  const [message, setMessage] = useState("正在读取当前账号可填报的学生…");
  const [students, setStudents] = useState<HealthIncidentStudentOption[]>([]);
  const [savedDrafts, setSavedDrafts] = useState<HealthIncidentSavedDraft[]>([]);
  const [resumeIndex, setResumeIndex] = useState(-1);
  const [newRecordSelected, setNewRecordSelected] = useState(true);
  const [studentIndex, setStudentIndex] = useState(0);
  const [observationIndex, setObservationIndex] = useState(0);
  const [dispositionIndex, setDispositionIndex] = useState(0);
  const [draft, setDraft] = useState<HealthIncidentDraft | null>(null);
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
    try {
      const session = await inviteSession.restore();
      if (!mounted.current) return;
      if (!hasRoleAccess(session, "STAFF")) {
        void Taro.redirectTo({ url: "/pages/auth/login/index" });
        return;
      }
      const [options, drafts] = await Promise.all([
        client.loadStaffStudents(),
        client.loadStaffDrafts(),
      ]);
      if (!mounted.current) return;
      setStudents(options);
      setSavedDrafts(drafts);
      setNewRecordSelected(drafts.length === 0);
      setStatus("READY");
      setMessage(
        !options.length
          ? "当前负责班级内暂无可填报的学生。"
          : drafts.length
            ? "发现已保存草稿，请选择继续填写或开始新记录。"
            : "请选择学生并填写固定选项。",
      );
    } catch (error) {
      if (!mounted.current) return;
      setStatus("ERROR");
      setStudents([]);
      setMessage(errorMessage(error));
    }
  }

  function draftLabel(saved: HealthIncidentSavedDraft) {
    const student = students.find((option) => option.id === saved.studentId);
    return student ? `${student.studentLabel} · ${saved.statusLabel}` : "授权范围内的草稿";
  }

  function selectedDraftLabel() {
    const saved = savedDrafts[resumeIndex];
    return saved ? draftLabel(saved) : newRecordSelected ? "新建记录" : "选择草稿或新建记录";
  }

  function resumeDraft(index: number) {
    const saved = savedDrafts[index];
    if (!saved) return;
    const nextStudentIndex = students.findIndex((student) => student.id === saved.studentId);
    const nextObservationIndex = HEALTH_INCIDENT_OBSERVATIONS.findIndex(
      ({ code }) => code === saved.observationCode,
    );
    const nextDispositionIndex = HEALTH_INCIDENT_DISPOSITIONS.findIndex(
      ({ code }) => code === saved.dispositionCode,
    );
    if (nextStudentIndex < 0 || nextObservationIndex < 0 || nextDispositionIndex < 0) {
      setMessage("草稿内容已不在当前授权范围内，暂时无法继续。请联系机构负责人。");
      return;
    }
    setStudentIndex(nextStudentIndex);
    setObservationIndex(nextObservationIndex);
    setDispositionIndex(nextDispositionIndex);
    setDraft(saved);
    setResumeIndex(index);
    setNewRecordSelected(false);
    setMessage("草稿已恢复。请核对内容后提交审核。");
  }

  function chooseDraft(index: number) {
    if (index === 0) {
      setMessage("请选择一份已保存草稿，或选择新建记录。");
      return;
    }
    if (index <= savedDrafts.length) {
      resumeDraft(index - 1);
      return;
    }
    setDraft(null);
    setResumeIndex(-1);
    setNewRecordSelected(true);
    setMessage("已选择新建记录，请填写学生和固定选项。");
  }

  async function saveDraft() {
    const student = students[studentIndex];
    if (
      !student ||
      draft?.status === "SUBMITTED" ||
      (savedDrafts.length > 0 && !draft && !newRecordSelected)
    )
      return;
    await runHealthIncidentSingleFlight(inFlight, async () => {
      setBusy(true);
      try {
        const saved = await client.createStaffDraft({
          studentId: student.id,
          observationCode: HEALTH_INCIDENT_OBSERVATIONS[observationIndex]!
            .code as HealthIncidentObservationCode,
          dispositionCode: HEALTH_INCIDENT_DISPOSITIONS[dispositionIndex]!
            .code as HealthIncidentDispositionCode,
        });
        if (!mounted.current) return;
        setDraft(saved);
        setMessage("草稿已保存。确认内容后，可提交员工审核。");
      } catch (error) {
        if (mounted.current) setMessage(errorMessage(error));
      } finally {
        if (mounted.current) setBusy(false);
      }
    });
  }

  async function submitDraft() {
    if (!draft || draft.status !== "DRAFT") return;
    await runHealthIncidentSingleFlight(inFlight, async () => {
      setBusy(true);
      try {
        const submitted = await client.submitStaffDraft(draft.id, draft.version);
        if (!mounted.current) return;
        setDraft(submitted);
        setMessage("已提交审核。审核发布后，家长可在健康消息中查看。");
      } catch (error) {
        if (mounted.current) setMessage(errorMessage(error));
      } finally {
        if (mounted.current) setBusy(false);
      }
    });
  }

  return (
    <View className="health-report-page">
      <View className="health-report-brand">
        <View className="health-report-brand-mark">心</View>
        <View>
          <Text className="health-report-brand-name">同芯学园</Text>
          <Text className="health-report-brand-subtitle">TONG XIN XUE YUAN</Text>
        </View>
      </View>

      <View className="health-report-card">
        <Text className="health-report-eyebrow">同芯学园 · 员工服务</Text>
        <Text className="health-report-title">健康事项上报</Text>
        <Text className="health-report-copy">
          选择当前负责班级的学生，按固定选项记录并提交审核。
        </Text>
      </View>

      <View className="health-report-card">
        <Text className="health-report-section-title">填写健康记录</Text>
        {savedDrafts.length > 0 ? (
          <View className="health-report-field">
            <Text className="health-report-label">继续填写</Text>
            <Picker
              mode="selector"
              range={[
                "选择草稿或新建记录",
                ...savedDrafts.map(draftLabel),
                "新建记录",
              ]}
              value={
                resumeIndex >= 0
                  ? resumeIndex + 1
                  : newRecordSelected
                    ? savedDrafts.length + 1
                    : 0
              }
              disabled={busy || !!draft}
              onChange={(event) => chooseDraft(Number(event.detail.value))}
            >
              <View className="health-report-picker">{selectedDraftLabel()}</View>
            </Picker>
          </View>
        ) : null}
        <View className="health-report-field">
          <Text className="health-report-label">学生</Text>
          <Picker
            mode="selector"
            range={students.map((student) => student.studentLabel)}
            value={studentIndex}
            disabled={
              status !== "READY" ||
              students.length === 0 ||
              busy ||
              !!draft ||
              (savedDrafts.length > 0 && !newRecordSelected)
            }
            onChange={(event) => setStudentIndex(Number(event.detail.value))}
          >
            <View className="health-report-picker">
              {students[studentIndex] ? students[studentIndex]!.studentLabel : "暂无可填报学生"}
            </View>
          </Picker>
        </View>
        <View className="health-report-field">
          <Text className="health-report-label">观察结果</Text>
          <Picker
            mode="selector"
            range={HEALTH_INCIDENT_OBSERVATIONS.map(({ label }) => label)}
            value={observationIndex}
            disabled={busy || !!draft}
            onChange={(event) => setObservationIndex(Number(event.detail.value))}
          >
            <View className="health-report-picker">
              {HEALTH_INCIDENT_OBSERVATIONS[observationIndex]!.label}
            </View>
          </Picker>
        </View>
        <View className="health-report-field">
          <Text className="health-report-label">处理情况</Text>
          <Picker
            mode="selector"
            range={HEALTH_INCIDENT_DISPOSITIONS.map(({ label }) => label)}
            value={dispositionIndex}
            disabled={busy || !!draft}
            onChange={(event) => setDispositionIndex(Number(event.detail.value))}
          >
            <View className="health-report-picker">
              {HEALTH_INCIDENT_DISPOSITIONS[dispositionIndex]!.label}
            </View>
          </Picker>
        </View>
        <View className="health-report-actions">
          <Button
            className="health-report-button health-report-button-secondary"
            disabled={status !== "READY" || students.length === 0 || busy || !!draft}
            onClick={() => void saveDraft()}
          >
            保存草稿
          </Button>
          <Button
            className="health-report-button"
            disabled={!draft || draft.status !== "DRAFT" || busy}
            onClick={() => void submitDraft()}
          >
            提交审核
          </Button>
        </View>
        <Text className="health-report-message">{message}</Text>
        {draft ? (
          <View className="health-report-draft">
            <Text className="health-report-draft-title">当前记录：{draft.statusLabel}</Text>
            <Text className="health-report-copy">
              提交后由管理端审核发布，家长只能查看已发布摘要。
            </Text>
          </View>
        ) : null}
      </View>

      <Text className="health-report-footnote">
        页面只显示服务端授权范围内的合成记录；不会向家长发送外部通知。
      </Text>
    </View>
  );
}
