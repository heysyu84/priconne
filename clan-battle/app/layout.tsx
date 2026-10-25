import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "냥냥클랜 · 클랜전 관리",
  description: "배틀로그, 택틱, 이월 계산과 월별 규칙 관리",
  icons: {
    icon: "/images/branding/nyang-paw-32.png",
    shortcut: "/images/branding/nyang-paw-32.png",
    apple: "/apple-touch-icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className="antialiased">{children}</body>
    </html>
  );
}
