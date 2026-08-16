import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/components/providers/auth-provider";
import { QueryProvider } from "@/components/providers/query-provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "TaskReward — Earn Money Online Completing Tasks",
  description:
    "TaskReward is a leading online earning platform. Complete simple tasks — like, follow, watch videos — and earn real money. Instant payouts via Easypaisa, JazzCash, and Binance.",
  keywords: [
    "TaskReward",
    "earn money online",
    "complete tasks for money",
    "online earning platform",
    "Easypaisa",
    "JazzCash",
    "Binance",
    "micro tasks",
  ],
  authors: [{ name: "TaskReward" }],
  creator: "TaskReward",
  publisher: "TaskReward",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/branding/favicon-32.png", type: "image/png", sizes: "32x32" },
    ],
    apple: [{ url: "/branding/apple-touch-icon.png", sizes: "180x180" }],
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://taskreward.example",
    siteName: "TaskReward",
    title: "TaskReward — Earn Money Online Completing Tasks",
    description:
      "Complete simple tasks and earn real money. Join thousands of earners today. Instant payouts via Easypaisa, JazzCash, and Binance.",
    images: [
      {
        url: "/branding/taskreward-logo.png",
        width: 512,
        height: 512,
        alt: "TaskReward logo",
      },
    ],
  },
  twitter: {
    card: "summary",
    title: "TaskReward — Earn Money Online Completing Tasks",
    description:
      "Complete simple tasks and earn real money. Instant payouts via Easypaisa, JazzCash, and Binance.",
    images: ["/branding/taskreward-logo.png"],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  themeColor: "#0A0F1C",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <AuthProvider>
          <QueryProvider>
            {children}
            <Toaster />
            <SonnerToaster />
          </QueryProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
