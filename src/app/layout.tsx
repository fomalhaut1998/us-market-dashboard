import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "美股估值与情绪监控看板",
  description: "使用服务端获取的真实日线、估值与市场情绪数据展示美股监控指标。",
  icons: {
    icon: "/assets/trading-globe.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f2f5fb" },
    { media: "(prefers-color-scheme: dark)", color: "#0b1220" },
  ],
};

const themeInitializationScript = `
  (function () {
    try {
      var key = "us-stock-dashboard-theme";
      var saved = localStorage.getItem(key);
      var hour = new Date().getHours();
      var theme = saved === "light" || saved === "dark"
        ? saved
        : (hour >= 6 && hour < 18 ? "light" : "dark");
      document.documentElement.dataset.theme = theme;
      document.documentElement.style.colorScheme = theme;
    } catch (_) {
      document.documentElement.dataset.theme = "light";
    }
  })();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitializationScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
