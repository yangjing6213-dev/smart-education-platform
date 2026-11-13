import type {
  StudentTransferDto,
  StudentTransferListing,
  StudentTransferCreateInput,
  StudentTransferReviewInput,
} from "../../../../../../packages/contracts/src/student-transfer.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const BASE = "/api/admin/student-transfers";
const object = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const exact = (value: unknown, keys: readonly string[]): value is Record<string, unknown> =>
  object(value) &&
  Object.keys(value).length === keys.length &&
  keys.every((key) => Object.hasOwn(value, key));
const text = (value: unknown): value is string =>
  typeof value === "string" &&
  value.length > 0 &&
  value.trim() === value &&
  !/[\p{Cc}\p{Cf}]/u.test(value);
const classRef = (value: unknown): value is string => text(value) && value.length <= 80;
const uuid = (value: unknown): value is string => typeof value === "string" && UUID.test(value);
const time = (value: unknown): value is string =>
  typeof value === "string" &&
  /^\d{4}-\d{2}-\d{2}T/u.test(value) &&
  Number.isFinite(Date.parse(value));

export function validTransferCreate(value: unknown): value is StudentTransferCreateInput {
  return (
    exact(value, ["student_id", "destination_class_ref"]) &&
    uuid(value.student_id) &&
    classRef(value.destination_class_ref)
  );
}
export function validTransferReview(value: unknown): value is StudentTransferReviewInput {
  return (
    exact(value, ["expected_version", "decision"]) &&
    Number.isSafeInteger(value.expected_version) &&
    Number(value.expected_version) > 0 &&
    Number(value.expected_version) < 2147483647 &&
    (value.decision === "APPROVE" || value.decision === "REJECT")
  );
}

export function parseTransferRecord(value: unknown): StudentTransferDto | undefined {
  if (
    !exact(value, [
      "id",
      "studentId",
      "studentLabel",
      "sourceClassRef",
      "destinationClassRef",
      "status",
      "version",
      "requestedAt",
      "reviewedAt",
      "isOwnRequest",
      "canReview",
      "canApprove",
      "events",
    ]) ||
    !uuid(value.id) ||
    !uuid(value.studentId) ||
    !text(value.studentLabel) ||
    !classRef(value.sourceClassRef) ||
    !classRef(value.destinationClassRef) ||
    value.sourceClassRef === value.destinationClassRef ||
    !["PENDING", "APPROVED", "REJECTED"].includes(String(value.status)) ||
    !time(value.requestedAt) ||
    typeof value.isOwnRequest !== "boolean" ||
    typeof value.canReview !== "boolean" ||
    typeof value.canApprove !== "boolean" ||
    (value.canReview && (value.isOwnRequest || value.status !== "PENDING")) ||
    (value.canApprove && !value.canReview) ||
    !Array.isArray(value.events)
  )
    return undefined;
  const version = value.status === "PENDING" ? 1 : 2;
  if (
    value.version !== version ||
    value.events.length !== version ||
    (version === 1
      ? value.reviewedAt !== null
      : !time(value.reviewedAt) || Date.parse(value.reviewedAt) < Date.parse(value.requestedAt))
  )
    return undefined;
  for (const [index, event] of value.events.entries()) {
    if (
      !exact(event, ["action", "actorId", "version", "occurredAt"]) ||
      !uuid(event.actorId) ||
      !time(event.occurredAt) ||
      event.version !== index + 1 ||
      event.action !== (index === 0 ? "CREATED" : value.status)
    )
      return undefined;
  }
  return value as unknown as StudentTransferDto;
}

export function parseTransferListing(value: unknown): StudentTransferListing | undefined {
  if (
    !exact(value, ["canRequest", "canReview", "students", "destinationClasses", "requests"]) ||
    typeof value.canRequest !== "boolean" ||
    typeof value.canReview !== "boolean" ||
    !Array.isArray(value.students) ||
    !Array.isArray(value.destinationClasses) ||
    !Array.isArray(value.requests)
  )
    return undefined;
  if (
    !value.students.every(
      (student: unknown) =>
        exact(student, ["id", "label", "classRef"]) &&
        uuid(student.id) &&
        text(student.label) &&
        classRef(student.classRef),
    ) ||
    !value.destinationClasses.every(classRef)
  )
    return undefined;
  const requests = value.requests.map(parseTransferRecord);
  if (
    requests.some((entry) => !entry || (entry.canReview && !value.canReview)) ||
    (!value.canRequest && (value.students.length > 0 || value.destinationClasses.length > 0))
  )
    return undefined;
  return value as unknown as StudentTransferListing;
}

export class TransferHttpError extends Error {
  public readonly status: number;
  public constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(
  path: string,
  method: "GET" | "POST",
  body: unknown,
  parse: (value: unknown) => T | undefined,
  fetcher: typeof fetch,
): Promise<T> {
  let response: Response;
  try {
    response = await fetcher(path, {
      method,
      credentials: "same-origin",
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(8000),
      headers: {
        accept: "application/json",
        ...(method === "POST" ? { "content-type": "application/json" } : {}),
      },
      ...(method === "POST" ? { body: JSON.stringify(body) } : {}),
    });
  } catch {
    throw new TransferHttpError(
      0,
      method === "POST"
        ? "操作结果尚未确认，请先刷新列表，勿重复提交。"
        : "暂时无法读取，请刷新重试。",
    );
  }
  const envelope: unknown = await response.json().catch(() => undefined);
  if (!response.ok)
    throw new TransferHttpError(
      response.status,
      response.status === 401
        ? "登录已失效，请重新登录。"
        : response.status === 403
          ? "当前账号没有转班处理权限。"
          : response.status === 409
            ? "申请或班级状态已变化，请刷新后处理。"
            : "请求未完成，请刷新后重试。",
    );
  const data = object(envelope) ? parse(envelope.data) : undefined;
  if (!data) throw new TransferHttpError(502, "返回资料不完整，请先刷新列表确认操作结果。");
  return data;
}
export const loadTransfers = (fetcher: typeof fetch = globalThis.fetch) =>
  request(BASE, "GET", undefined, parseTransferListing, fetcher);
export function createTransfer(input: unknown, fetcher: typeof fetch = globalThis.fetch) {
  if (!validTransferCreate(input))
    return Promise.reject(new TransferHttpError(400, "请选择学生和目标班级。"));
  return request(BASE, "POST", input, parseTransferRecord, fetcher);
}
export function reviewTransfer(
  id: string,
  input: unknown,
  fetcher: typeof fetch = globalThis.fetch,
) {
  if (!uuid(id) || !validTransferReview(input))
    return Promise.reject(new TransferHttpError(400, "审核资料不正确，请刷新列表。"));
  return request(`${BASE}/${id}/review`, "POST", input, parseTransferRecord, fetcher);
}
