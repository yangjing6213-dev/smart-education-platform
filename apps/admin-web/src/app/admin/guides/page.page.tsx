import type { Metadata } from "next";
import { AdminShell } from "../../admin-shell";
import { GuidesPanel } from "./guides-panel";

export const metadata: Metadata = { title: "内部指南" };

export default function AdminGuidesPage() {
  return (
    <AdminShell currentPath="/admin/guides">
      <GuidesPanel />
    </AdminShell>
  );
}
