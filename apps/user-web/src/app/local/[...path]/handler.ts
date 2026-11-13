import { NextResponse, type NextRequest } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = Readonly<{ params: Promise<{ path: string[] }> }>;

function localApiOrigin(): string | null {
  const value = process.env.USER_WEB_LOCAL_SYNTHETIC_API;
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.origin === value &&
      url.protocol === "http:" &&
      url.hostname === "127.0.0.1" &&
      /^\d{1,5}$/u.test(url.port) &&
      Number(url.port) > 0 &&
      Number(url.port) <= 65535 &&
      !url.username &&
      !url.password
      ? url.origin
      : null;
  } catch {
    return null;
  }
}

function allowed(method: string, path: string): boolean {
  if (method === "GET")
    return [
      "session",
      "student-options",
      "binding-applications",
      "consent-policies",
      "consents",
      "privacy-requests",
      "learning-sessions",
      "learning-parent-controls",
      "learning-knowledge",
      "public-meals",
      "care-records",
      "notices",
      "health-incidents",
      "fees",
      "fee-ledger",
      "monthly-feedback-parent",
      "pickup-authorizations",
      "pickup-records",
      "leave-requests",
    ].includes(path);
  if (method === "PATCH")
    return /^leave-requests\/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(
      path,
    );
  if (method !== "POST") return false;
  return (
    path === "sessions" ||
    path === "binding-applications" ||
    path === "guardian-binding/applications" ||
    path === "consents" ||
    path === "privacy-requests" ||
    path === "pickup-authorizations" ||
    path === "leave-requests" ||
    /^leave-requests\/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\/(withdraw|receipt)$/iu.test(
      path,
    ) ||
    /^pickup-authorizations\/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\/(activate|revoke|credential)$/iu.test(
      path,
    ) ||
    /^monthly-feedback\/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\/ack$/iu.test(
      path,
    ) ||
    /^(notices|health-incidents)\/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\/(read|ack)$/iu.test(
      path,
    ) ||
    /^care-records\/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\/receipt$/iu.test(
      path,
    ) ||
    /^consents\/[0-9a-f-]{36}\/revoke$/iu.test(path) ||
    /^privacy-requests\/[0-9a-f-]{36}\/withdraw$/iu.test(path) ||
    /^learning-parent-controls\/[\w-]{1,80}$/u.test(path) ||
    /^learning-parent-contact\/[\w-]{1,80}$/u.test(path)
  );
}

async function proxy(request: NextRequest, { params }: RouteContext) {
  const { path: segments } = await params;
  if (
    !Array.isArray(segments) ||
    segments.some((segment) => !segment || segment === "." || segment === "..")
  )
    return NextResponse.json({ error: { code: "INVALID_REQUEST" } }, { status: 400 });
  const path = segments.join("/");
  if (!allowed(request.method, path))
    return NextResponse.json({ error: { code: "UNAVAILABLE" } }, { status: 404 });
  const guardianBindingPath = path === "guardian-binding/applications";
  const origin = guardianBindingPath ? "http://127.0.0.1:4321" : localApiOrigin();
  if (!origin)
    return NextResponse.json({ error: { code: "LOCAL_SYNTHETIC_UNAVAILABLE" } }, { status: 503 });
  let search = "";
  if (path === "public-meals") {
    if (request.method !== "GET")
      return NextResponse.json({ error: { code: "UNAVAILABLE" } }, { status: 404 });
    const entries = [...request.nextUrl.searchParams.entries()];
    const date = entries[0]?.[1] ?? "";
    const parsed = new Date(`${date}T00:00:00.000Z`);
    if (
      entries.length !== 1 ||
      entries[0]?.[0] !== "date" ||
      !/^\d{4}-\d{2}-\d{2}$/u.test(date) ||
      Number.isNaN(parsed.getTime()) ||
      parsed.toISOString().slice(0, 10) !== date
    )
      return NextResponse.json({ error: { code: "INVALID_REQUEST" } }, { status: 400 });
    search = `?date=${encodeURIComponent(date)}`;
  } else if (request.nextUrl.search) {
    return NextResponse.json({ error: { code: "INVALID_REQUEST" } }, { status: 400 });
  }
  let body: string | undefined;
  if (request.method === "POST" || request.method === "PATCH") {
    if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json"))
      return NextResponse.json({ error: { code: "INVALID_REQUEST" } }, { status: 415 });
    body = await request.text();
    if (body.length > 4096)
      return NextResponse.json({ error: { code: "INVALID_REQUEST" } }, { status: 413 });
    if (path === "sessions") {
      try {
        const value: unknown = JSON.parse(body);
        if (
          typeof value !== "object" ||
          value === null ||
          Array.isArray(value) ||
          Object.keys(value).length !== 1 ||
          (value as { profile?: unknown }).profile !== "parent-alpha"
        )
          return NextResponse.json({ error: { code: "UNAVAILABLE" } }, { status: 403 });
      } catch {
        return NextResponse.json({ error: { code: "INVALID_REQUEST" } }, { status: 400 });
      }
    }
  }

  const authorization = request.headers.get("authorization");
  if (authorization && !/^Bearer [\w-]{43}$/u.test(authorization))
    return NextResponse.json({ error: { code: "UNAVAILABLE" } }, { status: 401 });

  try {
    const upstreamPath = guardianBindingPath
      ? `/${segments.map(encodeURIComponent).join("/")}`
      : `/local/${segments.map(encodeURIComponent).join("/")}`;
    const response = await fetch(`${origin}${upstreamPath}${search}`, {
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

export async function GET(request: NextRequest, context: RouteContext) {
  return proxy(request, context);
}

export async function POST(request: NextRequest, context: RouteContext) {
  return proxy(request, context);
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  if (!Array.isArray(path) || !allowed("PATCH", path.join("/")))
    return NextResponse.json({ error: { code: "UNAVAILABLE" } }, { status: 405 });
  return proxy(request, context);
}

export async function OPTIONS(request: NextRequest, context: RouteContext) {
  return proxy(request, context);
}
