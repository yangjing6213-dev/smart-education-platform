import { randomUUID } from "node:crypto";
import { exactBody, LocalError } from "./binding-leave.service.js";
import {
  LocalRepository,
  type Binding,
  type Notice,
  type NoticeReceipt,
  type NoticeStatus,
  type NoticeTarget,
  type NoticeTemplate,
} from "./repository.js";
import { memberForActor, type LocalAction, type LocalMember } from "./sessions.js";

const unavailable = () => new LocalError(403, "UNAVAILABLE");
const invalid = () => new LocalError(400, "INVALID_REQUEST");
const conflict = () => new LocalError(409, "STATE_CONFLICT");

const TEMPLATES: Readonly<
  Record<NoticeTemplate, { target: NoticeTarget; title: string; body: string }>
> = {
  INSTITUTION_ANNOUNCEMENT: {
    target: "INSTITUTION",
    title: "机构公告",
    body: "同芯学园机构公告合成内容，请以页面展示为准。",
  },
  CLASS_ACTIVITY: {
    target: "CLASS",
    title: "班级活动",
    body: "本周班级活动安排合成内容，请以页面展示为准。",
  },
};

function permission(member: LocalMember, action: LocalAction) {
  if (!member.actions.includes(action)) throw unavailable();
}

function scoped(member: LocalMember, row: Pick<Notice, "tenantId" | "campusId" | "classId">) {
  return (
    member.tenantId === row.tenantId &&
    member.campusId === row.campusId &&
    member.classIds.includes(row.classId)
  );
}

function expected(row: Notice, version: unknown) {
  if (!Number.isSafeInteger(version) || (version as number) < 1) throw invalid();
  if (row.version !== version) throw conflict();
}

function template(value: unknown): value is NoticeTemplate {
  return value === "INSTITUTION_ANNOUNCEMENT" || value === "CLASS_ACTIVITY";
}

function statusForReceipt(
  repository: LocalRepository,
  member: LocalMember,
  row: Notice,
): "UNREAD" | "READ" | "ACKNOWLEDGED" {
  return repository.noticeReceipt(member.actorId, row.id, row.version)?.status ?? "UNREAD";
}

export interface NoticeParentView {
  id: string;
  version: number;
  status: NoticeStatus;
  published: boolean;
  title: string;
  body: string;
  target: NoticeTarget;
  classId: string;
  requiresAcknowledgment: boolean;
  receiptStatus: "UNREAD" | "READ" | "ACKNOWLEDGED";
  synthetic: true;
}

export interface NoticeStaffView extends NoticeParentView {
  template: NoticeTemplate;
  authorId: string;
  authorLabel: string;
  updatedAt: string;
}

function parentView(
  repository: LocalRepository,
  member: LocalMember,
  row: Notice,
): NoticeParentView {
  return {
    id: row.id,
    version: row.version,
    status: row.status,
    published: row.published,
    title: row.title,
    body: row.body,
    target: row.target,
    classId: row.classId,
    requiresAcknowledgment: row.requiresAcknowledgment,
    receiptStatus: statusForReceipt(repository, member, row),
    synthetic: true,
  };
}

function staffView(row: Notice): NoticeStaffView {
  return {
    id: row.id,
    version: row.version,
    status: row.status,
    published: row.published,
    title: row.title,
    body: row.body,
    target: row.target,
    classId: row.classId,
    requiresAcknowledgment: row.requiresAcknowledgment,
    receiptStatus: "UNREAD",
    synthetic: true,
    template: row.template,
    authorId: row.authorId,
    authorLabel: memberForActor(row.authorId)?.label ?? "示例员工",
    updatedAt: row.updatedAt,
  };
}

export class NoticeService {
  constructor(
    private readonly repository: LocalRepository,
    private readonly now: () => number = Date.now,
  ) {}

  notices(member: LocalMember) {
    permission(member, "notice:read");
    return this.repository
      .list()
      .filter((row): row is Notice => row.kind === "notice")
      .filter((row) => row.status === "PUBLISHED" && row.published)
      .flatMap((row) =>
        this.parentBinding(member, row) ? [parentView(this.repository, member, row)] : [],
      );
  }

  reviewQueue(member: LocalMember) {
    permission(member, "notice:review");
    return this.repository
      .list()
      .filter((row): row is Notice => row.kind === "notice")
      .filter((row) => scoped(member, row) && row.status === "SUBMITTED")
      .map(staffView);
  }

  owned(member: LocalMember) {
    const broadScope = member.actions.some((action) =>
      ["notice:review", "notice:publish", "notice:revoke"].includes(action),
    );
    if (
      !broadScope &&
      !member.actions.some((action) => ["notice:create", "notice:submit"].includes(action))
    )
      throw unavailable();
    return this.repository
      .list()
      .filter((row): row is Notice => row.kind === "notice")
      .filter((row) => scoped(member, row) && (broadScope || row.authorId === member.actorId))
      .map(staffView);
  }

  create(member: LocalMember, body: unknown) {
    permission(member, "notice:create");
    const data = exactBody(body, ["template"]);
    if (!template(data.template) || member.classIds.length !== 1) throw unavailable();
    const selected = TEMPLATES[data.template];
    const row: Notice = {
      id: randomUUID(),
      version: 1,
      kind: "notice",
      tenantId: member.tenantId,
      campusId: member.campusId,
      classId: member.classIds[0]!,
      template: data.template,
      target: selected.target,
      title: selected.title,
      body: selected.body,
      requiresAcknowledgment: true,
      status: "DRAFT",
      published: false,
      authorId: member.actorId,
      updatedBy: member.actorId,
      updatedAt: new Date(this.now()).toISOString(),
    };
    this.repository.insert(row);
    this.audit(member, row, "notice.create");
    return staffView(row);
  }

  submit(member: LocalMember, id: string, body: unknown) {
    permission(member, "notice:submit");
    const data = exactBody(body, ["version"]);
    const row = this.staffRow(member, id);
    if (row.authorId !== member.actorId) throw unavailable();
    expected(row, data.version);
    if (row.status !== "DRAFT" && row.status !== "RETURNED") throw conflict();
    const next = this.change(member, row, "notice.submit", {
      status: "SUBMITTED",
      published: false,
    });
    return staffView(next);
  }

  review(member: LocalMember, id: string, body: unknown) {
    permission(member, "notice:review");
    const data = exactBody(body, ["version", "action"]);
    if (data.action !== "CONFIRM" && data.action !== "RETURN") throw invalid();
    const row = this.staffRow(member, id);
    expected(row, data.version);
    if (row.status !== "SUBMITTED") throw conflict();
    const next = this.change(member, row, `notice.${String(data.action).toLowerCase()}`, {
      status: data.action === "CONFIRM" ? "CONFIRMED" : "RETURNED",
      published: false,
    });
    return staffView(next);
  }

  publish(member: LocalMember, id: string, body: unknown) {
    permission(member, "notice:publish");
    const data = exactBody(body, ["version"]);
    const row = this.staffRow(member, id);
    expected(row, data.version);
    if (row.status !== "CONFIRMED" && row.status !== "PUBLISHED") throw conflict();
    const next = this.change(member, row, "notice.publish", {
      status: "PUBLISHED",
      published: true,
    });
    this.repository.clearNoticeReceipts(next.id, next.version);
    return staffView(next);
  }

  revoke(member: LocalMember, id: string, body: unknown) {
    permission(member, "notice:revoke");
    const data = exactBody(body, ["version"]);
    const row = this.staffRow(member, id);
    expected(row, data.version);
    if (row.status !== "PUBLISHED") throw conflict();
    const next = this.change(member, row, "notice.revoke", { status: "REVOKED", published: false });
    this.repository.clearNoticeReceipts(next.id);
    return staffView(next);
  }

  read(member: LocalMember, id: string, body: unknown) {
    permission(member, "notice:read");
    const data = exactBody(body, ["version"]);
    const row = this.visibleParent(member, id);
    expected(row, data.version);
    const current = this.repository.noticeReceipt(member.actorId, row.id, row.version);
    if (current?.status !== "ACKNOWLEDGED") {
      const receipt: NoticeReceipt = {
        guardianId: member.actorId,
        noticeId: row.id,
        version: row.version,
        status: "READ",
      };
      this.repository.setNoticeReceipt(receipt);
    }
    this.audit(member, row, "notice.read");
    return parentView(this.repository, member, row);
  }

  ack(member: LocalMember, id: string, body: unknown) {
    permission(member, "notice:ack");
    const data = exactBody(body, ["version"]);
    const row = this.visibleParent(member, id);
    expected(row, data.version);
    const current = this.repository.noticeReceipt(member.actorId, row.id, row.version);
    if (!current || (current.status !== "READ" && current.status !== "ACKNOWLEDGED"))
      throw conflict();
    this.repository.setNoticeReceipt({
      guardianId: member.actorId,
      noticeId: row.id,
      version: row.version,
      status: "ACKNOWLEDGED",
    });
    this.audit(member, row, "notice.ack");
    return parentView(this.repository, member, row);
  }

  denied(member: LocalMember, action: string, id: string) {
    this.repository.audit({
      actorId: member.actorId,
      objectId: id || null,
      version: null,
      action,
      outcome: "DENIED",
      at: new Date(this.now()).toISOString(),
      tenantId: member.tenantId,
      campusId: member.campusId,
    });
  }

  private staffRow(member: LocalMember, id: string) {
    const row = this.repository.get(id);
    if (!row || row.kind !== "notice" || !scoped(member, row)) throw unavailable();
    return row;
  }

  private visibleParent(member: LocalMember, id: string) {
    const row = this.repository.get(id);
    if (!row || row.kind !== "notice" || row.status !== "PUBLISHED" || !row.published)
      throw unavailable();
    if (!this.parentBinding(member, row)) throw unavailable();
    return row;
  }

  private parentBinding(member: LocalMember, row: Notice): Binding | undefined {
    if (!member.actions.includes("notice:read")) return undefined;
    return this.repository
      .list()
      .find(
        (candidate): candidate is Binding =>
          candidate.kind === "binding" &&
          candidate.status === "APPROVED" &&
          candidate.guardianId === member.actorId &&
          candidate.tenantId === row.tenantId &&
          candidate.campusId === row.campusId &&
          candidate.classId === row.classId &&
          member.tenantId === row.tenantId &&
          member.campusId === row.campusId &&
          member.classIds.includes(row.classId) &&
          (row.target === "INSTITUTION" || candidate.classId === row.classId),
      );
  }

  private change(
    member: LocalMember,
    row: Notice,
    action: string,
    patch: Pick<Notice, "status" | "published">,
  ) {
    const next: Notice = {
      ...row,
      ...patch,
      version: row.version + 1,
      updatedBy: member.actorId,
      updatedAt: new Date(this.now()).toISOString(),
    };
    if (!this.repository.replaceBatch([next])) throw conflict();
    this.audit(member, next, action);
    return next;
  }

  private audit(member: LocalMember, row: Notice, action: string) {
    this.repository.audit({
      actorId: member.actorId,
      objectId: row.id,
      version: row.version,
      action,
      outcome: "ACCEPTED",
      at: new Date(this.now()).toISOString(),
      tenantId: row.tenantId,
      campusId: row.campusId,
    });
  }
}
