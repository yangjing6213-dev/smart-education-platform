import type { Metadata } from "next";
import { AdminShell } from "../../admin-shell";
import { PublicTeachersPanel } from "./public-teachers-panel";

export const metadata: Metadata = { title: "教师介绍管理" };

export default function PublicTeachersPage() {
  return (
    <AdminShell currentPath="/admin/public-teachers">
      <PublicTeachersPanel />
    </AdminShell>
  );
}
