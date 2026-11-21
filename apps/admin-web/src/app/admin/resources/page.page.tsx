import type { Metadata } from "next";
import { AdminShell } from "../../admin-shell";
import { ResourcesPanel } from "./resources-panel";
import { StaffLibraryPanel } from "../staff-library-panel";
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "资源管理" };

export default function ResourcesPage() {
  const localPreview =
    process.env.TASK20_NEXT_ADMIN_SERVICE_PORT === "4319" &&
    !process.env.ADMIN_WEB_NEST_API_BASE_URL;

  return (
    <AdminShell currentPath="/admin/resources">
      {localPreview ? (
        <ResourcesPanel baseUrl="http://127.0.0.1:4319" />
      ) : (
        <StaffLibraryPanel kind="RESOURCE" />
      )}
    </AdminShell>
  );
}
