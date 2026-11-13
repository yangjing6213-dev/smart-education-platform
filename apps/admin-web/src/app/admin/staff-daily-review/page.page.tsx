import type { Metadata } from "next";
import Link from "next/link";
import { AdminShell } from "../../admin-shell";
import { StaffDailyReviewPanel } from "./staff-daily-review-panel";
import styles from "./staff-daily-review.module.css";

export const metadata: Metadata = { title: "员工工作日报" };

export default function StaffDailyReviewPage() {
  return (
    <AdminShell currentPath="/admin/staff-daily-review">
      <div className={styles.page}>
        <Link className={styles.backLink} href="/admin/institution" prefetch={false}>
          返回机构概览
        </Link>
        <header className={styles.header}>
          <p className={styles.eyebrow}>员工内部工作记录 · 本机合成数据</p>
          <h1>员工工作日报</h1>
          <p>负责人只查看授权校区与班级的待审核日报，可确认或退回修改。</p>
          <p className={styles.notice}>
            请使用机构邀请账号登录。仅可审核授权校区和班级内其他员工提交的日报，日报不会发布给家长。
          </p>
        </header>
        <StaffDailyReviewPanel />
      </div>
    </AdminShell>
  );
}
