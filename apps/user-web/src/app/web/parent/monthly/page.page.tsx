import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "../../visitor/site-header";
import styles from "../binding/parent-binding-panel.module.css";
import { ParentMonthlyPanel } from "./parent-monthly-panel";

export const metadata: Metadata = {
  title: "孩子个人月报",
  description: "按已批准绑定孩子查看机构审核发布的个人月报，并确认知悉。",
};

export default function ParentMonthlyPage() {
  return (
    <>
      <SiteHeader active="parent-monthly" />
      <main className={styles.main} id="main-content">
        <div className={styles.container}>
          <a className={styles.backLink} href="/web/parent/home">
            返回家长首页
          </a>
          <p className={styles.eyebrow}>家长服务 · 本机合成数据</p>
          <h1>孩子个人月报</h1>
          <p className={styles.intro}>
            选择已批准绑定的孩子，回顾机构审核发布的个人月度摘要，并确认知悉。
          </p>
          <p className={styles.notice}>
            本页面使用虚构的模拟数据，只连接本机服务。反馈由机构审核后发布，不自动判断孩子的能力或健康情况。
          </p>
          <ParentMonthlyPanel />
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
