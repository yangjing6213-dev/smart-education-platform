import type { Metadata } from "next";
import { AdminShell } from "../../admin-shell";
import { ConsentReviewPanel } from "./consent-review-panel";

export const metadata: Metadata = { title: "数据授权与期限复核" };

export default function ConsentReviewPage() {
  const port = process.env.TASK20_NEXT_ADMIN_SERVICE_PORT ?? "4319";
  const baseUrl = port === "4319" ? `http://127.0.0.1:${port}` : null;

  return (
    <AdminShell currentPath="/admin/consent-review">
      {baseUrl ? (
        <ConsentReviewPanel baseUrl={baseUrl} />
      ) : (
        <section aria-labelledby="consent-review-unavailable" className="pickup-review">
          <header className="pickup-review-header">
            <p className="pickup-review-eyebrow">授权期限复核 · 本机合成数据</p>
            <h1 id="consent-review-unavailable">数据授权复核暂不可用</h1>
            <p>当前服务地址不在允许的本机范围内，请从本机管理工作台重新打开此页面。</p>
          </header>
        </section>
      )}
    </AdminShell>
  );
}
