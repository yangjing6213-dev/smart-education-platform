import type { Metadata } from "next";
import { AdminShell } from "../../admin-shell";
import { SupplyRequestReviewPanel } from "./supply-request-review-panel";

export const metadata: Metadata = { title: "物资申请审核" };

type PageProps = Readonly<{ searchParams: Promise<{ localServicePort?: string }> }>;
const LOCAL_SERVICE_PORTS = new Set(["4317", "4319"]);

export default async function SupplyRequestReviewPage({ searchParams }: PageProps) {
  const query = await searchParams;
  const port = process.env.TASK20_NEXT_ADMIN_SERVICE_PORT ?? query.localServicePort ?? "4319";
  const baseUrl = LOCAL_SERVICE_PORTS.has(port) ? `http://127.0.0.1:${port}` : null;
  return (
    <AdminShell currentPath="/admin/supply-request-review">
      {baseUrl ? (
        <SupplyRequestReviewPanel baseUrl={baseUrl} />
      ) : (
        <section aria-labelledby="supply-review-unavailable" className="supply-review">
          <header className="supply-review-header">
            <p className="supply-review-eyebrow">物资协作 · 本机合成数据</p>
            <h1 id="supply-review-unavailable">无法连接物资审核服务</h1>
            <p>服务地址不在允许的本机范围内。请从本机工作台重新打开此页面。</p>
          </header>
        </section>
      )}
    </AdminShell>
  );
}
