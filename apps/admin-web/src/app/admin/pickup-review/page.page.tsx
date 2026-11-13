import type { Metadata } from "next";
import { AdminShell } from "../../admin-shell";
import { PickupReviewPanel } from "./pickup-review-panel";

export const metadata: Metadata = { title: "接送异常处理" };

type PageProps = Readonly<{ searchParams: Promise<{ localServicePort?: string }> }>;
const LOCAL_SERVICE_PORTS = new Set(["4317", "4319"]);

export default async function PickupReviewPage({ searchParams }: PageProps) {
  const query = await searchParams;
  const port = process.env.TASK20_NEXT_ADMIN_SERVICE_PORT ?? query.localServicePort ?? "4319";
  const baseUrl = LOCAL_SERVICE_PORTS.has(port) ? `http://127.0.0.1:${port}` : null;
  return (
    <AdminShell currentPath="/admin/pickup-review">
      {baseUrl ? (
        <PickupReviewPanel baseUrl={baseUrl} />
      ) : (
        <section aria-labelledby="pickup-review-unavailable" className="pickup-review">
          <header className="pickup-review-header">
            <p className="pickup-review-eyebrow">接送协作 · 本机合成数据</p>
            <h1 id="pickup-review-unavailable">无法连接接送处理服务</h1>
            <p>服务地址不在允许的本机范围内。请从本机管理工作台重新打开此页面。</p>
          </header>
        </section>
      )}
    </AdminShell>
  );
}
