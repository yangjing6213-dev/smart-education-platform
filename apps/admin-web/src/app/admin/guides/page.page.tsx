import type { Metadata } from "next";
import { AdminShell } from "../../admin-shell";
import { GuidesPanel } from "./guides-panel";
import { StaffLibraryPanel } from "../staff-library-panel";
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "内部指南" };

export default function AdminGuidesPage() {
  return (
    <AdminShell currentPath="/admin/guides">
      {process.env.TASK20_NEXT_ADMIN_SERVICE_PORT === "4319" &&
      !process.env.ADMIN_WEB_NEST_API_BASE_URL ? (
        <GuidesPanel />
      ) : (
        <StaffLibraryPanel kind="GUIDE" />
      )}
    </AdminShell>
  );
}
