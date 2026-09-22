import {
  createSyntheticVisitorResponse,
  openVisitorContent,
} from "../../../src/navigation/routes.ts";
import { renderVisitorContent } from "../../../src/pages/visitor/content.ts";
import type { VisitorPageState } from "../../../src/pages/visitor/home.ts";

declare function Page<T>(options: T): void;

interface ContentPageData {
  readonly state: VisitorPageState;
  readonly statusAnnouncement: string;
  readonly title: string;
  readonly summary: string;
  readonly body: readonly string[];
  readonly isLoading: boolean;
  readonly isEmpty: boolean;
  readonly isError: boolean;
  readonly isPublished: boolean;
}

interface ContentPageOptions {
  readonly contentKey?: string;
}

interface ContentPage {
  data: ContentPageData;
  setData(data: Partial<ContentPageData>): void;
  onLoad(options?: ContentPageOptions): void;
  handleBack(): void;
}

interface MiniProgramApi {
  navigateBack(options: { delta: number; fail: () => void }): void;
  reLaunch(options: { url: string }): void;
}

declare const wx: MiniProgramApi;

function emptyContentData(): ContentPageData {
  return {
    state: "ERROR",
    statusAnnouncement: "公开内容暂不可用",
    title: "公开内容不可用",
    summary: "请返回访客首页查看已确认的信息。",
    body: [],
    isLoading: false,
    isEmpty: false,
    isError: true,
    isPublished: false,
  };
}

function contentData(contentKey: string | undefined): ContentPageData {
  const decodedKey = decodeContentKey(contentKey);
  const navigation = openVisitorContent(decodedKey);
  if (navigation.contentKey === undefined) {
    return emptyContentData();
  }

  const view = renderVisitorContent(
    createSyntheticVisitorResponse(),
    navigation.contentKey,
    "PUBLISHED",
  );
  const state = view.state;

  return {
    state,
    statusAnnouncement: view.statusAnnouncement,
    title: view.item?.title ?? "公开内容不可用",
    summary: view.item?.summary ?? "请返回访客首页查看已确认的信息。",
    body: view.item?.body ?? [],
    isLoading: state === "LOADING",
    isEmpty: state === "EMPTY",
    isError: state === "ERROR",
    isPublished: state === "PUBLISHED",
  };
}

function decodeContentKey(value: string | undefined): string {
  try {
    return decodeURIComponent(value ?? "");
  } catch {
    return "";
  }
}

const contentPage: ContentPage = {
  data: emptyContentData(),

  setData(data) {
    this.data = { ...this.data, ...data };
  },

  onLoad(options) {
    this.setData(contentData(options?.contentKey));
  },

  handleBack() {
    wx.navigateBack({
      delta: 1,
      fail() {
        wx.reLaunch({ url: "/pages/visitor/home/index" });
      },
    });
  },
};

Page(contentPage);
