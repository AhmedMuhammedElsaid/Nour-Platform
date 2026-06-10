import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";

import { getCachedPublishedAzkar } from "@/lib/cached-content";
import { LOCALES, type Locale } from "@repo/api/schemas/locale";
import { localeAlternates, defaultOpenGraph, defaultTwitter } from "@/lib/seo";
import { AdhkarCard } from "@/features/adhkar/components/adhkar-card";

// Force dynamic — CSP nonce set per-request by proxy.ts; static HTML would mismatch.
export const dynamic = "force-dynamic";

const TITLES: Record<Locale, string> = { ar: "الأذكار", en: "Adhkar" };
const SUBTITLES: Record<Locale, string> = {
  ar: "أذكار الصباح والمساء وسائر الأذكار",
  en: "Morning, evening, and daily remembrances",
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const title = TITLES[locale];
  const pathByLocale = Object.fromEntries(
    LOCALES.map((l) => [l, `/${l}/adhkar`]),
  ) as Record<Locale, string>;
  const { canonical, languages } = localeAlternates(locale, pathByLocale);
  return {
    title,
    alternates: { canonical, languages },
    openGraph: {
      ...defaultOpenGraph(locale),
      title,
      url: canonical,
    },
    twitter: defaultTwitter(),
  };
}

export default async function AdhkarPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const azkarSets = await getCachedPublishedAzkar();

  return (
    <section className="mx-auto max-w-6xl px-6 py-16">
      {/* Hero */}
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-[3px] text-primary mb-2">
          {locale === "ar" ? "ذكر الله" : "Dhikr"}
        </p>
        <h1 className="font-display text-4xl font-bold tracking-tight text-text">
          {TITLES[locale]}
        </h1>
        <p className="mt-2 text-sm text-text-2">{SUBTITLES[locale]}</p>
      </div>

      <hr className="border-border my-8" />

      {azkarSets.length === 0 ? (
        <p className="text-text-2">{locale === "ar" ? "لا توجد أذكار منشورة" : "No adhkar published yet."}</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {azkarSets.map((set) => {
            const display = set[locale];
            const repeats = set.items.map((item) => item.repeat);
            return (
              <AdhkarCard
                key={set.id}
                id={set.id}
                kind={set.kind}
                title={display.title}
                slug={display.slug}
                count={set.items.length}
                repeats={repeats}
              />
            );
          })}
        </div>
      )}
    </section>
  );
}
