import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "../../visitor/site-header";
import sharedStyles from "../../parent/binding/parent-binding-panel.module.css";
import layoutStyles from "../../parent/leave/leave-panel.module.css";
import { StaffNavigation } from "../staff-navigation";
import { StaffMonthlyPanel } from "./staff-monthly-panel";

export const metadata: Metadata = {
  title: "班级月度总结",
  description: "受邀员工填写、修改和提交班级内部月度总结。",
};
export default function StaffMonthlyPage() {
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
          <h1>班级月度总结</h1>
          <p className={sharedStyles.intro}>
            按月份选择四项工作反馈，保存后提交负责人审核；退回或来源变化的总结需要重新核对。
          </p>
          <p className={sharedStyles.notice}>
            当前使用合成资料进行本机验证，班级总结仅供授权员工内部查看，不发送给家长。
          </p>
          <div className={layoutStyles.staffLayout}>
            <StaffNavigation active="monthly" />
            <StaffMonthlyPanel />
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
