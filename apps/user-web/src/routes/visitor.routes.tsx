// @ts-expect-error TS6142: this package intentionally keeps JSX-free .tsx page boundaries.
import { renderVisitorContent, type VisitorContentView } from "../pages/visitor-content.js";
import {
  renderVisitorHome,
  type PublicVisitorResponse,
  type VisitorHomeView,
  type VisitorPageState,
  // @ts-expect-error TS6142: this package intentionally keeps JSX-free .tsx page boundaries.
} from "../pages/visitor-home.js";

export interface VisitorRouteInput {
  readonly path: string;
  readonly response: PublicVisitorResponse;
  readonly state?: VisitorPageState;
}

export type VisitorRoute =
  | {
      readonly kind: "HOME";
      readonly view: VisitorHomeView;
    }
  | {
      readonly kind: "CONTENT";
      readonly view: VisitorContentView;
    };

export function createSyntheticVisitorResponse(): PublicVisitorResponse {
  return {
    items: [
      {
        slug: "welcome-to-synthetic-learning",
        title: "Synthetic learning welcome",
        summary: "A clearly simulated introduction to the visitor surface.",
        body: [
          "This long-form page contains simulated public learning information.",
          "Only content marked published and public is rendered here.",
        ],
        publicationStatus: "PUBLISHED",
        visibility: "PUBLIC",
        scope: "PUBLIC",
        syntheticData: "SIMULATED",
      },
      {
        slug: "private-staff-note",
        title: "Private staff note",
        summary: "This simulated private record must never appear in a public projection.",
        body: ["Private content is excluded before rendering."],
        publicationStatus: "PUBLISHED",
        visibility: "PRIVATE",
        scope: "PUBLIC",
        syntheticData: "SIMULATED",
      },
      {
        slug: "draft-preview",
        title: "Draft preview",
        summary: "This simulated draft must never appear in a public projection.",
        body: ["Draft content is excluded before rendering."],
        publicationStatus: "DRAFT",
        visibility: "PUBLIC",
        scope: "PUBLIC",
        syntheticData: "SIMULATED",
      },
      {
        slug: "foreign-public-item",
        title: "Foreign public item",
        summary: "This simulated foreign item must never appear in this projection.",
        body: ["Foreign scope content is excluded before rendering."],
        publicationStatus: "PUBLISHED",
        visibility: "PUBLIC",
        scope: "FOREIGN",
        syntheticData: "SIMULATED",
      },
    ],
  };
}

export function selectVisitorRoute(input: VisitorRouteInput): VisitorRoute {
  const normalizedPath = input.path.split("?")[0]?.replace(/\/+$/, "") || "/";
  if (normalizedPath === "/visitor") {
    return {
      kind: "HOME",
      view: renderVisitorHome(input.response, input.state),
    };
  }

  const contentPrefix = "/visitor/content/";
  if (normalizedPath.startsWith(contentPrefix)) {
    const slug = normalizedPath.slice(contentPrefix.length);
    return {
      kind: "CONTENT",
      view: renderVisitorContent(input.response, slug, input.state),
    };
  }

  return {
    kind: "CONTENT",
    view: renderVisitorContent(input.response, "", "ERROR"),
  };
}
