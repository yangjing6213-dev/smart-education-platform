import { randomBytes } from "node:crypto";
import type { TrustedAuthResult } from "@student-care/auth";
import type { IdentityCapability, MembershipStatus } from "@student-care/contracts";

const uuid = (n: number) => `00000000-0000-4000-8000-${n.toString(16).padStart(12, "0")}`;
export type LocalAction =
  | "binding:apply"
  | "binding:review"
  | "leave:apply"
  | "leave:review"
  | "membership:manage"
  | "audit:read"
  | "care:write"
  | "care:review"
  | "care:publish"
  | "care:read"
  | "attendance:write"
  | "attendance:review"
  | "attendance:read"
  | "pickup:authorize"
  | "pickup:read"
  | "pickup:verify"
  | "pickup:review"
  | "pickup:summary"
  | "fees:read"
  | "fees:summary"
  | "notice:read"
  | "notice:create"
  | "notice:submit"
  | "notice:review"
  | "notice:publish"
  | "notice:revoke"
  | "notice:ack"
  | "health:read"
  | "health:ack"
  | "health:create"
  | "health:submit"
  | "health:review"
  | "health:supplement"
  | "health:publish"
  | "health:revoke"
  | "daily:read"
  | "daily:create"
  | "daily:submit"
  | "daily:review"
  | "feedback:read"
  | "feedback:create"
  | "feedback:submit"
  | "feedback:review"
  | "feedback:publish"
  | "feedback:ack"
  | "supply:read"
  | "supply:create"
  | "supply:submit"
  | "supply:review"
  | "supply:claim"
  | "supply:summary"
  | "task:read"
  | "task:assign"
  | "task:claim"
  | "task:start"
  | "task:complete"
  | "task:check"
  | "task:cancel"
  | "resource:read"
  | "resource:use"
  | "resource:manage"
  | "resource:summary"
  | "media:read"
  | "media:manage"
  | "media:summary"
  | "consent:manage"
  | "consent:review"
  | "privacy:request"
  | "privacy:review"
  | "statistics:read"
  | "statistics:summary"
  | "content:write"
  | "content:publish"
  | "learning:enable"
  | "learning:read"
  | "learning:close"
  | "learning:delete"
  | "learning:summary"
  | "learning:institution-setting"
  | "learning:safety-summary";
type ActionArea<Action extends string> = Action extends `${infer Area}:${string}` ? Area : never;
type LocalCapabilityArea = ActionArea<LocalAction>;
const localCapabilityAreaLabels: Record<LocalCapabilityArea, string> = {
  binding: "关系绑定",
  leave: "请假",
  membership: "员工成员",
  audit: "操作记录",
  care: "成长记录",
  attendance: "考勤",
  pickup: "接送",
  fees: "费用",
  notice: "通知",
  health: "健康记录",
  daily: "日报",
  feedback: "月度反馈",
  supply: "物资",
  task: "工作任务",
  resource: "资源库",
  media: "媒体文件",
  consent: "数据授权",
  privacy: "隐私请求",
  statistics: "运营统计",
  content: "公开内容",
  learning: "学习支持",
};

function summarizeCapabilities(actions: readonly LocalAction[]): string[] {
  const areas = new Set(
    actions.map((action) => action.slice(0, action.indexOf(":")) as LocalCapabilityArea),
  );
  return [...areas].map((area) => localCapabilityAreaLabels[area]);
}

export interface LocalMember {
  actorId: string;
  profile: string;
  label: string;
  tenantId: string;
  campusId: string;
  classIds: string[];
  actions: LocalAction[];
}

export interface LocalMembershipView {
  actorId: string;
  version: number;
  profile: string;
  label: string;
  role: string;
  tenantId: string;
  campusId: string;
  classIds: string[];
  status: MembershipStatus;
  capabilities: string[];
}

export interface LocalMembershipEvent {
  actorId: string;
  targetActorId: string;
  fromStatus: MembershipStatus;
  toStatus: MembershipStatus;
  occurredAt: string;
}

export const LOCAL_STUDENT = Object.freeze({
  id: uuid(200),
  alias: "student-alpha",
  label: "示例学生甲",
  tenantId: uuid(100),
  campusId: uuid(101),
  classId: uuid(103),
  classLabel: "示例三年级甲班",
  campusLabel: "示例东校区",
});
export const LOCAL_STUDENTS = Object.freeze([
  LOCAL_STUDENT,
  Object.freeze({ ...LOCAL_STUDENT, id: uuid(201), alias: "student-beta", label: "示例学生乙" }),
]);

export function studentsForMember(member: LocalMember) {
  const permitted = member.actions.some((action) =>
    [
      "binding:apply",
      "binding:review",
      "care:write",
      "care:review",
      "attendance:write",
      "attendance:review",
      "pickup:authorize",
      "pickup:verify",
      "pickup:review",
      "health:create",
      "health:review",
      "learning:enable",
    ].includes(action),
  );
  return permitted
    ? LOCAL_STUDENTS.filter(
        (student) =>
          student.tenantId === member.tenantId &&
          student.campusId === member.campusId &&
          member.classIds.includes(student.classId),
      ).map((student) => ({ ...student }))
    : [];
}

export function studentOptions(member: LocalMember) {
  return studentsForMember(member).map(
    ({ id, alias, label, campusId, classId, campusLabel, classLabel }) => ({
      id,
      alias,
      label,
      campusId,
      classId,
      campusLabel,
      classLabel,
    }),
  );
}

export function studentForId(id: string) {
  return LOCAL_STUDENTS.find((student) => student.id === id);
}

const profiles: LocalMember[] = [
  {
    actorId: uuid(1),
    profile: "parent-alpha",
    label: "示例监护人甲",
    tenantId: uuid(100),
    campusId: uuid(101),
    classIds: [uuid(103)],
    actions: [
      "binding:apply",
      "consent:manage",
      "privacy:request",
      "leave:apply",
      "care:read",
      "attendance:read",
      "pickup:authorize",
      "pickup:read",
      "fees:read",
      "notice:read",
      "notice:ack",
      "health:read",
      "health:ack",
      "feedback:read",
      "feedback:ack",
      "learning:enable",
      "learning:read",
      "learning:close",
      "learning:delete",
    ],
  },
  {
    actorId: uuid(2),
    profile: "parent-beta",
    label: "示例监护人乙",
    tenantId: uuid(100),
    campusId: uuid(101),
    classIds: [uuid(103)],
    actions: [
      "binding:apply",
      "consent:manage",
      "privacy:request",
      "leave:apply",
      "care:read",
      "attendance:read",
      "pickup:authorize",
      "pickup:read",
      "fees:read",
      "notice:read",
      "notice:ack",
      "health:read",
      "health:ack",
      "feedback:read",
      "feedback:ack",
      "learning:enable",
      "learning:read",
      "learning:close",
      "learning:delete",
    ],
  },
  {
    actorId: uuid(3),
    profile: "teacher-east",
    label: "示例东校区教师",
    tenantId: uuid(100),
    campusId: uuid(101),
    classIds: [uuid(103)],
    actions: [
      "leave:review",
      "care:write",
      "attendance:write",
      "pickup:verify",
      "pickup:read",
      "notice:create",
      "notice:submit",
      "health:create",
      "health:submit",
      "daily:read",
      "daily:create",
      "daily:submit",
      "feedback:read",
      "feedback:create",
      "feedback:submit",
      "supply:read",
      "supply:create",
      "supply:submit",
      "supply:claim",
      "task:read",
      "task:claim",
      "task:start",
      "task:complete",
      "resource:read",
      "resource:use",
      "learning:enable",
      "learning:read",
      "learning:summary",
      "learning:close",
      "learning:delete",
    ],
  },
  {
    actorId: uuid(4),
    profile: "owner-east",
    label: "示例东校区负责人",
    tenantId: uuid(100),
    campusId: uuid(101),
    classIds: [uuid(103)],
    actions: [
      "binding:review",
      "consent:review",
      "privacy:review",
      "leave:review",
      "audit:read",
      "care:review",
      "care:publish",
      "attendance:review",
      "pickup:read",
      "pickup:review",
      "fees:summary",
      "notice:create",
      "notice:submit",
      "notice:review",
      "notice:publish",
      "notice:revoke",
      "health:review",
      "health:supplement",
      "health:publish",
      "health:revoke",
      "daily:read",
      "daily:review",
      "feedback:read",
      "feedback:review",
      "feedback:publish",
      "supply:read",
      "supply:review",
      "supply:claim",
      "task:read",
      "task:assign",
      "task:check",
      "task:cancel",
      "resource:read",
      "resource:use",
      "resource:manage",
      "media:read",
      "media:manage",
      "statistics:read",
      "learning:institution-setting",
      "membership:manage",
      "content:write",
      "content:publish",
    ],
  },
  {
    actorId: uuid(5),
    profile: "owner-west",
    label: "示例西校区负责人",
    tenantId: uuid(100),
    campusId: uuid(102),
    classIds: [uuid(104)],
    actions: [
      "binding:review",
      "consent:review",
      "privacy:review",
      "leave:review",
      "audit:read",
      "care:review",
      "care:publish",
      "attendance:review",
      "pickup:read",
      "pickup:review",
      "fees:summary",
      "notice:create",
      "notice:submit",
      "notice:review",
      "notice:publish",
      "notice:revoke",
      "health:review",
      "health:supplement",
      "health:publish",
      "health:revoke",
      "daily:read",
      "daily:review",
      "feedback:read",
      "feedback:review",
      "feedback:publish",
      "supply:read",
      "supply:review",
      "supply:claim",
      "task:read",
      "task:assign",
      "task:check",
      "task:cancel",
      "resource:read",
      "resource:use",
      "resource:manage",
      "media:read",
      "media:manage",
      "statistics:read",
      "learning:institution-setting",
      "membership:manage",
      "content:write",
      "content:publish",
    ],
  },
  {
    actorId: uuid(6),
    profile: "owner-other-tenant",
    label: "示例乙机构负责人",
    tenantId: uuid(110),
    campusId: uuid(111),
    classIds: [uuid(113)],
    actions: [
      "binding:review",
      "leave:review",
      "audit:read",
      "care:review",
      "care:publish",
      "attendance:review",
      "pickup:read",
      "pickup:review",
      "fees:summary",
      "notice:create",
      "notice:submit",
      "notice:review",
      "notice:publish",
      "notice:revoke",
      "health:review",
      "health:supplement",
      "health:publish",
      "health:revoke",
      "daily:read",
      "daily:review",
      "feedback:read",
      "feedback:review",
      "feedback:publish",
      "supply:read",
      "supply:review",
      "supply:claim",
      "task:read",
      "task:assign",
      "task:check",
      "task:cancel",
      "resource:read",
      "resource:use",
      "resource:manage",
      "media:read",
      "media:manage",
      "statistics:read",
      "membership:manage",
      "learning:institution-setting",
    ],
  },
  {
    actorId: uuid(7),
    profile: "teacher-other-class",
    label: "示例乙班教师",
    tenantId: uuid(100),
    campusId: uuid(101),
    classIds: [uuid(104)],
    actions: [
      "leave:review",
      "care:write",
      "attendance:write",
      "pickup:verify",
      "pickup:read",
      "notice:create",
      "notice:submit",
      "health:create",
      "health:submit",
      "daily:read",
      "daily:create",
      "daily:submit",
      "feedback:read",
      "feedback:create",
      "feedback:submit",
      "supply:read",
      "supply:create",
      "supply:submit",
      "supply:claim",
      "task:read",
      "task:claim",
      "task:start",
      "task:complete",
      "resource:read",
      "resource:use",
      "learning:enable",
      "learning:read",
      "learning:summary",
      "learning:close",
      "learning:delete",
    ],
  },
  {
    actorId: uuid(8),
    profile: "content-editor-east",
    label: "示例内容编辑",
    tenantId: uuid(100),
    campusId: uuid(101),
    classIds: [uuid(103)],
    actions: [],
  },
  {
    actorId: uuid(9),
    profile: "teacher-east-peer",
    label: "示例东校区同班教师乙",
    tenantId: uuid(100),
    campusId: uuid(101),
    classIds: [uuid(103)],
    actions: [
      "leave:review",
      "care:write",
      "attendance:write",
      "pickup:verify",
      "pickup:read",
      "notice:create",
      "notice:submit",
      "health:create",
      "health:submit",
      "daily:read",
      "daily:create",
      "daily:submit",
      "feedback:read",
      "feedback:create",
      "feedback:submit",
      "supply:read",
      "supply:create",
      "supply:submit",
      "supply:claim",
      "task:read",
      "task:claim",
      "task:start",
      "task:complete",
      "resource:read",
      "resource:use",
    ],
  },
  {
    actorId: uuid(10),
    profile: "platform-admin",
    label: "示例平台管理员（无学生明细权限）",
    tenantId: uuid(100),
    campusId: uuid(101),
    classIds: [],
    actions: [
      "pickup:summary",
      "supply:summary",
      "resource:summary",
      "media:summary",
      "statistics:summary",
      "learning:safety-summary",
    ],
  },
];

export function memberForActor(actorId: string): LocalMember | undefined {
  const member = profiles.find((row) => row.actorId === actorId);
  return member ? structuredClone(member) : undefined;
}

export function taskAssigneesFor(member: LocalMember) {
  return profiles
    .filter(
      (candidate) =>
        candidate.actions.includes("task:claim") &&
        candidate.tenantId === member.tenantId &&
        candidate.campusId === member.campusId &&
        candidate.classIds.some((classId) => member.classIds.includes(classId)),
    )
    .map(({ actorId, label, campusId, classIds }) => ({ actorId, label, campusId, classIds }));
}

export class LocalSessions {
  readonly #sessions = new Map<string, { member: LocalMember; expiresAt: number }>();
  readonly #membershipStatuses = new Map<string, MembershipStatus>(
    profiles.map((member) => [member.actorId, "ACTIVE"]),
  );
  readonly #membershipVersions = new Map<string, number>(
    profiles.map((member) => [member.actorId, 1]),
  );
  readonly #membershipEvents: LocalMembershipEvent[] = [];
  constructor(private readonly now: () => number = Date.now) {}

  listProfiles() {
    return profiles.map(({ profile, label }) => ({ profile, label }));
  }

  create(profile: string) {
    this.prune();
    const member = profiles.find((row) => row.profile === profile);
    if (!member || this.#membershipStatuses.get(member.actorId) !== "ACTIVE") return undefined;
    return this.createSession(member);
  }

  createForTrustedAuth(auth: TrustedAuthResult | undefined) {
    if (
      !auth ||
      auth.trusted !== true ||
      auth.session.status !== "ACTIVE" ||
      auth.session.actor_id !== auth.identity.actor_id
    )
      return undefined;
    const member = profiles.find((row) => row.actorId === auth.identity.actor_id);
    if (!member) return undefined;
    const matchingMembership = auth.memberships.some(
      (membership) =>
        membership.status === "ACTIVE" &&
        membership.capabilities.includes("identity:read") &&
        membership.tenant_id === member.tenantId &&
        membership.campus_ids.includes(member.campusId),
    );
    if (
      !matchingMembership ||
      this.#membershipStatuses.get(member.actorId) !== "ACTIVE"
    )
      return undefined;
    return this.createSession(member, true);
  }

  private createSession(member: LocalMember, includeProfile = false) {
    const handle = randomBytes(32).toString("base64url");
    const expiresAt = this.now() + 15 * 60 * 1000;
    this.#sessions.set(handle, { member: structuredClone(member), expiresAt });
    return {
      handle,
      expiresAt: new Date(expiresAt).toISOString(),
      mode: "local-synthetic",
      label: member.label,
      ...(includeProfile ? { profile: member.profile } : {}),
    };
  }

  resolve(authorization: string | undefined): TrustedAuthResult | undefined {
    this.prune();
    const token = authorization?.match(/^Bearer ([A-Za-z0-9_-]{43})$/)?.[1];
    const session = token ? this.#sessions.get(token) : undefined;
    if (!token || !session) return undefined;
    if (this.#membershipStatuses.get(session.member.actorId) !== "ACTIVE") {
      this.#sessions.delete(token);
      return undefined;
    }
    const m = session.member;
    const capabilities: IdentityCapability[] = ["identity:read"];
    if (m.actions.includes("membership:manage")) capabilities.push("memberships:read");
    if (m.profile === "content-editor-east") capabilities.push("content:write");
    if (m.actions.includes("binding:apply")) capabilities.push("binding:apply", "binding:read");
    if (m.actions.includes("binding:review")) capabilities.push("binding:read", "binding:review");
    return {
      trusted: true,
      session: {
        trusted: true,
        actor_id: m.actorId,
        status: "ACTIVE",
        expires_at: new Date(session.expiresAt).toISOString(),
      },
      identity: { actor_id: m.actorId, display_name: m.label },
      memberships: [
        {
          tenant_id: m.tenantId,
          campus_ids: [m.campusId],
          status: "ACTIVE",
          capabilities,
        },
      ],
    };
  }

  statusForProfile(profile: string): MembershipStatus | undefined {
    const member = profiles.find((row) => row.profile === profile);
    return member ? this.#membershipStatuses.get(member.actorId) : undefined;
  }

  membershipsFor(manager: LocalMember): LocalMembershipView[] | undefined {
    if (!manager.actions.includes("membership:manage")) return undefined;
    return profiles
      .filter(
        (member) =>
          member.tenantId === manager.tenantId &&
          member.campusId === manager.campusId &&
          !member.profile.startsWith("parent-") &&
          !member.profile.startsWith("owner-") &&
          member.profile !== "platform-admin",
      )
      .map((member) => this.membershipView(member));
  }

  changeMembershipStatus(
    manager: LocalMember,
    targetActorId: string,
    status: "ACTIVE" | "SUSPENDED" | "REVOKED",
    expectedVersion: number,
  ): LocalMembershipView | "CONFLICT" | undefined {
    if (!manager.actions.includes("membership:manage")) return undefined;
    const target = profiles.find((member) => member.actorId === targetActorId);
    if (
      !target ||
      target.actorId === manager.actorId ||
      target.tenantId !== manager.tenantId ||
      target.campusId !== manager.campusId ||
      target.profile.startsWith("parent-") ||
      target.profile.startsWith("owner-") ||
      target.profile === "platform-admin"
    )
      return undefined;

    const currentVersion = this.#membershipVersions.get(target.actorId);
    if (!currentVersion || currentVersion !== expectedVersion) return "CONFLICT";
    const previous = this.#membershipStatuses.get(target.actorId);
    if (!previous || previous === "REVOKED") return undefined;
    if (previous === status) return this.membershipView(target);
    this.#membershipStatuses.set(target.actorId, status);
    this.#membershipVersions.set(target.actorId, currentVersion + 1);
    if (status !== "ACTIVE") {
      for (const [handle, session] of this.#sessions)
        if (session.member.actorId === target.actorId) this.#sessions.delete(handle);
    }
    this.#membershipEvents.push({
      actorId: manager.actorId,
      targetActorId: target.actorId,
      fromStatus: previous,
      toStatus: status,
      occurredAt: new Date(this.now()).toISOString(),
    });
    return this.membershipView(target);
  }

  membershipEventsFor(manager: LocalMember): LocalMembershipEvent[] | undefined {
    if (!manager.actions.includes("membership:manage") || !manager.actions.includes("audit:read"))
      return undefined;
    return this.#membershipEvents
      .filter((event) => {
        const target = profiles.find((member) => member.actorId === event.targetActorId);
        return target?.tenantId === manager.tenantId && target.campusId === manager.campusId;
      })
      .map((event) => ({ ...event }));
  }

  private membershipView(member: LocalMember): LocalMembershipView {
    const role = member.profile.startsWith("teacher-")
      ? "教师"
      : member.profile.startsWith("content-editor-")
        ? "内容编辑"
        : "机构负责人";
    return {
      actorId: member.actorId,
      version: this.#membershipVersions.get(member.actorId) ?? 1,
      profile: member.profile,
      label: member.label,
      role,
      tenantId: member.tenantId,
      campusId: member.campusId,
      classIds: [...member.classIds],
      status: this.#membershipStatuses.get(member.actorId) ?? "REVOKED",
      capabilities: summarizeCapabilities(member.actions),
    };
  }

  end(authorization: string | undefined) {
    const handle = authorization?.match(/^Bearer ([A-Za-z0-9_-]{43})$/)?.[1];
    if (handle) this.#sessions.delete(handle);
  }

  clear() {
    this.#sessions.clear();
  }

  private prune() {
    for (const [handle, session] of this.#sessions)
      if (session.expiresAt <= this.now()) this.#sessions.delete(handle);
  }
}
