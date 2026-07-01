import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { LOCALES, type Locale } from "@repo/api/schemas/locale";
import { localeAlternates, defaultOpenGraph, defaultTwitter } from "@/lib/seo";
import { QiblaPage } from "@/features/qibla/components/qibla-page";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "qibla" });
  const pathByLocale = Object.fromEntries(
    LOCALES.map((l) => [l, `/${l}/qibla`]),
  ) as Record<Locale, string>;
  const { canonical, languages } = localeAlternates(locale, pathByLocale);
  return {
    title: t("title"),
    alternates: { canonical, languages },
    openGraph: { ...defaultOpenGraph(locale), title: t("title"), url: canonical },
    twitter: defaultTwitter(),
  };
}

export default async function QiblaRoute({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <QiblaPage locale={locale} />;
}
