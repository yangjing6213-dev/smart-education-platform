import { Button, Input, Text, View } from "@tarojs/components";
import Taro, { useDidShow, useDidHide, useUnload } from "@tarojs/taro";
import { useRef, useState } from "react";
import { inviteSession } from "../../../auth/runtime-session";
import { hasRoleAccess } from "../../../auth/role-gate";
import {
  confirmStaffPickupCredential,
  previewStaffPickupCredential,
  type PickupChecks,
  type StaffPickupPreview,
} from "../../../pickup/parent-pickup";
import "./index.css";

type PageStatus = "LOADING" | "READY" | "ERROR" | "LOGIN";

const checkItems = [
  { key: "student", label: "核对学生本人" },
  { key: "recipient", label: "核对接送人" },
  { key: "authorization", label: "确认有效授权" },
] as const;

function emptyChecks(): PickupChecks {
  return { student: false, recipient: false, authorization: false };
}

function errorMessage(error: unknown): string {
  if (typeof error === "object" && error !== null && "statusCode" in error) {
    const statusCode = Number(error.statusCode);
    if (statusCode === 401) return "登录已过期，请重新登录。";
    if (statusCode === 403) return "当前员工账号没有接送核验权限。";
    if (statusCode === 404) return "凭证无效或已过期，请家长重新生成。";
    if (statusCode === 409) return "凭证已使用或授权状态变化，请刷新后重新核对。";
    if (statusCode === 503) return "机构服务暂未连接，请稍后重试。";
  }
  return "接送核验暂时无法处理，请重新扫码或手动输入。";
}

type StaffSession = typeof inviteSession.snapshot;
type PickupForm = {
  session: StaffSession | null;
  entryId: symbol;
  credential: string;
  preview: StaffPickupPreview | null;
  checks: PickupChecks;
  action: "IDLE" | "SCAN" | "PREVIEW" | "CONFIRM";
};

function emptyForm(session: StaffSession | null = null, credential = ""): PickupForm {
  return {
    session,
    entryId: Symbol(),
    credential,
    preview: null,
    checks: emptyChecks(),
    action: "IDLE",
  };
}

export default function StaffPickupPage() {
  const [status, setStatus] = useState<PageStatus>("LOADING");
  const [message, setMessage] = useState("正在确认员工服务权限…");
  const [form, setForm] = useState<PickupForm>(emptyForm);
  const live = useRef(form);
  const active = useRef(false);
  const restoring = useRef<ReturnType<typeof inviteSession.restore> | null>(null);
  const signedIn = form.session !== null && form.session === inviteSession.snapshot;
  const accountChanged = status === "READY" && !signedIn;
  const ready = status === "READY" && signedIn;
  const preview = ready ? form.preview : null;
  const credential = ready ? form.credential : "";
  const checks = form.checks;
  const busy = form.action !== "IDLE";

  function display(next: PickupForm) {
    live.current = next;
    setForm(next);
  }
  function clear(next: PageStatus, text: string) {
    display(emptyForm());
    setStatus(next);
    setMessage(text);
  }
  function leave() {
    active.current = false;
    clear("LOADING", "正在确认员工服务权限…");
  }

  useDidShow(() => {
    active.current = true;
    void loadInitial();
  });
  useDidHide(leave);
  useUnload(leave);

  async function loadInitial() {
    if (!active.current) return;
    clear("LOADING", "正在确认员工服务权限…");
    const visit = live.current;
    try {
      if (restoring.current) {
        await restoring.current;
        if (live.current !== visit) return;
      }
      const pending = inviteSession.restore();
      restoring.current = pending;
      let session: StaffSession;
      try {
        session = await pending;
      } finally {
        if (restoring.current === pending) restoring.current = null;
      }
      if (live.current !== visit) return;
      if (session.status === "SIGNED_OUT") clear("LOGIN", "请登录员工账号后核验接送。");
      else if (session !== inviteSession.snapshot || session.status !== "READY")
        clear("ERROR", "账号状态暂时无法确认，请重试。");
      else if (!hasRoleAccess(session, "STAFF")) clear("ERROR", "当前账号没有员工接送核验权限。");
      else {
        display(emptyForm(session));
        setMessage("扫码读取家长出示的接送凭证；相机不可用时可手动输入。仅显示现场核验所需信息。");
        setStatus("READY");
      }
    } catch (error) {
      if (live.current === visit) clear("ERROR", errorMessage(error));
    }
  }

  // A pending dialog, lookup or tap belongs only to this exact visible form and verified employee.
  function current(expected: PickupForm): boolean {
    if (!active.current || live.current !== expected) return false;
    const session = inviteSession.snapshot;
    if (session.status === "SIGNED_OUT") clear("LOGIN", "登录已过期，请重新登录。");
    else if (!expected.session || expected.session !== session || !hasRoleAccess(session, "STAFF"))
      clear("ERROR", "账号信息已变化，请重新确认员工账号。");
    else return true;
    return false;
  }
  function begin(action: PickupForm["action"]): PickupForm | null {
    if (busy || !current(form)) return null;
    const pending = { ...(action === "SCAN" ? emptyForm(form.session) : form), action };
    display(pending);
    return pending;
  }

  function editCredential(value: string) {
    const latest = live.current;
    // Multiple native input events may arrive between renders of the same field.
    if (
      latest.entryId !== form.entryId ||
      latest.preview ||
      (latest.action !== "IDLE" && latest.action !== "PREVIEW") ||
      !current(latest)
    )
      return;
    display({ ...latest, credential: value, action: "IDLE" });
    setMessage("请扫描或输入当前凭证，再查询接送信息。");
  }

  function resetPreview() {
    if (busy || !current(form)) return;
    display(emptyForm(form.session));
    setMessage("请扫描或输入当前凭证，再查询接送信息。");
  }
  function fail(pending: PickupForm, error: unknown) {
    if (!current(pending)) return;
    const code =
      typeof error === "object" && error !== null && "statusCode" in error ? error.statusCode : 0;
    if (code === 401 || code === 403) clear(code === 401 ? "LOGIN" : "ERROR", errorMessage(error));
    else {
      display(emptyForm(pending.session));
      setMessage(errorMessage(error));
    }
  }

  async function scanCredential() {
    const pending = begin("SCAN");
    if (!pending) return;
    try {
      const result = await Taro.scanCode({ onlyFromCamera: true, scanType: ["qrCode"] });
      if (!current(pending)) return;
      display(emptyForm(pending.session, result.result.trim()));
      setMessage("已读取二维码，请查询并核对接送信息。");
    } catch {
      if (!current(pending)) return;
      display(emptyForm(pending.session));
      setMessage("扫码已取消或相机不可用，可手动输入接送凭证。");
    }
  }

  async function previewCredential() {
    if (!credential.trim()) return;
    const pending = begin("PREVIEW");
    if (!pending) return;
    try {
      const result = await previewStaffPickupCredential(
        (path, body) => inviteSession.postAuthenticated(path, body),
        pending.credential.trim(),
      );
      if (!current(pending)) return;
      display({ ...pending, preview: result, checks: emptyChecks(), action: "IDLE" });
      setMessage("请在现场分别核对学生本人、接送人和有效授权。");
    } catch (error) {
      fail(pending, error);
    }
  }

  function toggleCheck(key: keyof PickupChecks) {
    const latest = live.current;
    if (
      !preview ||
      latest.entryId !== form.entryId ||
      latest.preview !== preview ||
      latest.action !== "IDLE" ||
      !current(latest)
    )
      return;
    display({ ...latest, checks: { ...latest.checks, [key]: !latest.checks[key] } });
  }

  async function confirmPickup() {
    if (!preview || !current(form)) return;
    const allChecksComplete = checks.student && checks.recipient && checks.authorization;
    if (!allChecksComplete) {
      setMessage("请完成三项现场核对后再确认离校。");
      return;
    }
    const pending = begin("CONFIRM");
    if (!pending) return;
    try {
      const confirmation = await Taro.showModal({
        title: "确认接送完成",
        content: `已现场核对${preview.studentLabel}、${preview.recipientLabel}和有效授权？确认后将登记离校。`,
        confirmText: "确认离校",
        cancelText: "再核对",
      });
      if (!current(pending)) return;
      if (!confirmation.confirm) {
        display({ ...pending, action: "IDLE" });
        return;
      }
      await confirmStaffPickupCredential(
        (path, body) => inviteSession.postAuthenticated(path, body),
        pending.credential.trim(),
        pending.checks,
      );
      if (!current(pending)) return;
      display(emptyForm(pending.session));
      setMessage("接送核验完成，离校状态已更新。");
    } catch (error) {
      fail(pending, error);
    }
  }

  return (
    <View className="staff-pickup-page">
      <Button
        className="staff-pickup-back-button"
        onClick={() => {
          leave();
          void Taro.navigateBack();
        }}
      >
        ‹ 返回员工工作台
      </Button>

      <View className="staff-pickup-intro">
        <Text className="staff-pickup-eyebrow">同芯学园 · 员工服务</Text>
        <Text className="staff-pickup-title">接送核验</Text>
        <Text className="staff-pickup-copy">
          请在现场核对学生和接送人。核验结果将由机构服务记录。
        </Text>
      </View>

      <View className="staff-pickup-card">
        <Text className="staff-pickup-card-title">读取家长凭证</Text>
        <Text className="staff-pickup-message">
          {accountChanged ? "账号信息已变化，请重新确认员工账号。" : message}
        </Text>
        <View className="staff-pickup-scan-row">
          <Button
            className="staff-pickup-primary-button staff-pickup-scan-button"
            disabled={!ready || busy}
            onClick={() => void scanCredential()}
          >
            扫描接送二维码
          </Button>
          <Button
            className="staff-pickup-secondary-button staff-pickup-scan-button"
            disabled={!ready || busy}
            onClick={resetPreview}
          >
            手动输入
          </Button>
        </View>
        {!preview ? (
          <>
            <Text className="staff-pickup-field-label">接送凭证</Text>
            <Input
              className="staff-pickup-input"
              type="text"
              disabled={!ready}
              maxlength={43}
              value={credential}
              placeholder="扫描二维码后自动填入，也可手动输入"
              onInput={(event) => editCredential(event.detail.value)}
            />
            <Button
              className="staff-pickup-primary-button"
              disabled={!ready || busy || !credential.trim()}
              loading={busy}
              onClick={() => void previewCredential()}
            >
              查询接送信息
            </Button>
          </>
        ) : null}
      </View>

      {preview ? (
        <View className="staff-pickup-card staff-pickup-preview-card">
          <Text className="staff-pickup-card-title">请完成现场核对</Text>
          <View className="staff-pickup-preview-row">
            <Text className="staff-pickup-field-label">学生</Text>
            <Text className="staff-pickup-preview-value">{preview.studentLabel}</Text>
            <Text className="staff-pickup-muted">班级：{preview.classLabel}</Text>
          </View>
          <View className="staff-pickup-preview-row">
            <Text className="staff-pickup-field-label">授权接送人</Text>
            <Text className="staff-pickup-preview-value">{preview.recipientLabel}</Text>
          </View>
          <View className="staff-pickup-checks">
            {checkItems.map(({ key, label }) => {
              const checked = checks[key];
              const state = checked ? "已核对" : "待核对";
              return (
                <Button
                  key={key}
                  className={`staff-pickup-check-row${checked ? " is-checked" : ""}`}
                  ariaRole="checkbox"
                  ariaLabel={`${label}，${state}`}
                  ariaChecked={checked}
                  disabled={busy}
                  onClick={() => toggleCheck(key)}
                >
                  <Text>{label}</Text>
                  <Text className="staff-pickup-check-state">{state}</Text>
                </Button>
              );
            })}
          </View>
          <Button
            className="staff-pickup-primary-button"
            disabled={busy || !ready}
            loading={busy}
            onClick={() => void confirmPickup()}
          >
            确认离校
          </Button>
          <Button className="staff-pickup-secondary-button" disabled={busy} onClick={resetPreview}>
            取消并重新扫码
          </Button>
        </View>
      ) : null}

      {status === "LOGIN" ? (
        <Button
          className="staff-pickup-primary-button"
          onClick={() => {
            leave();
            void Taro.redirectTo({ url: "/pages/auth/login/index" });
          }}
        >
          重新登录
        </Button>
      ) : null}
      {status === "ERROR" || accountChanged ? (
        <Button className="staff-pickup-primary-button" onClick={() => void loadInitial()}>
          重新确认账号
        </Button>
      ) : null}
      <Text className="staff-pickup-footnote">
        只显示学生代号、班级代号和接送人代号；凭证不会保存到本机。
      </Text>
    </View>
  );
}
