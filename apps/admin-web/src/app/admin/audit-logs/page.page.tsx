import type { Metadata } from "next";
import { AdminShell } from "../../admin-shell";
import { AuditLogsPanel } from "./audit-logs-panel";

export const metadata: Metadata = { title: "审计日志" };

export default function AuditLogsPageRoute() {
  return (
    <AdminShell currentPath="/admin/audit-logs">
      <AuditLogsPanel />
    </AdminShell>
  );
}
