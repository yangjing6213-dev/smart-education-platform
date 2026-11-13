import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "../../visitor/site-header";
import sharedStyles from "../../parent/binding/parent-binding-panel.module.css";
import layoutStyles from "../../parent/leave/leave-panel.module.css";
import { StaffNavigation } from "../staff-navigation";
import { StaffDailyPanel } from "./staff-daily-panel";

export const metadata: Metadata = {
  title: "员工工作日报",
  description: "受邀员工在本人授权范围内填写并提交工作日报。",
};

export default function StaffDailyPage() {
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
          <h1>员工工作日报</h1>
          <p className={sharedStyles.intro}>
            按固定选项记录当日工作，提交后由负责人审核；退回的日报可以修改后重新提交。
          </p>
          <p className={sharedStyles.notice}>
            当前使用合成演示资料；日报只供授权员工流程查看，不会发送给家长或写入真实机构。
          </p>
          <div className={layoutStyles.staffLayout}>
            <StaffNavigation active="daily" />
            <StaffDailyPanel />
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
