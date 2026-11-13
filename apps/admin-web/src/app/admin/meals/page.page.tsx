import type { Metadata } from "next";
import { AdminShell } from "../../admin-shell";
import { MealsPanel } from "./meals-panel";

export const metadata: Metadata = { title: "餐食内容管理" };

export default function MealsPage() {
  return (
    <AdminShell currentPath="/admin/meals">
      <MealsPanel />
    </AdminShell>
  );
}
