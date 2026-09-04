import type { Metadata } from "next";
import "./globals.css";
import "./font.css";
import "./screens.css";
import "./palette.css";
import "./flip.css";
import "./journey-status.css";

export const metadata: Metadata = {
  title: "سائر — ماذا تفعل الآن؟",
  description: "نموذج تفاعلي لمساعد يومي هادئ يريك ما عليك الآن وكم يحتاج من وقتك.",
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
    <html lang="ar" dir="rtl">
      <body>{children}</body>
    </html>
  );
}
