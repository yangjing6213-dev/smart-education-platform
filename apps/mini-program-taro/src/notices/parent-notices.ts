export interface ParentNotice {
  readonly id: string;
  readonly version: number;
  readonly status: "PUBLISHED";
  readonly published: true;
  readonly title: string;
  readonly body: string;
  readonly target: "INSTITUTION" | "CLASS";
  readonly requiresAcknowledgment: true;
  readonly receiptStatus: "UNREAD" | "READ" | "ACKNOWLEDGED";
  readonly synthetic: true;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const INTERNAL_ID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/iu;
const fields = [
  "id",
  "version",
  "status",
  "published",
  "title",
  "body",
  "target",
  "requiresAcknowledgment",
  "receiptStatus",
  "synthetic",
];

function invalid(): Error {
  return new Error("通知内容暂时无法读取，请重新获取。");
}

function displayText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0 && !INTERNAL_ID.test(value);
}

function parseNotice(value: unknown): ParentNotice {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw invalid();
  const record = value as Record<string, unknown>;
  if (
    Object.keys(record).length !== fields.length ||
    !Object.keys(record).every((key) => fields.includes(key)) ||
    typeof record.id !== "string" ||
    !UUID.test(record.id) ||
    !Number.isSafeInteger(record.version) ||
    Number(record.version) < 1 ||
    record.status !== "PUBLISHED" ||
    record.published !== true ||
    !displayText(record.title) ||
    !displayText(record.body) ||
    (record.target !== "CLASS" && record.target !== "INSTITUTION") ||
    record.requiresAcknowledgment !== true ||
    record.synthetic !== true ||
    typeof record.receiptStatus !== "string" ||
    !["UNREAD", "READ", "ACKNOWLEDGED"].includes(record.receiptStatus)
  )
    throw invalid();
  return {
    id: record.id,
    version: Number(record.version),
    status: "PUBLISHED",
    published: true,
    title: record.title,
    body: record.body,
    target: record.target,
    requiresAcknowledgment: true,
    receiptStatus: record.receiptStatus as ParentNotice["receiptStatus"],
    synthetic: true,
  };
}

export async function loadParentNotices(
  get: (path: string) => Promise<unknown>,
): Promise<readonly ParentNotice[]> {
  const response = await get("/parent/notices");
  if (!Array.isArray(response)) throw invalid();
  const notices = response.map(parseNotice);
  if (new Set(notices.map((notice) => notice.id.toLowerCase())).size !== notices.length)
    throw invalid();
  return notices;
}

export async function recordParentNoticeReceipt(
  post: (path: string, body: { readonly version: number }) => Promise<unknown>,
  notice: ParentNotice,
  action: "read" | "ack",
): Promise<ParentNotice> {
  const selected = parseNotice(notice);
  if (action !== "read" && action !== "ack") throw invalid();
  if (action === "ack" && selected.receiptStatus === "UNREAD")
    throw new Error("请先阅读通知，再确认收到。");
  const result = parseNotice(
    await post(`/parent/notices/${selected.id}/${action}`, { version: selected.version }),
  );
  if (
    result.id.toLowerCase() !== selected.id.toLowerCase() ||
    result.version !== selected.version ||
    result.receiptStatus === "UNREAD" ||
    (action === "ack" && result.receiptStatus !== "ACKNOWLEDGED")
  )
    throw invalid();
  return result;
}
