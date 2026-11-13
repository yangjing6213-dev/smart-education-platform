import { isIP } from "node:net";

type RouteContext = {
  readonly params: Promise<{ readonly path: readonly string[] }>;
};

const COOKIE = "student_care_local_session";
const MAX_BODY_BYTES = 16 * 1024;
const TOKEN = /^[A-Za-z0-9_-]{40,160}$/u;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

function json(body: unknown, status = 200, headers = new Headers()): Response {
  headers.set("content-type", "application/json; charset=utf-8");
  headers.set("cache-control", "no-store");
  return new Response(JSON.stringify(body), { status, headers });
}

function error(status: number, code: string, headers?: Headers): Response {
  return json({ error: { code, message: "本机演示服务暂不可用。" } }, status, headers);
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
  const ipv4Mapped = /^::ffff:([0-9a-f]{1,4}):[0-9a-f]{1,4}$/u.exec(host);
  return ipv4Mapped !== null && Number.parseInt(ipv4Mapped[1] ?? "0", 16) >>> 8 === 127;
}

function apiOrigin(): URL | undefined {
  const production = process.env.NODE_ENV === "production";
  const localPreviewAllowed = !production || process.env.USER_WEB_LOCAL_PREVIEW === "true";
  const configured =
    process.env.USER_WEB_NEST_API_BASE_URL ||
    (localPreviewAllowed ? process.env.USER_WEB_LOCAL_NEST_API : undefined);
  if (!configured) return undefined;
  try {
    const url = new URL(configured);
    if (url.username || url.password || url.pathname !== "/" || url.search || url.hash)
      return undefined;
    if (url.protocol === "https:" && !isLoopbackHost(url.hostname)) return url;
    if (
      localPreviewAllowed &&
      url.protocol === "http:" &&
      url.hostname === "127.0.0.1" &&
      !!url.port
    )
      return url;
    return undefined;
  } catch {
    return undefined;
  }
}

function allowed(method: string, segments: readonly string[]): boolean {
  const path = `/${segments.join("/")}`;
  if (path === "/identity/login" || path === "/identity/logout") return method === "POST";
  if (path === "/me") return method === "GET";
  if (path === "/guardian-relationships") return method === "GET";
  if (
    segments.length === 3 &&
    segments[0] === "guardian-relationships" &&
    UUID.test(segments[1] ?? "") &&
    segments[2] === "release"
  )
    return method === "POST";
  if (path === "/parent/student-options") return method === "GET";
  if (path === "/parent/fees") return method === "GET";
  if (path === "/parent/pickup") return method === "GET";
  if (path === "/parent/pickup/authorizations") return method === "POST";
  if (
    segments.length === 5 &&
    segments[0] === "parent" &&
    segments[1] === "pickup" &&
    segments[2] === "authorizations" &&
    UUID.test(segments[3] ?? "") &&
    ["activate", "revoke", "credential"].includes(segments[4] ?? "")
  )
    return method === "POST";
  if (path === "/parent/monthly-feedback") return method === "GET";
  if (
    segments.length === 4 &&
    segments[0] === "parent" &&
    segments[1] === "monthly-feedback" &&
    UUID.test(segments[2] ?? "") &&
    segments[3] === "ack"
  )
    return method === "POST";
  if (path === "/parent/notices") return method === "GET";
  if (
    segments.length === 4 &&
    segments[0] === "parent" &&
    segments[1] === "notices" &&
    UUID.test(segments[2] ?? "") &&
    ["read", "ack"].includes(segments[3] ?? "")
  )
    return method === "POST";
  if (path === "/parent/health-incidents") return method === "GET";
  if (
    segments.length === 4 &&
    segments[0] === "parent" &&
    segments[1] === "health-incidents" &&
    UUID.test(segments[2] ?? "") &&
    ["read", "ack"].includes(segments[3] ?? "")
  )
    return method === "POST";
  if (path === "/parent/learning") return method === "GET";
  if (
    segments.length === 4 &&
    segments[0] === "parent" &&
    segments[1] === "learning" &&
    UUID.test(segments[2] ?? "") &&
    ["controls", "contact"].includes(segments[3] ?? "")
  )
    return method === "POST";
  if (path === "/guardian-binding/applications") return method === "GET" || method === "POST";
  if (path === "/staff/tasks") return method === "GET";
  if (path === "/staff/child-monthly-reports") return method === "GET" || method === "POST";
  if (
    segments[0] === "staff" &&
    segments[1] === "child-monthly-reports" &&
    UUID.test(segments[2] ?? "")
  ) {
    if (segments.length === 3) return method === "PATCH";
    return segments.length === 4 && segments[3] === "submit" && method === "POST";
  }
  if (
    segments[0] === "parent" &&
    segments[1] === "relationships" &&
    UUID.test(segments[2] ?? "") &&
    segments[3] === "monthly-reports"
  ) {
    if (segments.length === 4) return method === "GET";
    return (
      segments.length === 6 &&
      UUID.test(segments[4] ?? "") &&
      segments[5] === "ack" &&
      method === "POST"
    );
  }
  if (path === "/staff/monthly-feedback") return method === "GET" || method === "POST";
  if (
    segments[0] === "staff" &&
    segments[1] === "monthly-feedback" &&
    UUID.test(segments[2] ?? "")
  ) {
    if (segments.length === 3) return method === "PATCH";
    return segments.length === 4 && segments[3] === "submit" && method === "POST";
  }
  if (path === "/staff/daily-reports") return method === "GET" || method === "POST";
  if (
    segments.length === 3 &&
    segments[0] === "staff" &&
    segments[1] === "daily-reports" &&
    UUID.test(segments[2] ?? "")
  )
    return method === "PATCH";
  if (
    segments.length === 4 &&
    segments[0] === "staff" &&
    segments[1] === "daily-reports" &&
    UUID.test(segments[2] ?? "") &&
    ["submit", "resubmit"].includes(segments[3] ?? "")
  )
    return method === "POST";
  if (
    segments.length === 4 &&
    segments[0] === "staff" &&
    segments[1] === "tasks" &&
    UUID.test(segments[2] ?? "") &&
    ["claim", "start", "complete"].includes(segments[3] ?? "")
  )
    return method === "POST";
  if (path === "/staff/guardian-binding/applications") return method === "GET";
  if (
    segments.length === 5 &&
    segments[0] === "staff" &&
    segments[1] === "guardian-binding" &&
    segments[2] === "applications" &&
    UUID.test(segments[3] ?? "") &&
    segments[4] === "review"
  )
    return method === "POST";
  if (path === "/consent-policies") return method === "GET";
  if (path === "/consents") return method === "GET" || method === "POST";
  if (
    segments.length === 3 &&
    segments[0] === "consents" &&
    UUID.test(segments[1] ?? "") &&
    segments[2] === "revoke"
  )
    return method === "POST";
  if (path === "/privacy-requests") return method === "GET" || method === "POST";
  if (
    segments.length === 3 &&
    segments[0] === "privacy-requests" &&
    UUID.test(segments[1] ?? "") &&
    segments[2] === "withdraw"
  )
    return method === "POST";
  if (segments.length === 2 && segments[0] === "parent" && segments[1] === "leave-requests")
    return method === "GET" || method === "POST";
  if (segments.length === 2 && segments[0] === "staff" && segments[1] === "leave-requests")
    return method === "GET";
  if (
    segments.length === 4 &&
    segments[0] === "parent" &&
    segments[1] === "leave-requests" &&
    UUID.test(segments[2] ?? "") &&
    ["resubmit", "withdraw", "acknowledge"].includes(segments[3] ?? "")
  )
    return method === "POST";
  if (
    segments.length === 4 &&
    segments[0] === "staff" &&
    segments[1] === "leave-requests" &&
    UUID.test(segments[2] ?? "") &&
    segments[3] === "review"
  )
    return method === "POST";
  if (path === "/staff/care-record-students") return method === "GET";
  if (path === "/staff/care-records") return method === "GET" || method === "POST";
  if (path === "/parent/care-records") return method === "GET";
  if (/^\/staff\/care-records\/[0-9a-f-]{36}$/iu.test(path) && UUID.test(segments[2] ?? ""))
    return method === "GET" || method === "PATCH";
  if (
    /^\/staff\/care-records\/[0-9a-f-]{36}\/(submit|resubmit|review|publish|withdraw|revoke-publication)$/iu.test(
      path,
    ) &&
    UUID.test(segments[2] ?? "")
  ) {
    return method === "POST";
  }
  if (/^\/parent\/care-records\/[0-9a-f-]{36}$/iu.test(path) && UUID.test(segments[2] ?? "")) {
    return method === "GET";
  }
  return (
    /^\/parent\/care-records\/[0-9a-f-]{36}\/receipt$/iu.test(path) &&
    UUID.test(segments[2] ?? "") &&
    method === "POST"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const MONTHLY_FIELDS = [
  "learningParticipation",
  "dailyHabits",
  "activityParticipation",
  "familySchoolCollaboration",
] as const;
const MONTHLY_COUNTS = ["GROWTH_RECORD", "ATTENDANCE_OVERVIEW", "STAFF_DAILY"] as const;
const MONTHLY_STATUSES = [
  "DRAFT",
  "SUBMITTED",
  "RETURNED",
  "CONFIRMED",
  "PUBLISHED",
  "REVIEW_REQUIRED",
];
const MONTHLY_ACTIONS = ["edit", "submit", "confirm", "return", "publish"];

function positiveVersion(value: unknown): boolean {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

function validSupplements(
  value: unknown,
  allowUnknown = false,
): value is Record<(typeof MONTHLY_FIELDS)[number], string> {
  return (
    isRecord(value) &&
    (allowUnknown || Object.keys(value).length === MONTHLY_FIELDS.length) &&
    MONTHLY_FIELDS.every(
      (key) =>
        typeof value[key] === "string" &&
        ["KEEP_WATCHING", "PROGRESSING", "FOLLOW_UP"].includes(value[key]),
    )
  );
}

function validMonth(value: unknown): value is string {
  return typeof value === "string" && /^(19|20|21)\d{2}-(0[1-9]|1[0-2])$/u.test(value);
}

function validMonthlyBody(path: readonly string[], value: unknown): boolean {
  if (!isRecord(value)) return false;
  const keys = Object.keys(value);
  if (path.length === 4) return keys.length === 1 && positiveVersion(value.version);
  return (
    keys.length === 2 &&
    validSupplements(value.supplements) &&
    (path.length === 2 ? validMonth(value.month) : positiveVersion(value.version))
  );
}

function monthlyRecord(value: unknown) {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    !UUID.test(value.id) ||
    !positiveVersion(value.version) ||
    !positiveVersion(value.sourceVersion) ||
    !validMonth(value.month) ||
    typeof value.classRef !== "string" ||
    !value.classRef.trim() ||
    value.audience !== "STAFF_INTERNAL" ||
    typeof value.status !== "string" ||
    !MONTHLY_STATUSES.includes(value.status) ||
    !validSupplements(value.supplements, true) ||
    !isRecord(value.sourceCounts) ||
    !Array.isArray(value.actions) ||
    value.actions.some(
      (action) => typeof action !== "string" || !MONTHLY_ACTIONS.includes(action),
    ) ||
    new Set(value.actions).size !== value.actions.length
  )
    return undefined;
  const counts = value.sourceCounts;
  const supplements = value.supplements;
  if (
    !MONTHLY_COUNTS.every(
      (key) =>
        typeof counts[key] === "number" && Number.isSafeInteger(counts[key]) && counts[key] >= 0,
    )
  )
    return undefined;
  return {
    id: value.id,
    version: value.version,
    sourceVersion: value.sourceVersion,
    month: value.month,
    classRef: value.classRef,
    audience: value.audience,
    status: value.status,
    supplements: Object.fromEntries(MONTHLY_FIELDS.map((key) => [key, supplements[key]])),
    sourceCounts: Object.fromEntries(MONTHLY_COUNTS.map((key) => [key, counts[key]])),
    actions: [...value.actions],
  };
}

function monthlyPayload(value: unknown, listing: boolean) {
  if (!listing) return monthlyRecord(value);
  if (!isRecord(value) || !Array.isArray(value.records) || typeof value.canCreate !== "boolean")
    return undefined;
  const records = value.records.map(monthlyRecord);
  if (
    records.some((record) => !record) ||
    new Set(records.map((record) => record?.id)).size !== records.length
  )
    return undefined;
  return { records, canCreate: value.canCreate };
}

function validChildMonthlyBody(path: readonly string[], value: unknown): boolean {
  if (!isRecord(value)) return false;
  const keys = Object.keys(value);
  if (path[0] === "parent") {
    return (
      keys.length === 2 &&
      positiveVersion(value.publicationVersion) &&
      positiveVersion(value.relationshipVersion)
    );
  }
  if (path.length === 4) return keys.length === 1 && positiveVersion(value.version);
  if (path.length === 3)
    return (
      keys.length === 2 && positiveVersion(value.version) && validSupplements(value.supplements)
    );
  return (
    keys.length === 3 &&
    typeof value.studentId === "string" &&
    UUID.test(value.studentId) &&
    validMonth(value.month) &&
    validSupplements(value.supplements)
  );
}

function childMonthlyRecord(value: unknown, parent: boolean) {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    !UUID.test(value.id) ||
    typeof value.studentId !== "string" ||
    !UUID.test(value.studentId) ||
    typeof value.studentLabel !== "string" ||
    !value.studentLabel.trim() ||
    !validMonth(value.month) ||
    !validSupplements(value.supplements, true) ||
    !isRecord(value.sourceCounts)
  )
    return undefined;
  const counts = value.sourceCounts;
  const supplements = value.supplements;
  const countKeys = ["GROWTH_RECORD", "ATTENDANCE_OVERVIEW"] as const;
  if (
    !countKeys.every(
      (key) =>
        typeof counts[key] === "number" && Number.isSafeInteger(counts[key]) && counts[key] >= 0,
    )
  )
    return undefined;
  const shared = {
    id: value.id,
    studentId: value.studentId,
    studentLabel: value.studentLabel,
    month: value.month,
    supplements: Object.fromEntries(MONTHLY_FIELDS.map((key) => [key, supplements[key]])),
    sourceCounts: Object.fromEntries(countKeys.map((key) => [key, counts[key]])),
  };
  if (parent) {
    if (
      !positiveVersion(value.publicationVersion) ||
      !positiveVersion(value.relationshipVersion) ||
      typeof value.acknowledged !== "boolean"
    )
      return undefined;
    return {
      ...shared,
      publicationVersion: value.publicationVersion,
      relationshipVersion: value.relationshipVersion,
      acknowledged: value.acknowledged,
    };
  }
  if (
    typeof value.classRef !== "string" ||
    !value.classRef.trim() ||
    typeof value.status !== "string" ||
    !MONTHLY_STATUSES.includes(value.status) ||
    !positiveVersion(value.version) ||
    !positiveVersion(value.sourceVersion) ||
    typeof value.publicationVersion !== "number" ||
    !Number.isSafeInteger(value.publicationVersion) ||
    value.publicationVersion < 0 ||
    !Array.isArray(value.actions) ||
    value.actions.some(
      (action) => typeof action !== "string" || !MONTHLY_ACTIONS.includes(action),
    ) ||
    new Set(value.actions).size !== value.actions.length
  )
    return undefined;
  return {
    ...shared,
    classRef: value.classRef,
    status: value.status,
    version: value.version,
    sourceVersion: value.sourceVersion,
    publicationVersion: value.publicationVersion,
    actions: [...value.actions],
  };
}

function childMonthlyPayload(value: unknown, parent: boolean, listing: boolean) {
  if (!listing) {
    if (parent)
      return isRecord(value) && value.acknowledged === true ? { acknowledged: true } : undefined;
    return childMonthlyRecord(value, false);
  }
  if (!isRecord(value) || !Array.isArray(value.records)) return undefined;
  const records = value.records.map((record) => childMonthlyRecord(record, parent));
  if (
    records.some((record) => !record) ||
    new Set(records.map((record) => record?.id)).size !== records.length
  )
    return undefined;
  if (parent) return { records };
  if (!Array.isArray(value.students)) return undefined;
  const students = value.students.map((student) => {
    if (
      !isRecord(student) ||
      typeof student.id !== "string" ||
      !UUID.test(student.id) ||
      typeof student.displayRef !== "string" ||
      !student.displayRef.trim() ||
      typeof student.classRef !== "string" ||
      !student.classRef.trim()
    )
      return undefined;
    return { id: student.id, displayRef: student.displayRef, classRef: student.classRef };
  });
  if (
    students.some((student) => !student) ||
    new Set(students.map((student) => student?.id)).size !== students.length
  )
    return undefined;
  return { records, students };
}

function cookieToken(request: Request): string | undefined {
  const entry = request.headers
    .get("cookie")
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${COOKIE}=`));
  const value = entry?.slice(COOKIE.length + 1);
  return value && TOKEN.test(value) ? value : undefined;
}

function cookieHeader(value: string, maxAge: number, request: Request): string {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${COOKIE}=${value}; Path=/api-local; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

function trustedRequestOrigin(request: Request, url: URL): boolean {
  const origin = request.headers.get("origin");
  if (origin === null) return request.method === "GET";
  if (url.protocol !== "https:" && url.protocol !== "http:") return false;
  const host = (request.headers.get("host") ?? url.host).toLowerCase();
  try {
    const source = new URL(origin);
    const defaultPort = url.protocol === "https:" ? "443" : "80";
    return (
      origin === source.origin &&
      source.protocol === url.protocol &&
      (host === source.host || (!source.port && host === source.host + ":" + defaultPort))
    );
  } catch {
    return false;
  }
}

async function readJsonBody(
  request: Request,
): Promise<
  | { readonly ok: true; readonly value?: unknown }
  | { readonly ok: false; readonly response: Response }
> {
  const length = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(length) && length > MAX_BODY_BYTES) {
    return { ok: false, response: error(413, "BODY_TOO_LARGE") };
  }
  const bytes = await request.arrayBuffer();
  if (bytes.byteLength > MAX_BODY_BYTES)
    return { ok: false, response: error(413, "BODY_TOO_LARGE") };
  if (bytes.byteLength === 0) return { ok: true };
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return { ok: false, response: error(415, "JSON_REQUIRED") };
  }
  try {
    return {
      ok: true,
      value: JSON.parse(new TextDecoder().decode(bytes)) as unknown,
    };
  } catch {
    return { ok: false, response: error(400, "INVALID_JSON") };
  }
}

async function handle(request: Request, context: RouteContext): Promise<Response> {
  const { path } = await context.params;
  if (!Array.isArray(path) || !path.length || path.some((part) => !part || part.includes("/"))) {
    return error(404, "NOT_FOUND");
  }
  const method = request.method.toUpperCase();
  if (!allowed(method, path)) return error(404, "NOT_FOUND");
  const isChildMonthly =
    (path[0] === "staff" && path[1] === "child-monthly-reports") ||
    (path[0] === "parent" && path[1] === "relationships" && path[3] === "monthly-reports");
  if (
    isChildMonthly &&
    ["x-tenant-id", "x-campus-id", "x-user-id", "x-member-id", "x-actor-id", "x-role"].some(
      (header) => request.headers.has(header),
    )
  )
    return error(400, "SCOPE_NOT_ALLOWED");
  const requestUrl = new URL(request.url);
  if (requestUrl.search || requestUrl.hash) return error(400, "QUERY_NOT_ALLOWED");
  if (!trustedRequestOrigin(request, requestUrl)) return error(403, "ORIGIN_NOT_ALLOWED");
  const isLogin = method === "POST" && path.join("/") === "identity/login";
  const isLogout = method === "POST" && path.join("/") === "identity/logout";
  const responseHeaders = new Headers();
  if (isLogout) responseHeaders.set("set-cookie", cookieHeader("", 0, request));
  const upstream = apiOrigin();
  if (!upstream)
    return json(
      {
        error: {
          code: "LOCAL_API_UNAVAILABLE",
          message: "本机成长记录服务未配置。",
        },
      },
      503,
      responseHeaders,
    );

  const token = isLogin ? undefined : cookieToken(request);
  if (!isLogin && !token && !isLogout) return error(401, "UNAUTHENTICATED");

  const body = method === "GET" ? { ok: true as const } : await readJsonBody(request);
  if (!body.ok) return body.response;
  const isMonthly = path[0] === "staff" && path[1] === "monthly-feedback";
  if (isMonthly && method !== "GET" && !validMonthlyBody(path, body.value))
    return error(400, "INVALID_MONTHLY_INPUT");
  if (isChildMonthly && method !== "GET" && !validChildMonthlyBody(path, body.value))
    return error(400, "INVALID_MONTHLY_INPUT");
  const headers = new Headers({ accept: "application/json" });
  if (body.value !== undefined) headers.set("content-type", "application/json");
  if (token) headers.set("authorization", `Bearer ${token}`);
  const target = new URL(`/${path.join("/")}`, upstream);

  try {
    const response = await fetch(target, {
      method,
      headers,
      cache: "no-store",
      redirect: "error",
      ...(isMonthly || isChildMonthly ? { signal: AbortSignal.timeout(8000) } : {}),
      ...(body.value === undefined ? {} : { body: JSON.stringify(body.value) }),
    });
    const payload: unknown = await response.json().catch(() => undefined);
    if (!isLogin && response.status === 401) {
      responseHeaders.set("set-cookie", cookieHeader("", 0, request));
      return json(
        { error: { code: "UNAUTHENTICATED", message: "请重新登录。" } },
        401,
        responseHeaders,
      );
    }
    if (isMonthly || isChildMonthly) {
      if (!response.ok) {
        return json(
          {
            error: {
              code: "MONTHLY_REQUEST_FAILED",
              message: isChildMonthly
                ? "孩子月报请求未完成，请刷新页面后重试。"
                : "月度总结请求未完成，请刷新页面后重试。",
            },
          },
          response.status,
          responseHeaders,
        );
      }
      const data = isChildMonthly
        ? childMonthlyPayload(
            isRecord(payload) ? payload.data : undefined,
            path[0] === "parent",
            method === "GET",
          )
        : monthlyPayload(isRecord(payload) ? payload.data : undefined, method === "GET");
      return data ? json({ data }, response.status) : error(502, "INVALID_LOCAL_API_RESPONSE");
    }
    if (!payload) return error(502, "INVALID_LOCAL_API_RESPONSE", responseHeaders);
    if (isLogin && response.ok) {
      if (
        typeof payload !== "object" ||
        payload === null ||
        !("data" in payload) ||
        typeof payload.data !== "object" ||
        payload.data === null ||
        !("access_token" in payload.data) ||
        !("token_type" in payload.data) ||
        payload.data.token_type !== "Bearer" ||
        typeof payload.data.access_token !== "string" ||
        !TOKEN.test(payload.data.access_token) ||
        !("expires_at" in payload.data) ||
        typeof payload.data.expires_at !== "string"
      ) {
        return error(502, "INVALID_LOCAL_API_RESPONSE");
      }
      const data = payload.data as Record<string, unknown>;
      const maxAge = Math.min(
        28800,
        Math.floor((Date.parse(data.expires_at as string) - Date.now()) / 1000),
      );
      if (!Number.isFinite(maxAge) || maxAge < 1) return error(502, "INVALID_LOCAL_API_RESPONSE");
      responseHeaders.set("set-cookie", cookieHeader(data.access_token as string, maxAge, request));
      const safeData = { ...data };
      delete safeData.access_token;
      const safePayload = {
        ...(payload as Record<string, unknown>),
        data: safeData,
      };
      return json(safePayload, response.status, responseHeaders);
    }
    return json(payload, response.status, responseHeaders);
  } catch {
    return json(
      {
        error: {
          code: "LOCAL_API_UNAVAILABLE",
          message: "本机成长记录服务暂不可用。",
        },
      },
      503,
      responseHeaders,
    );
  }
}

export function GET(request: Request, context: RouteContext): Promise<Response> {
  return handle(request, context);
}

export function POST(request: Request, context: RouteContext): Promise<Response> {
  return handle(request, context);
}

export function PATCH(request: Request, context: RouteContext): Promise<Response> {
  return handle(request, context);
}
