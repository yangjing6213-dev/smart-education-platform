export interface PublicTeacherEditorState {
  readonly profileId: string;
  readonly displayName: string;
  readonly headline: string;
  readonly subjects: readonly string[];
  readonly bio: string;
  readonly photoRef?: string;
  readonly version: number;
  readonly status: "DRAFT" | "PUBLISHED" | "UNPUBLISHED";
  readonly canPublish: boolean;
}

export interface PublicTeacherEditorView {
  readonly route: "/admin/public-teachers";
  readonly heading: "教师介绍管理";
  readonly saveAction: "保存草稿";
  readonly publishAction: "发布" | "需要发布权限";
  readonly state: PublicTeacherEditorState;
}

export function PublicTeacherIntroductionsPage(
  state: PublicTeacherEditorState,
): PublicTeacherEditorView {
  return {
    route: "/admin/public-teachers",
    heading: "教师介绍管理",
    saveAction: "保存草稿",
    publishAction: state.canPublish ? "发布" : "需要发布权限",
    state,
  };
}
