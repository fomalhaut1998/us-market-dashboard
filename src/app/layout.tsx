import type { Metadata, Viewport } from "next";
import { siteConfig } from "@/config/site";
import "./globals.css";

const description =
  "把美股指数、VIX 期限结构、恐惧贪婪、估值分位、市场宽度与信用利差放在同一屏，并按固定规则给出定投倍率提示。仅供研究参考，不构成投资建议。";

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.liveDemo),
  title: {
    default: siteConfig.name,
    template: `%s · ${siteConfig.name}`,
  },
  description,
  applicationName: siteConfig.name,
  authors: [{ name: siteConfig.author, url: siteConfig.repository }],
  creator: siteConfig.author,
  publisher: siteConfig.author,
  category: "finance",
  keywords: [
    "美股",
    "估值",
    "VIX",
    "恐惧贪婪指数",
    "市场宽度",
    "信用利差",
    "定投倍率",
    "开源看板",
  ],
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "zh_CN",
    url: "/",
    siteName: siteConfig.name,
    title: siteConfig.name,
    description,
    images: [
      {
        url: "/assets/og-cover.png",
        width: 1200,
        height: 630,
        alt: `${siteConfig.name} 页面预览`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: siteConfig.name,
    description,
    images: ["/assets/og-cover.png"],
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/assets/site-icon.svg", type: "image/svg+xml" },
      { url: "/assets/site-icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/assets/site-icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/assets/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
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
