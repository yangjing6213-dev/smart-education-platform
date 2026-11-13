import type { Metadata } from "next";
import { AdminShell } from "../../admin-shell";
import { StaffOperationsPanel } from "./staff-operations-panel";
import styles from "./staff-operations.module.css";

export const metadata: Metadata = { title: "员工支持与招聘" };

export default function StaffOperationsPage() {
  return (
    <AdminShell currentPath="/admin/staff-operations">
      <main className={styles.page}>
        <header className={styles.header}>
          <p className={styles.eyebrow}>员工管理 · 模拟东校区</p>
          <h1>员工支持与招聘</h1>
          <p>记录工作材料、开展人工工作回顾，并维护招聘跟进进度。</p>
          <p className={styles.notice}>
            只显示固定模拟资料；本页变更保存在当前页面内存中，离开或刷新后重置。
          </p>
        </header>
        <StaffOperationsPanel />
      </main>
    </AdminShell>
  );
}
