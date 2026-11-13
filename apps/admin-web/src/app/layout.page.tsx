import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./admin-shell.css";

export const metadata: Metadata = {
  title: {
    default: "机构管理工作台迁移预览",
    template: "%s | 同芯学园管理端",
  },
  description: "管理端 Next.js 导航壳层迁移预览，业务页面仍由现有管理端提供。",
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
