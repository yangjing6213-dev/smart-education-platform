import { isIP } from "node:net";
import {
  parseChildMonthlyRecord,
  parseChildMonthlyListing,
} from "../../../admin/child-monthly-review/child-monthly-review-client.ts";
import {
  parseMonthlyRecord,
  parseMonthlyListing,
} from "../../../admin/monthly-feedback-review/monthly-feedback-review-client.ts";
import {
  parseTask,
  parseTaskPayload,
  validTaskInput,
} from "../../../admin/staff-tasks/staff-tasks-client.ts";

import {
  parseTransferListing,
  parseTransferRecord,
  validTransferCreate,
  validTransferReview,
} from "../../../admin/student-transfers/student-transfers-client.ts";

type RouteContext = Readonly<{
  params: Promise<{ readonly path: readonly string[] }>;
}>;

type JsonBody =
  | { readonly ok: true; readonly value?: unknown }
  | { readonly ok: false; readonly response: Response };

const SESSION_COOKIE = "student_care_admin_session";
const HOME_CONTENT_KEY = "home-content-synthetic-east";
const MAX_BODY_BYTES = 16 * 1024;
const MAX_SESSION_SECONDS = 8 * 60 * 60;
const TOKEN = /^[A-Za-z0-9_-]{40,160}$/u;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const HEALTH_ACTIONS = ["review", "supplement", "publish", "revoke"] as const;
const HEALTH_REVIEW_ACTIONS = ["CONFIRM", "RETURN", "ESCALATE"] as const;
const HEALTH_DISPOSITIONS = [
  "OBSERVATION_RECHECKED",
  "FOLLOW_UP_SCHEDULED",
  "GUARDIAN_SUMMARY_PREPARED",
] as const;
const HEALTH_SUMMARIES = [
  "FOLLOW_UP_IN_PROGRESS",
  "FOLLOW_UP_COMPLETED",
  "PLEASE_CHECK_PAGE_LATER",
] as const;
const HEALTH_STATUSES = [
  "SUBMITTED",
  "EXCEPTION_PENDING",
  "CONFIRMED",
  "PUBLISHED",
  "RETURNED",
  "REVOKED",
] as const;
const NOTICE_ACTIONS = ["review", "publish", "revoke"] as const;
const NOTICE_STATUSES = [
  "DRAFT",
  "SUBMITTED",
  "RETURNED",
  "APPROVED",
  "PUBLISHED",
  "REVOKED",
] as const;
const NOTICE_TEMPLATES = {
  INSTITUTION_ANNOUNCEMENT: {
    target: "INSTITUTION",
    title: "机构公告",
    body: "校区发布了新的服务安排，请家长查看页面内更新。",
  },
  CLASS_ACTIVITY: {
    target: "CLASS",
    title: "班级活动",
    body: "班级近期有活动安排，请家长查看并留意相关时间。",
  },
} as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function json(body: unknown, status = 200, headers = new Headers()): Response {
  headers.set("content-type", "application/json; charset=utf-8");
  headers.set("cache-control", "no-store");
  return new Response(JSON.stringify(body), { status, headers });
}

function error(status: number, code: string, message: string): Response {
  return json({ error: { code, message } }, status);
}

function isLoopbackHost(hostname: string): boolean {
  const host = hostname
    .toLowerCase()
    .replace(/^\[|\]$/gu, "")
    .replace(/\.$/u, "");
  if (host === "localhost" || host.endsWith(".localhost")) return true;
  if (isIP(host) === 4) return host.startsWith("127.");
  if (isIP(host) !== 6) return false;
  if (host === "::1") return true;
  const mapped = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/u.exec(host);
  return mapped !== null && Number.parseInt(mapped[1] ?? "0", 16) >>> 8 === 127;
}

function apiOrigin(): URL | undefined {
  const production = process.env.NODE_ENV === "production";
  const configured = production
    ? process.env.ADMIN_WEB_NEST_API_BASE_URL
    : process.env.ADMIN_WEB_LOCAL_NEST_API ||
      (process.env.NODE_ENV === "development" ? "http://127.0.0.1:4321" : undefined);
  if (!configured) return undefined;

  try {
    const url = new URL(configured);
    if (url.username || url.password || url.pathname !== "/" || url.search || url.hash)
      return undefined;
    if (production && url.protocol === "https:" && !isLoopbackHost(url.hostname)) return url;
    if (
      !production &&
      process.env.NODE_ENV === "development" &&
      url.protocol === "http:" &&
      url.hostname === "127.0.0.1" &&
      Boolean(url.port)
    )
      return url;
    return undefined;
  } catch {
    return undefined;
  }
}

function libraryRoute(method: string, path: readonly string[]) {
  if (path.length === 2 && path[1] === "summary") return method === "GET";
  if (path[1] !== "items") return false;
  if (path.length === 2) return method === "GET" || method === "POST";
  if (!UUID.test(path[2] ?? "")) return false;
  return (
    (path.length === 3 && method === "PATCH") ||
    (path.length === 4 && path[3] === "revoke" && method === "POST")
  );
}

function libraryText(v: unknown, max: number, allowEmpty = false) {
  return typeof v === "string" && v.length <= max && (allowEmpty || !!v.trim());
}
function libraryVersion(v: unknown) {
  return Number.isSafeInteger(v) && Number(v) > 0;
}
function libraryVisibility(v: Record<string, unknown>) {
  return (
    calendarDate(v.expiresOn) &&
    ((v.scope === "CLASS" && libraryText(v.classId, 80)) ||
      (v.scope === "CAMPUS" && v.classId === null))
  );
}
function libraryFields(v: Record<string, unknown>) {
  return (
    ["GUIDE", "RESOURCE"].includes(String(v.kind)) &&
    libraryText(v.title, 120) &&
    libraryText(v.summary, 500) &&
    libraryText(v.category, 80) &&
    libraryText(v.grade, 80, true) &&
    libraryText(v.subject, 80, true) &&
    Array.isArray(v.tags) &&
    v.tags.length <= 12 &&
    v.tags.every((t) => libraryText(t, 80)) &&
    libraryVisibility(v)
  );
}
function libraryBody(path: readonly string[], v: Record<string, unknown>, method: string) {
  const keys = Object.keys(v);
  if (path.length === 2) return keys.length === 11 && libraryFields(v) && libraryText(v.body, 8000);
  if (!libraryVersion(v.version)) return false;
  if (method === "PATCH") return keys.length === 4 && libraryVisibility(v);
  return keys.length === 1 && path[3] === "revoke";
}
function projectLibraryResponse(v: unknown, method: string, endpoint: string | undefined) {
  if (!isRecord(v)) return;
  if (method !== "GET")
    return typeof v.id === "string" && UUID.test(v.id) && libraryVersion(v.version)
      ? { id: v.id, version: v.version }
      : undefined;
  if (endpoint === "summary") {
    if (
      !["published", "expired", "revoked", "total"].every(
        (k) => Number.isSafeInteger(v[k]) && Number(v[k]) >= 0,
      ) ||
      v.total !== Number(v.published) + Number(v.revoked) + Number(v.expired)
    )
      return;
    return { published: v.published, expired: v.expired, revoked: v.revoked, total: v.total };
  }
  if (
    !Array.isArray(v.items) ||
    !Array.isArray(v.classIds) ||
    !v.classIds.every((id) => libraryText(id, 80))
  )
    return;
  const items = [];
  for (const row of v.items) {
    if (
      !isRecord(row) ||
      !libraryFields(row) ||
      !libraryVersion(row.version) ||
      typeof row.id !== "string" ||
      !UUID.test(row.id) ||
      !["REVOKED", "PUBLISHED"].includes(String(row.status))
    )
      return;
    const {
      id,
      kind,
      title,
      summary,
      category,
      grade,
      subject,
      tags,
      scope,
      classId,
      expiresOn,
      version,
      status,
    } = row;
    items.push({
      id,
      kind,
      title,
      summary,
      category,
      grade,
      subject,
      tags,
      scope,
      classId,
      expiresOn,
      version,
      status,
    });
  }
  return { items, classIds: v.classIds };
}

function allowed(method: string, path: readonly string[]): boolean {
  if(path[0]==="library") return libraryRoute(method,path);
  const joined = "/" + path.join("/");
  if (
    path.length === 4 &&
    path[0] === "institution" &&
    path[1] === "home" &&
    path[2] === HOME_CONTENT_KEY
  ) {
    if (path[3] === "draft") return method === "GET" || method === "POST" || method === "PUT";
    return (path[3] === "publish" || path[3] === "unpublish") && method === "POST";
  }
  if (joined === "/monthly-feedback" || joined === "/child-monthly-reports")
    return method === "GET";
  if (
    path.length === 3 &&
    ["monthly-feedback", "child-monthly-reports"].includes(path[0] ?? "") &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(
      path[1] ?? "",
    )
  )
    return method === "POST" && (path[2] === "review" || path[2] === "publish");
  if (joined === "/fees") return method === "GET" || method === "POST";
  if (joined === "/student-transfers") return method === "GET" || method === "POST";
  if (
    path.length === 3 &&
    path[0] === "student-transfers" &&
    UUID.test(path[1] ?? "") &&
    path[2] === "review"
  )
    return method === "POST";
  if (path.length === 3 && path[0] === "fees" && UUID.test(path[1] ?? "") && path[2] === "revoke")
    return method === "POST";
  if (joined === "/learning-institution-setting") return method === "GET" || method === "POST";
  if (joined === "/tasks") return method === "GET" || method === "POST";
  if (path.length === 3 && path[0] === "tasks" && UUID.test(path[1] ?? ""))
    return method === "POST" && (path[2] === "check" || path[2] === "cancel");
  if (joined === "/daily-reports") return method === "GET";
  if (
    path.length === 3 &&
    path[0] === "daily-reports" &&
    UUID.test(path[1] ?? "") &&
    path[2] === "audit-events"
  )
    return method === "GET";
  if (path.length === 3 && path[0] === "daily-reports" && UUID.test(path[1] ?? ""))
    return method === "POST" && (path[2] === "review" || path[2] === "withdraw");
  if (joined === "/meals") return method === "GET";
  if (path.length === 3 && path[0] === "meals" && UUID.test(path[1] ?? "")) {
    if (path[2] === "draft") return method === "POST" || method === "PUT";
    return (path[2] === "publish" || path[2] === "unpublish") && method === "POST";
  }
  if (joined === "/identity/login" || joined === "/identity/logout") return method === "POST";
  if (joined === "/identity/account") return method === "GET";
  if (joined === "/identity/account/profile" || joined === "/identity/account/username")
    return method === "PATCH";
  if (
    [
      "/identity/account/password",
      "/identity/account/logout-all",
      "/identity/account/profile-change-requests",
    ].includes(joined)
  )
    return method === "POST";
  if (joined === "/identity/profile-change-requests") return method === "GET";
  if (
    path.length === 4 &&
    path[0] === "identity" &&
    path[1] === "profile-change-requests" &&
    UUID.test(path[2] ?? "") &&
    (path[3] === "approve" || path[3] === "reject")
  )
    return method === "POST";
  if (
    joined === "/me" ||
    joined === "/staff/guardian-binding/applications" ||
    joined === "/staff/care-records" ||
    joined === "/staff/leave-requests" ||
    joined === "/staff/health-incidents"
  )
    return method === "GET";
  if (joined === "/staff/notices/review") return method === "GET";
  if (
    path.length === 4 &&
    path[0] === "staff" &&
    path[1] === "notices" &&
    UUID.test(path[2] ?? "") &&
    NOTICE_ACTIONS.includes(path[3] as (typeof NOTICE_ACTIONS)[number])
  )
    return method === "POST";
  if (
    path.length === 4 &&
    path[0] === "staff" &&
    path[1] === "leave-requests" &&
    UUID.test(path[2] ?? "") &&
    path[3] === "review"
  )
    return method === "POST";
  if (
    path.length === 4 &&
    path[0] === "staff" &&
    path[1] === "health-incidents" &&
    UUID.test(path[2] ?? "") &&
    HEALTH_ACTIONS.includes(path[3] as (typeof HEALTH_ACTIONS)[number])
  )
    return method === "POST";
  if (
    path.length === 4 &&
    path[0] === "staff" &&
    path[1] === "care-records" &&
    UUID.test(path[2] ?? "") &&
    (path[3] === "review" || path[3] === "publish" || path[3] === "revoke-publication")
  )
    return method === "POST";
  return (
    path.length === 5 &&
    path[0] === "staff" &&
    path[1] === "guardian-binding" &&
    path[2] === "applications" &&
    UUID.test(path[3] ?? "") &&
    path[4] === "review" &&
    method === "POST"
  );
}

function sameOrigin(request: Request): boolean {
  const originHeader = request.headers.get("origin");
  const hostHeader = request.headers.get("host");
  if (!originHeader || !hostHeader) return false;
  try {
    const requestUrl = new URL(request.url);
    if (requestUrl.protocol !== "http:" && requestUrl.protocol !== "https:") return false;

    const origin = new URL(originHeader);
    const requestHost = new URL(`${requestUrl.protocol}//${hostHeader}`);
    if (
      originHeader !== origin.origin ||
      hostHeader.toLowerCase() !== requestHost.host.toLowerCase() ||
      origin.username ||
      origin.password ||
      requestHost.username ||
      requestHost.password
    )
      return false;

    return origin.origin === requestHost.origin;
  } catch {
    return false;
  }
}

function cookieToken(request: Request): string | undefined {
  const entry = request.headers
    .get("cookie")
    ?.split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith(SESSION_COOKIE + "="));
  const value = entry?.slice(SESSION_COOKIE.length + 1);
  return value && TOKEN.test(value) ? value : undefined;
}

function setCookie(token: string, expiresAt: string, request: Request): string | undefined {
  const expiry = Date.parse(expiresAt);
  if (!Number.isFinite(expiry) || expiry <= Date.now()) return undefined;
  const seconds = Math.min(MAX_SESSION_SECONDS, Math.floor((expiry - Date.now()) / 1000));
  if (seconds < 1) return undefined;
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return (
    SESSION_COOKIE +
    "=" +
    token +
    "; Path=/api/admin; HttpOnly; SameSite=Lax; Max-Age=" +
    seconds +
    secure
  );
}

function clearCookie(request: Request): string {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return SESSION_COOKIE + "=; Path=/api/admin; HttpOnly; SameSite=Lax; Max-Age=0" + secure;
}

async function readJsonBody(request: Request): Promise<JsonBody> {
  const length = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(length) && length > MAX_BODY_BYTES)
    return { ok: false, response: error(413, "BODY_TOO_LARGE", "请求内容过大。") };
  const bytes = await request.arrayBuffer();
  if (bytes.byteLength > MAX_BODY_BYTES)
    return { ok: false, response: error(413, "BODY_TOO_LARGE", "请求内容过大。") };
  if (bytes.byteLength === 0) return { ok: true };
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json"))
    return { ok: false, response: error(415, "JSON_REQUIRED", "请求格式不正确。") };
  try {
    return { ok: true, value: JSON.parse(new TextDecoder().decode(bytes)) as unknown };
  } catch {
    return { ok: false, response: error(400, "INVALID_JSON", "请求格式不正确。") };
  }
}

function validBody(path: readonly string[], value: unknown, method: string): boolean {
  if (!isRecord(value)) return false;
  if(path[0]==="library") return libraryBody(path,value,method);
  const keys = Object.keys(value);
  const joined = "/" + path.join("/");
  if (
    path.length === 4 &&
    path[0] === "institution" &&
    path[1] === "home" &&
    path[2] === HOME_CONTENT_KEY
  ) {
    if (path[3] !== "draft")
      return (
        (path[3] === "publish" || path[3] === "unpublish") &&
        keys.length === 1 &&
        keys[0] === "expected_version" &&
        Number.isSafeInteger(value.expected_version) &&
        Number(value.expected_version) >= 1
      );

    const draftKeys = ["body", "title", "type", "visibility"];
    const draft = value.payload;
    const validDraft =
      isRecord(draft) &&
      Object.keys(draft).length === draftKeys.length &&
      draftKeys.every((key) => Object.hasOwn(draft, key)) &&
      draft.type === "HOME_BLOCK" &&
      draft.visibility === "PUBLIC" &&
      typeof draft.title === "string" &&
      draft.title.trim().length > 0 &&
      draft.title.length <= 120 &&
      isRecord(draft.body) &&
      Object.keys(draft.body).length === 2 &&
      Object.hasOwn(draft.body, "summary") &&
      Object.hasOwn(draft.body, "blocks") &&
      typeof draft.body.summary === "string" &&
      draft.body.summary.trim().length > 0 &&
      draft.body.summary.length <= 500 &&
      Array.isArray(draft.body.blocks) &&
      draft.body.blocks.length === 1 &&
      isRecord(draft.body.blocks[0]) &&
      Object.keys(draft.body.blocks[0]).length === 2 &&
      draft.body.blocks[0].kind === "TEXT" &&
      typeof draft.body.blocks[0].text === "string" &&
      draft.body.blocks[0].text.trim().length > 0 &&
      draft.body.blocks[0].text.length <= 4000;
    if (
      !validDraft ||
      keys.some((key) => key !== "payload" && key !== "expected_version")
    )
      return false;
    return method === "PUT"
      ? Number.isSafeInteger(value.expected_version) && Number(value.expected_version) >= 1
      : value.expected_version === null || value.expected_version === undefined;
  }
  if (["monthly-feedback", "child-monthly-reports"].includes(path[0] ?? "")) {
    if (
      typeof value.version !== "number" ||
      !Number.isSafeInteger(value.version) ||
      value.version < 1
    )
      return false;
    return path[2] === "publish"
      ? keys.length === 1
      : keys.length === 2 && (value.action === "CONFIRM" || value.action === "RETURN");
  }
  if (joined === "/student-transfers") return validTransferCreate(value);
  if (path[0] === "student-transfers") return validTransferReview(value);
  if (joined === "/fees")
    return (
      keys.length === 8 &&
      [
        "student_id",
        "document_type",
        "title",
        "period",
        "amount_minor",
        "valid_from",
        "valid_to",
        "summary",
      ].every((key) => keys.includes(key)) &&
      typeof value.student_id === "string" &&
      UUID.test(value.student_id) &&
      (value.document_type === "FEE_ITEM" ||
        value.document_type === "BILL" ||
        value.document_type === "AGREEMENT") &&
      typeof value.title === "string" &&
      value.title.trim().length > 0 &&
      value.title.length <= 120 &&
      typeof value.period === "string" &&
      /^\d{4}-(?:0[1-9]|1[0-2])$/u.test(value.period) &&
      (value.document_type === "AGREEMENT"
        ? value.amount_minor === null
        : Number.isSafeInteger(value.amount_minor) && Number(value.amount_minor) >= 0) &&
      typeof value.valid_from === "string" &&
      /^\d{4}-\d{2}-\d{2}$/u.test(value.valid_from) &&
      typeof value.valid_to === "string" &&
      /^\d{4}-\d{2}-\d{2}$/u.test(value.valid_to) &&
      value.valid_to >= value.valid_from &&
      typeof value.summary === "string" &&
      value.summary.trim().length > 0 &&
      value.summary.length <= 500
    );
  if (path[0] === "fees")
    return (
      keys.length === 1 &&
      keys[0] === "expected_version" &&
      Number.isSafeInteger(value.expected_version) &&
      Number(value.expected_version) > 0
    );
  if (joined === "/learning-institution-setting")
    return (
      keys.length === 2 &&
      typeof value.enabled === "boolean" &&
      Number.isInteger(value.expectedVersion) &&
      Number(value.expectedVersion) >= 0 &&
      Number(value.expectedVersion) < 2147483647
    );
  if (path[0] === "tasks") {
    if (path.length === 1) return validTaskInput(value);
    return (
      Number.isSafeInteger(value.version) &&
      Number(value.version) > 0 &&
      (path[2] === "cancel"
        ? keys.length === 1 && keys[0] === "version"
        : keys.length === 2 &&
          keys.includes("version") &&
          keys.includes("action") &&
          (value.action === "CONFIRM" || value.action === "RETURN"))
    );
  }
  if (path[0] === "daily-reports")
    return (
      Number.isSafeInteger(value.version) &&
      Number(value.version) > 0 &&
      (path[2] === "withdraw"
        ? keys.length === 1 && keys[0] === "version"
        : keys.length === 2 &&
          keys.includes("version") &&
          keys.includes("action") &&
          (value.action === "CONFIRM" || value.action === "RETURN"))
    );
  if (path[0] === "meals") {
    if (path[2] !== "draft")
      return (
        keys.length === 1 &&
        keys[0] === "expected_version" &&
        Number.isSafeInteger(value.expected_version) &&
        Number(value.expected_version) > 0
      );
    if (
      !validMealPayload(value.payload) ||
      keys.some((key) => key !== "payload" && key !== "expected_version")
    )
      return false;
    return method === "PUT"
      ? Number.isSafeInteger(value.expected_version) && Number(value.expected_version) > 0
      : value.expected_version === undefined ||
          value.expected_version === null ||
          (Number.isSafeInteger(value.expected_version) && Number(value.expected_version) > 0);
  }
  if (joined === "/identity/login") {
    return (
      keys.length === 2 &&
      keys.includes("username") &&
      keys.includes("password") &&
      typeof value.username === "string" &&
      value.username.length >= 3 &&
      value.username.length <= 64 &&
      typeof value.password === "string" &&
      value.password.length >= 1 &&
      value.password.length <= 128
    );
  }
  if (joined === "/identity/logout") return keys.length === 0;
  if (joined === "/identity/account/profile")
    return keys.length === 1 && typeof value.display_name === "string" && value.display_name.length <= 80;
  if (joined === "/identity/account/username")
    return (
      keys.length === 2 &&
      typeof value.current_password === "string" &&
      value.current_password.length > 0 &&
      value.current_password.length <= 128 &&
      typeof value.new_username === "string" &&
      value.new_username.length <= 64
    );
  if (joined === "/identity/account/password")
    return (
      keys.length === 2 &&
      typeof value.current_password === "string" &&
      value.current_password.length > 0 &&
      value.current_password.length <= 128 &&
      typeof value.new_password === "string" &&
      value.new_password.length >= 12 &&
      value.new_password.length <= 128
    );
  if (joined === "/identity/account/logout-all") return keys.length === 0;
  if (joined === "/identity/account/profile-change-requests")
    return (
      keys.length === 2 &&
      typeof value.tenant_id === "string" &&
      UUID.test(value.tenant_id) &&
      typeof value.display_name === "string" &&
      value.display_name.length <= 80
    );
  if (
    path.length === 4 &&
    path[0] === "identity" &&
    path[1] === "profile-change-requests" &&
    UUID.test(path[2] ?? "")
  )
    return (
      keys.length === 1 &&
      keys[0] === "expected_version" &&
      Number.isSafeInteger(value.expected_version) &&
      Number(value.expected_version) >= 1
    );
  if (
    path.length === 4 &&
    path[0] === "staff" &&
    path[1] === "notices" &&
    UUID.test(path[2] ?? "")
  ) {
    if (path[3] === "review")
      return (
        keys.length === 2 &&
        keys.includes("version") &&
        keys.includes("action") &&
        Number.isSafeInteger(value.version) &&
        Number(value.version) >= 1 &&
        (value.action === "APPROVE" || value.action === "RETURN")
      );
    return (
      (path[3] === "publish" || path[3] === "revoke") &&
      keys.length === 1 &&
      keys[0] === "version" &&
      Number.isSafeInteger(value.version) &&
      Number(value.version) >= 1
    );
  }
  if (
    path.length === 4 &&
    path[0] === "staff" &&
    path[1] === "leave-requests" &&
    UUID.test(path[2] ?? "") &&
    path[3] === "review"
  )
    return (
      keys.length === 2 &&
      keys.includes("version") &&
      keys.includes("action") &&
      Number.isSafeInteger(value.version) &&
      Number(value.version) >= 1 &&
      (value.action === "confirm" || value.action === "return")
    );
  if (
    path.length === 4 &&
    path[0] === "staff" &&
    path[1] === "health-incidents" &&
    UUID.test(path[2] ?? "")
  ) {
    const action = path[3];
    if (!Number.isSafeInteger(value.version) || Number(value.version) < 1) return false;
    if (action === "review")
      return (
        keys.length === 2 &&
        keys.includes("version") &&
        keys.includes("action") &&
        HEALTH_REVIEW_ACTIONS.includes(value.action as (typeof HEALTH_REVIEW_ACTIONS)[number])
      );
    if (action === "supplement")
      return (
        keys.length === 2 &&
        keys.includes("version") &&
        keys.includes("dispositionCode") &&
        HEALTH_DISPOSITIONS.includes(value.dispositionCode as (typeof HEALTH_DISPOSITIONS)[number])
      );
    if (action === "publish")
      return (
        keys.length === 2 &&
        keys.includes("version") &&
        keys.includes("summaryCode") &&
        HEALTH_SUMMARIES.includes(value.summaryCode as (typeof HEALTH_SUMMARIES)[number])
      );
    return action === "revoke" && keys.length === 1 && keys[0] === "version";
  }
  if (
    path.length === 4 &&
    path[0] === "staff" &&
    path[1] === "care-records" &&
    UUID.test(path[2] ?? "") &&
    path[3] === "review"
  )
    return (
      keys.length === 2 &&
      keys.includes("version") &&
      keys.includes("action") &&
      Number.isSafeInteger(value.version) &&
      Number(value.version) >= 1 &&
      (value.action === "confirm" || value.action === "return")
    );
  if (
    path.length === 4 &&
    path[0] === "staff" &&
    path[1] === "care-records" &&
    UUID.test(path[2] ?? "") &&
    (path[3] === "publish" || path[3] === "revoke-publication")
  )
    return (
      keys.length === 1 &&
      keys[0] === "version" &&
      Number.isSafeInteger(value.version) &&
      Number(value.version) >= 1
    );
  return (
    keys.length === 2 &&
    keys.includes("version") &&
    keys.includes("action") &&
    Number.isSafeInteger(value.version) &&
    Number(value.version) >= 1 &&
    (value.action === "approve" || value.action === "reject")
  );
}

function validIdentityQuery(
  path: readonly string[],
  method: string,
  searchParams: URLSearchParams,
): boolean {
  if ([...searchParams].length === 0) return true;
  const entries = [...searchParams.entries()];
  const scopedRead =
    method === "GET" && path.length === 2 && path[0] === "identity" && path[1] === "profile-change-requests";
  const scopedReview =
    method === "POST" &&
    path.length === 4 &&
    path[0] === "identity" &&
    path[1] === "profile-change-requests" &&
    UUID.test(path[2] ?? "") &&
    (path[3] === "approve" || path[3] === "reject");
  return (
    (scopedRead || scopedReview) &&
    entries.length === 1 &&
    entries[0]?.[0] === "tenant_id" &&
    UUID.test(entries[0]?.[1] ?? "")
  );
}

function apiMessage(status: number, login: boolean): string {
  if (login && status === 401) return "账号或密码不正确，请重试。";
  if (status === 401) return "登录状态已失效，请重新登录。";
  if (status === 403) return "当前账号没有此项审核权限。";
  if (status === 409) return "申请状态已更新，请刷新后重试。";
  if (status === 503) return "服务暂时无法使用，请稍后重试。";
  return "操作未完成，请稍后重试。";
}

function safeSession(payload: unknown): unknown | undefined {
  if (!isRecord(payload) || !isRecord(payload.data)) return undefined;
  const data = payload.data;
  if (typeof data.display_name !== "string" || data.display_name.length === 0) return undefined;
  if (!Array.isArray(data.memberships)) return undefined;
  const memberships = data.memberships.map((membership) => {
    if (!isRecord(membership) || typeof membership.status !== "string") return undefined;
    if (!Array.isArray(membership.capabilities)) return undefined;
    const capabilities = membership.capabilities.filter(
      (capability): capability is string => typeof capability === "string",
    );
    return { status: membership.status, capabilities };
  });
  if (memberships.some((membership) => membership === undefined)) return undefined;
  return {
    data: {
      display_name: data.display_name,
      memberships,
    },
  };
}

function safeAccount(payload: unknown): unknown | undefined {
  if (!isRecord(payload) || !isRecord(payload.data)) return undefined;
  const value = payload.data;
  if (
    typeof value.actor_id !== "string" ||
    !UUID.test(value.actor_id) ||
    typeof value.username !== "string" ||
    !/^[a-z0-9][a-z0-9._-]{2,63}$/u.test(value.username) ||
    typeof value.display_name !== "string" ||
    !value.display_name.trim() ||
    !["ACTIVE", "SUSPENDED", "REVOKED"].includes(String(value.account_status)) ||
    !Array.isArray(value.memberships)
  )
    return undefined;
  const memberships = value.memberships.map((membership) => {
    if (
      !isRecord(membership) ||
      typeof membership.tenant_id !== "string" ||
      !UUID.test(membership.tenant_id) ||
      !Array.isArray(membership.campus_ids) ||
      !membership.campus_ids.every((id) => typeof id === "string" && UUID.test(id)) ||
      typeof membership.status !== "string" ||
      !["ACTIVE", "SUSPENDED", "REVOKED", "INVITED"].includes(membership.status) ||
      !Array.isArray(membership.capabilities) ||
      !membership.capabilities.every((capability) => typeof capability === "string")
    )
      return undefined;
    return {
      tenant_id: membership.tenant_id,
      campus_ids: membership.campus_ids,
      status: membership.status,
      capabilities: membership.capabilities,
    };
  });
  if (memberships.some((membership) => membership === undefined)) return undefined;
  return {
    data: {
      actor_id: value.actor_id,
      username: value.username,
      display_name: value.display_name,
      account_status: value.account_status,
      memberships,
    },
  };
}

function safeProfileChange(value: unknown): Record<string, unknown> | undefined {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    !UUID.test(value.id) ||
    typeof value.actor_id !== "string" ||
    !UUID.test(value.actor_id) ||
    typeof value.display_name !== "string" ||
    !value.display_name.trim() ||
    typeof value.tenant_id !== "string" ||
    !UUID.test(value.tenant_id) ||
    !["PENDING", "APPROVED", "REJECTED"].includes(String(value.status)) ||
    !Number.isSafeInteger(value.version) ||
    typeof value.created_at !== "string" ||
    !Number.isFinite(Date.parse(value.created_at))
  )
    return undefined;
  return {
    id: value.id,
    actor_id: value.actor_id,
    display_name: value.display_name,
    tenant_id: value.tenant_id,
    status: value.status,
    version: value.version,
    created_at: value.created_at,
    ...(typeof value.reviewed_at === "string" && Number.isFinite(Date.parse(value.reviewed_at))
      ? { reviewed_at: value.reviewed_at }
      : {}),
  };
}

function safeProfileChangeResponse(payload: unknown): unknown | undefined {
  if (!isRecord(payload)) return undefined;
  const request = safeProfileChange(payload.data);
  return request ? { data: request } : undefined;
}

function safeProfileChangeList(payload: unknown): unknown | undefined {
  if (!isRecord(payload) || !Array.isArray(payload.data)) return undefined;
  const records = payload.data.map(safeProfileChange);
  if (
    records.some((record) => !record) ||
    records.some((record) => record?.status !== "PENDING") ||
    new Set(records.map((record) => record?.id)).size !== records.length
  )
    return undefined;
  return { data: records };
}

function safeAccountAction(payload: unknown, action: string): unknown | undefined {
  if (!isRecord(payload) || !isRecord(payload.data)) return undefined;
  const data = payload.data;
  if (action === "username" || action === "password")
    return data.changed === true && data.reauthentication_required === true
      ? { data: { changed: true, reauthentication_required: true } }
      : undefined;
  if (action === "logout-all")
    return data.logged_out_all === true ? { data: { logged_out_all: true } } : undefined;
  return undefined;
}

function safeProfileReview(payload: unknown, action: string): unknown | undefined {
  if (!isRecord(payload) || !isRecord(payload.data)) return undefined;
  const expected = action === "approve" ? "APPROVED" : action === "reject" ? "REJECTED" : "";
  return payload.data.reviewed === true && payload.data.status === expected
    ? { data: { reviewed: true, status: expected } }
    : undefined;
}

function isoDate(value: unknown): value is string {
  return (
    typeof value === "string" &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString() === value
  );
}

function calendarDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/u.test(value)) return false;
  const parsed = new Date(value + "T00:00:00.000Z");
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function validMealPayload(value: unknown): boolean {
  return (
    isRecord(value) &&
    Object.keys(value).length === 4 &&
    ["meal_date", "meal_type", "items", "notes"].every((key) => Object.hasOwn(value, key)) &&
    calendarDate(value.meal_date) &&
    typeof value.meal_type === "string" &&
    ["BREAKFAST", "LUNCH", "SNACK", "DINNER"].includes(value.meal_type) &&
    Array.isArray(value.items) &&
    value.items.length >= 1 &&
    value.items.length <= 12 &&
    value.items.every(
      (item) => typeof item === "string" && item.length >= 1 && item.length <= 120,
    ) &&
    typeof value.notes === "string" &&
    value.notes.length <= 500
  );
}

function safeMeal(value: unknown): Record<string, unknown> | undefined {
  if (!isRecord(value)) return undefined;
  const menu = {
    meal_date: value.meal_date,
    meal_type: value.meal_type,
    items: value.items,
    notes: value.notes,
  };
  if (
    !validMealPayload(menu) ||
    typeof value.id !== "string" ||
    !UUID.test(value.id) ||
    typeof value.status !== "string" ||
    !["DRAFT", "PUBLISHED", "UNPUBLISHED"].includes(value.status) ||
    !Number.isSafeInteger(value.version) ||
    Number(value.version) < 1 ||
    !isoDate(value.updated_at) ||
    (value.status === "PUBLISHED" ? !isoDate(value.published_at) : value.published_at !== null) ||
    !Array.isArray(value.actions) ||
    new Set(value.actions).size !== value.actions.length ||
    !value.actions.every((action) =>
      value.status === "PUBLISHED"
        ? action === "unpublish"
        : action === "edit" || action === "publish",
    )
  )
    return undefined;
  return {
    ...menu,
    id: value.id,
    status: value.status,
    version: value.version,
    published_at: value.published_at,
    updated_at: value.updated_at,
    actions: [...value.actions],
  };
}

function safeMeals(payload: Record<string, unknown>, list: boolean): unknown | undefined {
  if (!list) {
    const data = safeMeal(payload.data);
    return data === undefined ? undefined : { data };
  }
  if (!Array.isArray(payload.data) || payload.data.length > 500) return undefined;
  const data = payload.data.map(safeMeal);
  if (
    data.some((row) => row === undefined) ||
    new Set(data.map((row) => String(row?.id).toLowerCase())).size !== data.length
  )
    return undefined;
  return { data };
}

function safeHomeContent(payload: unknown, contentKey: string): unknown | undefined {
  if (!isRecord(payload) || !isRecord(payload.data)) return undefined;
  const value = payload.data;
  if (
    typeof value.content_key !== "string" ||
    value.content_key !== contentKey ||
    value.type !== "HOME_BLOCK" ||
    !["DRAFT", "PUBLISHED", "UNPUBLISHED"].includes(String(value.status)) ||
    typeof value.title !== "string" ||
    value.title.trim().length === 0 ||
    value.title.length > 120 ||
    !Number.isSafeInteger(value.version) ||
    Number(value.version) < 1 ||
    value.visibility !== "PUBLIC" ||
    value.synthetic_data !== true ||
    !isRecord(value.body) ||
    Object.keys(value.body).length !== 2 ||
    !Object.hasOwn(value.body, "summary") ||
    !Object.hasOwn(value.body, "blocks") ||
    typeof value.body.summary !== "string" ||
    value.body.summary.trim().length === 0 ||
    value.body.summary.length > 500 ||
    !Array.isArray(value.body.blocks) ||
    value.body.blocks.length !== 1
  )
    return undefined;
  const block = value.body.blocks[0];
  if (
    !isRecord(block) ||
    Object.keys(block).length !== 2 ||
    block.kind !== "TEXT" ||
    typeof block.text !== "string" ||
    block.text.trim().length === 0 ||
    block.text.length > 4000
  )
    return undefined;
  const publishedAt = value.published_at;
  if (
    value.status === "PUBLISHED"
      ? typeof publishedAt !== "string" || !isoDate(publishedAt)
      : publishedAt !== null
  )
    return undefined;
  return {
    data: {
      content_key: value.content_key,
      title: value.title,
      type: "HOME_BLOCK",
      status: value.status,
      version: Number(value.version),
      visibility: "PUBLIC",
      body: { summary: value.body.summary, blocks: [{ kind: "TEXT", text: block.text }] },
      synthetic_data: true,
    },
  };
}

function safeFeeDocument(value: unknown): Record<string, unknown> | undefined {
  if (
    !isRecord(value) ||
    Object.keys(value).sort().join(",") !==
      "amountMinor,documentType,id,period,status,studentId,studentLabel,summary,synthetic,title,validFrom,validTo,version" ||
    typeof value.id !== "string" ||
    !UUID.test(value.id) ||
    !Number.isSafeInteger(value.version) ||
    Number(value.version) < 1 ||
    !["FEE_ITEM", "BILL", "RECEIPT", "AGREEMENT"].includes(String(value.documentType)) ||
    typeof value.title !== "string" ||
    value.title.trim().length === 0 ||
    value.title.length > 120 ||
    typeof value.studentId !== "string" ||
    !UUID.test(value.studentId) ||
    typeof value.studentLabel !== "string" ||
    value.studentLabel.trim().length === 0 ||
    value.studentLabel.length > 80 ||
    typeof value.period !== "string" ||
    !/^\d{4}-(?:0[1-9]|1[0-2])$/u.test(value.period) ||
    (value.amountMinor !== null &&
      (!Number.isSafeInteger(value.amountMinor) || Number(value.amountMinor) < 0)) ||
    (value.documentType === "AGREEMENT"
      ? value.amountMinor !== null
      : value.amountMinor === null) ||
    !["AVAILABLE", "PAID", "VOIDED", "EXPIRED", "REVOKED"].includes(String(value.status)) ||
    !calendarDate(value.validFrom) ||
    !calendarDate(value.validTo) ||
    value.validTo < value.validFrom ||
    typeof value.summary !== "string" ||
    value.summary.trim().length === 0 ||
    value.summary.length > 500 ||
    value.synthetic !== true
  )
    return undefined;
  return {
    id: value.id,
    version: value.version,
    documentType: value.documentType,
    title: value.title,
    studentId: value.studentId,
    studentLabel: value.studentLabel,
    period: value.period,
    amountMinor: value.amountMinor,
    status: value.status,
    validFrom: value.validFrom,
    validTo: value.validTo,
    summary: value.summary,
    synthetic: true,
  };
}

function safeFees(payload: unknown, method: string, pathLength: number): unknown | undefined {
  if (!isRecord(payload) || !Object.hasOwn(payload, "data")) return undefined;
  if (pathLength > 1) {
    const data = payload.data;
    if (
      !isRecord(data) ||
      Object.keys(data).sort().join(",") !== "id,status,synthetic,version" ||
      typeof data.id !== "string" ||
      !UUID.test(data.id) ||
      !Number.isSafeInteger(data.version) ||
      Number(data.version) < 2 ||
      data.status !== "REVOKED" ||
      data.synthetic !== true
    )
      return undefined;
    return { data: { id: data.id, version: data.version, status: "REVOKED", synthetic: true } };
  }
  if (method === "POST") {
    const data = safeFeeDocument(payload.data);
    return data === undefined ? undefined : { data };
  }
  const data = payload.data;
  if (
    !isRecord(data) ||
    Object.keys(data).sort().join(",") !== "documents,students,synthetic" ||
    data.synthetic !== true ||
    !Array.isArray(data.students) ||
    data.students.length > 200 ||
    !Array.isArray(data.documents) ||
    data.documents.length > 200
  )
    return undefined;
  const students = data.students.map((student) => {
    if (
      !isRecord(student) ||
      Object.keys(student).sort().join(",") !== "id,label" ||
      typeof student.id !== "string" ||
      !UUID.test(student.id) ||
      typeof student.label !== "string" ||
      student.label.trim().length === 0 ||
      student.label.length > 80
    )
      return undefined;
    return { id: student.id, label: student.label };
  });
  const documents = data.documents.map(safeFeeDocument);
  if (
    students.some((student) => student === undefined) ||
    documents.some((document) => document === undefined) ||
    new Set(students.map((student) => student?.id)).size !== students.length ||
    new Set(documents.map((document) => String(document?.id).toLowerCase())).size !==
      documents.length
  )
    return undefined;
  return { data: { synthetic: true, students, documents } };
}

function safeQueue(payload: unknown): unknown | undefined {
  if (!isRecord(payload) || !Array.isArray(payload.data)) return undefined;
  const records = payload.data.map((value) => {
    if (
      !isRecord(value) ||
      typeof value.id !== "string" ||
      !UUID.test(value.id) ||
      value.relationship !== "GUARDIAN" ||
      value.status !== "PENDING" ||
      !Number.isSafeInteger(value.version) ||
      Number(value.version) < 1 ||
      typeof value.applicant_label !== "string" ||
      value.applicant_label.trim().length === 0 ||
      value.applicant_label.length > 80 ||
      typeof value.student_label !== "string" ||
      value.student_label.trim().length === 0 ||
      value.student_label.length > 80 ||
      !isoDate(value.submitted_at) ||
      !(value.reviewed_at === null || isoDate(value.reviewed_at))
    )
      return undefined;
    return {
      id: value.id,
      relationship: value.relationship,
      status: value.status,
      version: value.version,
      applicant_label: value.applicant_label,
      student_label: value.student_label,
      submitted_at: value.submitted_at,
      reviewed_at: value.reviewed_at,
    };
  });
  if (records.some((record) => record === undefined)) return undefined;
  return { data: records };
}

function safeReview(payload: unknown): unknown | undefined {
  if (!isRecord(payload) || !isRecord(payload.data)) return undefined;
  const value = payload.data;
  if (
    typeof value.id !== "string" ||
    !UUID.test(value.id) ||
    value.relationship !== "GUARDIAN" ||
    (value.status !== "APPROVED" && value.status !== "REJECTED") ||
    !Number.isSafeInteger(value.version) ||
    Number(value.version) < 2
  )
    return undefined;
  return {
    data: {
      id: value.id,
      relationship: value.relationship,
      status: value.status,
      version: value.version,
      reviewed_at: isoDate(value.reviewed_at) ? value.reviewed_at : null,
    },
  };
}

function safeNotice(value: unknown): Record<string, unknown> | undefined {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    !UUID.test(value.id) ||
    typeof value.templateCode !== "string" ||
    !(value.templateCode in NOTICE_TEMPLATES) ||
    !NOTICE_STATUSES.includes(value.status as (typeof NOTICE_STATUSES)[number]) ||
    !Number.isSafeInteger(value.version) ||
    Number(value.version) < 1 ||
    typeof value.published !== "boolean" ||
    (value.status === "PUBLISHED") !== value.published ||
    !isoDate(value.createdAt) ||
    !isoDate(value.updatedAt) ||
    value.synthetic !== true
  )
    return undefined;

  const template = NOTICE_TEMPLATES[value.templateCode as keyof typeof NOTICE_TEMPLATES];
  if (
    value.target !== template.target ||
    value.title !== template.title ||
    value.body !== template.body
  )
    return undefined;

  return {
    id: value.id,
    templateCode: value.templateCode,
    target: template.target,
    status: value.status,
    version: value.version,
    published: value.published,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
    title: template.title,
    body: template.body,
    synthetic: true,
  };
}

function safeNotices(payload: unknown): unknown | undefined {
  if (!isRecord(payload) || !Array.isArray(payload.data) || payload.data.length > 500)
    return undefined;
  const data = payload.data.map(safeNotice);
  if (data.some((notice) => notice === undefined)) return undefined;
  if (new Set(data.map((notice) => notice?.id)).size !== data.length) return undefined;
  return { data };
}

function safeNoticeResult(payload: unknown): unknown | undefined {
  if (!isRecord(payload) || !isRecord(payload.data)) return undefined;
  const data = safeNotice(payload.data);
  return data ? { data } : undefined;
}

const CARE_VALUE_OPTIONS = {
  arrival: ["ARRIVED_AS_PLANNED", "LATE", "ABSENT"],
  homework: ["COMPLETED", "IN_PROGRESS", "NEEDS_SUPPORT"],
  meal: ["FINISHED", "PARTIAL", "NOT_RECORDED"],
  rest: ["RESTED", "QUIET_ACTIVITY", "NOT_RECORDED"],
  activity: ["PARTICIPATED", "OBSERVED", "NOT_RECORDED"],
  wellbeing: ["ROUTINE", "CHECK_IN", "FOLLOW_UP"],
} as const;
const CARE_STATUSES = [
  "DRAFT",
  "SUBMITTED",
  "RETURNED",
  "CONFIRMED",
  "CANCELLED",
  "EXCEPTION_PENDING",
] as const;
const CARE_ACTIONS = [
  "edit",
  "submit",
  "resubmit",
  "review",
  "publish",
  "withdraw",
  "revoke-publication",
] as const;

function isoDay(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}$/u.test(value) &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value + "T00:00:00.000Z").toISOString().slice(0, 10) === value
  );
}

function safeCareRecord(value: unknown): Record<string, unknown> | undefined {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    !UUID.test(value.id) ||
    typeof value.student_display_ref !== "string" ||
    value.student_display_ref.trim().length === 0 ||
    value.student_display_ref.length > 80 ||
    typeof value.class_ref !== "string" ||
    value.class_ref.trim().length === 0 ||
    value.class_ref.length > 80 ||
    !isoDay(value.service_date) ||
    !CARE_STATUSES.includes(value.status as (typeof CARE_STATUSES)[number]) ||
    !Number.isSafeInteger(value.version) ||
    Number(value.version) < 1 ||
    typeof value.published !== "boolean" ||
    !Number.isSafeInteger(value.publication_version) ||
    Number(value.publication_version) < 0 ||
    !isoDate(value.updated_at) ||
    !isRecord(value.values) ||
    !Array.isArray(value.actions) ||
    value.actions.length > CARE_ACTIONS.length
  )
    return undefined;

  const values = value.values;
  if (!isRecord(values)) return undefined;
  const valueKeys = Object.keys(values);
  const expectedValueKeys = Object.keys(CARE_VALUE_OPTIONS);
  if (
    valueKeys.length !== expectedValueKeys.length ||
    !expectedValueKeys.every((key) => {
      const item = values[key];
      return CARE_VALUE_OPTIONS[key as keyof typeof CARE_VALUE_OPTIONS].includes(item as never);
    }) ||
    new Set(value.actions).size !== value.actions.length ||
    !value.actions.every((action) => CARE_ACTIONS.includes(action as (typeof CARE_ACTIONS)[number]))
  )
    return undefined;

  return {
    id: value.id,
    student_display_ref: value.student_display_ref,
    class_ref: value.class_ref,
    service_date: value.service_date,
    values: Object.fromEntries(expectedValueKeys.map((key) => [key, values[key]])),
    status: value.status,
    version: value.version,
    published: value.published,
    publication_version: value.publication_version,
    updated_at: value.updated_at,
    actions: value.actions,
  };
}

function safeCareRecords(payload: unknown): unknown | undefined {
  if (!isRecord(payload) || !Array.isArray(payload.data) || payload.data.length > 500)
    return undefined;
  const data = payload.data.map(safeCareRecord);
  if (data.some((row) => row === undefined)) return undefined;
  return { data };
}

function safeCareRecordResult(payload: unknown): unknown | undefined {
  if (!isRecord(payload) || !isRecord(payload.data)) return undefined;
  const data = safeCareRecord(payload.data);
  return data ? { data } : undefined;
}

const LEAVE_REASONS = ["FAMILY_ARRANGEMENT", "TEMPORARY_MATTER"] as const;

function safeLeaveRequest(value: unknown): Record<string, unknown> | undefined {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    !UUID.test(value.id) ||
    !Number.isSafeInteger(value.version) ||
    Number(value.version) < 1 ||
    value.status !== "SUBMITTED" ||
    typeof value.student_display_ref !== "string" ||
    value.student_display_ref.trim().length === 0 ||
    value.student_display_ref.length > 80 ||
    typeof value.class_ref !== "string" ||
    value.class_ref.trim().length === 0 ||
    value.class_ref.length > 80 ||
    !calendarDate(value.start_date) ||
    !calendarDate(value.end_date) ||
    value.start_date > value.end_date ||
    !LEAVE_REASONS.includes(value.reason_category as (typeof LEAVE_REASONS)[number]) ||
    typeof value.acknowledged !== "boolean"
  )
    return undefined;
  return {
    id: value.id,
    version: value.version,
    status: value.status,
    student_display_ref: value.student_display_ref,
    class_ref: value.class_ref,
    start_date: value.start_date,
    end_date: value.end_date,
    reason_category: value.reason_category,
    acknowledged: value.acknowledged,
  };
}

function safeLeaveQueue(payload: unknown): unknown | undefined {
  if (!isRecord(payload) || !Array.isArray(payload.data) || payload.data.length > 200)
    return undefined;
  const data = payload.data.map(safeLeaveRequest);
  return data.some((row) => row === undefined) ? undefined : { data };
}

function safeLeaveReviewResult(payload: unknown): unknown | undefined {
  if (!isRecord(payload) || !isRecord(payload.data)) return undefined;
  const value = payload.data;
  if (
    typeof value.id !== "string" ||
    !UUID.test(value.id) ||
    !Number.isSafeInteger(value.version) ||
    Number(value.version) < 2 ||
    (value.status !== "CONFIRMED" && value.status !== "RETURNED")
  )
    return undefined;
  return { data: { id: value.id, version: value.version, status: value.status } };
}

function safeHealthIncident(value: unknown): Record<string, unknown> | undefined {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    !UUID.test(value.id) ||
    !Number.isSafeInteger(value.version) ||
    Number(value.version) < 1 ||
    !HEALTH_STATUSES.includes(value.status as (typeof HEALTH_STATUSES)[number]) ||
    typeof value.studentLabel !== "string" ||
    value.studentLabel.trim().length === 0 ||
    value.studentLabel.length > 80 ||
    typeof value.observationCode !== "string" ||
    !["ROUTINE_OBSERVATION", "NEEDS_FOLLOW_UP", "URGENT_REVIEW"].includes(value.observationCode) ||
    typeof value.published !== "boolean" ||
    typeof value.createdByLabel !== "string" ||
    value.createdByLabel.trim().length === 0 ||
    value.createdByLabel.length > 80
  )
    return undefined;

  const dispositionCode = value.dispositionCode;
  if (
    dispositionCode !== null &&
    (typeof dispositionCode !== "string" ||
      !HEALTH_DISPOSITIONS.includes(dispositionCode as (typeof HEALTH_DISPOSITIONS)[number]))
  )
    return undefined;
  const summaryCode = value.summaryCode;
  if (
    summaryCode !== null &&
    (typeof summaryCode !== "string" ||
      !HEALTH_SUMMARIES.includes(summaryCode as (typeof HEALTH_SUMMARIES)[number]))
  )
    return undefined;

  const observationLabels: Readonly<Record<string, string>> = {
    ROUTINE_OBSERVATION: "日常状态观察",
    NEEDS_FOLLOW_UP: "需要跟进",
    URGENT_REVIEW: "需要尽快复核",
  };
  const dispositionLabels: Readonly<Record<string, string>> = {
    OBSERVATION_RECHECKED: "已重新核对观察",
    FOLLOW_UP_SCHEDULED: "已安排跟进",
    GUARDIAN_SUMMARY_PREPARED: "已准备家长摘要",
  };

  return {
    id: value.id,
    version: value.version,
    status: value.status,
    student_label: value.studentLabel,
    observation_code: value.observationCode,
    observation_label: observationLabels[value.observationCode],
    disposition_code: dispositionCode,
    disposition_label:
      typeof dispositionCode === "string" ? dispositionLabels[dispositionCode] : null,
    summary_code: summaryCode,
    published: value.published,
    created_by_label: value.createdByLabel,
  };
}

function safeHealthIncidents(payload: unknown): unknown | undefined {
  if (!isRecord(payload) || !Array.isArray(payload.data) || payload.data.length > 500)
    return undefined;
  const data = payload.data.map(safeHealthIncident);
  if (data.some((row) => row === undefined)) return undefined;
  return { data };
}

function safeHealthIncidentResult(payload: unknown): unknown | undefined {
  if (!isRecord(payload) || !isRecord(payload.data)) return undefined;
  const data = safeHealthIncident(payload.data);
  return data ? { data } : undefined;
}

function safeLogin(
  payload: unknown,
): { readonly token: string; readonly expiresAt: string } | undefined {
  if (!isRecord(payload) || !isRecord(payload.data)) return undefined;
  const data = payload.data;
  if (
    typeof data.access_token !== "string" ||
    !TOKEN.test(data.access_token) ||
    data.token_type !== "Bearer" ||
    typeof data.expires_at !== "string" ||
    !Number.isFinite(Date.parse(data.expires_at)) ||
    Date.parse(data.expires_at) <= Date.now()
  )
    return undefined;
  return { token: data.access_token, expiresAt: data.expires_at };
}

type AdminDaily = Readonly<{
  id: string;
  version: number;
  date: string;
  authorLabel: string;
  status: "SUBMITTED" | "CONFIRMED" | "RETURNED";
  values: Readonly<Record<string, string>>;
  sourceCounts: Readonly<Record<string, number>>;
  learningSummary: null | Readonly<{
    completedLearnerBand: "2_PLUS";
    usedGuidance: boolean;
    needsTeacherFollowUp: boolean;
  }>;
  actions: readonly ("confirm" | "return" | "withdraw")[];
}>;
const DAILY_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const DAILY_VALUES = {
  arrival: ["ARRIVED_AS_PLANNED", "LATE", "ABSENT"],
  homework: ["COMPLETED", "IN_PROGRESS", "NEEDS_SUPPORT"],
  activity: ["PARTICIPATED", "OBSERVED", "NOT_RECORDED"],
  classroom: ["ROUTINE", "NEEDS_ATTENTION", "NEEDS_FOLLOW_UP"],
  followUp: ["NONE", "OBSERVE_TOMORROW", "OWNER_ATTENTION"],
} as const;
const DAILY_SOURCES = ["TASK", "ATTENDANCE", "CARE_RECORD", "PICKUP", "PICKUP_EXCEPTION"] as const;
function safeDailyRecord(value: unknown): AdminDaily | undefined {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    !DAILY_UUID.test(value.id) ||
    !Number.isSafeInteger(value.version) ||
    Number(value.version) < 1 ||
    typeof value.authorLabel !== "string" ||
    !value.authorLabel.trim() ||
    value.authorLabel.length > 120 ||
    typeof value.date !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/u.test(value.date) ||
    !Number.isFinite(Date.parse(value.date)) ||
    new Date(value.date + "T00:00:00Z").toISOString().slice(0, 10) !== value.date ||
    !["SUBMITTED", "CONFIRMED", "RETURNED"].includes(String(value.status)) ||
    !isRecord(value.values) ||
    !isRecord(value.sourceCounts) ||
    !Array.isArray(value.actions)
  )
    return undefined;
  const values = value.values,
    counts = value.sourceCounts;
  if (
    Object.keys(values).length !== 5 ||
    !Object.entries(DAILY_VALUES).every(([key, options]) =>
      (options as readonly unknown[]).includes(values[key]),
    ) ||
    !DAILY_SOURCES.every((key) => Number.isSafeInteger(counts[key]) && Number(counts[key]) >= 0)
  )
    return undefined;
  const permitted =
    value.status === "SUBMITTED"
      ? ["confirm", "return"]
      : value.status === "CONFIRMED"
        ? ["return", "withdraw"]
        : [];
  if (
    new Set(value.actions).size !== value.actions.length ||
    !value.actions.every((action) => typeof action === "string" && permitted.includes(action))
  )
    return undefined;
  let learningSummary: AdminDaily["learningSummary"] = null;
  if (value.learningSummary !== null) {
    const summary = value.learningSummary;
    if (
      !isRecord(summary) ||
      summary.completedLearnerBand !== "2_PLUS" ||
      typeof summary.usedGuidance !== "boolean" ||
      typeof summary.needsTeacherFollowUp !== "boolean"
    )
      return undefined;
    learningSummary = {
      completedLearnerBand: "2_PLUS",
      usedGuidance: summary.usedGuidance,
      needsTeacherFollowUp: summary.needsTeacherFollowUp,
    };
  }
  return {
    id: value.id,
    version: Number(value.version),
    date: value.date,
    authorLabel: value.authorLabel,
    status: value.status as AdminDaily["status"],
    values: Object.fromEntries(
      Object.keys(DAILY_VALUES).map((key) => [key, values[key] as string]),
    ),
    sourceCounts: Object.fromEntries(DAILY_SOURCES.map((key) => [key, Number(counts[key])])),
    learningSummary,
    actions: value.actions as AdminDaily["actions"],
  };
}

function safeDaily(payload: Record<string, unknown>, list: boolean): unknown | undefined {
  if (!list) {
    const row = safeDailyRecord(payload.data);
    return row ? { data: row } : undefined;
  }
  if (!isRecord(payload.data) || !Array.isArray(payload.data.records)) return undefined;
  const records = payload.data.records.map(safeDailyRecord);
  if (records.some((row) => !row) || new Set(records.map((row) => row?.id)).size !== records.length)
    return undefined;
  return { data: { records } };
}

const DAILY_AUDIT_ACTIONS = [
  "CREATED",
  "EDITED",
  "SUBMITTED",
  "RESUBMITTED",
  "REVIEW_CONFIRMED",
  "REVIEW_RETURNED",
  "CONFIRMATION_WITHDRAWN",
  "SOURCES_INVALIDATED",
] as const;

function safeDailyAudit(payload: Record<string, unknown>): unknown | undefined {
  if (!isRecord(payload.data) || !Array.isArray(payload.data.events)) return undefined;
  const events = payload.data.events.map((event) => {
    if (
      !isRecord(event) ||
      Object.keys(event).length !== 5 ||
      !["action", "reportVersion", "actorLabel", "initiatedByLabel", "occurredAt"].every((key) =>
        Object.hasOwn(event, key),
      ) ||
      !(DAILY_AUDIT_ACTIONS as readonly unknown[]).includes(event.action) ||
      !Number.isSafeInteger(event.reportVersion) ||
      Number(event.reportVersion) < 1 ||
      (event.action === "SOURCES_INVALIDATED"
        ? event.actorLabel !== null
        : typeof event.actorLabel !== "string" ||
          !event.actorLabel.trim() ||
          event.actorLabel.length > 120) ||
      typeof event.initiatedByLabel !== "string" ||
      !event.initiatedByLabel.trim() ||
      event.initiatedByLabel.length > 120 ||
      typeof event.occurredAt !== "string" ||
      !Number.isFinite(Date.parse(event.occurredAt)) ||
      new Date(event.occurredAt).toISOString() !== event.occurredAt
    )
      return undefined;
    return {
      action: event.action,
      reportVersion: Number(event.reportVersion),
      actorLabel: event.actorLabel,
      initiatedByLabel: event.initiatedByLabel,
      occurredAt: event.occurredAt,
    };
  });
  if (
    events.some((event) => !event) ||
    events.some(
      (event, index) => index > 0 && event!.reportVersion <= events[index - 1]!.reportVersion,
    )
  )
    return undefined;
  return { data: { events } };
}

async function handle(request: Request, context: RouteContext): Promise<Response> {
  const { path } = await context.params;
  if (
    !Array.isArray(path) ||
    path.length === 0 ||
    path.some((part) => !part || part.includes("/") || !/^[A-Za-z0-9_-]+$/u.test(part))
  )
    return error(404, "NOT_FOUND", "未找到该服务。");

  const method = request.method.toUpperCase();
  if (!allowed(method, path)) return error(404, "NOT_FOUND", "未找到该服务。");
  const requestUrl = new URL(request.url);
  if (requestUrl.hash || !validIdentityQuery(path, method, requestUrl.searchParams))
    return error(400, "QUERY_NOT_ALLOWED", "请求内容不正确。");
  if (method !== "GET" && !sameOrigin(request))
    return error(403, "ORIGIN_NOT_ALLOWED", "请求来源不受允许。");

  const isLogin = method === "POST" && path.join("/") === "identity/login";
  const isLogout = method === "POST" && path.join("/") === "identity/logout";
  const token = isLogin ? undefined : cookieToken(request);
  const responseHeaders = new Headers();
  if (!isLogin && !token && !isLogout) return error(401, "UNAUTHENTICATED", "请先登录。");
  if (isLogout && !token) {
    responseHeaders.append("set-cookie", clearCookie(request));
    return json({ data: { logged_out: true } }, 200, responseHeaders);
  }

  const body = method === "GET" ? ({ ok: true } as const) : await readJsonBody(request);
  if (!body.ok) return body.response;
  if (method !== "GET" && (!("value" in body) || !validBody(path, body.value, method)))
    return error(400, "VALIDATION_FAILED", "请求内容不正确。");

  const origin = apiOrigin();
  if (!origin) {
    if (isLogout) responseHeaders.append("set-cookie", clearCookie(request));
    return json(
      { error: { code: "API_UNAVAILABLE", message: "管理服务尚未配置。" } },
      503,
      responseHeaders,
    );
  }

  const headers = new Headers({ accept: "application/json" });
  if (method !== "GET") headers.set("content-type", "application/json");
  if (token) headers.set("authorization", "Bearer " + token);
  const target = new URL(
    ([
      "library",
      "institution",
      "meals",
      "daily-reports",
      "monthly-feedback",
      "child-monthly-reports",
      "tasks",
      "learning-institution-setting",
      "fees",
      "student-transfers",
    ].includes(path[0] ?? "")
      ? "/admin/"
      : "/") + path.join("/"),
    origin,
  );
  target.search = requestUrl.search;
  let upstream: Response;
  try {
    upstream = await fetch(target, {
      method,
      headers,
      cache: "no-store",
      redirect: "error",
      ...([
        "library",
        "institution",
        "learning-institution-setting",
        "monthly-feedback",
        "child-monthly-reports",
        "student-transfers",
      ].includes(path[0] ?? "")
        ? { signal: AbortSignal.timeout(8000) }
        : {}),
      ...(method === "GET" || !("value" in body) ? {} : { body: JSON.stringify(body.value) }),
    });
  } catch {
    if (isLogout) responseHeaders.append("set-cookie", clearCookie(request));
    return json(
      { error: { code: "API_UNAVAILABLE", message: "管理服务暂时无法连接。" } },
      503,
      responseHeaders,
    );
  }

  if (
    !upstream.ok &&
    (["monthly-feedback", "child-monthly-reports"].includes(path[0] ?? "") ||
      (path.length === 1 && path[0] === "me" && upstream.status === 401))
  ) {
    // A cloned fetch body can keep cancellation pending after the status is already known.
    void upstream.body?.cancel().catch(() => {});
    if (upstream.status === 401 && !isLogin && token)
      responseHeaders.append("set-cookie", clearCookie(request));
    return json(
      {
        error: {
          code: upstream.status === 401 ? "UNAUTHENTICATED" : "REQUEST_FAILED",
          message: apiMessage(upstream.status, false),
        },
      },
      upstream.status,
      responseHeaders,
    );
  }
  const payload: unknown = await upstream.json().catch(() => undefined);
  if (!isRecord(payload)) {
    if (isLogout) responseHeaders.append("set-cookie", clearCookie(request));
    return json(
      { error: { code: "INVALID_API_RESPONSE", message: "管理服务暂时无法使用。" } },
      502,
      responseHeaders,
    );
  }

  if (!upstream.ok) {
    if (
      isLogout ||
      (upstream.status === 401 && !isLogin && token) ||
      (["monthly-feedback", "child-monthly-reports"].includes(path[0] ?? "") &&
        upstream.status === 401)
    )
      responseHeaders.append("set-cookie", clearCookie(request));
    const status = upstream.status >= 400 && upstream.status <= 599 ? upstream.status : 502;
    const code =
      !["monthly-feedback", "child-monthly-reports"].includes(path[0] ?? "") &&
      isRecord(payload.error) &&
      typeof payload.error.code === "string"
        ? payload.error.code
        : "REQUEST_FAILED";
    return json({ error: { code, message: apiMessage(status, isLogin) } }, status, responseHeaders);
  }

  if (isLogin) {
    const login = safeLogin(payload);
    const cookie = login ? setCookie(login.token, login.expiresAt, request) : undefined;
    if (!login || !cookie) return error(502, "INVALID_API_RESPONSE", "登录服务返回了无效结果。");
    responseHeaders.append("set-cookie", cookie);
    return json({ data: { expires_at: login.expiresAt } }, upstream.status, responseHeaders);
  }

  if (isLogout) {
    responseHeaders.append("set-cookie", clearCookie(request));
    return json(payload, upstream.status, responseHeaders);
  }

  if (path[0] === "learning-institution-setting") {
    const setting = payload.data;
    if (
      !isRecord(setting) ||
      typeof setting.enabled !== "boolean" ||
      !Number.isInteger(setting.version) ||
      Number(setting.version) < 0 ||
      Number(setting.version) > 2147483647 ||
      (setting.version === 0 && setting.enabled)
    )
      return error(502, "INVALID_API_RESPONSE", "机构设置返回了无效结果。");
    return json(
      { data: { enabled: setting.enabled, version: setting.version } },
      upstream.status,
      responseHeaders,
    );
  }

  if(path[0]==="library"){
    const data=projectLibraryResponse(payload.data,method,path[1]);
    return data===undefined ? error(502,"INVALID_API_RESPONSE","资料库返回了无效结果。") : json({data},upstream.status,responseHeaders);
  }

  if (path[0] === "tasks") {
    try {
      const data = method === "GET" ? parseTaskPayload(payload.data) : parseTask(payload.data);
      if (!data) return error(502, "INVALID_API_RESPONSE", "任务服务返回了无效结果。");
      return json({ data }, upstream.status, responseHeaders);
    } catch {
      return error(502, "INVALID_API_RESPONSE", "任务服务返回了无效结果。");
    }
  }

  if (["monthly-feedback", "child-monthly-reports"].includes(path[0] ?? "")) {
    try {
      const data =
        path[0] === "child-monthly-reports"
          ? method === "GET"
            ? parseChildMonthlyListing(payload.data)
            : parseChildMonthlyRecord(payload.data)
          : method === "GET"
            ? parseMonthlyListing(payload.data)
            : parseMonthlyRecord(payload.data);
      if (!data) return error(502, "INVALID_API_RESPONSE", "月度总结服务返回了无效结果。");
      return json({ data }, upstream.status, responseHeaders);
    } catch {
      return error(502, "INVALID_API_RESPONSE", "月度总结服务返回了无效结果。");
    }
  }

  if (path[0] === "student-transfers") {
    const data =
      method === "GET" ? parseTransferListing(payload.data) : parseTransferRecord(payload.data);
    if (!data)
      return error(502, "INVALID_API_RESPONSE", "转班服务返回了不完整的资料，请刷新确认。");
    return json({ data }, upstream.status, responseHeaders);
  }

  const safePayload =
    path[0] === "identity" && path[1] === "account" && path.length <= 3
      ? path.length === 2 || path[2] === "profile"
        ? safeAccount(payload)
        : path[2] === "profile-change-requests"
          ? safeProfileChangeResponse(payload)
          : safeAccountAction(payload, path[2] ?? "")
      : path[0] === "identity" && path[1] === "profile-change-requests"
        ? path.length === 2
          ? safeProfileChangeList(payload)
          : safeProfileReview(payload, path[3] ?? "")
      : path[0] === "institution"
      ? safeHomeContent(payload, path[2] ?? "")
      : path[0] === "fees"
      ? safeFees(payload, method, path.length)
      : path[0] === "daily-reports"
        ? path.length === 3 && path[2] === "audit-events"
          ? safeDailyAudit(payload)
          : safeDaily(payload, path.length === 1)
        : path[0] === "meals"
          ? safeMeals(payload, path.length === 1)
          : path.length === 1 && path[0] === "me"
            ? safeSession(payload)
            : path.length === 3 && path[0] === "staff" && path[1] === "notices"
              ? safeNotices(payload)
              : path.length === 4 && path[0] === "staff" && path[1] === "notices"
                ? safeNoticeResult(payload)
                : path.length === 3 && path[0] === "staff" && path[2] === "applications"
                  ? safeQueue(payload)
                  : path.length === 2 && path[0] === "staff" && path[1] === "health-incidents"
                    ? safeHealthIncidents(payload)
                    : path.length === 4 && path[0] === "staff" && path[1] === "health-incidents"
                      ? safeHealthIncidentResult(payload)
                      : path.length === 2 && path[0] === "staff" && path[1] === "care-records"
                        ? safeCareRecords(payload)
                        : path.length === 4 && path[0] === "staff" && path[1] === "care-records"
                          ? safeCareRecordResult(payload)
                          : path.length === 2 && path[0] === "staff" && path[1] === "leave-requests"
                            ? safeLeaveQueue(payload)
                            : path.length === 4 &&
                                path[0] === "staff" &&
                                path[1] === "leave-requests" &&
                                path[3] === "review"
                              ? safeLeaveReviewResult(payload)
                              : safeReview(payload);
  if (safePayload === undefined)
    return error(502, "INVALID_API_RESPONSE", "管理服务返回了无效结果。");
  if (
    upstream.ok &&
    path[0] === "identity" &&
    path[1] === "account" &&
    ["username", "password", "logout-all"].includes(path[2] ?? "")
  )
    responseHeaders.append("set-cookie", clearCookie(request));
  return json(safePayload, upstream.status, responseHeaders);
}

export function GET(request: Request, context: RouteContext): Promise<Response> {
  return handle(request, context);
}

export function POST(request: Request, context: RouteContext): Promise<Response> {
  return handle(request, context);
}

export function PUT(request: Request, context: RouteContext): Promise<Response> {
  return handle(request, context);
}

export function PATCH(request: Request, context: RouteContext): Promise<Response> {
  return handle(request, context);
}
