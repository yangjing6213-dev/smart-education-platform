import { Button, Picker, Text, View } from "@tarojs/components";
import Taro, { useDidShow } from "@tarojs/taro";
import { useEffect, useRef, useState } from "react";
import { inviteSession } from "../../../auth/runtime-session";
import { hasRoleAccess } from "../../../auth/role-gate";
import type { StaffDailyValues } from "../../../../../../packages/contracts/src/staff-daily";
import {
  STAFF_DAILY_FIELDS,
  createStaffDailyDraft,
  editStaffDailyDraft,
  loadStaffDailyReports,
  resubmitStaffDailyDraft,
  staffDailyValueLabel,
  submitStaffDailyDraft,
  type StaffDailyRecord,
} from "../../../staff-daily/staff-daily";
import "./index.css";

type PageStatus = "LOADING" | "READY" | "ERROR";

const INITIAL_VALUES: StaffDailyValues = {
  arrival: "ARRIVED_AS_PLANNED",
  homework: "COMPLETED",
  activity: "PARTICIPATED",
  classroom: "ROUTINE",
  followUp: "NONE",
};

const STATUS_LABEL: Record<StaffDailyRecord["status"], string> = {
  DRAFT: "草稿",
  SUBMITTED: "待审核",
  RETURNED: "退回修改",
  CONFIRMED: "审核通过",
};

const SOURCE_LABEL: Record<string, string> = {
  TASK: "任务",
  ATTENDANCE: "到校记录",
  CARE_RECORD: "成长记录",
  PICKUP: "接送核验",
  PICKUP_EXCEPTION: "接送异常",
};

function today(): string {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function errorMessage(error: unknown): string {
  if (typeof error === "object" && error !== null && "statusCode" in error) {
    const statusCode = Number(error.statusCode);
    if (statusCode === 401) return "登录状态已过期，请重新登录后继续。";
    if (statusCode === 403) return "当前账号没有工作日报权限，请联系机构负责人。";
    if (statusCode === 409) return "日报状态已变化，请刷新后再试。";
    if (statusCode === 503) return "机构服务暂未连接，请稍后重试。";
  }
  return error instanceof Error && error.message.includes("工作日报")
    ? error.message
    : "工作日报暂时无法读取或保存，请稍后重试。";
}

export default function StaffDailyReportPage() {
  const [status, setStatus] = useState<PageStatus>("LOADING");
  const [message, setMessage] = useState("正在读取当前账号可处理的工作日报…");
  const [records, setRecords] = useState<StaffDailyRecord[]>([]);
  const [canCreate, setCanCreate] = useState(false);
  const [date, setDate] = useState(today());
  const [values, setValues] = useState<StaffDailyValues>(INITIAL_VALUES);
  const [editing, setEditing] = useState<StaffDailyRecord | null>(null);
  const [busy, setBusy] = useState(false);
  const mounted = useRef(false);
  const initialLoadDone = useRef(false);
  const inFlight = useRef(false);

  useEffect(() => {
    mounted.current = true;
    void loadInitial();
    return () => {
      mounted.current = false;
      initialLoadDone.current = false;
    };
  }, []);

  useDidShow(() => {
    if (initialLoadDone.current) void refresh();
  });

  async function loadInitial() {
    const session = await inviteSession.restore();
    if (!mounted.current) return;
    if (!hasRoleAccess(session, "STAFF")) {
      void Taro.redirectTo({ url: "/pages/auth/login/index" });
      return;
    }
    await refresh();
    initialLoadDone.current = true;
  }

  async function refresh() {
    if (inFlight.current) return;
    if (!hasRoleAccess(inviteSession.snapshot, "STAFF")) {
      void Taro.redirectTo({ url: "/pages/auth/login/index" });
      return;
    }
    inFlight.current = true;
    setStatus("LOADING");
    try {
      const listing = await loadStaffDailyReports((path) => inviteSession.getAuthenticated(path));
      if (!mounted.current) return;
      setRecords([...listing.records]);
      setCanCreate(listing.canCreate);
      setMessage(
        listing.records.length
          ? "仅显示当前员工账号有权处理的日报。"
          : "还没有工作日报，可以从下方新建。 ",
      );
      setStatus("READY");
    } catch (error) {
      if (!mounted.current) return;
      setRecords([]);
      setCanCreate(false);
      setMessage(errorMessage(error));
      setStatus("ERROR");
    } finally {
      inFlight.current = false;
    }
  }

  function chooseValue(key: keyof StaffDailyValues, rawIndex: string | number) {
    const field = STAFF_DAILY_FIELDS.find((item) => item.key === key);
    const option = field?.options[Number(rawIndex)];
    if (!option) return;
    setValues((current) => ({ ...current, [key]: option.value }) as StaffDailyValues);
  }

  function startEditing(record: StaffDailyRecord) {
    setEditing(record);
    setDate(record.date);
    setValues(record.values);
    setMessage(
      record.status === "RETURNED" ? "修改内容后，可直接重新提交。" : "修改草稿后，再提交审核。 ",
    );
  }

  function cancelEditing() {
    setEditing(null);
    setDate(today());
    setValues(INITIAL_VALUES);
    setMessage("已退出修改；表单可用于新建日报。");
  }

  async function saveDraft() {
    if (inFlight.current || busy) return;
    if (!hasRoleAccess(inviteSession.snapshot, "STAFF")) {
      void Taro.redirectTo({ url: "/pages/auth/login/index" });
      return;
    }
    inFlight.current = true;
    setBusy(true);
    try {
      let saved: StaffDailyRecord;
      if (editing?.actions.includes("resubmit")) {
        saved = await resubmitStaffDailyDraft(
          (path, body) => inviteSession.postAuthenticated(path, body),
          editing.id,
          editing.version,
          values,
        );
        setMessage("修改已重新提交审核。");
      } else if (editing?.actions.includes("edit")) {
        saved = await editStaffDailyDraft(
          (path, body) => inviteSession.patchAuthenticated(path, body),
          editing.id,
          editing.version,
          values,
        );
        setMessage("草稿修改已保存，请核对后提交审核。");
      } else {
        if (!canCreate) {
          setMessage("当前账号没有新建日报权限。");
          return;
        }
        saved = await createStaffDailyDraft(
          (path, body) => inviteSession.postAuthenticated(path, body),
          date,
          values,
        );
        setMessage("日报草稿已保存。请核对后提交审核。");
      }
      if (!mounted.current) return;
      setRecords((current) => [saved, ...current.filter((item) => item.id !== saved.id)]);
      setEditing(null);
      setValues(INITIAL_VALUES);
      setDate(today());
    } catch (error) {
      if (mounted.current) setMessage(errorMessage(error));
    } finally {
      inFlight.current = false;
      if (mounted.current) setBusy(false);
    }
  }

  async function submit(record: StaffDailyRecord) {
    if (inFlight.current || !record.actions.includes("submit")) return;
    if (!hasRoleAccess(inviteSession.snapshot, "STAFF")) {
      void Taro.redirectTo({ url: "/pages/auth/login/index" });
      return;
    }
    const confirmation = await Taro.showModal({
      title: "提交工作日报",
      content: `确认提交 ${record.date} 的日报供机构审核？`,
      confirmText: "提交审核",
      cancelText: "再检查",
    });
    if (!confirmation.confirm) return;

    inFlight.current = true;
    setBusy(true);
    try {
      const updated = await submitStaffDailyDraft(
        (path, body) => inviteSession.postAuthenticated(path, body),
        record.id,
        record.version,
      );
      if (!mounted.current) return;
      setRecords((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      setMessage("工作日报已提交审核。");
    } catch (error) {
      if (mounted.current) setMessage(errorMessage(error));
    } finally {
      inFlight.current = false;
      if (mounted.current) setBusy(false);
    }
  }

  return (
    <View className="staff-daily-page">
      <View className="daily-intro">
        <Text className="daily-eyebrow">员工端 · 日常工作</Text>
        <Text className="daily-title">工作日报</Text>
        <Text className="daily-copy">
          用固定选项快速记录当天情况。提交后由机构审核，日报只按账号授权范围读取。
        </Text>
      </View>

      <View className="daily-section-heading">
        <View>
          <Text className="daily-section-title">填写日报</Text>
          <Text className="daily-copy">{message}</Text>
        </View>
        <Button
          className="daily-refresh-button"
          disabled={status === "LOADING" || busy}
          onClick={() => void refresh()}
        >
          刷新
        </Button>
      </View>

      <View className="daily-form-card">
        <Text className="daily-form-title">{editing ? "修改日报" : "新建日报"}</Text>
        <Text className="daily-field-label">日期</Text>
        <Picker mode="date" value={date} onChange={(event) => setDate(String(event.detail.value))}>
          <View className="daily-picker-value">{date}</View>
        </Picker>
        {STAFF_DAILY_FIELDS.map((field) => {
          const selected = field.options.findIndex((option) => option.value === values[field.key]);
          return (
            <View className="daily-field" key={field.key}>
              <Text className="daily-field-label">{field.label}</Text>
              <Picker
                mode="selector"
                range={field.options.map((option) => option.label)}
                value={Math.max(selected, 0)}
                onChange={(event) => chooseValue(field.key, event.detail.value)}
              >
                <View className="daily-picker-value">
                  <Text>{staffDailyValueLabel(field.key, values[field.key])}</Text>
                  <Text className="daily-picker-chevron">⌄</Text>
                </View>
              </Picker>
            </View>
          );
        })}
        <View className="daily-form-actions">
          <Button
            className="daily-primary-button"
            disabled={busy || status !== "READY" || (!editing && !canCreate)}
            loading={busy}
            onClick={() => void saveDraft()}
          >
            {editing?.actions.includes("resubmit") ? "提交修改" : editing ? "保存修改" : "保存草稿"}
          </Button>
          {editing ? (
            <Button className="daily-secondary-button" disabled={busy} onClick={cancelEditing}>
              取消修改
            </Button>
          ) : null}
        </View>
        {!canCreate && !editing && status === "READY" ? (
          <Text className="daily-permission-hint">当前账号仅可查看日报，不能新建。</Text>
        ) : null}
      </View>

      <View className="daily-section-heading daily-record-heading">
        <View>
          <Text className="daily-section-title">已保存的日报</Text>
          <Text className="daily-copy">提交审核后可在这里查看处理状态。</Text>
        </View>
      </View>

      {status === "LOADING" ? (
        <View className="daily-state-card">
          <Text className="daily-copy">正在读取工作日报…</Text>
        </View>
      ) : null}
      {status === "ERROR" ? (
        <View className="daily-state-card">
          <Text className="daily-state-title">暂时无法读取</Text>
          <Text className="daily-copy">{message}</Text>
          <Button className="daily-primary-button" onClick={() => void refresh()}>
            重新读取
          </Button>
        </View>
      ) : null}
      {status === "READY" && records.length === 0 ? (
        <View className="daily-state-card">
          <Text className="daily-state-title">暂无日报</Text>
          <Text className="daily-copy">新建日报后，草稿和审核状态会显示在这里。</Text>
        </View>
      ) : null}
      {status === "READY"
        ? records.map((record) => (
            <View className="daily-record-card" key={record.id}>
              <View className="daily-record-heading-row">
                <Text className="daily-record-title">{record.date} · 工作日报</Text>
                <Text className={`daily-status daily-status-${record.status.toLowerCase()}`}>
                  {STATUS_LABEL[record.status]}
                </Text>
              </View>
              {STAFF_DAILY_FIELDS.map((field) => (
                <Text className="daily-record-value" key={field.key}>
                  {field.label}：{staffDailyValueLabel(field.key, record.values[field.key])}
                </Text>
              ))}
              <Text className="daily-record-meta">
                关联记录：
                {Object.entries(record.sourceCounts)
                  .filter(([, count]) => count > 0)
                  .map(([kind, count]) => `${SOURCE_LABEL[kind] ?? "记录"} ${count} 条`)
                  .join("、") || "暂无"}
              </Text>
              {record.learningSummary ? (
                <Text className="daily-record-meta">
                  学习情况：已完成多项任务；
                  {record.learningSummary.usedGuidance ? "使用过学习提示" : "未使用学习提示"}
                  {record.learningSummary.needsTeacherFollowUp ? "；需教师继续关注" : ""}
                </Text>
              ) : null}
              <View className="daily-record-actions">
                {record.actions.includes("edit") || record.actions.includes("resubmit") ? (
                  <Button
                    className="daily-secondary-button"
                    disabled={busy}
                    onClick={() => startEditing(record)}
                  >
                    修改内容
                  </Button>
                ) : null}
                {record.actions.includes("submit") ? (
                  <Button
                    className="daily-primary-button"
                    disabled={busy}
                    onClick={() => void submit(record)}
                  >
                    提交审核
                  </Button>
                ) : null}
              </View>
            </View>
          ))
        : null}

      <Text className="daily-footnote">
        工作日报按员工账号和机构授权范围管理，不包含学生姓名或联系方式。
      </Text>
    </View>
  );
}
