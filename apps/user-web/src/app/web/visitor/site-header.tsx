"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

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

const visitorLinks: readonly {
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
];

const loginLinks: typeof visitorLinks = [
  { href: "/web/login", label: "账号服务", section: "login" },
];

const accountLinks: typeof visitorLinks = [
  { href: "/web/account", label: "我的账号", section: "account" },
];

const parentLinks: typeof visitorLinks = [
  { href: "/web/parent/home", label: "家长首页", section: "parent-home" },
  { href: "/web/account", label: "我的账号", section: "account" },
  { href: "/web/parent/learning", label: "学习摘要", section: "parent-learning" },
  { href: "/web/parent/binding", label: "关系绑定", section: "parent-binding" },
  { href: "/web/parent/fees", label: "费用资料", section: "parent-fees" },
  { href: "/web/parent/monthly", label: "月度反馈", section: "parent-monthly" },
  { href: "/web/parent/pickup", label: "接送安排", section: "parent-pickup" },
  { href: "/web/parent/leave", label: "请假申请", section: "parent-leave" },
];

const staffLinks: typeof visitorLinks = [
  { href: "/web/staff/workbench", label: "员工工作台", section: "staff-workbench" },
  { href: "/web/account", label: "我的账号", section: "account" },
  { href: "/web/staff/binding", label: "关系审核" },
  { href: "/web/staff/daily", label: "工作日报" },
  { href: "/web/staff/care", label: "成长记录", section: "staff-care" },
  { href: "/web/staff/care-review", label: "成长记录审核", section: "staff-care" },
  { href: "/web/staff/leave", label: "请假审核", section: "staff-leave" },
];

function homeForPath(pathname: string | null) {
  if (pathname === "/web/login") {
    return { href: "/web/login", ariaLabel: "同芯学园账号登录" };
  }
  if (pathname === "/web/account") {
    return { href: "/web/account", ariaLabel: "同芯学园我的账号" };
  }
  if (pathname?.startsWith("/web/parent/")) {
    return { href: "/web/parent/home", ariaLabel: "同芯学园家长首页" };
  }
  if (pathname?.startsWith("/web/staff/")) {
    return { href: "/web/staff/workbench", ariaLabel: "同芯学园员工工作台" };
  }
  return { href: "/visitor", ariaLabel: "同芯学园访客首页" };
}

export function SiteHeader({ active }: { readonly active: VisitorSection }) {
  const [open, setOpen] = useState(false);
  const isParent = active.startsWith("parent-");
  const isStaff = active.startsWith("staff-");
  const roleHome =
    active === "account"
      ? { href: "/web/account", label: "我的账号", ariaLabel: "同芯学园我的账号" }
      : isParent
        ? { href: "/web/parent/home", label: "家长首页", ariaLabel: "同芯学园家长首页" }
        : isStaff
          ? { href: "/web/staff/workbench", label: "员工工作台", ariaLabel: "同芯学园员工工作台" }
          : active === "login"
            ? { href: "/web/login", label: "账号登录", ariaLabel: "同芯学园账号登录" }
            : undefined;
  const links =
    active === "account"
      ? accountLinks
      : isParent
        ? parentLinks
        : isStaff
          ? staffLinks
          : active === "login"
            ? loginLinks
            : visitorLinks;

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
        <a
          className="brand"
          href={roleHome?.href ?? "/visitor"}
          aria-label={roleHome?.ariaLabel ?? "同芯学园访客首页"}
        >
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
          href={
            roleHome?.href ?? (active === "home" ? "#contact-intent" : "/visitor#contact-intent")
          }
        >
          {roleHome?.label ?? "了解更多"} <span aria-hidden="true">↗</span>
        </a>
      </div>
    </header>
  );
}

export function SiteFooter() {
  const pathname = usePathname();
  const home = homeForPath(pathname);
  return (
    <footer id="site-footer" className="site-footer">
      <div className="site-footer-inner">
        <div className="footer-brand">
          <a className="brand brand-footer" href={home.href} aria-label={`返回${home.ariaLabel}`}>
            <img className="brand-logo" src="/assets/tongxin-logo.png" alt="同芯学园" />
          </a>
          <p className="footer-description">
            机构介绍与企业文化采用机构提供的正式资料；业务演示数据按页面说明展示。
          </p>
        </div>
      </div>
    </footer>
  );
}
