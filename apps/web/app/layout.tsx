import "./globals.css";

import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Fraunces, Inter } from "next/font/google";

import { cn } from "@repo/ui/lib/utils";
import { SiteFooter } from "@/features/layout/components/site-footer";
import { SiteHeader } from "@/features/layout/components/site-header";

const fontSans = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans",
});

const fontDisplay = Fraunces({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-display",
});

export const metadata: Metadata = {
  title: "Nour — Audio Platform",
  description: "Islamic audio platform",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className={cn(fontSans.variable, fontDisplay.variable)}
      suppressHydrationWarning
    >
      <body className="flex flex-col min-h-dvh bg-bg text-foreground font-sans antialiased">
        <SiteHeader />
        <main className="flex-1">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
