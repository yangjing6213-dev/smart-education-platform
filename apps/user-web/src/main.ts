import {
  createSyntheticVisitorResponse,
  selectVisitorRoute,
  type VisitorRoute,
  // @ts-expect-error TS6142: this package intentionally keeps JSX-free .tsx page boundaries.
} from "./routes/visitor.routes.js";
import {
  selectStaffRoute,
  type StaffAccess,
  // @ts-expect-error TS6142: this package intentionally keeps JSX-free .tsx page boundaries.
} from "./routes/staff.routes.js";
import {
  projectStaffReport,
  // @ts-expect-error TS6142: this package intentionally keeps JSX-free .tsx page boundaries.
} from "./pages/staff-report.js";
import {
  projectStaffWorkbench,
  // @ts-expect-error TS6142: this package intentionally keeps JSX-free .tsx page boundaries.
} from "./pages/staff-workbench.js";
import {
  StaffGuidesPage,
  // @ts-expect-error TS6142: this package intentionally keeps JSX-free .tsx page boundaries.
} from "./pages/staff-guides.js";
import {
  TeachingResourcesPage,
  // @ts-expect-error TS6142: this package intentionally keeps JSX-free .tsx page boundaries.
} from "./pages/resources.js";

const root = document.querySelector<HTMLElement>("[data-app-root]");

if (root === null) {
  throw new Error("User-web application root is missing");
}
const appRoot = root;

const response = createSyntheticVisitorResponse();
const syntheticStaffAccess: StaffAccess = {
  session: "synthetic-staff-session",
  membership: "active",
  role: "teacher",
  capabilities: ["employee:workbench", "teacher:summary"],
  tenantId: "tenant-synthetic-a",
  campusId: "campus-synthetic-east",
};

const syntheticStaffTasks = [
  {
    id: "task-synthetic-1",
    tenantId: syntheticStaffAccess.tenantId,
    campusId: syntheticStaffAccess.campusId,
    status: "published" as const,
    title: "模拟数据：完成交接清单",
    dueLabel: "今天",
  },
];

const syntheticStaffResources = [
  {
    id: "guide-synthetic-1",
    tenantId: syntheticStaffAccess.tenantId,
    campusId: syntheticStaffAccess.campusId,
    status: "published" as const,
    title: "模拟数据：今日带班指南",
    summary: "仅展示当前校区的工作提示。",
    kind: "guide" as const,
  },
];

function render(): void {
  const internalPage = renderInternalPage(window.location.pathname);
  if (internalPage !== null) {
    appRoot.replaceChildren(document.createRange().createContextualFragment(internalPage));
    setupRevealAnimations();
    return;
  }

  const route = selectVisitorRoute({
    path: window.location.pathname,
    response,
  });
  appRoot.replaceChildren(document.createRange().createContextualFragment(renderShell(route)));
  setupRevealAnimations();
}

function renderInternalPage(pathname: string): string | null {
  if (pathname === "/staff/workbench") {
    const route = selectStaffRoute(syntheticStaffAccess, "workbench");
    const view =
      route.kind === "authorized"
        ? projectStaffWorkbench({
            access: syntheticStaffAccess,
            state: "published",
            resources: syntheticStaffResources,
            tasks: syntheticStaffTasks,
          })
        : projectStaffWorkbench({
            access: undefined,
            state: "error",
            resources: [],
            tasks: [],
          });
    return renderInternalShell(view.html, view.heading);
  }

  if (pathname === "/staff/report") {
    const route = selectStaffRoute(syntheticStaffAccess, "report");
    const view = projectStaffReport({
      access: route.kind === "authorized" ? syntheticStaffAccess : undefined,
      state: "published",
      report:
        route.kind === "authorized"
          ? {
              tenantId: syntheticStaffAccess.tenantId,
              campusId: syntheticStaffAccess.campusId,
              status: "published" as const,
              summary: "模拟数据：今日教学摘要已准备好。",
            }
          : undefined,
    });
    return renderInternalShell(view.html, view.heading);
  }

  if (pathname === "/staff/guides") {
    const route = selectStaffRoute(syntheticStaffAccess, "guides");
    const view = StaffGuidesPage({ query: "", limit: 20 });
    return route.kind === "authorized"
      ? renderInternalShell(view.html, view.heading)
      : renderInternalShell("<main><h1>员工访问不可用</h1></main>", "新员工指南");
  }

  if (pathname === "/web/staff/resources") {
    const route = selectStaffRoute(syntheticStaffAccess, "resources");
    const view = TeachingResourcesPage({ query: "", limit: 20 });
    return route.kind === "authorized"
      ? renderInternalShell(view.html, view.heading)
      : renderInternalShell("<main><h1>员工访问不可用</h1></main>", "教学资源");
  }

  return null;
}

function renderInternalShell(content: string, heading: string): string {
  return `
    <header class="site-header internal-header">
      <div class="site-header-inner">
        <a class="brand" href="/visitor" aria-label="同芯托管访客首页">
          <img class="brand-logo" src="/assets/tongxin-logo.png" alt="同芯学园" />
        </a>
        <nav class="site-navigation internal-navigation" aria-label="员工导航">
          <a href="/visitor">访客首页</a>
          <a href="/staff/workbench" aria-current="${heading === "员工工作台" ? "page" : "false"}">工作台</a>
          <a href="/staff/report" aria-current="${heading === "每日报告" ? "page" : "false"}">每日报告</a>
          <a href="/staff/guides" aria-current="${heading === "新员工指南" ? "page" : "false"}">新员工指南</a>
          <a href="/web/staff/resources" aria-current="${heading === "教学资源" ? "page" : "false"}">教学资源</a>
        </nav>
        <span class="header-action internal-badge">模拟员工端</span>
      </div>
    </header>
    ${content}
    <footer id="site-footer" class="site-footer">
      <div class="site-footer-inner">
        <div class="footer-brand">
          <strong>同芯员工端</strong>
          <p class="footer-description">仅展示当前校区范围内的合成数据，不连接正式服务。</p>
        </div>
      </div>
    </footer>
  `;
}

function setupRevealAnimations(): void {
  const revealNodes = document.querySelectorAll<HTMLElement>("[data-reveal]");
  if (revealNodes.length === 0 || !("IntersectionObserver" in window)) {
    revealNodes.forEach((node) => node.classList.add("is-revealed"));
    return;
  }

  const observer = new IntersectionObserver(
    (entries, currentObserver) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) {
          return;
        }
        entry.target.classList.add("is-revealed");
        currentObserver.unobserve(entry.target);
      });
    },
    { rootMargin: "0px 0px -12%", threshold: 0.08 },
  );

  revealNodes.forEach((node) => observer.observe(node));
}

function renderShell(route: VisitorRoute): string {
  const navigation = `
    <header class="site-header">
      <div class="site-header-inner">
        <a class="brand" href="/visitor" aria-label="同芯托管访客首页">
          <img class="brand-logo" src="/assets/tongxin-logo.png" alt="同芯学园" />
        </a>
        <button class="menu-toggle" type="button" aria-label="菜单" aria-expanded="false" aria-controls="site-navigation">
          <span class="menu-toggle-icon" aria-hidden="true">＋</span>
        </button>
        <nav id="site-navigation" class="site-navigation" aria-label="主导航">
          <a href="/visitor" aria-current="${route.kind === "HOME" ? "page" : "false"}">首页</a>
          <a href="/visitor#about">关于我们</a>
          <a href="/visitor#visitor-empty-states">服务方向</a>
          <a href="/visitor#site-footer">联系我们</a>
        </nav>
        <a class="header-action" href="${route.kind === "CONTENT" ? "/visitor" : "/visitor#visitor-empty-states"}">家长咨询 <span aria-hidden="true">↗</span></a>
      </div>
    </header>
  `;

  return `
    ${navigation}
    ${route.view.html}
    <footer id="site-footer" class="site-footer">
      <div class="site-footer-inner">
        <div class="footer-brand">
          <a class="brand brand-footer" href="/visitor" aria-label="同芯托管访客首页">
            <img class="brand-logo" src="/assets/tongxin-logo.png" alt="同芯学园" />
          </a>
          <p class="footer-description">让每个孩子在放学后的时光里，继续学习、探索与成长。</p>
          <p class="footer-meta">全部内容均为模拟数据 · 访客端公开信息预览</p>
        </div>
        <div class="footer-column">
          <h2>快速导航</h2>
          <a href="/visitor">访客首页</a>
          <a href="/visitor#about">关于我们</a>
          <a href="/visitor#visitor-empty-states">服务状态</a>
        </div>
        <div class="footer-column">
          <h2>服务方向</h2>
          <span>课后托管</span>
          <span>兴趣探索</span>
          <span>成长陪伴</span>
        </div>
        <div class="footer-column footer-contact">
          <h2>联系我们</h2>
          <span>家长咨询 · 模拟入口</span>
          <span>信息准备好后公开呈现</span>
          <a href="/visitor#site-footer">查看访客信息</a>
        </div>
      </div>
      <div class="footer-bottom">
        <span>同芯托管 · 模拟数据</span>
        <span>© 2026 同芯托管</span>
      </div>
    </footer>
  `;
}

document.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof Element)) {
    return;
  }

  const link = target.closest<HTMLAnchorElement>("a");
  if (link === null || link.origin !== window.location.origin || !link.pathname.startsWith("/")) {
    return;
  }

  const isHashOnly = link.pathname === window.location.pathname && link.hash !== "";
  if (isHashOnly) {
    return;
  }

  event.preventDefault();
  window.history.pushState({}, "", `${link.pathname}${link.search}${link.hash}`);
  render();
  if (link.hash !== "") {
    document.querySelector(link.hash)?.scrollIntoView({ block: "start" });
  }
});

document.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof Element)) {
    return;
  }

  const toggle = target.closest<HTMLButtonElement>(".menu-toggle");
  if (toggle === null) {
    return;
  }

  const navigation = document.querySelector<HTMLElement>("#site-navigation");
  if (navigation === null) {
    return;
  }

  const expanded = toggle.getAttribute("aria-expanded") === "true";
  toggle.setAttribute("aria-expanded", String(!expanded));
  navigation.toggleAttribute("data-open", !expanded);
});

document.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof Element) || target.closest(".menu-toggle") !== null) {
    return;
  }

  const navigation = document.querySelector<HTMLElement>("#site-navigation");
  const toggle = document.querySelector<HTMLButtonElement>(".menu-toggle");
  if (navigation?.hasAttribute("data-open") && target.closest("#site-navigation a") !== null) {
    navigation.removeAttribute("data-open");
    toggle?.setAttribute("aria-expanded", "false");
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") {
    return;
  }
  const navigation = document.querySelector<HTMLElement>("#site-navigation");
  const toggle = document.querySelector<HTMLButtonElement>(".menu-toggle");
  navigation?.removeAttribute("data-open");
  toggle?.setAttribute("aria-expanded", "false");
});

window.addEventListener("popstate", render);
render();
