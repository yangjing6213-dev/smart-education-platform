import type { Metadata } from "next";
import { AdminShell } from "../../admin-shell";
import { InstitutionOverviewPanel } from "./institution-overview-panel";
import { LearningInstitutionSettingPanel } from "./learning-institution-setting-panel";

export const metadata: Metadata = { title: "机构概览" };
export const dynamic = "force-dynamic";

export default function InstitutionOverviewPage() {
  return (
    <AdminShell currentPath="/admin/institution">
      <LearningInstitutionSettingPanel />
      <InstitutionOverviewPanel />
    </AdminShell>
  );
}
