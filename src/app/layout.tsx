import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Noto_Sans_Bengali } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// বাংলা টাইপোগ্রাফি — Noto Sans Bengali
const notoBengali = Noto_Sans_Bengali({
  variable: "--font-noto-bengali",
  subsets: ["bengali"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "TradeLite — রিয়েল-টাইম ট্রেডিং চার্ট",
  description:
    "TradingView Lightweight Charts ভিত্তিক ফ্রি রিয়েল-টাইম ক্রিপ্টো চার্টিং অ্যাপ: EMA, RSI, MACD, Bollinger Bands ইন্ডিকেটর, Socket.IO লাইভ ডেটা ও Binance মার্কেট API।",
  keywords: ["ট্রেডিং", "ক্রিপ্টো", "চার্ট", "Binance", "TradingView", "EMA", "RSI", "MACD"],
  authors: [{ name: "TradeLite" }],
};

export const viewport: Viewport = {
  themeColor: "#0B0D10",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="bn" className="dark" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${notoBengali.variable} antialiased bg-[#0B0D10] text-neutral-100`}
        style={{
          fontFamily:
            "'Inter', var(--font-geist-sans), var(--font-noto-bengali), 'Noto Sans Bengali', system-ui, sans-serif",
        }}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
