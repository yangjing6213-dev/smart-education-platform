import type { Metadata } from "next";
import Link from "next/link";
import { AdminShell } from "../../admin-shell";
import { StaffMembersPanel } from "./staff-members-panel";
import styles from "./staff-members.module.css";

export const metadata: Metadata = { title: "员工账号" };

type PageProps = Readonly<{
  searchParams: Promise<{ localServicePort?: string }>;
}>;

export default async function StaffMembersPage({ searchParams }: PageProps) {
  const query = await searchParams;
  const port = process.env.TASK20_NEXT_ADMIN_SERVICE_PORT ?? query.localServicePort ?? "4317";
  const servicePort = port === "4317" || port === "4319" ? Number(port) : null;

  return (
    <AdminShell currentPath="/admin/staff">
      <div className={styles.page}>
        <Link className={styles.backLink} href="/admin/institution" prefetch={false}>
          返回机构概览
        </Link>
        <header className={styles.header}>
          <p className={styles.eyebrow}>员工与成员范围 · 本机合成数据</p>
          <h1>员工账号</h1>
          <p>查看获授权校区的模拟员工，并管理成员账号状态。</p>
          <p className={styles.notice}>
            这里不创建真实账号，也不连接真实登录服务；岗位与授权范围由固定的本机示例资料提供。
          </p>
        </header>
        {servicePort !== null ? (
          <StaffMembersPanel servicePort={servicePort} />
        ) : (
          <section className={styles.stateCard} role="alert">
            <h2>无法连接成员服务</h2>
            <p>当前服务地址不在允许的本机范围内，请从本机管理工作台重新打开此页面。</p>
          </section>
        )}
      </div>
    </AdminShell>
  );
}
