import type { Metadata } from "next";
import { Cairo, Amiri_Quran } from "next/font/google";
import "./globals.css";

const cairo = Cairo({
  variable: "--font-cairo",
  subsets: ["arabic", "latin"],
  weight: ["400", "600", "700", "800", "900"],
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
  themeColor: "#fdfcfa",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ar" dir="rtl"
      className={`${cairo.variable} ${amiriQuran.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans">
        <a href="#main-content" className="skip-link">
          تخطّى إلى المحتوى الرئيسي
        </a>
        {children}
      </body>
    </html>
  );
}
