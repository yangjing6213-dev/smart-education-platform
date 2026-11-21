"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { projectIdentity } from "../../../local-synthetic/invite-session";
import styles from "../parent/leave/leave-panel.module.css";

export function StaffNavigation({
  active,
}: {
  readonly active:
    | "workbench"
    | "leave"
    | "care"
    | "care-review"
    | "daily"
    | "monthly"
    | "child-monthly"
    | "binding"
    | "resources"
    | "guides"
    | "pickup";
}) {
  const [navigationAccess, setNavigationAccess] = useState<{
    page: typeof active;
    monthly: boolean;
    pickup: boolean;
    library: boolean;
  } | null>(null);
  useEffect(() => {
    let disposed = false;
    const controller = new AbortController();
    async function readAccess(): Promise<void> {
      let monthly = false;
      let pickup = false;
      let library = false;
      try {
        const response = await fetch("/api-local/me", {
          credentials: "same-origin",
          cache: "no-store",
          redirect: "error",
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(5000)]),
        });
        if (!response.ok) throw new Error("Identity unavailable");
        const payload: unknown = await response.json();
        if (typeof payload !== "object" || payload === null || !("data" in payload))
          throw new Error("Identity unavailable");
        const hrefs = new Set(
          projectIdentity(payload.data).services.map((service) => service.href),
        );
        monthly = hrefs.has("/web/staff/monthly");
        pickup = hrefs.has("/web/staff/pickup");
        library = hrefs.has("/web/staff/resources");
      } catch {
        // Navigation stays closed without changing the user's login state.
      }
      if (!disposed) setNavigationAccess({ page: active, monthly, pickup, library });
    }
    void readAccess();
    return () => {
      disposed = true;
      controller.abort();
    };
  }, [active]);
  const libraryLinks =
    navigationAccess?.page === active && navigationAccess.library ? (
      <>
        <Link
          href="/web/staff/resources"
          prefetch={false}
          aria-current={active === "resources" ? "page" : undefined}
        >
          教学资源
        </Link>
        <Link
          href="/web/staff/guides"
          prefetch={false}
          aria-current={active === "guides" ? "page" : undefined}
        >
          新员工指南
        </Link>
      </>
    ) : null;
  if (active === "resources" || active === "guides") {
    return (
      libraryLinks && (
        <nav
          className={styles.sidebar}
          aria-label="员工服务"
          style={{ gridTemplateColumns: "repeat(auto-fit,minmax(100px,1fr))" }}
        >
          <p style={{ gridColumn: "1 / -1" }}>员工资料</p>
          {libraryLinks}
        </nav>
      )
    );
  }
  return (
    <nav className={styles.sidebar} aria-label="员工服务">
      <p>本机演示服务</p>
      <Link
        aria-current={active === "workbench" ? "page" : undefined}
        href="/web/staff/workbench"
        prefetch={false}
      >
        员工工作台
      </Link>
      <Link
        aria-current={active === "binding" ? "page" : undefined}
        href="/web/staff/binding"
        prefetch={false}
      >
        关系审核
      </Link>
      <Link
        aria-current={active === "daily" ? "page" : undefined}
        href="/web/staff/daily"
        prefetch={false}
      >
        工作日报
      </Link>
      {navigationAccess?.page === active && navigationAccess.monthly ? (
        <Link
          aria-current={active === "monthly" ? "page" : undefined}
          href="/web/staff/monthly"
          prefetch={false}
        >
          班级月度总结
        </Link>
      ) : null}
      {navigationAccess?.page === active && navigationAccess.monthly ? (
        <Link
          aria-current={active === "child-monthly" ? "page" : undefined}
          href="/web/staff/child-monthly"
          prefetch={false}
        >
          孩子个人月报
        </Link>
      ) : null}
      <Link
        aria-current={active === "care" ? "page" : undefined}
        href="/web/staff/care"
        prefetch={false}
      >
        成长记录
      </Link>
      <Link
        aria-current={active === "care-review" ? "page" : undefined}
        href="/web/staff/care-review"
        prefetch={false}
      >
        成长记录审核
      </Link>
      <Link
        aria-current={active === "leave" ? "page" : undefined}
        href="/web/staff/leave"
        prefetch={false}
      >
        请假审核
      </Link>
      {navigationAccess?.page === active && navigationAccess.pickup ? (
        <Link
          aria-current={active === "pickup" ? "page" : undefined}
          data-staff-pickup-navigation
          href="/web/staff/pickup"
          prefetch={false}
        >
          接送核验
        </Link>
      ) : null}
      {libraryLinks}
    </nav>
  );
}
