import type { Metadata } from "next";
import Link from "next/link";
import { AdminShell } from "../../admin-shell";
import { ChildMonthlyReviewPanel } from "./child-monthly-review-panel";
import styles from "../monthly-feedback-review/monthly-feedback-review.module.css";

export const metadata: Metadata = { title: "孩子月报审核" };

export default function ChildMonthlyReviewPage() {
  return (
    <AdminShell currentPath="/admin/child-monthly-review">
      <div className={styles.page}>
        <Link className={styles.backLink} href="/admin/institution" prefetch={false}>
          返回机构概览
        </Link>
        <header className={styles.header}>
          <p className={styles.eyebrow}>孩子个人月报 · 授权范围内处理</p>
          <h1>孩子月报审核</h1>
          <p>按孩子和月份查看来源数量与教师补充，确认或退回后，再单独发布给家长。</p>
          <p className={styles.notice}>
            请使用机构邀请账号登录。家长仅能查看获批绑定孩子的已发布月报。
          </p>
        </header>
        <ChildMonthlyReviewPanel />
      </div>
    </AdminShell>
  );
}
