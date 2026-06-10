import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { getCachedSurahList } from "@/lib/cached-content";
import { LOCALES, type Locale } from "@repo/api/schemas/locale";
import { localeAlternates, defaultOpenGraph, defaultTwitter } from "@/lib/seo";
import { Link } from "@/i18n/navigation";

// Opt out of static prerendering — proxy.ts sets a per-request CSP nonce and the
// deploy build has no Atlas connection. Matches the rest of the locale tree.
export const dynamic = "force-dynamic";

import { SurahJuzTabs } from "@/features/quran/components/surah-juz-tabs";
import { ContinueReading } from "@/features/quran/components/continue-reading";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "quran" });
  const pathByLocale = Object.fromEntries(
    LOCALES.map((l) => [l, `/${l}/quran`]),
  ) as Record<Locale, string>;
  const { canonical, languages } = localeAlternates(locale, pathByLocale);
  return {
    title: t("title"),
    alternates: { canonical, languages },
    openGraph: { ...defaultOpenGraph(locale), title: t("title") },
    twitter: defaultTwitter(),
  };
}

export default async function QuranIndexPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("quran");
  const surahs = await getCachedSurahList();
  const surahNames: Record<number, string> = Object.fromEntries(
    surahs.map((s) => [s.number, s.name.en]),
  );

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="font-display text-text mb-6 text-2xl font-bold">
        {t("title")}
      </h1>
      <Link href="/quran/bookmarks" className="text-primary mb-4 inline-block text-sm">
        {t("bookmarks")}
      </Link>
      <ContinueReading surahNames={surahNames} />
      <SurahJuzTabs surahs={surahs} />
    </div>
  );
}
