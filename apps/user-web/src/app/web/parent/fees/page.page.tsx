import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "../../visitor/site-header";
import styles from "../binding/parent-binding-panel.module.css";
import { ParentFeesPanel } from "./parent-fees-panel";

export const metadata: Metadata = {
  title: "费用资料",
  description: "查看已审核关系内的本机合成费用资料与费用流水。",
};

export default function ParentFeesPage() {
  return (
    <>
      <SiteHeader active="parent-fees" />
      <main className={styles.main} id="main-content">
        <div className={styles.container}>
          <a className={styles.backLink} href="/web/parent/home">
            返回家长首页
          </a>
          <p className={styles.eyebrow}>家长服务 · 本机合成数据</p>
          <h1>费用资料</h1>
          <p className={styles.intro}>查看已审核关系内的费用资料与流水，了解各项记录和核对摘要。</p>
          <p className={styles.notice}>
            本页面使用虚构的模拟数据，所有金额均不代表真实收付款。这里只提供查看，不收款、退款或签署协议。
          </p>
          <ParentFeesPanel />
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
