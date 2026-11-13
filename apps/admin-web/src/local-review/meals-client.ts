export type AdminMealStatus = "DRAFT" | "PUBLISHED" | "UNPUBLISHED";
export type AdminMealType = "BREAKFAST" | "LUNCH" | "SNACK" | "DINNER";

export interface AdminMealPayload {
  readonly meal_date: string;
  readonly meal_type: AdminMealType;
  readonly items: readonly string[];
  readonly notes: string;
}

export interface AdminMealRecord extends AdminMealPayload {
  readonly id: string;
  readonly tenant_id: string;
  readonly campus_id: string;
  readonly status: AdminMealStatus;
  readonly version: number;
  readonly media_ref: string | null;
  readonly private_notes: string;
  readonly published_at: string | null;
  readonly synthetic_data: true;
  readonly updated_by: string;
  readonly updated_at: string;
}

export interface AdminMealsClientOptions {
  readonly baseUrl?: string;
  readonly fetcher?: typeof fetch;
}

const HANDLE = /^[\w-]{43}$/u;
const MEAL_ID = /^[A-Za-z0-9._:-]{1,128}$/u;
const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

function allowed(path: string, method: string): boolean {
  if (path === "/local/sessions") return method === "POST";
  if (path === "/local/meals") return method === "GET" || method === "POST";
  const match = /^\/local\/meals\/([A-Za-z0-9._:-]{1,128})\/(draft|publish|unpublish)$/u.exec(
    path,
  );
  if (!match || !MEAL_ID.test(match[1] ?? "")) return false;
  return match[2] === "draft" ? method === "PUT" : method === "POST";
}

export function createAdminMealsTransport(
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
    throw new Error("餐食管理只允许连接本机服务。");

  return async (input, init = {}) => {
    if (typeof input !== "string") return new Response(null, { status: 403 });
    let url: URL;
    try {
      url = new URL(input, base.origin);
    } catch {
      return new Response(null, { status: 403 });
    }
    const method = init.method ?? "GET";
    if (
      url.origin !== base.origin ||
      url.search ||
      url.hash ||
      !allowed(url.pathname, method)
    )
      return new Response(null, { status: 403 });
    return fetcher(url, {
      ...init,
      credentials: "omit",
      cache: "no-store",
      redirect: "error",
    });
  };
}

function mealRecord(value: unknown): AdminMealRecord {
  if (
    !isObject(value) ||
    typeof value.id !== "string" ||
    !MEAL_ID.test(value.id) ||
    typeof value.tenant_id !== "string" ||
    typeof value.campus_id !== "string" ||
    !["DRAFT", "PUBLISHED", "UNPUBLISHED"].includes(String(value.status)) ||
    !Number.isSafeInteger(value.version) ||
    typeof value.meal_date !== "string" ||
    !["BREAKFAST", "LUNCH", "SNACK", "DINNER"].includes(String(value.meal_type)) ||
    !Array.isArray(value.items) ||
    !value.items.every((item) => typeof item === "string") ||
    typeof value.notes !== "string" ||
    !(typeof value.media_ref === "string" || value.media_ref === null) ||
    typeof value.private_notes !== "string" ||
    !(typeof value.published_at === "string" || value.published_at === null) ||
    value.synthetic_data !== true ||
    typeof value.updated_by !== "string" ||
    typeof value.updated_at !== "string"
  )
    throw new Error("本机餐食服务返回的数据无法识别。");
  return {
    id: value.id,
    tenant_id: value.tenant_id,
    campus_id: value.campus_id,
    status: value.status as AdminMealStatus,
    version: value.version as number,
    meal_date: value.meal_date,
    meal_type: value.meal_type as AdminMealType,
    items: value.items as string[],
    notes: value.notes,
    media_ref: value.media_ref,
    private_notes: value.private_notes,
    published_at: value.published_at,
    synthetic_data: true,
    updated_by: value.updated_by,
    updated_at: value.updated_at,
  };
}

export class AdminMealsClient {
  private readonly request: typeof fetch;
  private handle: string | null = null;

  public constructor(options: AdminMealsClientOptions) {
    this.request = createAdminMealsTransport(
      options.baseUrl ?? window.location.origin,
      options.fetcher,
    );
  }

  public async connect(): Promise<readonly AdminMealRecord[]> {
    const session = await this.send("/local/sessions", "POST", { profile: "owner-east" }, false);
    if (!isObject(session) || typeof session.handle !== "string" || !HANDLE.test(session.handle))
      throw new Error("本机餐食管理身份无法建立。");
    this.handle = session.handle;
    return this.list();
  }

  public async list(): Promise<readonly AdminMealRecord[]> {
    const response = await this.send("/local/meals", "GET");
    if (!Array.isArray(response)) throw new Error("本机餐食服务返回的列表无法识别。");
    return response.map(mealRecord);
  }

  public async createDraft(payload: AdminMealPayload): Promise<AdminMealRecord> {
    return mealRecord(await this.send("/local/meals", "POST", payload));
  }

  public async updateDraft(
    mealId: string,
    expectedVersion: number,
    payload: AdminMealPayload,
  ): Promise<AdminMealRecord> {
    return mealRecord(
      await this.send(`/local/meals/${encodeURIComponent(mealId)}/draft`, "PUT", {
        payload,
        expected_version: expectedVersion,
      }),
    );
  }

  public async publish(mealId: string, expectedVersion: number): Promise<AdminMealRecord> {
    return mealRecord(
      await this.send(`/local/meals/${encodeURIComponent(mealId)}/publish`, "POST", {
        expected_version: expectedVersion,
      }),
    );
  }

  public async unpublish(mealId: string, expectedVersion: number): Promise<AdminMealRecord> {
    return mealRecord(
      await this.send(`/local/meals/${encodeURIComponent(mealId)}/unpublish`, "POST", {
        expected_version: expectedVersion,
      }),
    );
  }

  public disconnect(): void {
    this.handle = null;
  }

  private async send(
    path: string,
    method: string,
    body?: object,
    authenticated = true,
  ): Promise<unknown> {
    const response = await this.request(path, {
      method,
      headers: {
        ...(body ? { "content-type": "application/json" } : {}),
        ...(authenticated && this.handle ? { authorization: `Bearer ${this.handle}` } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new Error("本机餐食服务暂不可用。");
    }
    if (!response.ok) {
      const error = isObject(payload) && isObject(payload.error) ? payload.error : payload;
      const code = isObject(error) && typeof error.code === "string" ? error.code : "UNAVAILABLE";
      throw new Error(code);
    }
    return payload;
  }
}
