import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "../../visitor/site-header";
import sharedStyles from "../../parent/binding/parent-binding-panel.module.css";
import layoutStyles from "../../parent/leave/leave-panel.module.css";
import { StaffNavigation } from "../staff-navigation";
import { StaffChildMonthlyPanel } from "./staff-child-monthly-panel";

export const metadata: Metadata = {
  title: "孩子个人月报",
  description: "受邀教师填写孩子个人月报，提交负责人审核后单独发布。",
};
export default function StaffChildMonthlyPage() {
  return (
    <>
      <SiteHeader active="staff-workbench" />
      <main className={sharedStyles.main} id="main-content">
        <div className={`${sharedStyles.container} ${layoutStyles.staffContainer}`}>
          <a
            className={sharedStyles.backLink}
            href="/web/staff/workbench"
            style={{ justifySelf: "start", margin: 0 }}
          >
            返回工作台
          </a>
          <p className={sharedStyles.eyebrow}>员工服务 · 受邀账号</p>
          <h1>孩子个人月报</h1>
          <p className={sharedStyles.intro}>
            选择孩子和月份，保存四项反馈，再提交负责人审核。审核通过后仍需单独发布，家长才能查看。
          </p>
          <p className={sharedStyles.notice}>
            当前使用虚构的模拟数据进行本机验证。孩子月报只汇总该孩子的成长与考勤来源，班级内部总结仍在独立页面。
          </p>
          <div className={layoutStyles.staffLayout}>
            <StaffNavigation active="child-monthly" />
            <StaffChildMonthlyPanel />
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
