import type { ReactNode } from "react";
import type { Metadata } from "next";
import "../styles/user-web.css";

export const metadata: Metadata = {
  title: {
    default: "同芯学园访客首页",
    template: "%s | 同芯学园",
  },
  description: "查看同芯学园的课后成长服务公开信息。页面内容均为模拟数据。",
  icons: { icon: "/assets/tongxin-logo.png" },
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>
        <a className="skip-link" href="#main-content">
          跳到主要内容
        </a>
        {children}
      </body>
    </html>
  );
}
