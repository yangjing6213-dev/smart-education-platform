import type { Metadata } from "next";
import { AdminShell } from "../../admin-shell";
import { NoticeReviewPanel } from "./notice-review-panel";

export const metadata: Metadata = { title: "通知审核与发布" };

export default function NoticeReviewPage() {
  return (
    <AdminShell currentPath="/admin/notice-review">
      <NoticeReviewPanel />
    </AdminShell>
  );
}
