import { AdminShell } from "../../admin-shell";
import { FeesPanel } from "./fees-panel";

export const metadata = { title: "费用管理" };

export default function FeesPage() {
  return (
    <AdminShell currentPath="/admin/fees">
      <FeesPanel />
    </AdminShell>
  );
}
