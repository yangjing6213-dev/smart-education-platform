import type { Metadata } from "next";
import { AdminShell } from "../../admin-shell";
import { HomeContentPanel } from "../home-content/home-content-panel";

export const metadata: Metadata = { title: "发布与下架管理" };

export default function PublishingRoute() {
  return (
    <AdminShell currentPath="/admin/publishing">
      <HomeContentPanel heading="发布与下架管理" />
    </AdminShell>
  );
}
