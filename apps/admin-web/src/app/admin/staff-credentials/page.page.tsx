import type { Metadata } from "next";
import Link from "next/link";
import { AdminShell } from "../../admin-shell";
import { StaffCredentialsPanel } from "./staff-credentials-panel";
import styles from "./staff-credentials.module.css";

export const metadata: Metadata = { title: "员工资格证照" };

type PageProps = Readonly<{
  searchParams: Promise<{ localServicePort?: string }>;
}>;

const LOCAL_SERVICE_PORTS = new Set(["4317", "4319"]);

export default async function StaffCredentialsPage({ searchParams }: PageProps) {
  const query = await searchParams;
  const port = process.env.TASK20_NEXT_ADMIN_SERVICE_PORT ?? query.localServicePort ?? "4317";
  const servicePort = LOCAL_SERVICE_PORTS.has(port) ? Number(port) : null;

  return (
    <AdminShell currentPath="/admin/staff-credentials">
      <main className={styles.page}>
        <Link className={styles.backLink} href="/admin/institution" prefetch={false}>
          返回机构概览
        </Link>
        <header className={styles.header}>
          <p className={styles.eyebrow}>员工管理 · 本机合成资料</p>
          <h1>员工资格证照</h1>
          <p>查看校区内固定示例资格材料，并维护签发与到期日期。</p>
          <p className={styles.notice}>
            资料仅用于本机演示，不上传证件或附件；到期提醒不会自动改变员工状态。
          </p>
        </header>
        {servicePort !== null ? (
          <StaffCredentialsPanel servicePort={servicePort} />
        ) : (
          <section className={styles.stateCard} role="alert">
            <h2>无法连接资格材料服务</h2>
            <p>当前服务地址不在允许的本机范围内。请从本机管理工作台重新打开页面。</p>
          </section>
        )}
      </main>
    </AdminShell>
  );
}
