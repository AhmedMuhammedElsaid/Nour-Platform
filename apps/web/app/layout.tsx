import type { ReactNode } from "react";

/*
 * Root layout is a passthrough: the real <html>/<body> live in
 * app/[locale]/layout.tsx so the document can carry the per-request `lang` and
 * `dir` attributes (RTL for Arabic). This is the next-intl App Router pattern.
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return children;
}
