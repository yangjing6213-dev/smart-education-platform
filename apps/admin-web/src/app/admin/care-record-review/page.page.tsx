import type { Metadata } from "next";
import { AdminShell } from "../../admin-shell";
import { CareRecordReviewPanel } from "./care-record-review-panel";

export const metadata: Metadata = { title: "成长记录审核与发布" };

export default function CareRecordReviewPage() {
  return (
    <AdminShell currentPath="/admin/care-record-review">
      <CareRecordReviewPanel />
    </AdminShell>
  );
}
