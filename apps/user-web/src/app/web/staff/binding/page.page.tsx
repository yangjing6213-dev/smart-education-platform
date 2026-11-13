import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "../../visitor/site-header";
import sharedStyles from "../../parent/binding/parent-binding-panel.module.css";
import layoutStyles from "../../parent/leave/leave-panel.module.css";
import { StaffNavigation } from "../staff-navigation";
import { StaffBindingPanel } from "./staff-binding-panel";

export const metadata: Metadata = {
  title: "家长关系审核",
  description: "员工审核当前授权校区的模拟家长关系申请。",
};

export default function StaffBindingPage() {
  return (
    <>
      <SiteHeader active="staff-workbench" />
      <main className={sharedStyles.main} id="main-content">
        <div className={`${sharedStyles.container} ${layoutStyles.staffContainer}`}>
          <a className={sharedStyles.backLink} href="/web/staff/workbench">
            返回员工工作台
          </a>
          <p className={sharedStyles.eyebrow}>员工服务 · 合成资料</p>
          <h1>家长关系审核</h1>
          <p className={sharedStyles.intro}>
            查看当前授权校区的待审核申请，批准或退回后，家长可以在自己的页面查看结果。
          </p>
          <p className={sharedStyles.notice}>
            当前仅使用虚构的模拟资料，不发送真实通知，也不连接真实机构数据。
          </p>
          <div className={layoutStyles.staffLayout}>
            <StaffNavigation active="binding" />
            <StaffBindingPanel />
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
