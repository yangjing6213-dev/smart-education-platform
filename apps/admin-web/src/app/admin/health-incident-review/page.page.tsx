import type { Metadata } from "next";
import { AdminShell } from "../../admin-shell";
import { HealthIncidentReviewPanel } from "./health-incident-review-panel";

export const metadata: Metadata = { title: "健康异常审核与发布" };

export default function HealthIncidentReviewPage() {
  return (
    <AdminShell currentPath="/admin/health-incident-review">
      <HealthIncidentReviewPanel />
    </AdminShell>
  );
}
