import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { LOCALES, type Locale } from "@repo/api/schemas/locale";
import { listStations } from "@repo/api/services/radio";
import { localeAlternates, defaultOpenGraph, defaultTwitter } from "@/lib/seo";
import { RadioPage } from "@/features/radio/components/radio-page";
import { toStationView } from "@/features/radio/lib/station-view";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "radio" });
  const pathByLocale = Object.fromEntries(
    LOCALES.map((l) => [l, `/${l}/radio`]),
  ) as Record<Locale, string>;
  const { canonical, languages } = localeAlternates(locale, pathByLocale);
  return {
    title: t("title"),
    description: t("subtitle"),
    alternates: { canonical, languages },
    openGraph: { ...defaultOpenGraph(locale), title: t("title"), url: canonical },
    twitter: defaultTwitter(),
  };
}

export default async function RadioRoute({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const stations = await listStations();
  const views = stations.map((s) => toStationView(s, locale));

  return <RadioPage stations={views} />;
}
