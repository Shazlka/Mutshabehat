import type { Metadata, Viewport } from "next";
import { Cairo, Amiri_Quran } from "next/font/google";
import "./globals.css";

const cairo = Cairo({
  variable: "--font-cairo",
  subsets: ["arabic", "latin"],
  // Only 400/700/900 are used in the UI (600 & 800 had zero usages) — fewer
  // weights = smaller Arabic font payload on first paint.
  weight: ["400", "700", "900"],
  display: "swap",
});

const amiriQuran = Amiri_Quran({
  variable: "--font-amiri-quran",
  subsets: ["arabic"],
  weight: ["400"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "متشابهات القرآن الكريم — V2",
  description: "Quran Similarity Explorer — مستكشف المتشابهات في القرآن الكريم",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "متشابهات",
  },
};

export const viewport: Viewport = {
  themeColor: "#3a4a8a",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ar" dir="rtl"
      className={`${cairo.variable} ${amiriQuran.variable} h-full antialiased`}>
      <head>
        <link rel="icon" href="/icons/icon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/icons/icon.svg" />
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body className="min-h-full flex flex-col font-sans">
        <a href="#main-content" className="skip-link">
          تخطّى إلى المحتوى الرئيسي
        </a>
        {children}
        <script dangerouslySetInnerHTML={{
          __html: `if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js')`
        }} />
      </body>
    </html>
  );
}
