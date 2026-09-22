import {
  createSyntheticVisitorResponse,
  openVisitorContent,
} from "../../../src/navigation/routes.ts";
import { renderVisitorHome, type VisitorPageState } from "../../../src/pages/visitor/home.ts";

declare function Page<T>(options: T): void;

interface HomeCard {
  readonly contentKey: string;
  readonly title: string;
  readonly summary: string;
}

interface HomePageData {
  readonly state: VisitorPageState;
  readonly statusAnnouncement: string;
  readonly cards: readonly HomeCard[];
  readonly isLoading: boolean;
  readonly isEmpty: boolean;
  readonly isError: boolean;
  readonly isPublished: boolean;
}

interface HomeTapEvent {
  readonly currentTarget: {
    readonly dataset: { readonly contentKey?: string };
  };
}

interface HomePage {
  data: HomePageData;
  setData(data: Partial<HomePageData>): void;
  onLoad(): void;
  handleContentTap(event: HomeTapEvent): void;
}

interface MiniProgramApi {
  navigateTo(options: { url: string }): void;
}

declare const wx: MiniProgramApi;

function buildHomeData(): HomePageData {
  const view = renderVisitorHome(createSyntheticVisitorResponse(), "PUBLISHED");
  const state = view.state;

  return {
    state,
    statusAnnouncement: view.statusAnnouncement,
    cards: view.items.map((item) => ({
      contentKey: item.slug,
      title: item.title,
      summary: item.summary,
    })),
    isLoading: state === "LOADING",
    isEmpty: state === "EMPTY",
    isError: state === "ERROR",
    isPublished: state === "PUBLISHED",
  };
}

const homePage: HomePage = {
  data: buildHomeData(),

  setData(data) {
    this.data = { ...this.data, ...data };
  },

  onLoad() {
    this.setData(buildHomeData());
  },

  handleContentTap(event) {
    const navigation = openVisitorContent(event.currentTarget.dataset.contentKey ?? "");
    if (navigation.contentKey === undefined) {
      this.setData({
        state: "ERROR",
        statusAnnouncement: "公开内容暂不可用",
        isLoading: false,
        isEmpty: false,
        isError: true,
        isPublished: false,
      });
      return;
    }

    wx.navigateTo({
      url: `/pages/visitor/content/index?contentKey=${encodeURIComponent(navigation.contentKey)}`,
    });
  },
};

Page(homePage);
