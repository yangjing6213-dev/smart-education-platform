import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "../../visitor/site-header";
import { ParentBindingPanel } from "./parent-binding-panel";
import styles from "./parent-binding-panel.module.css";

export const metadata: Metadata = {
  title: "家长服务",
  description: "提交本机合成关系申请，查看审核状态并管理固定用途。",
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
          <p className={styles.eyebrow}>家长服务 · 本机合成数据</p>
          <h1>关系绑定与授权</h1>
          <p className={styles.intro}>
            提交虚构关系申请，审核通过后再查看固定用途和个人信息申请入口。
          </p>
          <p className={styles.notice}>
            本页面只连接本机开发服务，使用虚构资料，不会读取、发送或改变真实资料。
          </p>
          <ParentBindingPanel />
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
