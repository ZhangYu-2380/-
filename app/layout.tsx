import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "券商自动化流程监控 V4",
  description: "7 个核心流程的自动化运行监控与操作级异常定位演示系统。",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
