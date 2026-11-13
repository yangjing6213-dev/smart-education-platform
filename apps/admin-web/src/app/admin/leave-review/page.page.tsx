import type { Metadata } from "next";
import { AdminShell } from "../../admin-shell";
import { LeaveReviewPanel } from "./leave-review-panel";

export const metadata: Metadata = { title: "请假审核" };

export default function LeaveReviewPage() {
  return (
    <AdminShell currentPath="/admin/leave-review">
      <LeaveReviewPanel />
    </AdminShell>
  );
}
