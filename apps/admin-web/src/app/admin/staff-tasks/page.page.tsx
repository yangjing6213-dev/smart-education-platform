import type { Metadata } from "next";
import Link from "next/link";
import { AdminShell } from "../../admin-shell";
import { StaffTasksPanel } from "./staff-tasks-panel";
import styles from "./staff-tasks.module.css";

export const metadata: Metadata = { title: "任务分派与检查" };

export default function StaffTasksPage() {
  return (
    <AdminShell currentPath="/admin/staff-tasks">
      <div className={styles.page}>
        <Link className={styles.backLink} href="/admin/institution" prefetch={false}>
          返回机构概览
        </Link>
        <header className={styles.header}>
          <p className={styles.eyebrow}>员工任务 · 本机合成数据</p>
          <h1>任务分派与检查</h1>
          <p>为当前校区的员工分派任务，在员工提交完成结果后独立检查。提交结果不代表验收通过。</p>
          <p className={styles.notice}>
            请使用机构邀请账号登录，只可为当前授权班级分派任务。任务结果需由其他有权限的负责人检查。
          </p>
        </header>
        <StaffTasksPanel />
      </div>
    </AdminShell>
  );
}
