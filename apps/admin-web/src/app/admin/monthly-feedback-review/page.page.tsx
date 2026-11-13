import type { Metadata } from "next";
import Link from "next/link";
import { AdminShell } from "../../admin-shell";
import { MonthlyFeedbackReviewPanel } from "./monthly-feedback-review-panel";
import styles from "./monthly-feedback-review.module.css";

export const metadata: Metadata = { title: "班级月度总结审核" };

export default function MonthlyFeedbackReviewPage() {
  return (
    <AdminShell currentPath="/admin/monthly-feedback-review">
      <main className={styles.page}>
        <Link className={styles.backLink} href="/admin/institution" prefetch={false}>
          返回机构概览
        </Link>
        <header className={styles.header}>
          <p className={styles.eyebrow}>班级内部总结 · 授权范围内处理</p>
          <h1>班级月度总结审核</h1>
          <p>查看班级月度来源数量及员工补充，确认或退回后，再单独内部发布。</p>
          <p className={styles.notice}>
            请使用机构邀请账号登录。总结仅供员工内部使用，家长不可见。
          </p>
        </header>
        <MonthlyFeedbackReviewPanel />
      </main>
    </AdminShell>
  );
}
