import type { Metadata } from "next";
import { AdminShell } from "../../admin-shell";
import { ActivitiesPanel } from "./activities-panel";

export const metadata: Metadata = { title: "活动" };

export default function ActivitiesPage() {
  return (
    <AdminShell currentPath="/admin/activities">
      <ActivitiesPanel />
    </AdminShell>
  );
}
