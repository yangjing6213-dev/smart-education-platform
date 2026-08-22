import type { ContentBody, ContentType } from "./content.js";

export interface ContentInput {
  readonly type: ContentType;
  readonly title: string;
  readonly body: ContentBody;
}

export interface ContentInputSyntax extends ContentInput {
  readonly campus_id?: string | null;
}

export interface DailyReportInput {
  readonly report_id: string;
  readonly note: string;
  readonly version: number;
}

export interface RelationshipInput {
  readonly student_id: string;
  readonly consent: true;
}

export interface LearningStartInput {
  readonly student_id: string;
  readonly supervision: true;
}

export interface HintInput {
  readonly session_id: string;
  readonly level: 0 | 1 | 2 | 3;
}

export interface PaginationQuery {
  readonly page_size?: number;
  readonly cursor?: string;
}

export interface RequestHeaders {
  readonly "Idempotency-Key"?: string;
  readonly "If-Match"?: string;
}
