import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "../../visitor/site-header";
import sharedStyles from "../../parent/binding/parent-binding-panel.module.css";
import layoutStyles from "../../parent/leave/leave-panel.module.css";
import { StaffNavigation } from "../staff-navigation";
import { StaffPickupPanel } from "./staff-pickup-panel";

export const metadata: Metadata = {
  title: "员工接送核验",
  description: "受邀员工在已授权校区核对一次性接送凭证并确认离校。",
};

export default function StaffPickupPage() {
  return (
    <>
      <SiteHeader active="staff-workbench" />
      <main className={sharedStyles.main} id="main-content">
        <div className={`${sharedStyles.container} ${layoutStyles.staffContainer}`}>
          <a className={sharedStyles.backLink} href="/web/staff/workbench">
            返回员工工作台
          </a>
          <p className={sharedStyles.eyebrow}>员工服务 · 受邀账号</p>
          <h1>员工接送核验</h1>
          <p className={sharedStyles.intro}>
            核对家长出示的一次性凭证、学生和接送人信息后，再确认学生离校。
          </p>
          <p className={sharedStyles.notice}>
            页面使用合成演示资料。凭证只在本次核验中暂时使用，不会保存到浏览器；现场信息不一致时请停止核验并联系家长。
          </p>
          <div className={layoutStyles.staffLayout}>
            <StaffNavigation active="pickup" />
            <StaffPickupPanel />
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
