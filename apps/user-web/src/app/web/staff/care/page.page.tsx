import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "../../visitor/site-header";
import sharedStyles from "../../parent/binding/parent-binding-panel.module.css";
import layoutStyles from "../../parent/leave/leave-panel.module.css";
import { StaffNavigation } from "../staff-navigation";
import { StaffCarePanel } from "./staff-care-panel";

export const metadata: Metadata = {
  title: "成长记录填写",
  description: "受邀员工为授权范围内的孩子填写成长记录，保存草稿后提交审核。",
};

export default function StaffCarePage() {
  return (
    <>
      <SiteHeader active="staff-care" />
      <main className={sharedStyles.main} id="main-content">
        <div className={`${sharedStyles.container} ${layoutStyles.staffContainer}`}>
          <a className={sharedStyles.backLink} href="/web/staff/workbench">
            返回员工工作台
          </a>
          <p className={sharedStyles.eyebrow}>员工服务 · 本机合成数据</p>
          <h1>成长记录填写</h1>
          <p className={sharedStyles.intro}>
            为负责的孩子填写六项日常观察，保存草稿后提交负责人审核。审核通过后，仍需由负责人单独发布给家长。
          </p>
          <p className={sharedStyles.notice}>
            仅显示受邀账号授权范围内的虚构资料。请使用固定选项，不填写真实儿童信息。
          </p>
          <div className={layoutStyles.staffLayout}>
            <StaffNavigation active="care" />
            <StaffCarePanel />
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
