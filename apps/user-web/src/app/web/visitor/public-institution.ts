export type PublicInstitutionKind = "profile" | "home";
export type PublicInstitutionReadState = "READY" | "NOT_CONFIGURED" | "EMPTY" | "ERROR";

export interface PublicInstitutionVisitorItem {
  readonly slug: string;
  readonly title: string;
  readonly summary: string;
  readonly body: readonly string[];
  readonly publicationStatus: "PUBLISHED";
  readonly visibility: "PUBLIC";
  readonly scope: "PUBLIC";
  readonly syntheticData: "SIMULATED";
  readonly freshnessStatus: "FRESH";
  readonly enabledStatus: "ENABLED";
}

export interface PublicInstitutionListResult {
  readonly state: PublicInstitutionReadState;
  readonly items: readonly PublicInstitutionVisitorItem[];
}

export interface PublicInstitutionItemResult {
  readonly state: PublicInstitutionReadState;
  readonly item?: PublicInstitutionVisitorItem;
}

export interface PublicInstitutionClientOptions {
  readonly baseUrl?: string | undefined;
  readonly publicRef?: string | undefined;
  readonly fetcher?: typeof fetch;
}

const PUBLIC_REF_PATTERN = /^[A-Za-z0-9._~-]{1,128}$/u;
const CONTENT_KEY_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/u;
const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "[::1]"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isContentBlock(value: unknown): value is { readonly kind: string; readonly text: string } {
  return isRecord(value) && typeof value.kind === "string" && typeof value.text === "string";
}

function configuredBase(value: string | undefined): URL | undefined {
  if (value === undefined || value.length === 0) return undefined;
  try {
    const url = new URL(value);
    const localHttp = url.protocol === "http:" && LOOPBACK_HOSTS.has(url.hostname);
    if (
      (url.protocol !== "https:" && !localHttp) ||
      url.username.length > 0 ||
      url.password.length > 0 ||
      url.pathname !== "/" ||
      url.search.length > 0 ||
      url.hash.length > 0
    ) {
      return undefined;
    }
    return url;
  } catch {
    return undefined;
  }
}

function projectItem(
  value: unknown,
  kind: PublicInstitutionKind,
): PublicInstitutionVisitorItem | undefined {
  if (!isRecord(value)) return undefined;
  if (
    typeof value.content_key !== "string" ||
    !CONTENT_KEY_PATTERN.test(value.content_key) ||
    value.type !== (kind === "profile" ? "INSTITUTION" : "HOME_BLOCK") ||
    typeof value.title !== "string" ||
    typeof value.summary !== "string" ||
    value.visibility !== "PUBLIC" ||
    !Number.isInteger(value.version) ||
    typeof value.published_at !== "string" ||
    Number.isNaN(Date.parse(value.published_at)) ||
    !Array.isArray(value.blocks) ||
    !value.blocks.every(isContentBlock)
  ) {
    return undefined;
  }
  return {
    slug: value.content_key,
    title: value.title,
    summary: value.summary,
    body: value.blocks.map((block) => block.text),
    publicationStatus: "PUBLISHED",
    visibility: "PUBLIC",
    scope: "PUBLIC",
    syntheticData: "SIMULATED",
    freshnessStatus: "FRESH",
    enabledStatus: "ENABLED",
  };
}

export class PublicInstitutionClient {
  private readonly baseUrl: URL | undefined;
  private readonly publicRef: string | undefined;
  private readonly invalidConfiguration: boolean;
  private readonly fetcher: typeof fetch;

  public constructor(options: PublicInstitutionClientOptions = {}) {
    this.baseUrl = configuredBase(options.baseUrl);
    this.publicRef = options.publicRef;
    this.invalidConfiguration =
      options.baseUrl !== undefined && options.baseUrl.length > 0 && this.baseUrl === undefined;
    this.fetcher = options.fetcher ?? globalThis.fetch.bind(globalThis);
  }

  public async list(kind: PublicInstitutionKind): Promise<PublicInstitutionListResult> {
    const config = this.requestConfiguration();
    if (config.state !== "READY") return { state: config.state, items: [] };
    try {
      const response = await this.fetcher(this.url(kind), {
        method: "GET",
        credentials: "omit",
        cache: "no-store",
        redirect: "error",
      });
      if (!response.ok) return { state: response.status === 404 ? "EMPTY" : "ERROR", items: [] };
      const value: unknown = await response.json();
      if (!isRecord(value) || !Array.isArray(value.data)) return { state: "ERROR", items: [] };
      const items = value.data.map((item) => projectItem(item, kind));
      if (items.some((item) => item === undefined)) return { state: "ERROR", items: [] };
      return { state: "READY", items: items as PublicInstitutionVisitorItem[] };
    } catch {
      return { state: "ERROR", items: [] };
    }
  }

  public async read(
    kind: PublicInstitutionKind,
    contentKey: string,
  ): Promise<PublicInstitutionItemResult> {
    const config = this.requestConfiguration();
    if (config.state !== "READY") return { state: config.state };
    if (!CONTENT_KEY_PATTERN.test(contentKey)) return { state: "ERROR" };
    try {
      const response = await this.fetcher(this.url(kind, contentKey), {
        method: "GET",
        credentials: "omit",
        cache: "no-store",
        redirect: "error",
      });
      if (!response.ok) return { state: response.status === 404 ? "EMPTY" : "ERROR" };
      const value: unknown = await response.json();
      if (!isRecord(value)) return { state: "ERROR" };
      const item = projectItem(value.data, kind);
      return item === undefined ? { state: "ERROR" } : { state: "READY", item };
    } catch {
      return { state: "ERROR" };
    }
  }

  private requestConfiguration(): { readonly state: "READY" | "NOT_CONFIGURED" | "ERROR" } {
    if (this.invalidConfiguration) return { state: "ERROR" };
    if (this.baseUrl === undefined || this.publicRef === undefined) {
      return { state: "NOT_CONFIGURED" };
    }
    if (!PUBLIC_REF_PATTERN.test(this.publicRef)) return { state: "ERROR" };
    return { state: "READY" };
  }

  private url(kind: PublicInstitutionKind, contentKey?: string): URL {
    const url = new URL(
      `/public/institution/${kind}${contentKey === undefined ? "" : `/${encodeURIComponent(contentKey)}`}`,
      this.baseUrl,
    );
    url.searchParams.set("public_ref", this.publicRef!);
    return url;
  }
}
