// @ts-expect-error TS6142: this package intentionally keeps JSX-free .tsx page boundaries.
import { renderVisitorContent, type PublicMealPageState, type VisitorContentView } from "../pages/visitor-content.js";
import {
  renderVisitorHome,
  type PublicVisitorResponse,
  type VisitorHomeView,
  type VisitorPageState,
  // @ts-expect-error TS6142: this package intentionally keeps JSX-free .tsx page boundaries.
} from "../pages/visitor-home.js";
import {
  renderVisitorInstitution,
  type VisitorInstitutionView,
  // @ts-expect-error TS6142: this package intentionally keeps JSX-free .tsx page boundaries.
} from "../pages/visitor-institution.js";
// @ts-expect-error TS6142: this package intentionally keeps JSX-free .tsx page boundaries.
import { renderVisitorDayFlow, type VisitorDayFlowView } from "../pages/visitor-day-flow.js";
import {
  createSyntheticPublicVerticalResponse,
  type PublicVerticalResponse,
} from "../pages/visitor-public-verticals.js";

export interface VisitorRouteInput {
  readonly path: string;
  readonly response: unknown;
  readonly state?: VisitorPageState;
  readonly publicMeals?: PublicMealPageState;
}

export type VisitorRoute =
  | {
      readonly kind: "HOME";
      readonly view: VisitorHomeView;
    }
  | {
      readonly kind: "CONTENT";
      readonly view: VisitorContentView;
    }
  | {
      readonly kind: "INSTITUTION";
      readonly view: VisitorInstitutionView;
    }
  | {
      readonly kind: "DAY_FLOW";
      readonly view: VisitorDayFlowView;
    };

export function createSyntheticVisitorResponse(): PublicVisitorResponse & {
  readonly publicVerticals: PublicVerticalResponse;
} {
  return {
    items: [
      {
        slug: "teacher-team",
        title: "教师团队",
        summary: "由陪伴者、引导者和沟通者共同完成每日照料。",
        body: [
          "这是仅用于演示的教师团队公开内容。",
          "页面示例会介绍团队分工、陪伴边界与家长沟通方式。",
        ],
        publicationStatus: "PUBLISHED",
        visibility: "PUBLIC",
        scope: "PUBLIC",
        syntheticData: "SIMULATED",
        freshnessStatus: "FRESH",
        enabledStatus: "ENABLED",
      },
      {
        slug: "seasonal-activities",
        title: "活动",
        summary: "给孩子留出动手、表达和合作的时间。",
        body: [
          "这是仅用于演示的活动公开内容。",
          "页面示例会围绕阅读分享、创意手作与科学小实验整理活动说明。",
        ],
        publicationStatus: "PUBLISHED",
        visibility: "PUBLIC",
        scope: "PUBLIC",
        syntheticData: "SIMULATED",
        freshnessStatus: "FRESH",
        enabledStatus: "ENABLED",
      },
      {
        slug: "meal-plan",
        title: "餐食 / 食谱",
        summary: "用清楚的餐食说明帮助家庭提前了解。",
        body: [
          "这是仅用于演示的餐食公开内容。",
          "页面示例会说明当日菜单、食材提示与饮水提醒的组成。",
        ],
        publicationStatus: "PUBLISHED",
        visibility: "PUBLIC",
        scope: "PUBLIC",
        syntheticData: "SIMULATED",
        freshnessStatus: "FRESH",
        enabledStatus: "ENABLED",
      },
      {
        slug: "environment-and-contact",
        title: "环境与联系",
        summary: "查看空间分区与模拟联系说明。",
        body: [
          "这是仅用于演示的环境与联系公开内容。",
          "页面示例会说明学习区、阅读区与活动区；联系信息仅作页面演示。",
        ],
        publicationStatus: "PUBLISHED",
        visibility: "PUBLIC",
        scope: "PUBLIC",
        syntheticData: "SIMULATED",
        freshnessStatus: "FRESH",
        enabledStatus: "ENABLED",
      },
      {
        slug: "private-staff-note",
        title: "模拟私密记录",
        summary: "这条模拟私密记录不得出现在公开投影中。",
        body: ["私密内容会在渲染前被排除。"],
        publicationStatus: "PUBLISHED",
        visibility: "PRIVATE",
        scope: "PUBLIC",
        syntheticData: "SIMULATED",
        freshnessStatus: "FRESH",
        enabledStatus: "ENABLED",
      },
      {
        slug: "draft-preview",
        title: "模拟草稿预览",
        summary: "这条模拟草稿不得出现在公开投影中。",
        body: ["草稿内容会在渲染前被排除。"],
        publicationStatus: "DRAFT",
        visibility: "PUBLIC",
        scope: "PUBLIC",
        syntheticData: "SIMULATED",
        freshnessStatus: "FRESH",
        enabledStatus: "ENABLED",
      },
      {
        slug: "foreign-public-item",
        title: "模拟外部内容",
        summary: "这条模拟外部内容不得出现在当前公开投影中。",
        body: ["外部范围内容会在渲染前被排除。"],
        publicationStatus: "PUBLISHED",
        visibility: "PUBLIC",
        scope: "FOREIGN",
        syntheticData: "SIMULATED",
        freshnessStatus: "FRESH",
        enabledStatus: "ENABLED",
      },
    ],
    publicVerticals: createSyntheticPublicVerticalResponse(),
  };
}

export function selectVisitorRoute(input: VisitorRouteInput): VisitorRoute {
  const normalizedPath = input.path.split("?")[0]?.replace(/\/+$/, "") || "/";
  if (normalizedPath === "/visitor" || normalizedPath === "/web/visitor/home") {
    return {
      kind: "HOME",
      view: renderVisitorHome(input.response, input.state),
    };
  }

  const publicVerticals =
    isRecord(input.response) && "publicVerticals" in input.response
      ? input.response.publicVerticals
      : undefined;
  if (normalizedPath === "/web/visitor/institution") {
    return {
      kind: "INSTITUTION",
      view: renderVisitorInstitution(publicVerticals, input.state),
    };
  }
  if (normalizedPath === "/web/visitor/day-flow") {
    return {
      kind: "DAY_FLOW",
      view: renderVisitorDayFlow(publicVerticals, input.state),
    };
  }

  const contentPrefix = "/visitor/content/";
  if (normalizedPath.startsWith(contentPrefix)) {
    const slug = normalizedPath.slice(contentPrefix.length);
    return {
      kind: "CONTENT",
      view: renderVisitorContent(input.response, slug, input.state, input.publicMeals),
    };
  }

  return {
    kind: "CONTENT",
    view: renderVisitorContent(input.response, "", "ERROR"),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
