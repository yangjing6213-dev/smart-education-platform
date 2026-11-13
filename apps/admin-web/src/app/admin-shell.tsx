"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ADMIN_ROUTES } from "./admin-routes";

export function AdminShell({
  currentPath,
  children,
}: Readonly<{ currentPath: string; children: ReactNode }>) {
  const [isNavigationOpen, setNavigationOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isNavigationOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setNavigationOpen(false);
      toggleRef.current?.focus();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [isNavigationOpen]);

  return (
    <div className={`admin-layout${isNavigationOpen ? " nav-open" : ""}`}>
      <div className="mobile-navigation-bar">
        <button
          aria-controls="admin-navigation"
          aria-expanded={isNavigationOpen}
          aria-label={isNavigationOpen ? "关闭菜单" : "打开菜单"}
          className="nav-toggle"
          onClick={() => setNavigationOpen((open) => !open)}
          ref={toggleRef}
          type="button"
        >
          菜单
        </button>
      </div>
      {isNavigationOpen ? (
        <button
          aria-label="关闭导航菜单"
          className="drawer-backdrop"
          onClick={() => setNavigationOpen(false)}
          type="button"
        />
      ) : null}
      <aside className="admin-sidebar">
        <header className="admin-brand">
          <strong>机构管理工作台</strong>
          <span>同芯学园 · 管理端</span>
          <span className="preview-badge">Next.js 迁移预览</span>
        </header>
        <nav aria-label="机构管理页面" id="admin-navigation">
          {ADMIN_ROUTES.map(({ href, label }) => (
            <Link
              aria-current={currentPath === href ? "page" : undefined}
              className={currentPath === href ? "admin-nav-link active" : "admin-nav-link"}
              href={href}
              key={href}
              onClick={() => setNavigationOpen(false)}
              prefetch={false}
            >
              {label}
            </Link>
          ))}
        </nav>
      </aside>
      <main className="admin-main" id="main-content">
        {children}
      </main>
    </div>
  );
}
