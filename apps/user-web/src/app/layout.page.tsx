import type { ReactNode } from "react";
import type { Metadata } from "next";
import "../styles/user-web.css";

export const metadata: Metadata = {
  title: {
    default: "同芯学园访客首页",
    template: "%s | 同芯学园",
  },
  description: "了解同芯学园的机构介绍、教育理念与公开服务信息。",
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
