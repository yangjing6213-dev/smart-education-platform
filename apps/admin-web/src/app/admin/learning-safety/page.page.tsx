import type { Metadata } from "next";
import { AdminShell } from "../../admin-shell";
import { LearningSafetyPanel } from "./learning-safety-panel";
import styles from "./learning-safety.module.css";

export const metadata: Metadata = { title: "学习安全汇总" };
export const dynamic = "force-dynamic";

export default function LearningSafetyPage() {
  const servicePort =
    process.env.TASK20_NEXT_ADMIN_SERVICE_PORT === "4319" ? 4319 : null;

  return (
    <AdminShell currentPath="/admin/learning-safety">
      <div className={styles.page}>
        <header className={styles.header}>
          <p className={styles.eyebrow}>平台管理 · 本机合成汇总</p>
          <h1>学习安全汇总</h1>
          <p>仅查看匿名指标，不含学生、班级或学习会话明细。</p>
        </header>
        {servicePort ? (
          <LearningSafetyPanel baseUrl={`http://127.0.0.1:${servicePort}`} />
        ) : (
          <p className={styles.status} role="status">
            本机汇总服务暂不可用；未显示任何学习指标。
          </p>
        )}
      </div>
    </AdminShell>
  );
}
