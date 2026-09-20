import {
  createSyntheticVisitorResponse,
  selectVisitorRoute,
  type VisitorRoute,
  // @ts-expect-error TS6142: this package intentionally keeps JSX-free .tsx page boundaries.
} from "./routes/visitor.routes.js";

const root = document.querySelector<HTMLElement>("[data-app-root]");

if (root === null) {
  throw new Error("User-web application root is missing");
}
const appRoot = root;

const response = createSyntheticVisitorResponse();

function render(): void {
  const route = selectVisitorRoute({
    path: window.location.pathname,
    response,
  });
  appRoot.replaceChildren(document.createRange().createContextualFragment(renderShell(route)));
}

function renderShell(route: VisitorRoute): string {
  const navigation = `
    <header class="site-header">
      <div class="site-header-inner">
        <a class="brand" href="/visitor" aria-label="同芯托管访客首页">
          <span class="brand-mark" aria-hidden="true">同</span>
          <span class="brand-copy"><strong>同芯</strong><small>托管服务</small></span>
        </a>
        <button class="menu-toggle" type="button" aria-expanded="false" aria-controls="site-navigation">
          <span class="menu-toggle-label">菜单</span>
          <span class="menu-toggle-icon" aria-hidden="true">☰</span>
        </button>
        <nav id="site-navigation" class="site-navigation" aria-label="主导航">
          <a href="/visitor" aria-current="${route.kind === "HOME" ? "page" : "false"}">访客首页</a>
          <a href="/visitor#visitor-empty-states">服务状态</a>
          <a href="/visitor#site-footer">联系我们</a>
        </nav>
      </div>
    </header>
  `;

  return `
    ${navigation}
    ${route.view.html}
    <footer id="site-footer" class="site-footer">
      <div class="site-footer-inner">
        <div>
          <p class="eyebrow">同芯托管 · 模拟数据</p>
          <p class="footer-title">让家长看见每一步安心。</p>
        </div>
        <p class="footer-meta">访客端公开信息预览</p>
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

window.addEventListener("popstate", render);
render();
