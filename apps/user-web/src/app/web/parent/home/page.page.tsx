import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "../../visitor/site-header";
import sharedStyles from "../binding/parent-binding-panel.module.css";
import { ParentHealthPanel } from "./parent-health-panel";
import { ParentHomePanel } from "./parent-home-panel";
import { ParentNoticesPanel } from "./parent-notices-panel";
import styles from "./parent-home.module.css";

export const metadata: Metadata = {
  title: "家长首页",
  description: "查看本机合成成长记录、通知与健康跟进摘要，进入关系授权和孩子学习摘要。",
};

export default function ParentHomePage() {
  return (
    <>
      <SiteHeader active="parent-home" />
      <main className={sharedStyles.main} id="main-content">
        <div className={sharedStyles.container}>
          <a className={sharedStyles.backLink} href="/web/visitor/home">
            返回访客首页
          </a>
          <p className={sharedStyles.eyebrow}>家长服务 · 本机合成数据</p>
          <h1>家长首页</h1>
          <p className={sharedStyles.intro}>
            查看孩子的成长记录、通知与健康跟进摘要，管理关系授权，了解学习进展。
          </p>
          <p className={sharedStyles.notice}>
            本页面使用虚构的模拟数据，只连接本机服务，不会读取或改变真实孩子的资料。
          </p>

          <section aria-label="家长服务入口" className={styles.entryGrid}>
            <a className={styles.entryCard} href="/web/parent/binding">
              <p className={styles.kicker}>关系与用途</p>
              <h2>关系绑定与授权</h2>
              <p>查看关系审核状态，了解并管理资料的使用用途。</p>
              <span className={styles.entryAction} aria-hidden="true">
                进入服务 →
              </span>
            </a>
            <a className={styles.entryCard} href="/web/parent/learning">
              <p className={styles.kicker}>陪伴孩子学习</p>
              <h2>孩子学习摘要</h2>
              <p>查看已审核关系下的练习时长、完成情况与知识点。</p>
              <span className={styles.entryAction} aria-hidden="true">
                查看摘要 →
              </span>
            </a>
            <a className={styles.entryCard} href="/web/parent/fees">
              <p className={styles.kicker}>费用与流水</p>
              <h2>费用资料</h2>
              <p>查看已审核关系内的费用资料、收支记录与核对摘要。</p>
              <span className={styles.entryAction} aria-hidden="true">
                查看费用 →
              </span>
            </a>
            <a className={styles.entryCard} href="/web/parent/monthly">
              <p className={styles.kicker}>一起回顾成长</p>
              <h2>月度反馈</h2>
              <p>查看机构审核发布的月度摘要，并确认知悉。</p>
              <span className={styles.entryAction} aria-hidden="true">
                查看反馈 →
              </span>
            </a>
            <a className={styles.entryCard} href="/web/parent/pickup">
              <p className={styles.kicker}>接送安排与记录</p>
              <h2>接送安排</h2>
              <p>管理已审核孩子的接送授权，临时出示现场凭证并查看接送历史。</p>
              <span className={styles.entryAction} aria-hidden="true">
                查看接送 →
              </span>
            </a>
            <a className={styles.entryCard} href="/web/parent/leave">
              <p className={styles.kicker}>提前告知请假安排</p>
              <h2>请假申请</h2>
              <p>为已审核关系下的孩子提交请假，查看审核结果并确认知悉。</p>
              <span className={styles.entryAction} aria-hidden="true">
                查看请假 →
              </span>
            </a>
          </section>

          <div className={styles.services}>
            <ParentHomePanel />
            <ParentNoticesPanel />
            <ParentHealthPanel />
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
