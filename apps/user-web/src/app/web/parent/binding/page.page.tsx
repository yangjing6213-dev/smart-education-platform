import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "../../visitor/site-header";
import { ParentBindingPanel } from "./parent-binding-panel";
import styles from "./parent-binding-panel.module.css";

export const metadata: Metadata = {
  title: "家长服务",
  description: "选择受邀学生，提交关系申请并查看审核状态。",
};

export default function ParentBindingPage() {
  return (
    <>
      <SiteHeader active="parent-binding" />
      <main className={styles.main} id="main-content">
        <div className={styles.container}>
          <a className={styles.backLink} href="/web/parent/home">
            返回家长首页
          </a>
          <p className={styles.eyebrow}>家长服务 · 合成数据</p>
          <h1>家长关系绑定</h1>
          <p className={styles.intro}>
            选择受邀学生并提交关系申请，员工审核通过后可查看已发布的成长记录。
          </p>
          <p className={styles.notice}>
            本页面使用独立的合成试用资料。请勿填写真实学生或家庭信息。
          </p>
          <ParentBindingPanel />
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
