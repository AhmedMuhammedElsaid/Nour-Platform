import "./globals.css";

import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Fraunces, Inter } from "next/font/google";

import { cn } from "@repo/ui/lib/utils";
import { AdminNav } from "../features/layout/components/admin-nav";

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
  title: "Nour — Admin",
  description: "Admin CMS",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className={cn(fontSans.variable, fontDisplay.variable)}
      suppressHydrationWarning
    >
      <body className="min-h-dvh bg-bg text-foreground font-sans antialiased">
        <AdminNav />
        {children}
      </body>
    </html>
  );
}
