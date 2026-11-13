import { Button, Checkbox, CheckboxGroup, Picker, Text, View } from "@tarojs/components";
import Taro from "@tarojs/taro";
import { useEffect, useRef, useState } from "react";
import { inviteSession } from "../../../auth/runtime-session";
import { hasRoleAccess } from "../../../auth/role-gate";
import {
  loadParentBindingApplications,
  loadParentBindingOptions,
  loadParentGuardianRelationships,
  canSubmitParentBinding,
  releaseParentGuardianRelationship,
  submitParentBinding,
  toggleParentBindingConsent,
  type ParentBindingApplication,
  type ParentBindingOption,
  type ParentBindingReceipt,
  type ParentGuardianRelationship,
} from "../../../binding/parent-binding";
import "./index.css";

type PageStatus = "LOADING" | "READY" | "ERROR";

function errorMessage(error: unknown): string {
  if (typeof error === "object" && error !== null && "statusCode" in error) {
    const statusCode = Number(error.statusCode);
    if (statusCode === 401) return "登录状态已过期，请重新登录后提交。";
    if (statusCode === 403) return "当前账号没有管理关系的权限。";
    if (statusCode === 409) return "关系状态已变化，请重新读取后再试。";
    if (statusCode === 503) return "机构服务暂未连接，请稍后再试。";
  }
  return "关系操作暂时无法完成，请稍后重试。";
}

export default function ParentBindingPage() {
  const [status, setStatus] = useState<PageStatus>("LOADING");
  const [message, setMessage] = useState("正在读取当前账号可申请关联的学生…");
  const [options, setOptions] = useState<ParentBindingOption[]>([]);
  const [applications, setApplications] = useState<ParentBindingApplication[]>([]);
  const [relationships, setRelationships] = useState<ParentGuardianRelationship[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [receipt, setReceipt] = useState<ParentBindingReceipt | null>(null);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const mounted = useRef(false);

  useEffect(() => {
    mounted.current = true;
    void loadOptions();
    return () => {
      mounted.current = false;
    };
  }, []);

  async function loadOptions() {
    const session = await inviteSession.restore();
    if (!mounted.current) return;
    if (!hasRoleAccess(session, "PARENT")) {
      void Taro.redirectTo({ url: "/pages/auth/login/index" });
      return;
    }
    try {
      const get = (path: string) => inviteSession.getAuthenticated(path);
      const [next, existing, existingRelationships] = await Promise.all([
        loadParentBindingOptions(get),
        loadParentBindingApplications(get),
        loadParentGuardianRelationships(get),
      ]);
      if (!mounted.current) return;
      setOptions(next);
      setApplications(existing);
      setRelationships(existingRelationships);
      setSelectedId(
        (current) =>
          current ||
          next.find((option) => canSubmitParentBinding(option.id, existing, existingRelationships))
            ?.id ||
          next[0]?.id ||
          "",
      );
      setMessage(
        next.length
          ? "请选择需要申请关联的学生。已提交记录及审核结果显示在下方。"
          : "当前账号暂无可申请关联的学生资料。",
      );
      setStatus("READY");
    } catch (error) {
      if (!mounted.current) return;
      setMessage(errorMessage(error));
      setStatus("ERROR");
    }
  }

  async function submit() {
    if (busy || receipt) return;
    if (!hasRoleAccess(inviteSession.snapshot, "PARENT")) {
      void Taro.redirectTo({ url: "/pages/auth/login/index" });
      return;
    }
    setBusy(true);
    try {
      const next = await submitParentBinding(
        (path, body) => inviteSession.postAuthenticated(path, body),
        selectedId,
        consent,
      );
      if (!mounted.current) return;
      setReceipt(next);
      setApplications((current) => [
        ...current,
        {
          id: next.id,
          studentId: selectedId,
          status: "PENDING",
          version: next.version,
          submittedAt: next.submittedAt,
          reviewedAt: null,
        },
      ]);
      setMessage("申请已提交，等待员工审核。审核完成后可在家长首页查看结果。");
    } catch (error) {
      if (!mounted.current) return;
      setMessage(errorMessage(error));
    } finally {
      if (mounted.current) setBusy(false);
    }
  }

  async function releaseRelationship(relationship: ParentGuardianRelationship) {
    if (busy || relationship.status !== "ACTIVE") return;
    if (!hasRoleAccess(inviteSession.snapshot, "PARENT")) {
      void Taro.redirectTo({ url: "/pages/auth/login/index" });
      return;
    }
    setBusy(true);
    try {
      const confirmation = await Taro.showModal({
        title: "解除监护关系",
        content: "解除后可重新提交关系申请，新申请需要再次经过员工审核。确认继续吗？",
        confirmText: "确认解除",
        confirmColor: "#82B435",
        cancelText: "再想一想",
      });
      if (!confirmation.confirm || !mounted.current) return;
      const updated = await releaseParentGuardianRelationship(
        (path) => inviteSession.getAuthenticated(path),
        (path, body) => inviteSession.postAuthenticated(path, body),
        relationship.id,
        relationship.version,
        true,
      );
      if (!mounted.current) return;
      setRelationships((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );
      setMessage("监护关系已解除，并已核对最新状态。");
    } catch (error) {
      if (mounted.current) setMessage(errorMessage(error));
    } finally {
      if (mounted.current) setBusy(false);
    }
  }

  function returnToParent() {
    void Taro.navigateBack();
  }

  const selectedLabel = options.find((option) => option.id === selectedId)?.label ?? "请选择学生";
  const selectedApplication = applications
    .filter((item) => item.studentId === selectedId)
    .sort((left, right) => left.submittedAt.localeCompare(right.submittedAt))
    .slice(-1)[0];
  const selectedRelationship = relationships.find(
    (item) => item.sourceApplicationId === selectedApplication?.id,
  );
  const canSubmit = selectedId
    ? canSubmitParentBinding(selectedId, applications, relationships)
    : false;
  const isReapplication =
    canSubmit &&
    selectedApplication?.status === "APPROVED" &&
    selectedRelationship?.status === "RELEASED";
  const applicationStatus: Record<ParentBindingApplication["status"], string> = {
    PENDING: "等待员工审核",
    APPROVED: "审核已通过",
    REJECTED: "审核未通过",
  };
  const relationshipStatus: Record<ParentGuardianRelationship["status"], string> = {
    ACTIVE: "监护关系已建立",
    RELEASED: "监护关系已结束",
  };

  return (
    <View className="parent-binding-page">
      <Button className="binding-back-button" onClick={returnToParent}>
        ‹ 返回家长首页
      </Button>
      <View className="binding-brand">
        <View className="binding-brand-mark">心</View>
        <View>
          <Text className="binding-brand-name">同芯学园</Text>
          <Text className="binding-brand-subtitle">TONG XIN XUE YUAN</Text>
        </View>
      </View>

      <View className="binding-intro">
        <Text className="binding-eyebrow">家长服务 · 关系申请</Text>
        <Text className="binding-title">申请关联学生</Text>
        <Text className="binding-copy">
          学生选项由机构账号权限提供。提交后由员工审核，审核结果会显示在家长服务中。
        </Text>
      </View>

      <View className="binding-card binding-relationships">
        <Text className="binding-section-title">监护关系</Text>
        {status === "LOADING" ? (
          <Text className="binding-message">正在读取已审核的关系…</Text>
        ) : null}
        {status === "READY" && relationships.length === 0 ? (
          <Text className="binding-message">当前账号没有已审核的监护关系。</Text>
        ) : null}
        {relationships.map((relationship) => (
          <View className="binding-relationship-row" key={relationship.id}>
            <View className="binding-relationship-summary">
              <Text className="binding-application-name">
                {options.find((option) => option.id === relationship.studentId)?.label ??
                  "已关联学生"}
              </Text>
              <Text className="binding-message">
                {relationshipStatus[relationship.status]} · 审核时间：
                {new Date(relationship.approvedAt).toLocaleString("zh-CN")}
              </Text>
            </View>
            {relationship.status === "ACTIVE" ? (
              <Button
                className="binding-release-button"
                disabled={busy || status !== "READY"}
                loading={busy}
                onClick={() => void releaseRelationship(relationship)}
              >
                解除关系
              </Button>
            ) : (
              <Text className="binding-ended-label">已结束</Text>
            )}
          </View>
        ))}
      </View>

      <View className="binding-card">
        <Text className="binding-section-title">选择学生</Text>
        {status === "LOADING" ? <Text className="binding-message">{message}</Text> : null}
        {status === "ERROR" ? (
          <View>
            <Text className="binding-message">{message}</Text>
            <Button className="binding-secondary-button" onClick={() => void loadOptions()}>
              重新读取
            </Button>
          </View>
        ) : null}
        {status === "READY" && options.length > 0 && !receipt ? (
          <Picker
            mode="selector"
            range={options.map((option) => option.label)}
            value={Math.max(
              0,
              options.findIndex((option) => option.id === selectedId),
            )}
            onChange={(event) => {
              const selected = options[Number(event.detail.value)];
              if (selected) setSelectedId(selected.id);
            }}
          >
            <View className="binding-picker">
              <Text className="binding-picker-label">{selectedLabel}</Text>
              <Text className="binding-picker-arrow">⌄</Text>
            </View>
          </Picker>
        ) : null}
        {status === "READY" && options.length > 0 && !receipt ? (
          <View className="binding-consent-row">
            <CheckboxGroup
              className="binding-consent-control"
              onChange={(event) => setConsent(event.detail.value.includes("guardian-consent"))}
            >
              <Checkbox id="guardian-consent" value="guardian-consent" checked={consent} color="#82B435" />
            </CheckboxGroup>
            <Text
              className="binding-consent-copy"
              onClick={() => setConsent((current) => toggleParentBindingConsent(current))}
            >
                我确认申请与所选学生建立监护人关系，并同意提交机构审核。
            </Text>
          </View>
        ) : null}
        {status === "READY" && options.length === 0 ? (
          <Text className="binding-message">{message}</Text>
        ) : null}
        {receipt ? (
          <View className="binding-receipt">
            <Text className="binding-receipt-title">申请已提交</Text>
            <Text className="binding-message">审核状态：等待员工审核</Text>
            <Text className="binding-message">
              提交时间：{new Date(receipt.submittedAt).toLocaleString("zh-CN")}
            </Text>
          </View>
        ) : null}
        {selectedApplication && !receipt ? (
          <View className="binding-existing-status">
            <Text className="binding-receipt-title">该学生已有申请</Text>
            <Text className="binding-message">
              审核状态：{applicationStatus[selectedApplication.status]}
            </Text>
            <Text className="binding-message">
              提交时间：{new Date(selectedApplication.submittedAt).toLocaleString("zh-CN")}
            </Text>
            {selectedApplication.reviewedAt ? (
              <Text className="binding-message">
                审核时间：{new Date(selectedApplication.reviewedAt).toLocaleString("zh-CN")}
              </Text>
            ) : null}
          </View>
        ) : null}
        {applications.length > 0 ? (
          <View className="binding-application-list">
            <Text className="binding-section-title">我的申请记录</Text>
            {applications.map((application) => {
              const option = options.find((item) => item.id === application.studentId);
              if (!option) return null;
              return (
                <View className="binding-application-row" key={application.id}>
                  <Text className="binding-application-name">{option.label}</Text>
                  <Text className="binding-message">{applicationStatus[application.status]}</Text>
                </View>
              );
            })}
          </View>
        ) : null}
        <Text className="binding-message">{status === "READY" && !receipt ? message : ""}</Text>
        <Button
          className="binding-primary-button"
          disabled={
            busy ||
            status !== "READY" ||
            options.length === 0 ||
            !consent ||
            !canSubmit ||
            !!receipt
          }
          loading={busy}
          onClick={() => void submit()}
        >
          {isReapplication ? "重新申请关系" : "提交关系申请"}
        </Button>
      </View>

      <Text className="binding-footnote">
        关系申请仅提交给当前机构服务；没有连接时不会生成虚构申请。
      </Text>
    </View>
  );
}
