import { NextResponse, type NextRequest } from "next/server";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
type Context = Readonly<{ params: Promise<{ path: string[] }> }>;
const REVIEW =
  /^leave-requests\/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\/review$/iu;
const TASK_COMMAND =
  /^staff-tasks\/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\/(claim|start|complete)$/iu;
const CARE_RECORD =
  /^care-records\/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const CARE_COMMAND =
  /^care-records\/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\/(submit|withdraw|resubmit)$/iu;
const STAFF_DAILY_REPORT =
  /^staff-daily-reports\/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const STAFF_DAILY_COMMAND =
  /^staff-daily-reports\/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\/(submit|resubmit)$/iu;
async function proxy(request: NextRequest, context: Context) {
  const { path: parts } = await context.params;
  if (
    !Array.isArray(parts) ||
    parts.some((part) => !part || part === "." || part === "..") ||
    request.nextUrl.search
  )
    return NextResponse.json({ error: { code: "INVALID_REQUEST" } }, { status: 400 });
  const path = parts.join("/");
  if (
    request.method === "PATCH" &&
    !path.startsWith("care-records/") &&
    !path.startsWith("staff-daily-reports/")
  )
    return NextResponse.json({ error: { code: "METHOD_NOT_ALLOWED" } }, { status: 405 });
  const allowed =
    request.method === "GET"
      ? [
          "session",
          "leave-requests",
          "staff-tasks",
          "student-options",
          "care-records",
          "staff-daily-owned",
        ].includes(path)
      : request.method === "PATCH"
        ? CARE_RECORD.test(path) || STAFF_DAILY_REPORT.test(path)
        : request.method === "POST" &&
          (path === "sessions" ||
            path === "care-records" ||
            path === "staff-daily-reports" ||
            REVIEW.test(path) ||
            TASK_COMMAND.test(path) ||
            CARE_COMMAND.test(path) ||
            STAFF_DAILY_COMMAND.test(path));
  if (!allowed) return NextResponse.json({ error: { code: "UNAVAILABLE" } }, { status: 404 });
  let base: string;
  try {
    const value = process.env.USER_WEB_LOCAL_SYNTHETIC_API;
    if (!value) throw new Error("missing");
    const url = new URL(value);
    if (
      url.origin !== value ||
      url.protocol !== "http:" ||
      url.hostname !== "127.0.0.1" ||
      !url.port ||
      Number(url.port) < 1 ||
      Number(url.port) > 65535 ||
      url.username ||
      url.password
    )
      throw new Error("invalid");
    base = url.origin;
  } catch {
    return NextResponse.json({ error: { code: "LOCAL_SYNTHETIC_UNAVAILABLE" } }, { status: 503 });
  }
  let body: string | undefined;
  if (request.method === "POST" || request.method === "PATCH") {
    if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json"))
      return NextResponse.json({ error: { code: "INVALID_REQUEST" } }, { status: 415 });
    body = await request.text();
    if (body.length > 4096)
      return NextResponse.json({ error: { code: "INVALID_REQUEST" } }, { status: 413 });
    try {
      const value: unknown = JSON.parse(body);
      if (
        path === "sessions" &&
        (typeof value !== "object" ||
          value === null ||
          Array.isArray(value) ||
          Object.keys(value).length !== 1 ||
          (value as { profile?: unknown }).profile !== "teacher-east")
      )
        return NextResponse.json({ error: { code: "UNAVAILABLE" } }, { status: 403 });
    } catch {
      return NextResponse.json({ error: { code: "INVALID_REQUEST" } }, { status: 400 });
    }
  }
  const authorization = request.headers.get("authorization");
  if (authorization && !/^Bearer [\w-]{43}$/u.test(authorization))
    return NextResponse.json({ error: { code: "UNAVAILABLE" } }, { status: 401 });
  try {
    const response = await fetch(base + "/local/" + parts.map(encodeURIComponent).join("/"), {
      method: request.method,
      headers: {
        ...(authorization ? { authorization } : {}),
        ...(body === undefined ? {} : { "content-type": "application/json" }),
      },
      ...(body === undefined ? {} : { body }),
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(5000),
    });
    return new NextResponse(await response.arrayBuffer(), {
      status: response.status,
      headers: {
        "content-type": response.headers.get("content-type") ?? "application/json",
        "cache-control": "no-store",
      },
    });
  } catch {
    return NextResponse.json({ error: { code: "LOCAL_SYNTHETIC_UNAVAILABLE" } }, { status: 502 });
  }
}
export async function GET(request: NextRequest, context: Context) {
  return proxy(request, context);
}
export async function POST(request: NextRequest, context: Context) {
  return proxy(request, context);
}
export async function PATCH(request: NextRequest, context: Context) {
  return proxy(request, context);
}
export async function OPTIONS(request: NextRequest, context: Context) {
  return proxy(request, context);
}
