export const HOME_CONTENT_KEY = "home-content-synthetic-east";

export type HomeContentRecord = Readonly<{
  content_key: typeof HOME_CONTENT_KEY;
  title: string;
  type: "HOME_BLOCK";
  status: "DRAFT" | "PUBLISHED" | "UNPUBLISHED";
  version: number;
  visibility: "PUBLIC";
  body: Readonly<{
    summary: string;
    blocks: readonly [Readonly<{ kind: "TEXT"; text: string }>];
  }>;
  synthetic_data: true;
}>;

export type HomeContentDraft = Readonly<{
  title: string;
  summary: string;
  text: string;
}>;

type JsonObject = Record<string, unknown>;

function isRecord(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseRecord(value: unknown): HomeContentRecord {
  if (
    !isRecord(value) ||
    Object.keys(value).length !== 8 ||
    value.content_key !== HOME_CONTENT_KEY ||
    typeof value.title !== "string" ||
    value.title.trim().length === 0 ||
    value.title.length > 120 ||
    value.type !== "HOME_BLOCK" ||
    (value.status !== "DRAFT" &&
      value.status !== "PUBLISHED" &&
      value.status !== "UNPUBLISHED") ||
    !Number.isSafeInteger(value.version) ||
    Number(value.version) < 1 ||
    value.visibility !== "PUBLIC" ||
    value.synthetic_data !== true ||
    !isRecord(value.body) ||
    Object.keys(value.body).length !== 2 ||
    typeof value.body.summary !== "string" ||
    value.body.summary.trim().length === 0 ||
    value.body.summary.length > 500 ||
    !Array.isArray(value.body.blocks) ||
    value.body.blocks.length !== 1
  )
    throw new Error("INVALID_API_RESPONSE");

  const block = value.body.blocks[0];
  if (
    !isRecord(block) ||
    Object.keys(block).length !== 2 ||
    block.kind !== "TEXT" ||
    typeof block.text !== "string" ||
    block.text.trim().length === 0 ||
    block.text.length > 4000
  )
    throw new Error("INVALID_API_RESPONSE");

  return {
    content_key: HOME_CONTENT_KEY,
    title: value.title,
    type: "HOME_BLOCK",
    status: value.status,
    version: Number(value.version),
    visibility: "PUBLIC",
    body: {
      summary: value.body.summary,
      blocks: [{ kind: "TEXT", text: block.text }],
    },
    synthetic_data: true,
  };
}

function validDraft(value: HomeContentDraft): boolean {
  return (
    value.title.trim().length > 0 &&
    value.title.length <= 120 &&
    value.summary.trim().length > 0 &&
    value.summary.length <= 500 &&
    value.text.trim().length > 0 &&
    value.text.length <= 4000
  );
}

export class HomeContentClient {
  private readonly fetcher: typeof fetch;
  private writable = false;
  private publishable = false;
  private connected = false;
  private record: HomeContentRecord | null = null;

  public constructor(options: Readonly<{ fetcher?: typeof fetch }> = {}) {
    this.fetcher = options.fetcher ?? globalThis.fetch.bind(globalThis);
  }

  public get canWrite(): boolean {
    return this.writable;
  }

  public get canPublish(): boolean {
    return this.publishable;
  }

  public async connect(): Promise<HomeContentRecord | null> {
    this.disconnect();
    const identity = await this.send("/me");
    if (!isRecord(identity) || typeof identity.display_name !== "string")
      throw new Error("INVALID_API_RESPONSE");
    if (!Array.isArray(identity.memberships)) throw new Error("INVALID_API_RESPONSE");
    const active = identity.memberships.filter(
      (membership) => isRecord(membership) && membership.status === "ACTIVE",
    );
    const membership = active[0];
    if (
      active.length !== 1 ||
      !isRecord(membership) ||
      !Array.isArray(membership.capabilities) ||
      !membership.capabilities.every((capability) => typeof capability === "string") ||
      !membership.capabilities.includes("content:write")
    )
      throw new Error("FORBIDDEN_SCOPE");

    this.writable = true;
    this.publishable = membership.capabilities.includes("content:publish");
    this.connected = true;
    try {
      this.record = parseRecord(
        await this.send(`/institution/home/${HOME_CONTENT_KEY}/draft`),
      );
      return this.record;
    } catch (error) {
      if (error instanceof Error && error.message === "NOT_FOUND_SCOPED") {
        this.record = null;
        return null;
      }
      this.disconnect();
      throw error;
    }
  }

  public async saveDraft(draft: HomeContentDraft): Promise<HomeContentRecord> {
    if (!this.connected || !this.writable) throw new Error("UNAUTHENTICATED");
    if (!validDraft(draft)) throw new Error("VALIDATION_FAILED");
    if (this.record?.status === "PUBLISHED") throw new Error("CONFLICT_STATE");

    const previous = this.record;
    const data = parseRecord(
      await this.send(
        `/institution/home/${HOME_CONTENT_KEY}/draft`,
        previous ? "PUT" : "POST",
        {
          payload: {
            title: draft.title.trim(),
            type: "HOME_BLOCK",
            visibility: "PUBLIC",
            body: {
              summary: draft.summary.trim(),
              blocks: [{ kind: "TEXT", text: draft.text.trim() }],
            },
          },
          expected_version: previous?.version ?? null,
        },
      ),
    );
    if (
      data.version !== (previous?.version ?? 0) + 1 ||
      data.status !== "DRAFT" ||
      data.title !== draft.title.trim() ||
      data.body.summary !== draft.summary.trim() ||
      data.body.blocks[0].text !== draft.text.trim()
    )
      throw new Error("INVALID_API_RESPONSE");
    this.record = data;
    return data;
  }

  public async publish(): Promise<HomeContentRecord> {
    return this.changeStatus("publish", "PUBLISHED");
  }

  public async unpublish(): Promise<HomeContentRecord> {
    return this.changeStatus("unpublish", "UNPUBLISHED");
  }

  public disconnect(): void {
    this.writable = false;
    this.publishable = false;
    this.connected = false;
    this.record = null;
  }

  private async changeStatus(
    action: "publish" | "unpublish",
    status: "PUBLISHED" | "UNPUBLISHED",
  ): Promise<HomeContentRecord> {
    if (!this.connected || !this.writable) throw new Error("UNAUTHENTICATED");
    if (!this.publishable) throw new Error("FORBIDDEN_SCOPE");
    const previous = this.record;
    if (
      !previous ||
      (action === "publish" && previous.status === "PUBLISHED") ||
      (action === "unpublish" && previous.status !== "PUBLISHED")
    )
      throw new Error("CONFLICT_STATE");

    const data = parseRecord(
      await this.send(`/institution/home/${HOME_CONTENT_KEY}/${action}`, "POST", {
        expected_version: previous.version,
      }),
    );
    if (data.version !== previous.version + 1 || data.status !== status)
      throw new Error("INVALID_API_RESPONSE");
    this.record = data;
    return data;
  }

  private async send(path: string, method = "GET", body?: object): Promise<unknown> {
    const response = await this.fetcher("/api/admin" + path, {
      method,
      credentials: "same-origin",
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(5000),
      headers: {
        accept: "application/json",
        ...(body ? { "content-type": "application/json" } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const payload: unknown = await response.json().catch(() => undefined);
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) this.disconnect();
      if (response.status === 401) throw new Error("UNAUTHENTICATED");
      if (response.status === 403) throw new Error("FORBIDDEN_SCOPE");
      const code =
        isRecord(payload) && isRecord(payload.error) && typeof payload.error.code === "string"
          ? payload.error.code
          : "UNAVAILABLE";
      throw new Error(code);
    }
    if (!isRecord(payload) || !Object.hasOwn(payload, "data"))
      throw new Error("INVALID_API_RESPONSE");
    return payload.data;
  }
}
