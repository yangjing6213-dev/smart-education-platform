"use client";

import { useEffect, useState } from "react";
import { InviteSessionClient } from "../local-synthetic/invite-session";

export default function HomePage() {
  const [message, setMessage] = useState("正在确认登录状态…");

  useEffect(() => {
    let active = true;
    let client: InviteSessionClient | undefined;
    const adminController = new AbortController();

    void (async () => {
      let adminSessionUnavailable = true;
      try {
        const response = await fetch("/api/admin/me", {
          credentials: "same-origin",
          cache: "no-store",
          redirect: "error",
          signal: AbortSignal.any([adminController.signal, AbortSignal.timeout(5000)]),
        });
        if (response.status === 401) {
          adminSessionUnavailable = false;
        } else if (response.ok) {
          const payload: unknown = await response.json();
          const data =
            typeof payload === "object" && payload !== null && "data" in payload
              ? payload.data
              : undefined;
          const hasActiveMembership =
            typeof data === "object" &&
            data !== null &&
            "memberships" in data &&
            Array.isArray(data.memberships) &&
            data.memberships.some(
              (membership: unknown) =>
                typeof membership === "object" &&
                membership !== null &&
                "status" in membership &&
                membership.status === "ACTIVE",
            );
          if (
            typeof data === "object" &&
            data !== null &&
            "display_name" in data &&
            typeof data.display_name === "string" &&
            hasActiveMembership
          ) {
            if (active) window.location.replace("/admin/institution");
            return;
          }
        }
      } catch {
        // Keep the root page from showing visitor content while admin identity is uncertain.
      }
      if (!active) return;

      client = new InviteSessionClient({ baseUrl: window.location.origin });
      await client.restore();
      if (!active) return;
      const session = client.snapshot;
      if (session.status === "IDLE") {
        if (adminSessionUnavailable) {
          setMessage("暂时无法确认管理端登录状态，请重试或重新登录。");
        } else {
          window.location.replace("/visitor");
        }
        return;
      }
      if (session.status === "READY") {
        const destination =
          session.services.find((service) => service.href === "/web/staff/workbench") ??
          session.services.find((service) => service.href === "/web/parent/home") ??
          session.services[0];
        if (destination) window.location.replace(destination.href);
        else window.location.replace("/web/login");
        return;
      }
      setMessage(
        session.status === "DENIED"
          ? "此账号尚未获准使用当前网页服务，请联系机构负责人。"
          : "暂时无法确认登录状态，请重试或重新登录。",
      );
    })();

    return () => {
      active = false;
      adminController.abort();
      client?.disconnect();
    };
  }, []);

  return (
    <main className="visitor-main" id="main-content">
      <section className="content-card" aria-labelledby="home-route-status">
        <h1 id="home-route-status">正在打开同芯学园</h1>
        <p role="status" aria-live="polite">
          {message}
        </p>
        {message !== "正在确认登录状态…" ? (
          <div className="button-row">
            <button
              className="button button-primary"
              type="button"
              onClick={() => window.location.reload()}
            >
              重新核对
            </button>
            <a className="button button-secondary" href="/web/login">
              账号登录
            </a>
            <a className="button button-secondary" href="/admin/login">
              管理端登录
            </a>
            <a className="button button-light" href="/visitor">
              以访客身份浏览
            </a>
          </div>
        ) : null}
      </section>
    </main>
  );
}
