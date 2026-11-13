export type PublicMealType = "BREAKFAST" | "LUNCH" | "SNACK" | "DINNER";

export type PublicMeal = {
  readonly id: string;
  readonly date: string;
  readonly mealType: PublicMealType;
  readonly items: readonly string[];
  readonly notes: string;
  readonly publishedAt: string;
};

type PublicMealRequestOptions = {
  readonly method: "GET";
  readonly timeout: number;
};

type PublicMealRequestResult = {
  readonly statusCode: number;
  readonly data: unknown;
};

type PublicMealRequest = (
  url: string,
  options: PublicMealRequestOptions,
) => Promise<PublicMealRequestResult>;

type LoadPublicMealsOptions = {
  readonly baseUrl: string;
  readonly publicReference: string;
  readonly date: string;
  readonly allowLocalHttp: boolean;
  readonly request: PublicMealRequest;
};

const PUBLIC_REFERENCE = /^[A-Za-z0-9._~-]{1,128}$/u;
const MEAL_TYPES = new Set<PublicMealType>(["BREAKFAST", "LUNCH", "SNACK", "DINNER"]);
const MEAL_FIELDS = new Set([
  "id",
  "meal_date",
  "meal_type",
  "items",
  "notes",
  "media_ref",
  "published_at",
]);

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isDate(value: string): boolean {
  return (
    /^\d{4}-\d{2}-\d{2}$/u.test(value) &&
    Number.isFinite(Date.parse(`${value}T00:00:00.000Z`)) &&
    new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) === value
  );
}

function apiOrigin(value: string, allowLocalHttp: boolean): string {
  if (!value.trim()) throw new Error("餐食服务尚未配置。");

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("餐食服务地址无效。");
  }

  if (url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
    throw new Error("餐食服务地址必须是单独的网站地址。");
  }
  if (url.protocol === "https:") return url.origin;
  if (allowLocalHttp && url.protocol === "http:" && url.hostname === "127.0.0.1" && url.port)
    return url.origin;
  throw new Error("餐食服务必须使用 HTTPS；开发版仅可明确启用本机地址。");
}

function parseMeal(value: unknown, date: string): PublicMeal {
  if (!record(value)) throw new Error("餐食信息格式无效。");
  if (Object.keys(value).some((key) => !MEAL_FIELDS.has(key)))
    throw new Error("餐食信息包含不可公开的字段。");
  if (
    typeof value.id !== "string" ||
    !value.id.trim() ||
    value.id.length > 128 ||
    value.meal_date !== date ||
    typeof value.meal_type !== "string" ||
    !MEAL_TYPES.has(value.meal_type as PublicMealType) ||
    !Array.isArray(value.items) ||
    value.items.some((item) => typeof item !== "string") ||
    typeof value.notes !== "string" ||
    typeof value.published_at !== "string" ||
    !Number.isFinite(Date.parse(value.published_at)) ||
    (value.media_ref !== undefined && typeof value.media_ref !== "string")
  ) {
    throw new Error("餐食信息格式无效。");
  }

  return {
    id: value.id,
    date: value.meal_date,
    mealType: value.meal_type as PublicMealType,
    items: value.items as string[],
    notes: value.notes,
    publishedAt: value.published_at,
  };
}

export async function loadPublicMeals(
  options: LoadPublicMealsOptions,
): Promise<readonly PublicMeal[]> {
  const origin = apiOrigin(options.baseUrl, options.allowLocalHttp);
  if (!PUBLIC_REFERENCE.test(options.publicReference)) throw new Error("餐食公开范围尚未配置。");
  if (!isDate(options.date)) throw new Error("餐食日期无效。");

  const url = new URL("/public/meals", origin);
  url.searchParams.set("date", options.date);
  url.searchParams.set("public_ref", options.publicReference);

  let response: PublicMealRequestResult;
  try {
    response = await options.request(url.toString(), { method: "GET", timeout: 8000 });
  } catch {
    throw new Error("暂时无法读取餐食安排，请检查网络后重试。");
  }

  if (response.statusCode !== 200 || !record(response.data))
    throw new Error("暂时无法读取餐食安排，请稍后重试。");
  const envelope = response.data;
  if (
    Object.keys(envelope).some((key) => key !== "data" && key !== "request_id") ||
    typeof envelope.request_id !== "string" ||
    !envelope.request_id.trim() ||
    !Array.isArray(envelope.data) ||
    envelope.data.length > 100
  ) {
    throw new Error("餐食信息格式无效。");
  }

  return envelope.data.map((meal) => parseMeal(meal, options.date));
}
