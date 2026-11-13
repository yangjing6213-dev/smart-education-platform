import type { Metadata } from "next";
import { AdminShell } from "../../admin-shell";
import { ResourcesPanel } from "./resources-panel";

export const metadata: Metadata = { title: "资源管理" };

export default function ResourcesPage() {
  const port = process.env.TASK20_NEXT_ADMIN_SERVICE_PORT ?? "4319";
  const baseUrl = port === "4319" ? `http://127.0.0.1:${port}` : null;

  return (
    <AdminShell currentPath="/admin/resources">
      {baseUrl ? (
        <ResourcesPanel baseUrl={baseUrl} />
      ) : (
        <section className="pickup-review" aria-labelledby="resources-unavailable-title">
          <header className="pickup-review-header">
            <p className="pickup-review-eyebrow">资源管理 · 本机合成数据</p>
            <h1 id="resources-unavailable-title">资源管理暂不可用</h1>
            <p>当前服务地址不在允许的本机范围内，请从本机管理工作台重新打开此页面。</p>
          </header>
        </section>
      )}
    </AdminShell>
  );
}
