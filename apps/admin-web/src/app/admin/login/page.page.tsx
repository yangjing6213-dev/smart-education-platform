import type { Metadata } from "next";
import Link from "next/link";
import { AdminLoginPanel } from "./login-panel";
import styles from "./login-panel.module.css";

export const metadata: Metadata = { title: "管理端账号登录" };

export default function AdminLoginPage() {
  return (
    <main className={styles.page}>
      <section aria-labelledby="admin-login-title" className={styles.card}>
        <p className={styles.eyebrow}>同芯学园 · 机构管理</p>
        <h1 id="admin-login-title">管理端登录</h1>
        <p className={styles.intro}>使用机构发放的账号和密码进入管理工作台。</p>
        <AdminLoginPanel />
        <Link className={styles.backLink} href="/admin/binding-review">
          返回家长关系审核
        </Link>
      </section>
    </main>
  );
}
