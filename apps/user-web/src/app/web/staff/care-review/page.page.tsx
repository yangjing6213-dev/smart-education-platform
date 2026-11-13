import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "../../visitor/site-header";
import sharedStyles from "../../parent/binding/parent-binding-panel.module.css";
import layoutStyles from "../../parent/leave/leave-panel.module.css";
import { StaffNavigation } from "../staff-navigation";
import { StaffCareReviewPanel } from "./staff-care-review-panel";

export const metadata: Metadata = {
  title: "成长记录审核",
  description: "负责人审核并单独发布授权校区内的成长记录。",
};

export default function StaffCareReviewPage() {
  return (
    <>
      <SiteHeader active="staff-care" />
      <main className={sharedStyles.main} id="main-content">
        <div className={`${sharedStyles.container} ${layoutStyles.staffContainer}`}>
          <a className={sharedStyles.backLink} href="/web/staff/workbench">
            返回员工工作台
          </a>
          <p className={sharedStyles.eyebrow}>负责人服务 · 本机合成数据</p>
          <h1>成长记录审核</h1>
          <p className={sharedStyles.intro}>
            先核对员工提交的记录。审核通过不会自动发给家长，负责人还要单独发布。
          </p>
          <p className={sharedStyles.notice}>
            仅显示当前邀请账号有权查看的虚构资料；记录创建人不能审核自己的内容。
          </p>
          <div className={layoutStyles.staffLayout}>
            <StaffNavigation active="care-review" />
            <StaffCareReviewPanel />
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
