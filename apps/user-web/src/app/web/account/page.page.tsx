import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "../visitor/site-header";
import { AccountPanel } from "./account-panel";

export const metadata: Metadata = {
  title: "我的账号",
  description: "查看账号资料，管理登录凭据与会话。",
};

export default function AccountPage() {
  return (
    <>
      <SiteHeader active="account" />
      <main id="main-content" className="page-shell">
        <AccountPanel />
      </main>
      <SiteFooter />
    </>
  );
}
