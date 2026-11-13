import { Button, Canvas, Picker, Text, View } from "@tarojs/components";
import Taro, { useDidHide, useDidShow, useUnload } from "@tarojs/taro";
import { useEffect, useRef, useState } from "react";
import { inviteSession } from "../../../auth/runtime-session";
import { hasRoleAccess } from "../../../auth/role-gate";
import {
  activateParentPickupAuthorization,
  createParentPickupAuthorization,
  issueParentPickupCredential,
  loadParentPickup,
  revokeParentPickupAuthorization,
  type ParentPickupProjection,
  type PickupAuthorization,
  type PickupBinding,
} from "../../../pickup/parent-pickup";
import { encodePickupCredentialQr, withPickupQrQuietZone } from "../../../pickup/credential-qr";
import "./index.css";

type PageStatus = "LOADING" | "READY" | "LOGIN" | "ERROR";
type Visit = { session: typeof inviteSession.snapshot | null; busy: boolean };
type AuthorizationType = "TEMPORARY" | "REGULAR";
type IssuedCredential = {
  readonly authorizationId: string;
  readonly credential: string;
  readonly expiresAt: string;
};

const recipientLabels = ["示例接送人甲", "示例接送人乙"] as const;
const recipientValues = ["pickup-alpha", "pickup-beta"] as const;
const typeLabels = ["临时接送", "常规接送"] as const;

function shanghaiParts(value: Date): {
  readonly year: string;
  readonly month: string;
  readonly day: string;
  readonly hour: string;
  readonly minute: string;
} {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(value);
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "00";
  return {
    year: part("year"),
    month: part("month"),
    day: part("day"),
    hour: part("hour"),
    minute: part("minute"),
  };
}

function today(): string {
  const parts = shanghaiParts(new Date());
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function dateAfter(days: number): string {
  const parts = shanghaiParts(new Date(Date.now() + days * 86_400_000));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function timeAfter(minutes: number): string {
  const parts = shanghaiParts(new Date(Date.now() + minutes * 60_000));
  return `${parts.hour}:${parts.minute}`;
}

function defaultSchedule(): {
  readonly date: string;
  readonly startTime: string;
  readonly endTime: string;
} {
  const parts = shanghaiParts(new Date());
  if (parts.hour >= "19") return { date: dateAfter(1), startTime: "15:00", endTime: "19:00" };
  return { date: today(), startTime: timeAfter(10), endTime: timeAfter(4 * 60) };
}

function errorMessage(error: unknown): string {
  if (typeof error === "object" && error !== null && "statusCode" in error) {
    const statusCode = Number(error.statusCode);
    if (statusCode === 401) return "登录已过期，请重新登录。";
    if (statusCode === 403) return "当前家长账号没有接送授权权限。";
    if (statusCode === 404) return "关联关系已变化，请刷新后重试。";
    if (statusCode === 409) return "授权状态已变化或凭证已过期，请刷新后重试。";
    if (statusCode === 503) return "机构服务暂未连接，请稍后重试。";
  }
  return "接送安排暂时无法处理，请稍后重试。";
}

function showDate(value: string): string {
  const [year, month, day] = value.split("-");
  return `${year}年${Number(month)}月${Number(day)}日`;
}

function showExpiry(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.valueOf())
    ? ""
    : date.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
}

export default function ParentPickupPage() {
  const [status, setStatus] = useState<PageStatus>("LOADING");
  const [message, setMessage] = useState("正在读取已审核的学生关系…");
  const [projection, setProjection] = useState<ParentPickupProjection | null>(null);
  const [bindingId, setBindingId] = useState("");
  const [recipientIndex, setRecipientIndex] = useState(0);
  const [authorizationType, setAuthorizationType] = useState<AuthorizationType>("TEMPORARY");
  const [startDate, setStartDate] = useState(() => defaultSchedule().date);
  const [endDate, setEndDate] = useState(() => defaultSchedule().date);
  const [startTime, setStartTime] = useState(() => defaultSchedule().startTime);
  const [endTime, setEndTime] = useState(() => defaultSchedule().endTime);
  const [busyId, setBusyId] = useState("");
  const [creating, setCreating] = useState(false);
  const [issuedCredential, setIssuedCredential] = useState<IssuedCredential | null>(null);
  const active = useRef(false);
  const visit = useRef<Visit | null>(null);
  const restoring = useRef<ReturnType<typeof inviteSession.restore> | null>(null);
  const displayed = visit.current;
  const signedIn = displayed?.session != null && displayed.session === inviteSession.snapshot;

  function clearDetails() {
    setProjection(null);
    setBindingId("");
    setIssuedCredential(null);
    setBusyId("");
    setCreating(false);
  }

  function leave() {
    active.current = false;
    visit.current = null;
    clearDetails();
    setStatus("LOADING");
    setMessage("正在读取已审核的学生关系…");
  }

  useDidShow(() => {
    active.current = true;
    void refreshProjection();
  });
  useDidHide(leave);
  useUnload(leave);

  function current(owner: Visit) {
    if (visit.current !== owner) return false;
    if (
      owner.session &&
      owner.session === inviteSession.snapshot &&
      hasRoleAccess(owner.session, "PARENT")
    )
      return true;
    visit.current = null;
    clearDetails();
    setStatus("ERROR");
    setMessage("账号信息已变化，请重新读取接送安排。");
    return false;
  }

  function fail(owner: Visit, error: unknown) {
    if (visit.current !== owner) return;
    if (owner.session && inviteSession.snapshot.status !== "SIGNED_OUT" && !current(owner)) return;
    visit.current = null;
    clearDetails();
    const unauthenticated =
      typeof error === "object" &&
      error !== null &&
      "statusCode" in error &&
      error.statusCode === 401;
    setStatus(unauthenticated ? "LOGIN" : "ERROR");
    setMessage(errorMessage(error));
  }

  useEffect(() => {
    if (!issuedCredential) return undefined;
    const delay = Date.parse(issuedCredential.expiresAt) - Date.now();
    if (delay <= 0) {
      setIssuedCredential(null);
      setMessage("接送二维码已过期，请重新生成。");
      return undefined;
    }
    let active = true;
    const timer = setTimeout(() => {
      if (!active || !displayed || visit.current !== displayed) return;
      setIssuedCredential(null);
      setMessage("接送二维码已过期，请重新生成。");
    }, delay);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [issuedCredential]);

  useEffect(() => {
    if (
      !issuedCredential ||
      !displayed ||
      !current(displayed) ||
      Date.parse(issuedCredential.expiresAt) <= Date.now()
    )
      return;
    try {
      const matrix = withPickupQrQuietZone(encodePickupCredentialQr(issuedCredential.credential));
      const context = Taro.createCanvasContext("parent-pickup-credential-qr");
      const moduleSize = 6;
      const canvasSize = matrix.length * moduleSize;
      context.setFillStyle("#ffffff");
      context.fillRect(0, 0, canvasSize, canvasSize);
      context.setFillStyle("#294d32");
      matrix.forEach((row, y) =>
        row.forEach((dark, x) => {
          if (dark) context.fillRect(x * moduleSize, y * moduleSize, moduleSize, moduleSize);
        }),
      );
      context.draw(false);
    } catch {
      setIssuedCredential(null);
      setMessage("二维码暂时无法显示，请重新生成。");
    }
  }, [issuedCredential]);

  async function refreshProjection(resultMessage?: string) {
    if (!active.current) return;
    const previous = visit.current;
    const sessionToReuse = previous?.session === inviteSession.snapshot ? previous.session : null;
    const preferredBinding = sessionToReuse ? bindingId : "";
    if (!sessionToReuse) {
      const schedule = defaultSchedule();
      setRecipientIndex(0);
      setAuthorizationType("TEMPORARY");
      setStartDate(schedule.date);
      setEndDate(schedule.date);
      setStartTime(schedule.startTime);
      setEndTime(schedule.endTime);
    }
    const owner: Visit = { session: sessionToReuse, busy: true };
    visit.current = owner;
    clearDetails();
    setStatus("LOADING");
    try {
      let session = owner.session;
      if (!session) {
        if (restoring.current) {
          await restoring.current;
          if (visit.current !== owner) return;
        }
        const pending = inviteSession.restore();
        restoring.current = pending;
        try {
          session = await pending;
        } finally {
          if (restoring.current === pending) restoring.current = null;
        }
      }
      if (visit.current !== owner) return;
      if (session.status === "SIGNED_OUT") {
        fail(owner, { statusCode: 401 });
        void Taro.redirectTo({ url: "/pages/auth/login/index" });
        return;
      }
      if (session.status !== "READY") throw new Error("IDENTITY_UNAVAILABLE");
      if (!hasRoleAccess(session, "PARENT")) {
        fail(owner, { statusCode: 403 });
        return;
      }
      owner.session = session;
      if (!current(owner)) return;
      const result = await loadParentPickup((path) => inviteSession.getAuthenticated(path));
      if (!current(owner)) return;
      setProjection(result);
      setBindingId(
        result.bindings.some((item) => item.id === preferredBinding)
          ? preferredBinding
          : (result.bindings[0]?.id ?? ""),
      );
      setMessage(
        resultMessage ??
          (result.bindings.length
            ? "仅显示当前家长账号已审核关联的学生。"
            : "暂无已审核关联，请先完成家长关系审核。"),
      );
      setStatus("READY");
    } catch (error) {
      fail(owner, error);
    } finally {
      owner.busy = false;
    }
  }

  async function perform(id: string, operation: (owner: Visit) => Promise<void>) {
    const owner = displayed;
    if (!owner || owner.busy || status !== "READY" || !current(owner)) return;
    owner.busy = true;
    if (id) setBusyId(id);
    else setCreating(true);
    try {
      await operation(owner);
    } catch (error) {
      fail(owner, error);
    } finally {
      if (visit.current === owner) {
        owner.busy = false;
        setCreating(false);
        setBusyId("");
      }
    }
  }

  function createAuthorization() {
    const selectedBinding = projection?.bindings.find((item) => item.id === bindingId);
    if (!selectedBinding) return;
    return perform("", async (owner) => {
      await createParentPickupAuthorization(
        (path, body) => inviteSession.postAuthenticated(path, body),
        {
          bindingId: selectedBinding.id,
          recipient: recipientValues[recipientIndex]!,
          type: authorizationType,
          startDate,
          endDate: authorizationType === "TEMPORARY" ? startDate : endDate,
          startTime,
          endTime,
        },
      );
      if (current(owner)) await refreshProjection("接送授权草稿已保存，请启用后生成接送二维码。");
    });
  }

  function confirmAuthorization(item: PickupAuthorization, revoke: boolean) {
    return perform(item.id, async (owner) => {
      const confirmation = await Taro.showModal({
        title: revoke ? "撤销接送授权" : "启用接送授权",
        content: revoke
          ? `撤销${item.studentLabel}的${item.recipientLabel}接送授权？未使用的二维码也会失效。`
          : `确认启用${item.studentLabel}的${item.recipientLabel}接送安排？`,
        confirmText: revoke ? "撤销授权" : "启用",
        cancelText: "再看看",
      });
      if (!current(owner) || !confirmation.confirm) return;
      setIssuedCredential(null);
      const change = revoke ? revokeParentPickupAuthorization : activateParentPickupAuthorization;
      await change(
        (path, body) => inviteSession.postAuthenticated(path, body),
        item.id,
        item.version,
      );
      if (current(owner)) await refreshProjection(revoke ? "接送授权已撤销。" : "接送授权已启用。");
    });
  }

  function issueCredential(item: PickupAuthorization) {
    if (!item.currentlyValid) return;
    return perform(item.id, async (owner) => {
      setIssuedCredential(null);
      const issued = await issueParentPickupCredential(
        (path, body) => inviteSession.postAuthenticated(path, body),
        item.id,
        item.version,
      );
      if (!current(owner)) return;
      if (Date.parse(issued.expiresAt) <= Date.now()) {
        setMessage("接送二维码已过期，请重新生成。");
        return;
      }
      setIssuedCredential({ ...issued, authorizationId: item.id });
      setMessage("二维码仅供本次接送使用，五分钟后自动失效。");
    });
  }

  const viewStatus = status === "READY" && !signedIn ? "ERROR" : status;
  const notice = status === "READY" && !signedIn ? "账号信息已变化，请重新读取接送安排。" : message;
  function refreshFromPage() {
    if (visit.current === displayed && !displayed?.busy) void refreshProjection();
  }
  const bindings = projection?.bindings ?? [];
  const selectedBinding: PickupBinding | undefined = bindings.find((item) => item.id === bindingId);

  return (
    <View className="pickup-page">
      <Button className="pickup-back-button" onClick={() => void Taro.navigateBack()}>
        ‹ 返回家长首页
      </Button>

      <View className="pickup-intro">
        <Text className="pickup-eyebrow">同芯学园 · 家长服务</Text>
        <Text className="pickup-title">接送授权</Text>
        <Text className="pickup-copy">
          为已审核关联的孩子安排接送人。到校交接时，由员工核对二维码和现场信息。
        </Text>
      </View>

      <View className="pickup-status-line">
        <Text className="pickup-muted">{notice}</Text>
        <Button
          className="pickup-refresh-button"
          disabled={viewStatus === "LOADING" || creating || !!busyId}
          onClick={refreshFromPage}
        >
          刷新
        </Button>
      </View>

      {viewStatus === "LOADING" ? (
        <View className="pickup-card">
          <Text className="pickup-card-title">正在读取</Text>
          <Text className="pickup-muted">正在查询当前账号已审核的关系和接送安排。</Text>
        </View>
      ) : null}

      {viewStatus === "LOGIN" || viewStatus === "ERROR" ? (
        <View className="pickup-card">
          <Text className="pickup-card-title">暂时无法读取</Text>
          <Text className="pickup-muted">{notice}</Text>
          <Button
            className="pickup-primary-button"
            disabled={creating}
            onClick={
              viewStatus === "LOGIN"
                ? () => void Taro.redirectTo({ url: "/pages/auth/login/index" })
                : refreshFromPage
            }
          >
            {viewStatus === "LOGIN" ? "重新登录" : "重新读取"}
          </Button>
        </View>
      ) : null}

      {viewStatus === "READY" ? (
        <>
          <View className="pickup-card">
            <Text className="pickup-card-title">新增接送安排</Text>
            {bindings.length ? (
              <>
                <Text className="pickup-field-label">学生</Text>
                <Picker
                  mode="selector"
                  range={bindings.map((item) => item.studentLabel)}
                  value={Math.max(
                    0,
                    bindings.findIndex((item) => item.id === bindingId),
                  )}
                  onChange={(event) => setBindingId(bindings[Number(event.detail.value)]?.id ?? "")}
                >
                  <View className="pickup-picker-value">
                    {selectedBinding?.studentLabel ?? "选择已审核关联的学生"}　⌄
                  </View>
                </Picker>
                <Text className="pickup-field-label">接送人</Text>
                <Picker
                  mode="selector"
                  range={[...recipientLabels]}
                  value={recipientIndex}
                  onChange={(event) => setRecipientIndex(Math.min(1, Number(event.detail.value)))}
                >
                  <View className="pickup-picker-value">{recipientLabels[recipientIndex]}　⌄</View>
                </Picker>
                <Text className="pickup-field-label">授权类型</Text>
                <Picker
                  mode="selector"
                  range={[...typeLabels]}
                  value={authorizationType === "TEMPORARY" ? 0 : 1}
                  onChange={(event) => {
                    const selected = Number(event.detail.value) === 0 ? "TEMPORARY" : "REGULAR";
                    setAuthorizationType(selected);
                    if (selected === "TEMPORARY") setEndDate(startDate);
                  }}
                >
                  <View className="pickup-picker-value">
                    {authorizationType === "TEMPORARY" ? typeLabels[0] : typeLabels[1]}　⌄
                  </View>
                </Picker>
                <Text className="pickup-field-label">开始日期</Text>
                <Picker
                  mode="date"
                  value={startDate}
                  onChange={(event) => {
                    const value = String(event.detail.value);
                    setStartDate(value);
                    if (authorizationType === "TEMPORARY") setEndDate(value);
                  }}
                >
                  <View className="pickup-picker-value">{showDate(startDate)}　⌄</View>
                </Picker>
                {authorizationType === "REGULAR" ? (
                  <>
                    <Text className="pickup-field-label">结束日期</Text>
                    <Picker
                      mode="date"
                      value={endDate}
                      start={startDate}
                      onChange={(event) => setEndDate(String(event.detail.value))}
                    >
                      <View className="pickup-picker-value">{showDate(endDate)}　⌄</View>
                    </Picker>
                  </>
                ) : null}
                <View className="pickup-time-row">
                  <View className="pickup-time-column">
                    <Text className="pickup-field-label">开始时间</Text>
                    <Picker
                      mode="time"
                      value={startTime}
                      onChange={(event) => setStartTime(String(event.detail.value))}
                    >
                      <View className="pickup-picker-value">{startTime}　⌄</View>
                    </Picker>
                  </View>
                  <View className="pickup-time-column">
                    <Text className="pickup-field-label">结束时间</Text>
                    <Picker
                      mode="time"
                      value={endTime}
                      onChange={(event) => setEndTime(String(event.detail.value))}
                    >
                      <View className="pickup-picker-value">{endTime}　⌄</View>
                    </Picker>
                  </View>
                </View>
                <Button
                  className="pickup-primary-button"
                  disabled={creating || !!busyId}
                  loading={creating}
                  onClick={() => void createAuthorization()}
                >
                  保存接送安排
                </Button>
              </>
            ) : (
              <>
                <Text className="pickup-muted">审核完成后，可在这里为孩子添加接送安排。</Text>
                <Button
                  className="pickup-secondary-button"
                  onClick={() => void Taro.navigateTo({ url: "/pages/parent/binding/index" })}
                >
                  查看关系审核
                </Button>
              </>
            )}
          </View>

          <View className="pickup-section-heading">
            <Text className="pickup-card-title">接送授权记录</Text>
            <Text className="pickup-muted">{projection?.authorizations.length ?? 0} 条</Text>
          </View>

          {projection?.authorizations.length ? (
            projection.authorizations.map((item) => (
              <View className="pickup-card" key={item.id}>
                <Text className="pickup-record-title">
                  {item.studentLabel} · {item.recipientLabel}
                </Text>
                <Text className="pickup-muted">
                  {item.type === "TEMPORARY" ? "临时接送" : "常规接送"}　{showDate(item.startDate)}
                  {item.endDate !== item.startDate ? ` 至 ${showDate(item.endDate)}` : ""}
                </Text>
                <Text className="pickup-muted">
                  {item.startTime} 至 {item.endTime}　·　
                  {item.status === "DRAFT"
                    ? "待启用"
                    : item.status === "ACTIVE"
                      ? item.currentlyValid
                        ? "有效"
                        : "已启用，当前时段外"
                      : "已撤销"}
                </Text>
                <View className="pickup-action-row">
                  {item.status === "DRAFT" ? (
                    <Button
                      className="pickup-primary-button pickup-action-button"
                      disabled={!!busyId}
                      loading={busyId === item.id}
                      onClick={() => void confirmAuthorization(item, false)}
                    >
                      启用授权
                    </Button>
                  ) : null}
                  {item.status === "ACTIVE" ? (
                    <>
                      <Button
                        className="pickup-primary-button pickup-action-button"
                        disabled={!!busyId || !item.currentlyValid}
                        loading={busyId === item.id}
                        onClick={() => void issueCredential(item)}
                      >
                        生成接送二维码
                      </Button>
                      <Button
                        className="pickup-secondary-button pickup-action-button"
                        disabled={!!busyId}
                        onClick={() => void confirmAuthorization(item, true)}
                      >
                        撤销授权
                      </Button>
                    </>
                  ) : null}
                </View>
                {issuedCredential?.authorizationId === item.id && item.currentlyValid ? (
                  <View className="pickup-qr-panel">
                    <Canvas
                      canvasId="parent-pickup-credential-qr"
                      width="222"
                      height="222"
                      className="pickup-qr-canvas"
                    />
                    <Text className="pickup-qr-caption">
                      请由员工在现场扫描　·　{showExpiry(issuedCredential.expiresAt)} 前有效
                    </Text>
                    <Text className="pickup-qr-caption">
                      请勿转发或截图留存；撤销授权后二维码立即失效。
                    </Text>
                  </View>
                ) : null}
              </View>
            ))
          ) : (
            <View className="pickup-card pickup-empty-card">
              <Text className="pickup-muted">还没有接送安排，提交上方表单即可创建。</Text>
            </View>
          )}

          <View className="pickup-section-heading">
            <Text className="pickup-card-title">接送记录</Text>
          </View>
          {projection?.records.length ? (
            projection.records.slice(0, 10).map((record) => (
              <View className="pickup-record-row" key={record.id}>
                <Text className="pickup-record-title">
                  {record.studentLabel} · {record.recipient}
                </Text>
                <Text className="pickup-muted">
                  {showDate(record.date)} {record.time}　·　已完成
                </Text>
              </View>
            ))
          ) : (
            <Text className="pickup-muted pickup-empty-records">暂无接送记录。</Text>
          )}
        </>
      ) : null}

      <Text className="pickup-footnote">
        接送凭证仅在本机临时显示；实际离校由员工现场核验后确认。
      </Text>
    </View>
  );
}
