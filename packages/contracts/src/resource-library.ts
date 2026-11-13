export type ResourceLibraryScope = "CAMPUS" | "CLASS";
export type ResourceLibraryStatus = "PUBLISHED" | "REVOKED";
export type ResourceLibraryAudience = "TEACHER" | "OWNER";
export type LearningSourceReviewStatus = "PENDING_REVIEW" | "APPROVED" | "RETURNED";

export interface LearningSourceGovernance {
  collection: "SYNTHETIC_CAMPUS_MATH_SET";
  revision: "SYNTHETIC_2026_10_V1";
  reviewStatus: LearningSourceReviewStatus;
  reviewedAt: string | null;
}

export interface ResourceLibraryRecord {
  kind: "resourceLibrary";
  id: string;
  version: number;
  tenantId: string;
  campusId: string;
  classId: string;
  scope: ResourceLibraryScope;
  audienceRoles: ResourceLibraryAudience[];
  category: "LESSON" | "EXERCISE" | "READING" | "REFERENCE";
  title: string;
  summary: string;
  content: string;
  grade: string;
  subject: string;
  tags: string[];
  sourceLabel: string;
  ownerId: string;
  ownerRole: "机构负责人";
  ownerLabel: string;
  status: ResourceLibraryStatus;
  expiresOn: string;
  updatedBy: string;
  updatedAt: string;
  learningSourceGovernance?: LearningSourceGovernance;
}

export interface ResourceLibraryFilter {
  query?: string;
  grade?: string;
  subject?: string;
  tag?: string;
}

export interface ResourceLibraryProjection extends ResourceLibraryRecord {
  favorite: boolean;
  lastUsedAt?: string;
}

export interface ResourceLibraryUpdate {
  version: number;
  scope: ResourceLibraryScope;
  expiresOn: string;
  classId?: string;
  learningSourceAction?: "APPROVE" | "RETURN";
}

export interface ResourceLibrarySummary {
  total: number;
  published: number;
  expired: number;
  revoked: number;
}
