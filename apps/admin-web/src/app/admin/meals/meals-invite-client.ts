export type AdminMealType = "BREAKFAST" | "LUNCH" | "SNACK" | "DINNER";
export type AdminMealPayload = Readonly<{
  meal_date: string;
  meal_type: AdminMealType;
  items: readonly string[];
  notes: string;
}>;
export type AdminMealRecord = AdminMealPayload &
  Readonly<{
    id: string;
    status: "DRAFT" | "PUBLISHED" | "UNPUBLISHED";
    version: number;
    published_at: string | null;
    updated_at: string;
    actions: readonly ("edit" | "publish" | "unpublish")[];
  }>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const FIELDS = [
  "id",
  "meal_date",
  "meal_type",
  "items",
  "notes",
  "status",
  "version",
  "published_at",
  "updated_at",
  "actions",
];
const PAYLOAD_FIELDS = ["meal_date", "meal_type", "items", "notes"];
function object(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function calendarDate(value: unknown): boolean {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/u.test(value)) return false;
  const date = new Date(value + "T00:00:00.000Z");
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
function isoDate(value: unknown): boolean {
  return (
    typeof value === "string" &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString() === value
  );
}
function validPayload(value: unknown): value is AdminMealPayload {
  return (
    object(value) &&
    Object.keys(value).length === 4 &&
    PAYLOAD_FIELDS.every((key) => Object.hasOwn(value, key)) &&
    calendarDate(value.meal_date) &&
    typeof value.meal_type === "string" &&
    ["BREAKFAST", "LUNCH", "SNACK", "DINNER"].includes(value.meal_type) &&
    Array.isArray(value.items) &&
    value.items.length > 0 &&
    value.items.length <= 12 &&
    value.items.every(
      (item) => typeof item === "string" && item.length > 0 && item.length <= 120,
    ) &&
    typeof value.notes === "string" &&
    value.notes.length <= 500
  );
}
function parseRecord(value: unknown): AdminMealRecord {
  if (
    !object(value) ||
    Object.keys(value).length !== FIELDS.length ||
    !FIELDS.every((key) => Object.hasOwn(value, key)) ||
    typeof value.id !== "string" ||
    !UUID.test(value.id) ||
    !validPayload({
      meal_date: value.meal_date,
      meal_type: value.meal_type,
      items: value.items,
      notes: value.notes,
    }) ||
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
    throw new Error("INVALID_API_RESPONSE");
  return value as unknown as AdminMealRecord;
}

export class MealsInviteClient {
  private readonly fetcher: typeof fetch;
  private writable = false;
  private publishable = false;
  public constructor(options: Readonly<{ fetcher?: typeof fetch }> = {}) {
    this.fetcher = options.fetcher ?? globalThis.fetch.bind(globalThis);
  }
  public get canWrite(): boolean {
    return this.writable;
  }
  public get canPublish(): boolean {
    return this.publishable;
  }

  public async connect(): Promise<readonly AdminMealRecord[]> {
    this.disconnect();
    const identity = await this.send("/me");
    if (!object(identity) || !Array.isArray(identity.memberships))
      throw new Error("INVALID_API_RESPONSE");
    const active = identity.memberships.filter(
      (membership) => object(membership) && membership.status === "ACTIVE",
    );
    if (
      active.length !== 1 ||
      !object(active[0]) ||
      !Array.isArray(active[0].capabilities) ||
      !active[0].capabilities.every((capability) => typeof capability === "string") ||
      !active[0].capabilities.includes("content:write")
    )
      throw new Error("FORBIDDEN_SCOPE");
    this.writable = true;
    this.publishable = active[0].capabilities.includes("content:publish");
    return this.list();
  }

  public async list(): Promise<readonly AdminMealRecord[]> {
    if (!this.writable) throw new Error("UNAUTHENTICATED");
    const data = await this.send("/meals");
    if (!Array.isArray(data) || data.length > 500) throw new Error("INVALID_API_RESPONSE");
    const rows = data.map(parseRecord);
    if (new Set(rows.map((row) => row.id.toLowerCase())).size !== rows.length)
      throw new Error("INVALID_API_RESPONSE");
    return rows;
  }
  public createDraft(payload: AdminMealPayload): Promise<AdminMealRecord> {
    return this.mutate(crypto.randomUUID(), "draft", "POST", null, payload);
  }
  public updateDraft(
    id: string,
    version: number,
    payload: AdminMealPayload,
  ): Promise<AdminMealRecord> {
    return this.mutate(id, "draft", "PUT", version, payload);
  }
  public publish(id: string, version: number): Promise<AdminMealRecord> {
    return this.mutate(id, "publish", "POST", version);
  }
  public unpublish(id: string, version: number): Promise<AdminMealRecord> {
    return this.mutate(id, "unpublish", "POST", version);
  }
  public disconnect(): void {
    this.writable = false;
    this.publishable = false;
  }
  private async mutate(
    id: string,
    action: "draft" | "publish" | "unpublish",
    method: "POST" | "PUT",
    version: number | null,
    payload?: AdminMealPayload,
  ): Promise<AdminMealRecord> {
    if (!this.writable || (action !== "draft" && !this.publishable))
      throw new Error("FORBIDDEN_SCOPE");
    if (
      !UUID.test(id) ||
      (version !== null && (!Number.isSafeInteger(version) || version < 1)) ||
      (action === "draft" && !validPayload(payload))
    )
      throw new Error("VALIDATION_FAILED");
    const data = parseRecord(
      await this.send("/meals/" + id.toLowerCase() + "/" + action, method, {
        ...(payload ? { payload } : {}),
        expected_version: version,
      }),
    );
    const expectedStatus =
      action === "publish" ? "PUBLISHED" : action === "unpublish" ? "UNPUBLISHED" : "DRAFT";
    if (
      data.id.toLowerCase() !== id.toLowerCase() ||
      data.version !== (version ?? 0) + 1 ||
      data.status !== expectedStatus
    )
      throw new Error("INVALID_API_RESPONSE");
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
        object(payload) && object(payload.error) && typeof payload.error.code === "string"
          ? payload.error.code
          : "UNAVAILABLE";
      throw new Error(code);
    }
    if (!object(payload) || !Object.hasOwn(payload, "data"))
      throw new Error("INVALID_API_RESPONSE");
    return payload.data;
  }
}
