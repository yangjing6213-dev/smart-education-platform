import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "../../visitor/site-header";
import sharedStyles from "../../parent/binding/parent-binding-panel.module.css";
import layoutStyles from "../../parent/leave/leave-panel.module.css";
import { StaffNavigation } from "../staff-navigation";
import { StaffWorkbenchPanel } from "./staff-workbench-panel";

export const metadata: Metadata = {
  title: "员工工作台",
  description: "受邀员工在授权校区内查看并处理工作任务。",
};

export default function StaffWorkbenchPage() {
  return (
    <>
      <SiteHeader active="staff-workbench" />
      <main className={sharedStyles.main} id="main-content">
        <div className={`${sharedStyles.container} ${layoutStyles.staffContainer}`}>
          <p className={sharedStyles.eyebrow}>员工服务 · 本机合成数据</p>
          <h1>员工工作台</h1>
          <p className={sharedStyles.intro}>
            使用机构邀请的账号登录。页面根据员工所属校区显示可处理的任务。
          </p>
          <p className={sharedStyles.notice}>
            当前使用虚构的模拟资料，仅供本机体验，不是真实员工账号或机构数据。
          </p>
          <div className={layoutStyles.staffLayout}>
            <StaffNavigation active="workbench" />
            <StaffWorkbenchPanel />
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
