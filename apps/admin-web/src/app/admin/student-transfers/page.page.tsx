import { AdminShell } from "../../admin-shell";
import { StudentTransfersPanel } from "./student-transfers-panel";

export const metadata = { title: "学生转班审核" };

export default function StudentTransfersPage() {
  return (
    <AdminShell currentPath="/admin/student-transfers">
      <StudentTransfersPanel />
    </AdminShell>
  );
}
