import { HomeContentPage, type HomeContentEditorState } from "./pages/home-content.js";

const initialState: HomeContentEditorState = {
  contentKey: "home-announcement",
  title: "春季托管服务公告",
  summary: "面向访客展示的模拟首页内容，发布前仅供机构管理员预览。",
  blocks: [
    { kind: "TEXT", text: "本内容仅使用模拟数据。" },
    { kind: "LINK_REF", text: "查看服务说明", href: "/synthetic-services" },
  ],
  version: 3,
  status: "DRAFT",
  canPublish: true,
};

const root = document.querySelector<HTMLDivElement>("#app");
if (root === null) throw new Error("Admin web root is missing.");
const appRoot = root;

let state = initialState;
let notice = "草稿尚未发布";

function element<T extends keyof HTMLElementTagNameMap>(tagName: T, className?: string) {
  const element = document.createElement(tagName);
  if (className !== undefined) element.className = className;
  return element;
}

function render(): void {
  const view = HomeContentPage(state);
  document.title = view.heading;
  appRoot.replaceChildren();

  const shell = element("div", "shell");
  const topbar = element("header", "topbar");
  const brand = element("strong", "brand");
  brand.textContent = "机构管理工作台";
  const scope = element("span");
  scope.textContent = "模拟租户 · 当前校区";
  topbar.append(brand, scope);

  const main = element("main");
  const headingRow = element("div", "heading-row");
  const heading = element("div");
  const title = element("h1");
  title.textContent = view.heading;
  const subtitle = element("p");
  subtitle.textContent = "编辑、预览并控制首页内容的发布状态";
  heading.append(title, subtitle);
  const status = element("div", "status");
  status.textContent = notice;
  headingRow.append(heading, status);

  const workspace = element("div", "workspace");
  const editorPanel = element("section", "panel");
  const editorTitle = element("h2");
  editorTitle.textContent = "内容编辑";
  const titleField = element("div", "field");
  const titleLabel = element("label");
  titleLabel.textContent = "标题";
  const contentTitle = element("strong");
  contentTitle.textContent = view.state.title;
  titleField.append(titleLabel, contentTitle);
  const summaryField = element("div", "field");
  const summaryLabel = element("label");
  summaryLabel.textContent = "摘要";
  const summary = element("p", "summary");
  summary.textContent = view.state.summary;
  summaryField.append(summaryLabel, summary);
  const blocksField = element("div", "field");
  const blocksLabel = element("label");
  blocksLabel.textContent = "内容区块";
  const blocks = element("ul", "block-list");
  for (const block of view.state.blocks) {
    const item = element("li");
    const kind = element("span", "block-kind");
    kind.textContent = block.kind;
    const text = element("span");
    text.textContent = block.text;
    item.append(kind, text);
    blocks.append(item);
  }
  blocksField.append(blocksLabel, blocks);
  editorPanel.append(editorTitle, titleField, summaryField, blocksField);

  const actionPanel = element("aside", "panel");
  const actionTitle = element("h2");
  actionTitle.textContent = "发布控制";
  const meta = element("dl", "meta");
  const version = element("div");
  const versionLabel = element("dt");
  versionLabel.textContent = "版本";
  const versionValue = element("dd");
  versionValue.textContent = `v${view.state.version}`;
  version.append(versionLabel, versionValue);
  const stateRow = element("div");
  const stateLabel = element("dt");
  stateLabel.textContent = "状态";
  const stateValue = element("dd");
  stateValue.textContent = view.state.status;
  stateRow.append(stateLabel, stateValue);
  meta.append(version, stateRow);

  const actions = element("div", "actions");
  const save = element("button", "save");
  save.type = "button";
  save.textContent = view.saveAction;
  save.addEventListener("click", () => {
    state = { ...state, status: "DRAFT", version: state.version + 1 };
    notice = "草稿已保存";
    render();
  });
  const publish = element("button", "publish");
  publish.type = "button";
  publish.disabled = !state.canPublish;
  publish.textContent = view.publishAction;
  publish.addEventListener("click", () => {
    state = { ...state, status: "PUBLISHED", version: state.version + 1 };
    notice = "内容已发布";
    render();
  });
  actions.append(save, publish);
  const audit = element("p", "notice");
  audit.textContent = "发布动作使用模拟状态，不连接正式服务。";
  actionPanel.append(actionTitle, meta, actions, audit);

  workspace.append(editorPanel, actionPanel);
  main.append(headingRow, workspace);
  shell.append(topbar, main);
  appRoot.append(shell);
}

render();
