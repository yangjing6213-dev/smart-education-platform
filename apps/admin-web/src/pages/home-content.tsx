export interface HomeContentEditorState {
  readonly contentKey: string;
  readonly title: string;
  readonly summary: string;
  readonly blocks: readonly {
    readonly kind: "TEXT" | "HEADING" | "IMAGE_REF" | "LINK_REF" | "LIST";
    readonly text: string;
    readonly href?: string;
  }[];
  readonly version: number;
  readonly status: "DRAFT" | "PUBLISHED" | "UNPUBLISHED" | "CONFLICT";
  readonly canPublish: boolean;
}

export interface HomeContentEditorView {
  readonly route: "/admin/institution/home";
  readonly heading: "首页内容管理";
  readonly saveAction: "保存草稿";
  readonly publishAction: "发布" | "需要发布权限" | "版本冲突待处理";
  readonly unpublishAction: "下架" | "需要发布权限" | "版本冲突待处理";
  readonly state: HomeContentEditorState;
}

export function HomeContentPage(state: HomeContentEditorState): HomeContentEditorView {
  const hasConflict = state.status === "CONFLICT";
  return {
    route: "/admin/institution/home",
    heading: "首页内容管理",
    saveAction: "保存草稿",
    publishAction: hasConflict ? "版本冲突待处理" : state.canPublish ? "发布" : "需要发布权限",
    unpublishAction: hasConflict ? "版本冲突待处理" : state.canPublish ? "下架" : "需要发布权限",
    state,
  };
}
