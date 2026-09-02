import type {
  ContentBody,
  ContentStatus,
  ContentType,
  ContentVisibility,
} from "@student-care/contracts";

export interface ContentScope {
  readonly tenantId: string;
  readonly campusId?: string;
}

export interface ContentRecord {
  readonly id: string;
  readonly content_key: string;
  readonly tenant_id: string;
  readonly campus_id: string | null;
  readonly type: ContentType;
  readonly status: ContentStatus;
  readonly title: string;
  readonly version: number;
  readonly visibility: ContentVisibility;
  readonly body: ContentBody;
  readonly published_at: string | null;
  readonly synthetic_data: true;
  readonly editor_note: string;
  readonly moderation_state: string;
  readonly tenant_admin_note: string;
  readonly campus_admin_note: string;
  readonly updated_by: string;
  readonly updated_at: string;
}

export interface ContentRepository {
  get(scope: ContentScope, contentKey: string): ContentRecord | undefined;
  save(record: ContentRecord): void;
}

function storageKey(scope: ContentScope, contentKey: string): string {
  return JSON.stringify([scope.tenantId, scope.campusId ?? null, contentKey]);
}

function cloneRecord(record: ContentRecord): ContentRecord {
  return {
    ...record,
    body: {
      ...record.body,
      blocks: record.body.blocks.map((block) => ({ ...block })),
    },
  };
}

export class InMemoryContentRepository implements ContentRepository {
  private readonly records = new Map<string, ContentRecord>();

  public constructor(initialRecords: readonly ContentRecord[] = []) {
    for (const record of initialRecords) {
      this.save(record);
    }
  }

  public get(scope: ContentScope, contentKey: string): ContentRecord | undefined {
    const record = this.records.get(storageKey(scope, contentKey));
    return record === undefined ? undefined : cloneRecord(record);
  }

  public save(record: ContentRecord): void {
    this.records.set(
      storageKey(
        {
          tenantId: record.tenant_id,
          ...(record.campus_id === null ? {} : { campusId: record.campus_id }),
        },
        record.content_key,
      ),
      cloneRecord(record),
    );
  }
}
