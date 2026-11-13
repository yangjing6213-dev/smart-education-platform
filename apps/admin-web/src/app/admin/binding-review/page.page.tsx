import type { Metadata } from "next";
import { AdminShell } from "../../admin-shell";
import { AdminBindingReviewPanel } from "./binding-review-panel";

export const metadata: Metadata = { title: "家长关系审核" };

export default function BindingReviewPage() {
  return (
    <AdminShell currentPath="/admin/binding-review">
      <AdminBindingReviewPanel />
    </AdminShell>
  );
}
