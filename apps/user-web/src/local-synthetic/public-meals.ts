export type PublicMealType = "BREAKFAST" | "LUNCH" | "SNACK" | "DINNER";

export interface PublicMealProjection {
  readonly id: string;
  readonly meal_date: string;
  readonly meal_type: PublicMealType;
  readonly items: readonly string[];
  readonly notes: string;
  readonly media_ref?: string;
  readonly published_at: string;
}

export interface PublicMealsClientOptions {
  readonly baseUrl?: string;
  readonly fetcher?: typeof fetch;
}

const DATE = /^\d{4}-\d{2}-\d{2}$/u;
const MEAL_TYPE = ["BREAKFAST", "LUNCH", "SNACK", "DINNER"] as const;
const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

function validDate(value: string): boolean {
  if (!DATE.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function allowed(url: URL, method: string): boolean {
  const entries = [...url.searchParams.entries()];
  return (
    method === "GET" &&
    url.pathname === "/local/public-meals" &&
    url.hash === "" &&
    entries.length === 1 &&
    entries[0]?.[0] === "date" &&
    validDate(entries[0][1])
  );
}

export function createPublicMealsTransport(
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
    throw new Error("公开餐食只允许连接本机服务。");

  return async (input, init = {}) => {
    if (typeof input !== "string") return new Response(null, { status: 403 });
    let url: URL;
    try {
      url = new URL(input, base.origin);
    } catch {
      return new Response(null, { status: 403 });
    }
    if (url.origin !== base.origin || !allowed(url, init.method ?? "GET"))
      return new Response(null, { status: 403 });
    return fetcher(url, {
      ...init,
      method: "GET",
      credentials: "omit",
      cache: "no-store",
      redirect: "error",
    });
  };
}

function projectMeal(value: unknown): PublicMealProjection {
  if (
    !isObject(value) ||
    typeof value.id !== "string" ||
    value.id.length === 0 ||
    typeof value.meal_date !== "string" ||
    !validDate(value.meal_date) ||
    typeof value.meal_type !== "string" ||
    !MEAL_TYPE.includes(value.meal_type as PublicMealType) ||
    !Array.isArray(value.items) ||
    !value.items.every((item) => typeof item === "string") ||
    typeof value.notes !== "string" ||
    typeof value.published_at !== "string" ||
    (value.media_ref !== undefined && typeof value.media_ref !== "string")
  )
    throw new Error("公开餐食内容无法识别。");
  return {
    id: value.id,
    meal_date: value.meal_date,
    meal_type: value.meal_type as PublicMealType,
    items: [...(value.items as string[])],
    notes: value.notes,
    ...(typeof value.media_ref === "string" ? { media_ref: value.media_ref } : {}),
    published_at: value.published_at,
  };
}

export class PublicMealsClient {
  private readonly request: typeof fetch;

  public constructor(options: PublicMealsClientOptions) {
    this.request = createPublicMealsTransport(
      options.baseUrl ?? window.location.origin,
      options.fetcher,
    );
  }

  public async forDate(date: string): Promise<readonly PublicMealProjection[]> {
    if (!validDate(date)) throw new Error("請提供有效的餐食日期。");
    const response = await this.request(`/local/public-meals?date=${encodeURIComponent(date)}`, {
      method: "GET",
    });
    if (!response.ok) throw new Error("本机公开餐食暂不可用。");
    let value: unknown;
    try {
      value = await response.json();
    } catch {
      throw new Error("本机公开餐食暂不可用。");
    }
    if (!Array.isArray(value)) throw new Error("公开餐食内容无法识别。");
    return value.map(projectMeal);
  }
}
