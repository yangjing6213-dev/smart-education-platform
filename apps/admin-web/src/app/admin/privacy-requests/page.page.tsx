import type { Metadata } from "next";
import { AdminShell } from "../../admin-shell";
import { PrivacyRequestsPanel } from "./privacy-requests-panel";

export const metadata: Metadata = { title: "隐私申请审核" };

export default function PrivacyRequestsPage() {
  const port = process.env.TASK20_NEXT_ADMIN_SERVICE_PORT ?? "4319";
  const baseUrl = port === "4319" ? `http://127.0.0.1:${port}` : null;

  return (
    <AdminShell currentPath="/admin/privacy-requests">
      {baseUrl ? (
        <PrivacyRequestsPanel baseUrl={baseUrl} />
      ) : (
        <section aria-labelledby="privacy-review-unavailable" className="pickup-review">
          <header className="pickup-review-header">
            <p className="pickup-review-eyebrow">隐私申请 · 本机合成资料</p>
            <h1 id="privacy-review-unavailable">隐私申请审核暂不可用</h1>
            <p>当前地址不在允许的本机范围内，请从本机管理工作台重新打开此页面。</p>
          </header>
        </section>
      )}
    </AdminShell>
  );
}
