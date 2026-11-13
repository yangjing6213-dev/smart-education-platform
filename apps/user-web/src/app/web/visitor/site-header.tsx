"use client";

import { useEffect, useState } from "react";

export type VisitorSection =
  | "login"
  | "home"
  | "institution"
  | "day-flow"
  | "parent-learning"
  | "parent-binding"
  | "parent-home"
  | "parent-fees"
  | "parent-monthly"
  | "parent-pickup"
  | "parent-leave"
  | "staff-care"
  | "staff-workbench"
  | "staff-leave"
  | "account";

const links: readonly {
  readonly href: string;
  readonly label: string;
  readonly section?: VisitorSection;
}[] = [
  { href: "/visitor", label: "首页", section: "home" },
  { href: "/web/visitor/institution", label: "机构介绍", section: "institution" },
  { href: "/web/visitor/day-flow", label: "一日流程", section: "day-flow" },
  { href: "/web/parent/learning", label: "学习摘要", section: "parent-learning" },
  { href: "/web/parent/home", label: "家长服务", section: "parent-home" },
  { href: "/web/staff/workbench", label: "员工服务", section: "staff-workbench" },
  { href: "/visitor#visitor-empty-states", label: "服务方向" },
  { href: "/visitor#contact-intent", label: "联系我们" },
  { href: "/web/login", label: "账号登录", section: "login" },
  { href: "/web/account", label: "我的账号", section: "account" },
];

export function SiteHeader({ active }: { readonly active: VisitorSection }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, []);

  return (
    <header className="site-header">
      <div className="site-header-inner">
        <a className="brand" href="/visitor" aria-label="同芯学园访客首页">
          <img className="brand-logo" src="/assets/tongxin-logo.png" alt="同芯学园" />
        </a>
        <button
          className="menu-toggle"
          type="button"
          aria-label="菜单"
          aria-expanded={open}
          aria-controls="site-navigation"
          onClick={() => setOpen((value) => !value)}
        >
          <span className="menu-toggle-icon" aria-hidden="true">
            {open ? "×" : "＋"}
          </span>
        </button>
        <nav
          id="site-navigation"
          className="site-navigation"
          aria-label="主导航"
          data-open={open ? "" : undefined}
        >
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              aria-current={link.section === active ? "page" : undefined}
              onClick={() => setOpen(false)}
            >
              {link.label}
            </a>
          ))}
        </nav>
        <a
          className="header-action"
          href={active === "home" ? "#contact-intent" : "/visitor#contact-intent"}
        >
          了解更多 <span aria-hidden="true">↗</span>
        </a>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer id="site-footer" className="site-footer">
      <div className="site-footer-inner">
        <div className="footer-brand">
          <a className="brand brand-footer" href="/visitor" aria-label="返回同芯学园访客首页">
            <img className="brand-logo" src="/assets/tongxin-logo.png" alt="同芯学园" />
          </a>
          <p className="footer-description">页面中的机构、人员、菜单和流程均为虚构示例。</p>
        </div>
      </div>
    </footer>
  );
}
