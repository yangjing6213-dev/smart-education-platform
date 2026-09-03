export interface MealEditorState {
  readonly mealId: string;
  readonly mealDate: string;
  readonly mealType: "BREAKFAST" | "LUNCH" | "SNACK" | "DINNER";
  readonly items: readonly string[];
  readonly notes: string;
  readonly version: number;
  readonly status: "DRAFT" | "PUBLISHED" | "UNPUBLISHED";
  readonly canPublish: boolean;
}

export interface MealEditorView {
  readonly route: "/admin/meals";
  readonly heading: "餐食内容管理";
  readonly saveAction: "保存草稿";
  readonly publishAction: "发布" | "需要发布权限";
  readonly state: MealEditorState;
}

export function MealsPage(state: MealEditorState): MealEditorView {
  return {
    route: "/admin/meals",
    heading: "餐食内容管理",
    saveAction: "保存草稿",
    publishAction: state.canPublish ? "发布" : "需要发布权限",
    state,
  };
}
