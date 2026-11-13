const COMMAND =
  /^\/local\/care-records\/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\/(submit|withdraw|resubmit)$/iu;

const RECORD =
  /^\/local\/care-records\/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export function createStaffCareTransport(
  baseUrl: string,
  fetcher: typeof fetch = globalThis.fetch.bind(globalThis),
): typeof fetch {
  const base = new URL(baseUrl);
  if (
    base.protocol !== "http:" ||
    !["127.0.0.1", "localhost"].includes(base.hostname) ||
    !base.port ||
    base.username ||
    base.password ||
    base.pathname !== "/" ||
    base.search ||
    base.hash
  )
    throw new Error("成长记录只允许连接本机服务。");
  return async (input, init = {}) => {
    if (typeof input !== "string" && !(input instanceof URL))
      return new Response(null, { status: 403 });
    let url: URL;
    try {
      url = new URL(String(input), base.origin);
    } catch {
      return new Response(null, { status: 403 });
    }
    const method = init.method ?? "GET";
    const allowed =
      method === "GET"
        ? ["/local/session", "/local/student-options", "/local/care-records"].includes(url.pathname)
        : method === "PATCH"
          ? RECORD.test(url.pathname)
          : method === "POST" &&
            (url.pathname === "/local/sessions" ||
              url.pathname === "/local/care-records" ||
              COMMAND.test(url.pathname));
    if (
      !allowed ||
      url.origin !== base.origin ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    )
      return new Response(null, { status: 403 });
    if (url.pathname === "/local/sessions") {
      try {
        if (typeof init.body !== "string") throw new Error("invalid");
        const body: unknown = JSON.parse(init.body);
        if (
          typeof body !== "object" ||
          body === null ||
          Array.isArray(body) ||
          Object.keys(body).length !== 1 ||
          (body as { profile?: unknown }).profile !== "teacher-east"
        )
          throw new Error("invalid");
      } catch {
        return new Response(null, { status: 403 });
      }
    }
    const response = await fetcher(
      base.origin + "/staff-local" + url.pathname.slice("/local".length),
      {
        ...init,
        method,
        credentials: "omit",
        cache: "no-store",
        redirect: "error",
        signal: AbortSignal.timeout(5000),
      },
    );
    return response;
  };
}
