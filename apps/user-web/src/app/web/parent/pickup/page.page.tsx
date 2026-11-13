import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "../../visitor/site-header";
import styles from "../binding/parent-binding-panel.module.css";
import { ParentPickupPanel } from "./parent-pickup-panel";

export const metadata: Metadata = {
  title: "接送安排",
  description: "管理邀请账号已审核关系内的模拟接送授权，查看临时现场凭证与接送历史。",
};

export default function ParentPickupPage() {
  return (
    <>
      <SiteHeader active="parent-pickup" />
      <main className={styles.main} id="main-content">
        <div className={styles.container}>
          <a className={styles.backLink} href="/web/parent/home">
            返回家长首页
          </a>
          <p className={styles.eyebrow}>家长服务 · 邀请账号</p>
          <h1>接送安排</h1>
          <p className={styles.intro}>提前安排接送人，管理临时或常用授权，查看已完成的接送记录。</p>
          <p className={styles.notice}>
            本页面仅使用虚构的模拟数据，不会发送真实通知。现场接送仍需由员工核对孩子、接送人和授权。
          </p>
          <ParentPickupPanel />
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
