import "../globals.css";

import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Fraunces, Inter, IBM_Plex_Sans_Arabic } from "next/font/google";
import { notFound } from "next/navigation";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { getMessages, getTranslations, setRequestLocale } from "next-intl/server";

import { cn } from "@repo/ui/lib/utils";
import { AudioPlayer } from "@repo/ui/blocks/audio-player";
import { PlayerProvider } from "@repo/ui/blocks/player-context";
import { type Locale } from "@repo/api/schemas/locale";
import { SiteFooter } from "@/features/layout/components/site-footer";
import { SiteHeader } from "@/features/layout/components/site-header";
import { PlaybackPersistence } from "@/features/player/components/playback-persistence";
import { ServiceWorkerRegister } from "@/features/pwa/components/service-worker-register";
import { InstallPrompt } from "@/features/pwa/components/install-prompt";
import { AdhanController } from "@/features/prayer-times/components/adhan-controller";
import { AzkarReminderController } from "@/features/prayer-times/components/azkar-reminder-controller";
import { LocaleAlternatesProvider } from "@/features/layout/locale-alternates-context";
import { BUILD_VERSION } from "@/lib/build-version";
import { routing } from "@/i18n/routing";
import { defaultOpenGraph, defaultTwitter } from "@/lib/seo";
import { JsonLd } from "@/features/seo/components/json-ld";
import { organizationLd, webSiteLd } from "@/lib/seo";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";

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

// Arabic UI face. Exposed as its own CSS var and swapped into --font-sans for
// the `ar` locale below, so Tailwind's `font-sans` token renders Arabic text
// with a proper Naskh-style face instead of a Latin fallback.
const fontArabic = IBM_Plex_Sans_Arabic({
  subsets: ["arabic"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-arabic",
});

// NOTE: the Quran mushaf face (Amiri Quran → --font-quran) is deliberately NOT
// loaded here — it is scoped to app/[locale]/quran/layout.tsx so its woff2 is
// not preloaded on every route. tokens.css carries the fallback stack.

// Pre-render both locale shells (pages stay force-dynamic for the CSP nonce).
export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "metadata" });
  return {
    title: { default: t("homeTitle"), template: `%s — Nour` },
    description: t("homeDescription"),
    manifest: "/manifest.webmanifest",
    appleWebApp: { capable: true, title: "Nour", statusBarStyle: "default" },
    icons: {
      icon: [
        { url: "/favicon.ico", sizes: "any" },
        { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
        { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
        { url: "/icons/icon.svg", type: "image/svg+xml" },
      ],
      apple: { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    },
    openGraph: {
      ...defaultOpenGraph(locale),
      title: t("homeTitle"),
      description: t("homeDescription"),
    },
    twitter: defaultTwitter(),
  };
}

// Match the PWA manifest theme so the browser/OS chrome blends in. Literal hex
// is unavoidable here (viewport metadata is not CSS) — values mirror
// --color-bg in packages/ui/src/styles/tokens.css for each theme.
export const viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0f0d0a" },
    { media: "(prefers-color-scheme: light)", color: "#fdfaf4" },
  ],
};

export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }
  // Enable static rendering / request-scoped locale for this subtree.
  setRequestLocale(locale);

  const messages = await getMessages();
  const t = await getTranslations("nav");
  const isRtl = locale === "ar";

  return (
    <html
      lang={locale}
      dir={isRtl ? "rtl" : "ltr"}
      // Dark is the default theme; ThemeToggle overrides from localStorage on mount.
      data-theme="dark"
      // The build this HTML was rendered from. ServiceWorkerRegister compares it
      // against a live /api/health poll to detect a stale long-lived tab still
      // running old JS after a deploy, and hard-reloads it. See build-version.ts.
      data-build={BUILD_VERSION}
      className={cn(fontSans.variable, fontDisplay.variable, fontArabic.variable)}
      // For Arabic, point the shared `--font-sans` token at the Arabic face so
      // every `font-sans` element renders Arabic text correctly.
      style={isRtl ? { ["--font-sans" as string]: "var(--font-arabic)" } : undefined}
      suppressHydrationWarning
    >
      <body className="flex flex-col min-h-dvh bg-bg text-foreground font-sans antialiased">
        {/* Site-wide structured data: rendered once per locale, nonce-stamped for CSP. */}
        <JsonLd data={organizationLd()} />
        <JsonLd data={webSiteLd(locale)} />
        <NextIntlClientProvider messages={messages}>
          <PlayerProvider>
            <LocaleAlternatesProvider>
              <a
                href="#main-content"
                className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:start-4 focus:z-50 focus:rounded-md focus:bg-bg focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:ring-2 focus:ring-ring"
              >
                {t("skipToContent")}
              </a>
              <SiteHeader />
              <main id="main-content" className="flex-1">
                {children}
              </main>
              <SiteFooter />
              <AudioPlayer />
              <PlaybackPersistence />
              <InstallPrompt />
              <ServiceWorkerRegister />
              <AdhanController />
              <AzkarReminderController />
              <Analytics />
              <SpeedInsights />
            </LocaleAlternatesProvider>
          </PlayerProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
