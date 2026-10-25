import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "냥냥클랜 Re²:Dive",
  description: "냥냥클랜 클랜전 기록과 택틱",
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
    <html lang="ko">
      <body className="antialiased">{children}</body>
    </html>
  );
}
