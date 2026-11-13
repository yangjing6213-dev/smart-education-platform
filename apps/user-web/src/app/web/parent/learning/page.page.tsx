import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "../../visitor/site-header";
import { ParentLearningPanel } from "./learning-panel";
import styles from "./learning-panel.module.css";

export const metadata: Metadata = {
  title: "家长学习摘要",
  description: "查看已审核关系对应的本机合成学习摘要与陪伴设置。",
};

export default function ParentLearningPage() {
  return (
    <>
      <SiteHeader active="parent-learning" />
      <main className={styles.main} id="main-content">
        <div className={styles.container}>
          <a className={styles.backLink} href="/web/parent/home">
            返回家长首页
          </a>
          <p className={styles.eyebrow}>家长服务 · 本机合成数据</p>
          <h1>孩子学习摘要</h1>
          <p className={styles.intro}>
            仅汇总已审核关系下的练习时长、完成情况和知识点，方便家长陪伴孩子继续学习。
          </p>
          <p className={styles.notice}>
            开发预览：记录只保存在本机内存，刷新后可重新读取，服务重启后清空。联系意向不会发送消息。
          </p>
          <ParentLearningPanel />
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
