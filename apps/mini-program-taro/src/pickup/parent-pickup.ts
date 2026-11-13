export type AuthenticatedGet = (path: string) => Promise<unknown>;
export type AuthenticatedPost = (path: string, body: unknown) => Promise<unknown>;

export type PickupBinding = {
  readonly id: string;
  readonly version: number;
  readonly studentId: string;
  readonly studentLabel: string;
  readonly classLabel: string;
  readonly status: "APPROVED";
};

export type PickupAuthorization = {
  readonly id: string;
  readonly version: number;
  readonly status: "DRAFT" | "ACTIVE" | "REVOKED";
  readonly currentlyValid: boolean;
  readonly bindingId: string;
  readonly studentId: string;
  readonly studentLabel: string;
  readonly classLabel: string;
  readonly recipient: "pickup-alpha" | "pickup-beta";
  readonly recipientLabel: string;
  readonly type: "REGULAR" | "TEMPORARY";
  readonly startDate: string;
  readonly endDate: string;
  readonly startTime: string;
  readonly endTime: string;
};

export type PickupRecord = {
  readonly id: string;
  readonly date: string;
  readonly time: string;
  readonly studentId: string;
  readonly studentLabel: string;
  readonly recipient: string;
  readonly status: "COMPLETED";
};

export type ParentPickupProjection = {
  readonly bindings: readonly PickupBinding[];
  readonly authorizations: readonly PickupAuthorization[];
  readonly records: readonly PickupRecord[];
};

export type ParentPickupInput = {
  readonly bindingId: string;
  readonly recipient: PickupAuthorization["recipient"];
  readonly type: PickupAuthorization["type"];
  readonly startDate: string;
  readonly endDate: string;
  readonly startTime: string;
  readonly endTime: string;
};

export type PickupCredential = { readonly credential: string; readonly expiresAt: string };
export type StaffPickupPreview = {
  readonly studentLabel: string;
  readonly classLabel: string;
  readonly recipientLabel: string;
};
export type StaffPickupResult = { readonly id: string; readonly status: "COMPLETED" };
export type PickupChecks = {
  readonly student: boolean;
  readonly recipient: boolean;
  readonly authorization: boolean;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/u;
const ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/u;
const TIME = /^(?:[01]\d|2[0-3]):[0-5]\d$/u;
const CREDENTIAL = /^[A-Za-z0-9_-]{43}$/u;
const BINDING_KEYS = ["id", "version", "studentId", "studentLabel", "classLabel", "status"];
const AUTHORIZATION_KEYS = [
  "id",
  "version",
  "status",
  "currentlyValid",
  "bindingId",
  "studentId",
  "studentLabel",
  "classLabel",
  "recipient",
  "recipientLabel",
  "type",
  "startDate",
  "endDate",
  "startTime",
  "endTime",
];
const RECORD_KEYS = ["id", "date", "time", "studentId", "studentLabel", "recipient", "status"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  return (
    Object.keys(value).length === keys.length &&
    Object.keys(value).every((key) => keys.includes(key))
  );
}

function validId(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}

function validVersion(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) > 0;
}

function validLabel(value: unknown): value is string {
  return (
    typeof value === "string" && !!value.trim() && value.length <= 80 && !UUID.test(value.trim())
  );
}

function validDate(value: unknown): value is string {
  if (typeof value !== "string" || !ISO_DATE.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}

function validTimestamp(value: unknown): value is string {
  return (
    typeof value === "string" && ISO_TIMESTAMP.test(value) && Number.isFinite(Date.parse(value))
  );
}

function requireObject(
  value: unknown,
  keys: readonly string[],
  message: string,
): Record<string, unknown> {
  if (!isRecord(value) || !hasExactKeys(value, keys)) throw new Error(message);
  return value;
}

function parseBinding(value: unknown): PickupBinding {
  const item = requireObject(value, BINDING_KEYS, "已关联学生信息格式不正确。");
  if (
    !validId(item.id) ||
    !validVersion(item.version) ||
    !validId(item.studentId) ||
    !validLabel(item.studentLabel) ||
    !validLabel(item.classLabel) ||
    item.status !== "APPROVED"
  )
    throw new Error("已关联学生信息格式不正确。");
  return {
    id: item.id,
    version: item.version,
    studentId: item.studentId,
    studentLabel: item.studentLabel.trim(),
    classLabel: item.classLabel.trim(),
    status: "APPROVED",
  };
}

function parseAuthorization(value: unknown): PickupAuthorization {
  const item = requireObject(value, AUTHORIZATION_KEYS, "接送授权信息格式不正确。");
  if (
    !validId(item.id) ||
    !validVersion(item.version) ||
    !["DRAFT", "ACTIVE", "REVOKED"].includes(String(item.status)) ||
    typeof item.currentlyValid !== "boolean" ||
    !validId(item.bindingId) ||
    !validId(item.studentId) ||
    !validLabel(item.studentLabel) ||
    !validLabel(item.classLabel) ||
    !["pickup-alpha", "pickup-beta"].includes(String(item.recipient)) ||
    !validLabel(item.recipientLabel) ||
    !["REGULAR", "TEMPORARY"].includes(String(item.type)) ||
    !validDate(item.startDate) ||
    !validDate(item.endDate) ||
    item.endDate < item.startDate ||
    !TIME.test(String(item.startTime)) ||
    !TIME.test(String(item.endTime)) ||
    String(item.startTime) > String(item.endTime) ||
    (item.type === "TEMPORARY" && item.startDate !== item.endDate) ||
    (item.currentlyValid && item.status !== "ACTIVE")
  )
    throw new Error("接送授权信息格式不正确。");
  return {
    id: item.id,
    version: item.version,
    status: item.status as PickupAuthorization["status"],
    currentlyValid: item.currentlyValid,
    bindingId: item.bindingId,
    studentId: item.studentId,
    studentLabel: item.studentLabel.trim(),
    classLabel: item.classLabel.trim(),
    recipient: item.recipient as PickupAuthorization["recipient"],
    recipientLabel: item.recipientLabel.trim(),
    type: item.type as PickupAuthorization["type"],
    startDate: item.startDate,
    endDate: item.endDate,
    startTime: item.startTime as string,
    endTime: item.endTime as string,
  };
}

function parseRecord(value: unknown): PickupRecord {
  const item = requireObject(value, RECORD_KEYS, "接送记录信息格式不正确。");
  if (
    !validId(item.id) ||
    !validDate(item.date) ||
    !TIME.test(String(item.time)) ||
    !validId(item.studentId) ||
    !validLabel(item.studentLabel) ||
    !validLabel(item.recipient) ||
    item.status !== "COMPLETED"
  )
    throw new Error("接送记录信息格式不正确。");
  return {
    id: item.id,
    date: item.date,
    time: item.time as string,
    studentId: item.studentId,
    studentLabel: item.studentLabel.trim(),
    recipient: item.recipient.trim(),
    status: "COMPLETED",
  };
}

function parseProjection(value: unknown): ParentPickupProjection {
  const projection = requireObject(
    value,
    ["bindings", "authorizations", "records"],
    "接送信息格式不正确。",
  );
  if (
    !Array.isArray(projection.bindings) ||
    !Array.isArray(projection.authorizations) ||
    !Array.isArray(projection.records)
  ) {
    throw new Error("接送信息格式不正确。");
  }
  return {
    bindings: projection.bindings.map(parseBinding),
    authorizations: projection.authorizations.map(parseAuthorization),
    records: projection.records.map(parseRecord),
  };
}

function parseCredential(value: unknown): string {
  if (typeof value !== "string" || !CREDENTIAL.test(value))
    throw new Error("接送凭证格式不正确，请重新扫码。");
  return value;
}

function parseCredentialResponse(value: unknown): PickupCredential {
  const item = requireObject(value, ["credential", "expiresAt"], "接送凭证信息格式不正确。");
  if (!CREDENTIAL.test(String(item.credential)) || !validTimestamp(item.expiresAt)) {
    throw new Error("接送凭证信息格式不正确。");
  }
  return { credential: item.credential as string, expiresAt: item.expiresAt };
}

function parseStaffPreview(value: unknown): StaffPickupPreview {
  const item = requireObject(
    value,
    ["studentLabel", "classLabel", "recipientLabel"],
    "接送核验信息格式不正确。",
  );
  if (
    !validLabel(item.studentLabel) ||
    !validLabel(item.classLabel) ||
    !validLabel(item.recipientLabel)
  ) {
    throw new Error("接送核验信息格式不正确。");
  }
  return {
    studentLabel: item.studentLabel.trim(),
    classLabel: item.classLabel.trim(),
    recipientLabel: item.recipientLabel.trim(),
  };
}

function parseStaffResult(value: unknown): StaffPickupResult {
  const item = requireObject(value, ["id", "status"], "接送确认结果格式不正确。");
  if (!validId(item.id) || item.status !== "COMPLETED") throw new Error("接送确认结果格式不正确。");
  return { id: item.id, status: "COMPLETED" };
}

function validateInput(input: ParentPickupInput): ParentPickupInput {
  if (
    !isRecord(input) ||
    !hasExactKeys(input, [
      "bindingId",
      "recipient",
      "type",
      "startDate",
      "endDate",
      "startTime",
      "endTime",
    ])
  ) {
    throw new Error("请完善接送授权信息。");
  }
  const start = Date.parse(`${input.startDate}T00:00:00.000Z`);
  const end = Date.parse(`${input.endDate}T00:00:00.000Z`);
  if (
    !validId(input.bindingId) ||
    !["pickup-alpha", "pickup-beta"].includes(input.recipient) ||
    !["REGULAR", "TEMPORARY"].includes(input.type) ||
    !validDate(input.startDate) ||
    !validDate(input.endDate) ||
    input.endDate < input.startDate ||
    end - start > 90 * 86_400_000 ||
    !TIME.test(input.startTime) ||
    !TIME.test(input.endTime) ||
    input.startTime > input.endTime ||
    (input.type === "TEMPORARY" && input.startDate !== input.endDate)
  )
    throw new Error("接送授权时间范围不正确。");
  return { ...input };
}

function validateActionTarget(id: string, version: number): void {
  if (!validId(id)) throw new Error("接送授权编号不正确。");
  if (!validVersion(version)) throw new Error("接送授权版本不正确。");
}

export async function loadParentPickup(get: AuthenticatedGet): Promise<ParentPickupProjection> {
  return parseProjection(await get("/parent/pickup"));
}

export async function createParentPickupAuthorization(
  post: AuthenticatedPost,
  input: ParentPickupInput,
): Promise<PickupAuthorization> {
  return parseAuthorization(await post("/parent/pickup/authorizations", validateInput(input)));
}

export async function activateParentPickupAuthorization(
  post: AuthenticatedPost,
  id: string,
  version: number,
): Promise<PickupAuthorization> {
  validateActionTarget(id, version);
  return parseAuthorization(
    await post(`/parent/pickup/authorizations/${id}/activate`, { version }),
  );
}

export async function revokeParentPickupAuthorization(
  post: AuthenticatedPost,
  id: string,
  version: number,
): Promise<PickupAuthorization> {
  validateActionTarget(id, version);
  return parseAuthorization(await post(`/parent/pickup/authorizations/${id}/revoke`, { version }));
}

export async function issueParentPickupCredential(
  post: AuthenticatedPost,
  id: string,
  version: number,
): Promise<PickupCredential> {
  validateActionTarget(id, version);
  return parseCredentialResponse(
    await post(`/parent/pickup/authorizations/${id}/credential`, { version }),
  );
}

export async function previewStaffPickupCredential(
  post: AuthenticatedPost,
  credential: string,
): Promise<StaffPickupPreview> {
  return parseStaffPreview(
    await post("/staff/pickup/credentials/preview", { credential: parseCredential(credential) }),
  );
}

export async function confirmStaffPickupCredential(
  post: AuthenticatedPost,
  credential: string,
  checks: PickupChecks,
): Promise<StaffPickupResult> {
  const token = parseCredential(credential);
  if (
    !checks ||
    checks.student !== true ||
    checks.recipient !== true ||
    checks.authorization !== true
  ) {
    throw new Error("请先完成三项现场核对。");
  }
  return parseStaffResult(
    await post("/staff/pickup/credentials/confirm", {
      credential: token,
      checks: { student: true, recipient: true, authorization: true },
    }),
  );
}
