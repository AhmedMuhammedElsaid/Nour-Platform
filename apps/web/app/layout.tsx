import type { Metadata } from "next";
import type { ReactNode } from "react";

import { DEFAULT_LOCALE } from "@repo/api/schemas/locale";

import {
  SITE_NAME,
  SITE_URL,
  defaultOpenGraph,
  defaultTwitter,
} from "@/lib/seo";

/*
 * `metadataBase` lives at the root so every relative URL in metadata (canonical,
 * OG/Twitter images) resolves to an absolute URL. The default OG/Twitter blocks
 * use the default locale as a fallback; app/[locale]/layout.tsx overrides them
 * with the request's actual locale (Next replaces, not deep-merges, nested
 * `openGraph`/`twitter` objects, so the per-locale layout sets complete blocks).
 */
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  applicationName: SITE_NAME,
  openGraph: defaultOpenGraph(DEFAULT_LOCALE),
  twitter: defaultTwitter(),
};

/*
 * Root layout is a passthrough: the real <html>/<body> live in
 * app/[locale]/layout.tsx so the document can carry the per-request `lang` and
 * `dir` attributes (RTL for Arabic). This is the next-intl App Router pattern.
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return children;
}
