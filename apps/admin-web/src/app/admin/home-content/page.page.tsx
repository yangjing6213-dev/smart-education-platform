import type { Metadata } from "next";
import { AdminShell } from "../../admin-shell";
import { HomeContentPanel } from "./home-content-panel";

export const metadata: Metadata = { title: "首页内容管理" };

export default function HomeContentRoute() {
  return (
    <AdminShell currentPath="/admin/home-content">
      <HomeContentPanel heading="首页内容管理" />
    </AdminShell>
  );
}
