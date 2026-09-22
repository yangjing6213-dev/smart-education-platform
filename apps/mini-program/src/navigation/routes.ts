import { renderVisitorContent, type VisitorContentView } from "../pages/visitor/content.ts";
import {
  renderVisitorHome,
  type PublicVisitorResponse,
  type VisitorHomeView,
  type VisitorPageState,
} from "../pages/visitor/home.ts";

export const VISITOR_ROUTES = {
  home: "pages/visitor/home",
  content: "pages/visitor/content",
} as const;

export interface VisitorNavigation {
  readonly route: (typeof VISITOR_ROUTES)[keyof typeof VISITOR_ROUTES];
  readonly contentKey?: string;
}

export interface VisitorRouteInput {
  readonly navigation: VisitorNavigation;
  readonly response: unknown;
  readonly state?: VisitorPageState;
}

export type VisitorRoute =
  | { readonly kind: "HOME"; readonly view: VisitorHomeView }
  | { readonly kind: "CONTENT"; readonly view: VisitorContentView };

export function openVisitorContent(contentKey: string): VisitorNavigation {
  return isSafeContentKey(contentKey)
    ? { route: VISITOR_ROUTES.content, contentKey }
    : { route: VISITOR_ROUTES.home };
}

export function backToVisitorHome(): VisitorNavigation {
  return { route: VISITOR_ROUTES.home };
}

export function selectVisitorRoute(input: VisitorRouteInput): VisitorRoute {
  if (input.navigation.route === VISITOR_ROUTES.home) {
    return {
      kind: "HOME",
      view: renderVisitorHome(input.response, input.state),
    };
  }

  return {
    kind: "CONTENT",
    view: renderVisitorContent(input.response, input.navigation.contentKey ?? "", input.state),
  };
}

export function createSyntheticVisitorResponse(): PublicVisitorResponse {
  return {
    items: [
      {
        slug: "welcome-to-synthetic-learning",
        title: "模拟学习欢迎",
        summary: "一条明确标注为模拟数据的公开介绍。",
        body: ["这是仅用于演示的公开学习内容。"],
        publicationStatus: "PUBLISHED",
        visibility: "PUBLIC",
        scope: "PUBLIC",
        syntheticData: "SIMULATED",
        freshnessStatus: "FRESH",
        enabledStatus: "ENABLED",
      },
    ],
  };
}

function isSafeContentKey(contentKey: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(contentKey);
}
