import type {
  MediaAssetReference,
  MediaAssetStatus,
  MediaAssetSummary,
  MediaAssetType,
  MediaAssetView,
} from "@student-care/contracts";
import { LocalError } from "./binding-leave.service.js";
import type { LocalAction, LocalMember } from "./sessions.js";

type StoredAsset = {
  id: string;
  alias: string;
  title: string;
  version: number;
  type: MediaAssetType;
  tenantId: string;
  campusId: string;
  expiresOn: string;
  state: "ACTIVE" | "ARCHIVED" | "REVOKED" | "DELETED";
  references: MediaAssetReference[];
};

export interface MediaAssetEvent {
  readonly id: string;
  readonly actorProfile: string;
  readonly assetAlias: string;
  readonly action: "ACCESS_CHECK" | "REPLACE_REFERENCE" | "ARCHIVE" | "REVOKE" | "SOFT_DELETE";
  readonly outcome: string;
  readonly occurredAt: string;
}

const uuid = (n: number) => `00000000-0000-4000-8000-${n.toString(16).padStart(12, "0")}`;
const TENANT_EAST = uuid(100);
const CAMPUS_EAST = uuid(101);
const CAMPUS_WEST = uuid(102);
const TENANT_OTHER = uuid(110);
const CAMPUS_OTHER = uuid(111);
const unavailable = () => new LocalError(403, "UNAVAILABLE");
const conflict = () => new LocalError(409, "STATE_CONFLICT");

function currentDate(now: number): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(now));
}

function fixtures(): StoredAsset[] {
  return [
    {
      id: uuid(701),
      alias: "teacher-profile-placeholder",
      title: "教师介绍占位图",
      version: 1,
      type: "IMAGE",
      tenantId: TENANT_EAST,
      campusId: CAMPUS_EAST,
      expiresOn: "2026-12-31",
      state: "ACTIVE",
      references: [{ id: uuid(801), label: "教师介绍", kind: "TEACHER_INTRO" }],
    },
    {
      id: uuid(702),
      alias: "family-guide-placeholder",
      title: "家长指南占位文档",
      version: 1,
      type: "DOCUMENT",
      tenantId: TENANT_EAST,
      campusId: CAMPUS_EAST,
      expiresOn: "2026-12-31",
      state: "ACTIVE",
      references: [{ id: uuid(802), label: "家长指南", kind: "FAMILY_GUIDE" }],
    },
    {
      id: uuid(703),
      alias: "activity-cover-placeholder",
      title: "活动封面占位图",
      version: 1,
      type: "IMAGE",
      tenantId: TENANT_EAST,
      campusId: CAMPUS_EAST,
      expiresOn: "2026-12-31",
      state: "ACTIVE",
      references: [],
    },
    {
      id: uuid(704),
      alias: "expired-placeholder",
      title: "已过期活动占位图",
      version: 1,
      type: "IMAGE",
      tenantId: TENANT_EAST,
      campusId: CAMPUS_EAST,
      expiresOn: "2026-10-07",
      state: "ACTIVE",
      references: [{ id: uuid(804), label: "过期活动", kind: "ACTIVITY" }],
    },
    {
      id: uuid(705),
      alias: "archived-placeholder",
      title: "已归档指南占位图",
      version: 1,
      type: "IMAGE",
      tenantId: TENANT_EAST,
      campusId: CAMPUS_EAST,
      expiresOn: "2026-12-31",
      state: "ARCHIVED",
      references: [],
    },
    {
      id: uuid(706),
      alias: "revoked-placeholder",
      title: "已撤回说明占位文档",
      version: 1,
      type: "DOCUMENT",
      tenantId: TENANT_EAST,
      campusId: CAMPUS_EAST,
      expiresOn: "2026-12-31",
      state: "REVOKED",
      references: [{ id: uuid(803), label: "已撤回指南", kind: "FAMILY_GUIDE" }],
    },
    {
      id: uuid(707),
      alias: "west-activity-placeholder",
      title: "西校区活动占位图",
      version: 1,
      type: "IMAGE",
      tenantId: TENANT_EAST,
      campusId: CAMPUS_WEST,
      expiresOn: "2026-12-31",
      state: "ACTIVE",
      references: [],
    },
    {
      id: uuid(708),
      alias: "other-tenant-placeholder",
      title: "其他机构活动占位图",
      version: 1,
      type: "IMAGE",
      tenantId: TENANT_OTHER,
      campusId: CAMPUS_OTHER,
      expiresOn: "2026-12-31",
      state: "ACTIVE",
      references: [],
    },
    {
      id: uuid(709),
      alias: "available-guide-placeholder",
      title: "可用家长指南占位文档",
      version: 1,
      type: "DOCUMENT",
      tenantId: TENANT_EAST,
      campusId: CAMPUS_EAST,
      expiresOn: "2026-12-31",
      state: "ACTIVE",
      references: [],
    },
    {
      id: uuid(710),
      alias: "alternate-activity-cover-placeholder",
      title: "备用活动封面占位图",
      version: 1,
      type: "IMAGE",
      tenantId: TENANT_EAST,
      campusId: CAMPUS_EAST,
      expiresOn: "2026-12-31",
      state: "ACTIVE",
      references: [],
    },
  ];
}

export class MediaAssetsService {
  readonly #assets = fixtures();
  readonly #events: MediaAssetEvent[] = [];
  #nextEvent = 9000;

  constructor(private readonly now: () => number = Date.now) {}

  private require(member: LocalMember, action: LocalAction): void {
    if (!member.actions.includes(action)) throw unavailable();
  }

  private scopedAsset(member: LocalMember, id: string): StoredAsset {
    const asset = this.#assets.find((row) => row.id === id);
    if (!asset || asset.tenantId !== member.tenantId || asset.campusId !== member.campusId)
      throw unavailable();
    return asset;
  }

  private status(asset: StoredAsset): MediaAssetStatus {
    if (asset.state !== "ACTIVE") return asset.state;
    if (asset.expiresOn < currentDate(this.now())) return "EXPIRED";
    return asset.references.length > 0 ? "REFERENCED" : "AVAILABLE";
  }

  private view(asset: StoredAsset): MediaAssetView {
    return {
      id: asset.id,
      alias: asset.alias,
      title: asset.title,
      version: asset.version,
      type: asset.type,
      status: this.status(asset),
      expiresOn: asset.expiresOn,
      references: structuredClone(asset.references),
    };
  }

  private version(asset: StoredAsset, value: unknown): void {
    if (!Number.isSafeInteger(value) || (value as number) < 1) {
      throw new LocalError(400, "INVALID_REQUEST");
    }
    if (asset.version !== value) throw conflict();
  }

  private record(
    member: LocalMember,
    asset: StoredAsset,
    action: MediaAssetEvent["action"],
    outcome: string,
  ): void {
    this.#events.push({
      id: uuid(this.#nextEvent++),
      actorProfile: member.profile,
      assetAlias: asset.alias,
      action,
      outcome,
      occurredAt: new Date(this.now()).toISOString(),
    });
  }

  list(member: LocalMember): { assets: MediaAssetView[] } {
    if (!member.actions.includes("media:read") && !member.actions.includes("media:manage"))
      throw unavailable();
    return {
      assets: this.#assets
        .filter((row) => row.tenantId === member.tenantId && row.campusId === member.campusId)
        .map((row) => this.view(row)),
    };
  }

  events(member: LocalMember): MediaAssetEvent[] {
    if (!member.actions.includes("media:read") && !member.actions.includes("media:manage"))
      throw unavailable();
    return structuredClone(
      this.#events.filter((event) => {
        const asset = this.#assets.find((row) => row.alias === event.assetAlias);
        return asset?.tenantId === member.tenantId && asset.campusId === member.campusId;
      }),
    );
  }

  summary(member: LocalMember): MediaAssetSummary {
    this.require(member, "media:summary");
    const counts = {
      total: this.#assets.length,
      available: 0,
      referenced: 0,
      expired: 0,
      archived: 0,
      revoked: 0,
      deleted: 0,
    };
    for (const asset of this.#assets)
      counts[this.status(asset).toLowerCase() as keyof typeof counts]++;
    return counts;
  }

  accessCheck(member: LocalMember, id: string, input: { version: number }) {
    if (!member.actions.includes("media:read") && !member.actions.includes("media:manage"))
      throw unavailable();
    const asset = this.scopedAsset(member, id);
    this.version(asset, input.version);
    const allowed = this.status(asset) === "AVAILABLE" || this.status(asset) === "REFERENCED";
    this.record(member, asset, "ACCESS_CHECK", allowed ? "ALLOWED" : "DENIED");
    return {
      allowed,
      recorded: true as const,
      message: allowed
        ? "本机合成权限校验通过；没有读取或下载真实文件。"
        : "当前素材已过期、撤回、归档或软删除，不能查看。",
    };
  }

  replaceReference(
    member: LocalMember,
    id: string,
    input: { version: number; referenceId: string; targetAssetId: string; targetVersion: number },
  ) {
    this.require(member, "media:manage");
    const source = this.scopedAsset(member, id);
    const target = this.scopedAsset(member, input.targetAssetId);
    this.version(source, input.version);
    this.version(target, input.targetVersion);
    const reference = source.references.find((row) => row.id === input.referenceId);
    if (
      !reference ||
      source.id === target.id ||
      source.type !== target.type ||
      !["REFERENCED", "EXPIRED", "REVOKED"].includes(this.status(source)) ||
      this.status(target) !== "AVAILABLE"
    )
      throw conflict();
    source.references = source.references.filter((row) => row.id !== reference.id);
    target.references = [...target.references, reference];
    source.version++;
    target.version++;
    this.record(member, source, "REPLACE_REFERENCE", "SUCCESS");
    return { source: this.view(source), target: this.view(target) };
  }

  archive(member: LocalMember, id: string, input: { version: number }): MediaAssetView {
    this.require(member, "media:manage");
    const asset = this.scopedAsset(member, id);
    this.version(asset, input.version);
    if (asset.references.length > 0) {
      this.record(member, asset, "ARCHIVE", "REFERENCE_CONFLICT");
      throw conflict();
    }
    if (!(["AVAILABLE", "EXPIRED"] as MediaAssetStatus[]).includes(this.status(asset)))
      throw conflict();
    asset.state = "ARCHIVED";
    asset.version++;
    this.record(member, asset, "ARCHIVE", "SUCCESS");
    return this.view(asset);
  }

  revoke(
    member: LocalMember,
    id: string,
    input: { version: number; confirmReferences: boolean },
  ): MediaAssetView {
    this.require(member, "media:manage");
    const asset = this.scopedAsset(member, id);
    this.version(asset, input.version);
    if (typeof input.confirmReferences !== "boolean") {
      throw new LocalError(400, "INVALID_REQUEST");
    }
    if (asset.references.length > 0 && !input.confirmReferences) {
      this.record(member, asset, "REVOKE", "CONFIRMATION_REQUIRED");
      throw conflict();
    }
    if (!(
      this.status(asset) === "AVAILABLE" ||
      this.status(asset) === "REFERENCED" ||
      this.status(asset) === "EXPIRED"
    ))
      throw conflict();
    asset.state = "REVOKED";
    asset.version++;
    this.record(member, asset, "REVOKE", "SUCCESS");
    return this.view(asset);
  }

  softDelete(member: LocalMember, id: string, input: { version: number }): MediaAssetView {
    this.require(member, "media:manage");
    const asset = this.scopedAsset(member, id);
    this.version(asset, input.version);
    if (asset.state !== "ARCHIVED" || asset.references.length > 0) throw conflict();
    asset.state = "DELETED";
    asset.version++;
    this.record(member, asset, "SOFT_DELETE", "SUCCESS");
    return this.view(asset);
  }
}
