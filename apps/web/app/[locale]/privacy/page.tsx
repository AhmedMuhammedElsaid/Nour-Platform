import type { Metadata } from "next";
import type { ReactNode } from "react";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { LOCALES, type Locale } from "@repo/api/schemas/locale";
import {
  localeAlternates,
  defaultOpenGraph,
  defaultTwitter,
  absoluteUrl,
  breadcrumbLd,
  webPageLd,
} from "@/lib/seo";
import { JsonLd } from "@/features/seo/components/json-ld";

// Force dynamic — CSP nonce set per-request by proxy.ts; static HTML would mismatch.
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "privacy" });
  const pathByLocale = Object.fromEntries(
    LOCALES.map((l) => [l, `/${l}/privacy`]),
  ) as Record<Locale, string>;
  const { canonical, languages } = localeAlternates(locale, pathByLocale);
  const description = t("metaDescription");
  return {
    title: t("title"),
    description,
    alternates: { canonical, languages },
    // A privacy policy is stable, indexable content — let crawlers follow it.
    robots: { index: true, follow: true },
    openGraph: {
      ...defaultOpenGraph(locale),
      title: t("title"),
      description,
      url: canonical,
    },
    twitter: defaultTwitter(),
  };
}

// The policy is a fixed list of heading/body pairs; keeping the order in one
// array keeps the markup DRY and the translation keys the single source of truth.
const SECTIONS = [
  ["controllerHeading", "controllerBody"],
  ["dataHeading", "dataBody"],
  ["localHeading", "localBody"],
  ["networkHeading", "networkBody"],
  ["permissionsHeading", "permissionsBody"],
  ["analyticsHeading", "analyticsBody"],
  ["thirdPartyHeading", "thirdPartyBody"],
  ["childrenHeading", "childrenBody"],
  ["changesHeading", "changesBody"],
] as const;

export default async function PrivacyRoute({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "privacy" });

  const url = absoluteUrl(`/${locale}/privacy`);
  const jsonLd = [
    webPageLd({
      name: t("title"),
      description: t("metaDescription"),
      url,
      locale,
      // ISO date backing the human-readable "Last updated" line below.
      dateModified: "2026-07-01",
    }),
    breadcrumbLd([
      { name: SITE_HOME_LABEL[locale], url: absoluteUrl(`/${locale}`) },
      { name: t("title"), url },
    ]),
  ];

  return (
    <section className="mx-auto max-w-3xl px-6 py-16">
      <JsonLd data={jsonLd} />

      <header className="mb-8">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[3px] text-primary">
          {t("eyebrow")}
        </p>
        <h1 className="font-display text-4xl font-bold tracking-tight text-text">
          {t("title")}
        </h1>
        <p className="mt-2 text-sm text-text-2">{t("updated")}</p>
      </header>

      <hr className="my-8 border-border" />

      <p className="mb-8 text-base leading-relaxed text-text">{t("intro")}</p>

      {SECTIONS.map(([heading, body]) => (
        <section key={heading} className="mb-8">
          <h2 className="mb-2 font-display text-xl font-semibold text-text">
            {t(heading)}
          </h2>
          <p className="text-base leading-relaxed text-text-2">{t(body)}</p>
        </section>
      ))}

      <section className="mb-8">
        <h2 className="mb-2 font-display text-xl font-semibold text-text">
          {t("contactHeading")}
        </h2>
        <p className="text-base leading-relaxed text-text-2">
          {t.rich("contactBody", {
            mail: (chunks: ReactNode) => (
              <a
                href="mailto:ahmed.muhammed.elsaid@gmail.com"
                className="text-primary underline underline-offset-4 hover:text-primary/80"
              >
                {chunks}
              </a>
            ),
          })}
        </p>
      </section>
    </section>
  );
}

// Home breadcrumb label — matches the site name used elsewhere in nav.
const SITE_HOME_LABEL: Record<Locale, string> = { ar: "نور", en: "Nour" };
