export interface PublicTeacherEditorState {
  readonly profileId: string;
  readonly displayName: string;
  readonly headline: string;
  readonly subjects: readonly string[];
  readonly bio: string;
  readonly photoRef?: string;
  readonly version: number;
  readonly status: "DRAFT" | "PUBLISHED" | "UNPUBLISHED" | "CONFLICT";
  readonly canPublish: boolean;
}

export interface PublicTeacherEditorView {
  readonly route: "/admin/public-teachers";
  readonly heading: "教师介绍管理";
  readonly saveAction: "保存草稿";
  readonly publishAction: "发布" | "需要发布权限" | "版本冲突待处理";
  readonly unpublishAction: "下架" | "需要发布权限" | "版本冲突待处理";
  readonly state: PublicTeacherEditorState;
}

export function PublicTeacherIntroductionsPage(
  state: PublicTeacherEditorState,
): PublicTeacherEditorView {
  const hasConflict = state.status === "CONFLICT";
  return {
    route: "/admin/public-teachers",
    heading: "教师介绍管理",
    saveAction: "保存草稿",
    publishAction: hasConflict ? "版本冲突待处理" : state.canPublish ? "发布" : "需要发布权限",
    unpublishAction: hasConflict ? "版本冲突待处理" : state.canPublish ? "下架" : "需要发布权限",
    state,
  };
}
