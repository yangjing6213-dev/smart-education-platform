import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "../../visitor/site-header";
import sharedStyles from "../binding/parent-binding-panel.module.css";
import { LeavePanel } from "./leave-panel";

export const metadata: Metadata = {
  title: "请假申请",
  description: "为已审核关系下的孩子提交本机合成请假申请，查看审核结果并确认知悉。",
};

export default function ParentLeavePage() {
  return (
    <>
      <SiteHeader active="parent-leave" />
      <main className={sharedStyles.main} id="main-content">
        <div className={sharedStyles.container}>
          <a className={sharedStyles.backLink} href="/web/parent/home">
            返回家长首页
          </a>
          <p className={sharedStyles.eyebrow}>家长服务 · 本机合成数据</p>
          <h1>请假申请</h1>
          <p className={sharedStyles.intro}>
            提交孩子的请假日期和原因，查看机构处理结果；被退回后可修改并重新提交。
          </p>
          <p className={sharedStyles.notice}>
            本页面使用机构邀请的家长账号查看和提交合成请假记录，只连接本机服务，不会发送真实通知或改变真实考勤。
          </p>
          <LeavePanel key="parent" role="parent" />
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
