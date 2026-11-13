import { Button, Text, View } from "@tarojs/components";
import Taro from "@tarojs/taro";
import { useEffect, useRef, useState } from "react";
import { inviteSession } from "../../../auth/runtime-session";
import { hasRoleAccess } from "../../../auth/role-gate";
import {
  careRecordValueLabel,
  loadParentCareRecords,
  recordParentCareReceipt,
  type CareRecordValues,
  type ParentCareRecord,
} from "../../../care-record/care-record";
import "./index.css";

type PageStatus = "LOADING" | "READY" | "ERROR";

function errorMessage(error: unknown): string {
  if (typeof error === "object" && error !== null && "statusCode" in error) {
    const code = Number(error.statusCode);
    if (code === 401) return "登录状态已过期，请重新登录后查看。";
    if (code === 403) return "当前账号没有查看成长记录的权限。";
    if (code === 503) return "机构服务暂未连接，请稍后再试。";
  }
  return error instanceof Error && error.message.includes("成长记录")
    ? error.message
    : "成长记录暂时无法读取，请稍后重试。";
}

function recordSummary(values: CareRecordValues): string {
  return [
    `到离校：${careRecordValueLabel("arrival", values.arrival)}`,
    `作业整理：${careRecordValueLabel("homework", values.homework)}`,
    `餐食情况：${careRecordValueLabel("meal", values.meal)}`,
    `午休情况：${careRecordValueLabel("rest", values.rest)}`,
    `活动参与：${careRecordValueLabel("activity", values.activity)}`,
    `日常状态：${careRecordValueLabel("wellbeing", values.wellbeing)}`,
  ].join("\n");
}

function formatDate(value: string): string {
  const [year, month, day] = value.split("-");
  return `${year}年${Number(month)}月${Number(day)}日`;
}

export default function ParentCareRecordPage() {
  const [status, setStatus] = useState<PageStatus>("LOADING");
  const [message, setMessage] = useState("正在读取已发布的成长记录…");
  const [records, setRecords] = useState<ParentCareRecord[]>([]);
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

  async function loadInitial() {
    const session = await inviteSession.restore();
    if (!mounted.current) return;
    if (!hasRoleAccess(session, "PARENT")) {
      void Taro.redirectTo({ url: "/pages/auth/login/index" });
      return;
    }
    await refresh();
  }

  async function refresh() {
    if (!hasRoleAccess(inviteSession.snapshot, "PARENT")) {
      void Taro.redirectTo({ url: "/pages/auth/login/index" });
      return;
    }
    setStatus("LOADING");
    try {
      const next = await loadParentCareRecords((path) => inviteSession.getAuthenticated(path));
      if (!mounted.current) return;
      setRecords(next);
      setMessage(next.length ? "以下内容已由员工审核并单独发布。" : "暂无已发布的成长记录。");
      setStatus("READY");
    } catch (error) {
      if (!mounted.current) return;
      setMessage(errorMessage(error));
      setStatus("ERROR");
    }
  }

  async function openRecord(record: ParentCareRecord) {
    if (inFlight.current) return;
    if (!hasRoleAccess(inviteSession.snapshot, "PARENT")) {
      void Taro.redirectTo({ url: "/pages/auth/login/index" });
      return;
    }
    inFlight.current = true;
    setBusyId(record.id);
    try {
      const opened = await Taro.showModal({
        title: `${record.studentLabel} · ${formatDate(record.date)}`,
        content: recordSummary(record.values),
        confirmText: "我已查看",
        cancelText: "返回",
      });
      if (!opened.confirm || record.receipt !== "UNREAD") return;
      const read = await recordParentCareReceipt(
        (path, body) => inviteSession.postAuthenticated(path, body),
        record,
        "read",
      );
      if (!mounted.current) return;
      setRecords((current) => current.map((item) => item.id === record.id ? read : item));
      setMessage("已记录查看状态；如有需要，可再单独确认知悉。");
    } catch (error) {
      if (mounted.current) setMessage(errorMessage(error));
    } finally {
      inFlight.current = false;
      if (mounted.current) setBusyId("");
    }
  }

  async function acknowledge(record: ParentCareRecord) {
    if (inFlight.current || record.receipt !== "READ") return;
    if (!hasRoleAccess(inviteSession.snapshot, "PARENT")) {
      void Taro.redirectTo({ url: "/pages/auth/login/index" });
      return;
    }
    inFlight.current = true;
    setBusyId(record.id);
    try {
      const confirmation = await Taro.showModal({
        title: "确认知悉成长记录",
        content: "确认已阅读这条成长记录。",
        confirmText: "确认知悉",
        cancelText: "再看看",
      });
      if (!confirmation.confirm) return;
      const acknowledged = await recordParentCareReceipt(
        (path, body) => inviteSession.postAuthenticated(path, body),
        record,
        "acknowledge",
      );
      if (!mounted.current) return;
      setRecords((current) => current.map((item) => item.id === record.id ? acknowledged : item));
      setMessage("已确认知悉。");
    } catch (error) {
      if (mounted.current) setMessage(errorMessage(error));
    } finally {
      inFlight.current = false;
      if (mounted.current) setBusyId("");
    }
  }

  return (
    <View className="parent-care-page">
      <View className="parent-care-intro">
        <Text className="parent-care-eyebrow">家长服务 · 成长记录</Text>
        <Text className="parent-care-title">孩子的每日成长</Text>
        <Text className="parent-care-copy">这里只显示员工审核并发布的内容。请先打开记录查看，再按需确认知悉。</Text>
      </View>

      <View className="parent-care-heading">
        <View>
          <Text className="parent-care-section-title">已发布记录</Text>
          <Text className="parent-care-message">{message}</Text>
        </View>
        <Button className="parent-care-refresh" disabled={status === "LOADING" || !!busyId} onClick={() => void refresh()}>
          刷新
        </Button>
      </View>

      {status === "LOADING" ? (
        <View className="parent-care-state">
          <Text className="parent-care-state-title">正在读取</Text>
          <Text className="parent-care-copy">{message}</Text>
        </View>
      ) : null}
      {status === "ERROR" ? (
        <View className="parent-care-state">
          <Text className="parent-care-state-title">暂时无法显示</Text>
          <Text className="parent-care-copy">{message}</Text>
          <Button className="parent-care-button" onClick={() => void refresh()}>重新读取</Button>
        </View>
      ) : null}
      {status === "READY" && records.length === 0 ? (
        <View className="parent-care-state">
          <Text className="parent-care-state-title">暂无已发布记录</Text>
          <Text className="parent-care-copy">员工完成审核并发布后，成长记录会显示在这里。</Text>
        </View>
      ) : null}
      {status === "READY" ? records.map((record) => (
        <View className="parent-care-card" key={record.id}>
          <View className="parent-care-card-heading">
            <View>
              <Text className="parent-care-student">{record.studentLabel}</Text>
              <Text className="parent-care-date">{formatDate(record.date)}</Text>
            </View>
            <Text className={`parent-care-status parent-care-status-${record.receipt.toLowerCase()}`}>
              {record.receipt === "ACKNOWLEDGED" ? "已确认知悉" : record.receipt === "READ" ? "已查看" : "待查看"}
            </Text>
          </View>
          {record.receipt === "UNREAD" ? (
            <Text className="parent-care-locked">打开记录后查看已发布内容。</Text>
          ) : (
            <View className="parent-care-values">
              <Text className="parent-care-value">到离校　{careRecordValueLabel("arrival", record.values.arrival)}</Text>
              <Text className="parent-care-value">作业整理　{careRecordValueLabel("homework", record.values.homework)}</Text>
              <Text className="parent-care-value">餐食情况　{careRecordValueLabel("meal", record.values.meal)}</Text>
              <Text className="parent-care-value">午休情况　{careRecordValueLabel("rest", record.values.rest)}</Text>
              <Text className="parent-care-value">活动参与　{careRecordValueLabel("activity", record.values.activity)}</Text>
              <Text className="parent-care-value">日常状态　{careRecordValueLabel("wellbeing", record.values.wellbeing)}</Text>
            </View>
          )}
          <View className="parent-care-actions">
            <Button className="parent-care-button parent-care-button-secondary" disabled={!!busyId} onClick={() => void openRecord(record)}>
              打开成长记录
            </Button>
            {record.receipt === "READ" ? (
              <Button className="parent-care-button" disabled={!!busyId} loading={busyId === record.id} onClick={() => void acknowledge(record)}>
                确认知悉
              </Button>
            ) : null}
          </View>
          {record.receipt === "UNREAD" ? <Text className="parent-care-hint">请先打开成长记录，阅读后才可确认知悉。</Text> : null}
        </View>
      )) : null}

      <Button className="parent-care-button parent-care-button-secondary" onClick={() => void Taro.navigateBack()}>
        返回家长首页
      </Button>
    </View>
  );
}
