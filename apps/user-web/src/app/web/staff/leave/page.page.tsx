import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "../../visitor/site-header";
import sharedStyles from "../../parent/binding/parent-binding-panel.module.css";
import { LeavePanel } from "../../parent/leave/leave-panel";
import styles from "../../parent/leave/leave-panel.module.css";
import { StaffNavigation } from "../staff-navigation";

export const metadata: Metadata = {
  title: "请假审核",
  description: "受邀员工在授权校区内查看请假申请，逐项处理并保留记录。",
};

export default function StaffLeavePage() {
  return (
    <>
      <SiteHeader active="staff-leave" />
      <main className={sharedStyles.main} id="main-content">
        <div className={`${sharedStyles.container} ${styles.staffContainer}`}>
          <a className={sharedStyles.backLink} href="/web/staff/workbench">
            返回员工工作台
          </a>
          <p className={sharedStyles.eyebrow}>员工服务 · 本机合成数据</p>
          <h1>请假审核</h1>
          <p className={sharedStyles.intro}>
            使用机构邀请的员工账号登录后，查看服务端按授权校区和班级筛选的申请，再逐项确认或退回。
          </p>
          <p className={sharedStyles.notice}>
            页面使用虚构的模拟数据，仅供本机体验。可见范围由服务端按邀请账号权限确认；不会改变真实考勤或发送真实通知。
          </p>
          <div className={styles.staffLayout}>
            <StaffNavigation active="leave" />
            <LeavePanel key="staff" role="staff" />
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
