import type { Metadata } from "next";
import { AdminShell } from "../../admin-shell";
import { PlatformOperationsPanel, type PlatformOperationsMode } from "./platform-operations-panel";
import styles from "./platform-operations.module.css";

export const metadata: Metadata = { title: "平台运营" };

type PageProps = Readonly<{ searchParams: Promise<{ mode?: string }> }>;

function resolveMode(value: string | undefined): PlatformOperationsMode {
  if (value === "readonly") return "READ_ONLY";
  if (value === "denied") return "DENIED";
  if (value === "conflict") return "CONFLICT";
  return "AUTHORIZED";
}

export default async function PlatformOperationsPage({ searchParams }: PageProps) {
  const query = await searchParams;
  const servicePort = process.env.TASK20_NEXT_ADMIN_SERVICE_PORT === "4319" ? 4319 : null;

  return (
    <AdminShell currentPath="/admin/platform-operations">
      <div className={styles.page}>
        <header className={styles.header}>
          <p className={styles.eyebrow}>平台管理 · 本机合成汇总</p>
          <h1>平台运营</h1>
          <p>查看匿名运营数量，维护模拟租户套餐与支持事项。</p>
          <p className={styles.notice}>
            仅用于本机演示，不连接真实机构服务；页面中的修改只保留在当前页面，刷新后恢复示例资料。
          </p>
        </header>
        <PlatformOperationsPanel mode={resolveMode(query.mode)} servicePort={servicePort} />
      </div>
    </AdminShell>
  );
}
