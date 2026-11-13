import type { Metadata } from "next";
import { AdminShell } from "../../admin-shell";
import { StatisticsPanel } from "./statistics-panel";

export const metadata: Metadata = { title: "运营统计" };

export default function StatisticsPage() {
  const port = process.env.TASK20_NEXT_ADMIN_SERVICE_PORT ?? "4319";
  const baseUrl = port === "4319" ? `http://127.0.0.1:${port}` : null;

  return (
    <AdminShell currentPath="/admin/statistics">
      {baseUrl ? (
        <StatisticsPanel baseUrl={baseUrl} />
      ) : (
        <section aria-labelledby="statistics-unavailable-title" className="pickup-review">
          <header className="pickup-review-header">
            <p className="pickup-review-eyebrow">运营统计 · 本机合成数据</p>
            <h1 id="statistics-unavailable-title">运营统计暂不可用</h1>
            <p>当前服务地址不在允许的本机范围内，请从本机管理工作台重新打开此页面。</p>
          </header>
        </section>
      )}
    </AdminShell>
  );
}
