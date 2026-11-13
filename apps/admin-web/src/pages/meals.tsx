export type MealType = "BREAKFAST" | "LUNCH" | "SNACK" | "DINNER";
export type MealStatus = "DRAFT" | "PUBLISHED" | "UNPUBLISHED" | "CONFLICT";
export type MealSortDirection = "ASC" | "DESC";

export interface MealEditorState {
  readonly mealId: string;
  readonly mealDate: string;
  readonly mealType: MealType;
  readonly items: readonly string[];
  readonly notes: string;
  readonly version: number;
  readonly status: MealStatus;
  readonly canPublish: boolean;
}

export interface MealAuditEntry {
  readonly id: number;
  readonly action: "SORT" | "SAVE_DRAFT" | "PUBLISH" | "UNPUBLISH";
  readonly mealId: string;
  readonly occurredAt: string;
}

export interface MealsPageState {
  readonly meals: readonly MealEditorState[];
  readonly selectedMealId: string | null;
  readonly sortDirection: MealSortDirection;
  readonly auditEntries: readonly MealAuditEntry[];
  readonly canEdit: boolean;
  readonly canPublish: boolean;
  readonly hasConflict: boolean;
}

export interface MealEditorView {
  readonly route: "/admin/meals";
  readonly heading: "餐食内容管理";
  readonly saveAction: "保存草稿";
  readonly publishAction: "发布" | "需要发布权限" | "版本冲突待处理";
  readonly unpublishAction: "下架" | "需要发布权限" | "版本冲突待处理";
  readonly meals: readonly MealEditorState[];
  readonly selectedMeal: MealEditorState | null;
  readonly sortDirection: MealSortDirection;
  readonly auditEntries: readonly MealAuditEntry[];
  readonly canEdit: boolean;
  readonly canPublish: boolean;
  readonly hasConflict: boolean;
}

const mealTypeOrder: Record<MealType, number> = {
  BREAKFAST: 0,
  LUNCH: 1,
  SNACK: 2,
  DINNER: 3,
};

function compareMeals(left: MealEditorState, right: MealEditorState): number {
  return (
    left.mealDate.localeCompare(right.mealDate) ||
    mealTypeOrder[left.mealType] - mealTypeOrder[right.mealType] ||
    left.mealId.localeCompare(right.mealId)
  );
}

export function MealsPage(state: MealsPageState): MealEditorView {
  const direction = state.sortDirection === "ASC" ? 1 : -1;
  const meals = [...state.meals].sort((left, right) => direction * compareMeals(left, right));
  const selectedMeal = meals.find((meal) => meal.mealId === state.selectedMealId) ?? null;

  return {
    route: "/admin/meals",
    heading: "餐食内容管理",
    saveAction: "保存草稿",
    publishAction: state.hasConflict
      ? "版本冲突待处理"
      : state.canPublish
        ? "发布"
        : "需要发布权限",
    unpublishAction: state.hasConflict
      ? "版本冲突待处理"
      : state.canPublish
        ? "下架"
        : "需要发布权限",
    meals,
    selectedMeal,
    sortDirection: state.sortDirection,
    auditEntries: [...state.auditEntries],
    canEdit: state.canEdit && !state.hasConflict,
    canPublish: state.canPublish && !state.hasConflict,
    hasConflict: state.hasConflict,
  };
}
