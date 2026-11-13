import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "../visitor/site-header";
import { LoginPanel } from "./login-panel";
import styles from "./login-panel.module.css";

export const metadata: Metadata = {
  title: "账号登录",
  description: "使用机构邀请的账号登录，进入当前已授权的服务。",
};

export default function LoginPage() {
  return (
    <>
      <SiteHeader active="login" />
      <main id="main-content" className={styles.main}>
        <div className={styles.layout}>
          <section className={styles.welcome} aria-labelledby="login-welcome">
            <p className={styles.eyebrow}>同芯学园 · 用心陪伴</p>
            <h1 id="login-welcome">
              每一步成长，
              <br />
              都值得看见。
            </h1>
            <p>一个受邀账号，连接家长与机构。登录后，只显示你可以使用的服务。</p>
            <a href="/visitor" className={styles.back}>
              ← 返回访客首页
            </a>
          </section>
          <LoginPanel />
        </div>
        <p className={styles.note}>当前仅使用本机合成资料体验，不接收真实学生或家庭信息。</p>
      </main>
      <SiteFooter />
    </>
  );
}
