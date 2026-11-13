import type { Metadata } from "next";
import { AdminShell } from "../../admin-shell";
import { AccountPanel } from "./account-panel";

export const metadata: Metadata = { title: "我的账号" };

export default function AdminAccountPage() {
  return (
    <AdminShell currentPath="/admin/account">
      <AccountPanel />
    </AdminShell>
  );
}
