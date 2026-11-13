import { LocalError } from "./binding-leave.service.js";
import {
  LocalRepository,
  type ResourceLibraryFilter,
  type ResourceLibraryProjection,
  type ResourceLibraryRecord,
  type ResourceLibrarySummary,
  type ResourceLibraryUpdate,
} from "./repository.js";
import type { LocalMember } from "./sessions.js";

const unavailable = () => new LocalError(403, "UNAVAILABLE");
const conflict = () => new LocalError(409, "STATE_CONFLICT");
const TENANT_EAST = "00000000-0000-4000-8000-000000000064";
const CAMPUS_EAST = "00000000-0000-4000-8000-000000000065";
const CLASS_EAST = "00000000-0000-4000-8000-000000000067";
const TENANT_OTHER = "00000000-0000-4000-8000-00000000006e";
const CAMPUS_OTHER = "00000000-0000-4000-8000-00000000006f";
const CLASS_OTHER = "00000000-0000-4000-8000-000000000071";
const EXPIRY_CHOICES = new Set(["2026-10-31", "2026-12-31", "2027-03-31"]);

function currentDate(now: number) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(now));
}

function uuid(n: number) {
  return `00000000-0000-4000-8000-${n.toString(16).padStart(12, "0")}`;
}

function fixtures(): ResourceLibraryRecord[] {
  const base = {
    version: 1,
    kind: "resourceLibrary" as const,
    tenantId: TENANT_EAST,
    campusId: CAMPUS_EAST,
    classId: CLASS_EAST,
    audienceRoles: ["TEACHER", "OWNER"] as ResourceLibraryRecord["audienceRoles"],
    sourceLabel: "校内教研组（合成示例）",
    ownerId: uuid(4),
    ownerRole: "机构负责人" as const,
    ownerLabel: "示例东校区负责人",
    updatedBy: uuid(4),
    updatedAt: "2026-10-01T00:00:00.000Z",
  };
  return [
    {
      ...base,
      id: uuid(901),
      scope: "CAMPUS",
      category: "LESSON",
      title: "示例数学活动卡",
      summary: "用纸片和纸杯组织一次小组探索。",
      content: "先观察纸张的形状，再尝试折出不同结构。教师引导大家描述发现，不给儿童贴标签。",
      grade: "三年级",
      subject: "数学",
      tags: ["小组活动", "课堂探索"],
      status: "PUBLISHED",
      expiresOn: "2026-12-31",
    },
    {
      ...base,
      id: uuid(902),
      scope: "CLASS",
      category: "READING",
      title: "示例阅读引导单",
      summary: "围绕短篇故事开展阅读分享。",
      content: "先提出一个开放问题，邀请学生从文本寻找线索。保留多种理解，不记录个人能力结论。",
      grade: "三年级",
      subject: "语文",
      tags: ["阅读引导", "课堂分享"],
      status: "PUBLISHED",
      expiresOn: "2027-03-31",
    },
    {
      ...base,
      id: uuid(903),
      scope: "CAMPUS",
      category: "EXERCISE",
      title: "已过期示例练习",
      summary: "用于确认过期资料不会再显示。",
      content: "此固定示例已过期，不展示练习内容。",
      grade: "三年级",
      subject: "科学",
      tags: ["实验观察"],
      status: "PUBLISHED",
      expiresOn: "2026-09-30",
    },
    {
      ...base,
      id: uuid(904),
      scope: "CAMPUS",
      category: "REFERENCE",
      title: "已撤回示例参考",
      summary: "用于确认撤回资源不会从个人入口重新出现。",
      content: "此资源已撤回，不展示正文。",
      grade: "三年级",
      subject: "综合实践",
      tags: ["教研参考"],
      status: "REVOKED",
      expiresOn: "2027-03-31",
    },
    {
      ...base,
      id: uuid(905),
      tenantId: TENANT_OTHER,
      campusId: CAMPUS_OTHER,
      classId: CLASS_OTHER,
      ownerId: uuid(6),
      ownerLabel: "示例乙机构负责人",
      updatedBy: uuid(6),
      scope: "CAMPUS",
      category: "EXERCISE",
      title: "其他机构示例练习",
      summary: "仅属于另一家合成机构。",
      content: "该示例不应跨机构展示。",
      grade: "四年级",
      subject: "数学",
      tags: ["数感练习"],
      status: "PUBLISHED",
      expiresOn: "2027-03-31",
    },
    {
      ...base,
      id: uuid(906),
      scope: "CLASS",
      audienceRoles: ["PARENT", "TEACHER"],
      category: "LESSON",
      title: "两位数加法分步学习卡",
      summary: "按步骤理解进位过程。",
      content: "先拆分数位，再依次相加；完成后请与老师或家长核对。",
      grade: "三年级",
      subject: "数学",
      tags: ["两位数加法与进位"],
      status: "PUBLISHED",
      expiresOn: "2027-03-31",
      learningSourceGovernance: {
        collection: "SYNTHETIC_CAMPUS_MATH_SET",
        revision: "SYNTHETIC_2026_10_V1",
        reviewStatus: "APPROVED",
        reviewedAt: "2026-10-01T00:00:00.000Z",
      },
    },
    {
      ...base,
      id: uuid(907),
      scope: "CLASS",
      audienceRoles: ["PARENT", "TEACHER"],
      category: "EXERCISE",
      title: "两位数加法练习卡",
      summary: "练习进位前先拆分数位。",
      content: "请先独立尝试，再对照步骤检查；需要帮助时请联系老师或家长。",
      grade: "三年级",
      subject: "数学",
      tags: ["两位数加法与进位"],
      status: "PUBLISHED",
      expiresOn: "2027-03-31",
      learningSourceGovernance: {
        collection: "SYNTHETIC_CAMPUS_MATH_SET",
        revision: "SYNTHETIC_2026_10_V1",
        reviewStatus: "PENDING_REVIEW",
        reviewedAt: null,
      },
    },
  ] as ResourceLibraryRecord[];
}

export class ResourceLibraryService {
  readonly #favorites = new Map<string, Set<string>>();
  readonly #recent = new Map<string, Array<{ id: string; at: string }>>();

  constructor(
    private readonly repository: LocalRepository,
    private readonly now: () => number = Date.now,
  ) {
    for (const resource of fixtures()) {
      if (!repository.get(resource.id)) repository.insert(resource);
    }
  }

  private role(member: LocalMember) {
    return member.actions.includes("resource:manage") ? "OWNER" : "TEACHER";
  }

  private require(
    member: LocalMember,
    action: "resource:read" | "resource:manage" | "resource:summary",
  ) {
    if (!member.actions.includes(action)) throw unavailable();
  }

  private isRecord(value: unknown): value is ResourceLibraryRecord {
    return (
      typeof value === "object" &&
      value !== null &&
      (value as { kind?: unknown }).kind === "resourceLibrary"
    );
  }

  private all() {
    return this.repository.list().filter((row): row is ResourceLibraryRecord => this.isRecord(row));
  }

  private active(resource: ResourceLibraryRecord) {
    return resource.status === "PUBLISHED" && resource.expiresOn >= currentDate(this.now());
  }

  private inScope(member: LocalMember, resource: ResourceLibraryRecord) {
    return (
      resource.tenantId === member.tenantId &&
      resource.campusId === member.campusId &&
      (resource.scope === "CAMPUS" || member.classIds.includes(resource.classId)) &&
      resource.audienceRoles.includes(this.role(member))
    );
  }

  private project(member: LocalMember, resource: ResourceLibraryRecord): ResourceLibraryProjection {
    const lastUsedAt = this.#recent
      .get(member.actorId)
      ?.find((item) => item.id === resource.id)?.at;
    return {
      ...structuredClone(resource),
      favorite: this.#favorites.get(member.actorId)?.has(resource.id) ?? false,
      ...(lastUsedAt ? { lastUsedAt } : {}),
    };
  }

  list(member: LocalMember, filter: ResourceLibraryFilter = {}) {
    this.require(member, "resource:read");
    const query = (filter.query ?? "").trim().toLocaleLowerCase("zh-CN");
    if (query.length > 80) throw new LocalError(400, "INVALID_REQUEST");
    return this.all()
      .filter((item) => this.inScope(member, item) && this.active(item))
      .filter((item) => !filter.grade || item.grade === filter.grade)
      .filter((item) => !filter.subject || item.subject === filter.subject)
      .filter((item) => !filter.tag || item.tags.includes(filter.tag))
      .filter(
        (item) =>
          !query ||
          `${item.title} ${item.summary} ${item.content} ${item.tags.join(" ")}`
            .toLocaleLowerCase("zh-CN")
            .includes(query),
      )
      .map((item) => this.project(member, item));
  }

  detail(member: LocalMember, id: string) {
    this.require(member, "resource:read");
    const item = this.all().find((row) => row.id === id);
    return item && this.inScope(member, item) && this.active(item)
      ? this.project(member, item)
      : undefined;
  }

  favorites(member: LocalMember) {
    const favorites = this.#favorites.get(member.actorId) ?? new Set<string>();
    return this.list(member).filter((item) => favorites.has(item.id));
  }

  recent(member: LocalMember) {
    const recent = this.#recent.get(member.actorId) ?? [];
    const positions = new Map(recent.map((item, index) => [item.id, index]));
    return this.list(member)
      .filter((item) => positions.has(item.id))
      .sort((left, right) => positions.get(left.id)! - positions.get(right.id)!);
  }

  managed(member: LocalMember) {
    this.require(member, "resource:manage");
    return this.all()
      .filter(
        (item) =>
          item.tenantId === member.tenantId &&
          item.campusId === member.campusId &&
          (item.scope === "CAMPUS" || member.classIds.includes(item.classId)),
      )
      .map((item) => this.project(member, item));
  }

  favorite(member: LocalMember, id: string, input: { version: number; favorite: boolean }) {
    const item = this.detail(member, id);
    if (!item) throw unavailable();
    if (input.version !== item.version) throw conflict();
    if (typeof input.favorite !== "boolean") throw new LocalError(400, "INVALID_REQUEST");
    let favorites = this.#favorites.get(member.actorId);
    if (!favorites) this.#favorites.set(member.actorId, (favorites = new Set()));
    if (input.favorite) favorites.add(id);
    else favorites.delete(id);
    this.repository.audit({
      actorId: member.actorId,
      objectId: id,
      version: item.version,
      action: "resource.favorite",
      outcome: "ACCEPTED",
      at: new Date(this.now()).toISOString(),
      tenantId: member.tenantId,
      campusId: member.campusId,
    });
    return this.project(
      member,
      this.all().find((row) => row.id === id)!,
    );
  }

  use(member: LocalMember, id: string, input: { version: number }) {
    const item = this.detail(member, id);
    if (!item) throw unavailable();
    if (input.version !== item.version) throw conflict();
    const rows = this.#recent.get(member.actorId) ?? [];
    const at = new Date(this.now()).toISOString();
    this.#recent.set(
      member.actorId,
      [{ id, at }, ...rows.filter((row) => row.id !== id)].slice(0, 10),
    );
    this.repository.audit({
      actorId: member.actorId,
      objectId: id,
      version: item.version,
      action: "resource.use",
      outcome: "ACCEPTED",
      at,
      tenantId: member.tenantId,
      campusId: member.campusId,
    });
    return this.project(
      member,
      this.all().find((row) => row.id === id)!,
    );
  }

  update(member: LocalMember, id: string, input: ResourceLibraryUpdate) {
    this.require(member, "resource:manage");
    const current = this.all().find(
      (item) =>
        item.id === id &&
        item.tenantId === member.tenantId &&
        item.campusId === member.campusId &&
        (item.scope === "CAMPUS" || member.classIds.includes(item.classId)),
    );
    if (!current) throw unavailable();
    if (
      !Number.isSafeInteger(input.version) ||
      !(input.scope === "CAMPUS" || input.scope === "CLASS") ||
      !EXPIRY_CHOICES.has(input.expiresOn) ||
      (input.scope === "CLASS" && (!input.classId || !member.classIds.includes(input.classId))) ||
      (input.learningSourceAction !== undefined &&
        input.learningSourceAction !== "APPROVE" &&
        input.learningSourceAction !== "RETURN")
    )
      throw new LocalError(400, "INVALID_REQUEST");
    if (current.version !== input.version || current.status !== "PUBLISHED") throw conflict();
    if (input.learningSourceAction !== undefined) {
      if (
        !current.learningSourceGovernance ||
        current.learningSourceGovernance.reviewStatus !== "PENDING_REVIEW" ||
        input.scope !== current.scope ||
        input.expiresOn !== current.expiresOn ||
        (current.scope === "CLASS" && input.classId !== current.classId) ||
        (current.scope === "CAMPUS" && input.classId !== undefined)
      )
        throw conflict();
      const next: ResourceLibraryRecord = {
        ...current,
        version: current.version + 1,
        updatedBy: member.actorId,
        updatedAt: new Date(this.now()).toISOString(),
        learningSourceGovernance: {
          ...current.learningSourceGovernance,
          reviewStatus: input.learningSourceAction === "APPROVE" ? "APPROVED" : "RETURNED",
          reviewedAt: new Date(this.now()).toISOString(),
        },
      };
      if (!this.repository.replaceBatch([next])) throw conflict();
      this.audit(
        member,
        id,
        next.version,
        input.learningSourceAction === "APPROVE"
          ? "resource.learning-source.approve"
          : "resource.learning-source.return",
      );
      return this.project(member, next);
    }
    const next: ResourceLibraryRecord = {
      ...current,
      version: current.version + 1,
      scope: input.scope,
      ...(input.scope === "CLASS" ? { classId: input.classId! } : {}),
      expiresOn: input.expiresOn,
      updatedBy: member.actorId,
      updatedAt: new Date(this.now()).toISOString(),
    };
    if (!this.repository.replaceBatch([next])) throw conflict();
    this.audit(member, id, next.version, "resource.update");
    return this.project(member, next);
  }

  revoke(member: LocalMember, id: string, input: { version: number }) {
    this.require(member, "resource:manage");
    const current = this.all().find(
      (item) =>
        item.id === id &&
        item.tenantId === member.tenantId &&
        item.campusId === member.campusId &&
        (item.scope === "CAMPUS" || member.classIds.includes(item.classId)),
    );
    if (!current) throw unavailable();
    if (current.version !== input.version || current.status !== "PUBLISHED") throw conflict();
    const next: ResourceLibraryRecord = {
      ...current,
      version: current.version + 1,
      status: "REVOKED",
      updatedBy: member.actorId,
      updatedAt: new Date(this.now()).toISOString(),
    };
    if (!this.repository.replaceBatch([next])) throw conflict();
    this.#favorites.forEach((rows) => rows.delete(id));
    this.#recent.forEach((rows) => {
      const index = rows.findIndex((row) => row.id === id);
      if (index >= 0) rows.splice(index, 1);
    });
    this.audit(member, id, next.version, "resource.revoke");
    return this.project(member, next);
  }

  summary(member: LocalMember): ResourceLibrarySummary {
    this.require(member, "resource:summary");
    const rows = this.all();
    const today = currentDate(this.now());
    const expired = rows.filter(
      (item) => item.status === "PUBLISHED" && item.expiresOn < today,
    ).length;
    const revoked = rows.filter((item) => item.status === "REVOKED").length;
    return {
      total: rows.length,
      published: rows.length - expired - revoked,
      expired,
      revoked,
    };
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

  private audit(member: LocalMember, id: string, version: number, action: string) {
    this.repository.audit({
      actorId: member.actorId,
      objectId: id,
      version,
      action,
      outcome: "ACCEPTED",
      at: new Date(this.now()).toISOString(),
      tenantId: member.tenantId,
      campusId: member.campusId,
    });
  }
}
