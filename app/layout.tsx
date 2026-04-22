import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CodeAutopsy | AI-Powered Codebase Visualization",
  description: "Stop wrestling with unfamiliar code. CodeAutopsy analyzes GitHub repositories to provide visual architecture, execution flows, and AI-driven insights in minutes.",
  metadataBase: new URL("https://codeautopsy-lyart.vercel.app"),
  openGraph: {
    title: "CodeAutopsy | Dissect Any Codebase",
    description: "AI-powered architecture maps and execution flows for any GitHub repository. Understand code faster.",
    url: "https://codeautopsy-lyart.vercel.app",
    siteName: "CodeAutopsy",
    images: [
      {
        url: "/og-image.png", // We will create this file next!
        width: 1200,
        height: 630,
        alt: "CodeAutopsy Visual Architecture Analysis",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "CodeAutopsy | Dissect Any Codebase",
    description: "Understand any codebase in minutes. AI-powered visual architecture and execution flows.",
    creator: "@Sidhant07", // Update this to your real Twitter handle if you have one!
    images: ["/og-image.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <Analytics />
      </body>
    </html>
  );
}
