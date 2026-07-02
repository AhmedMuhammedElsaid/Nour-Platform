import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { LOCALES, type Locale } from "@repo/api/schemas/locale";
import { listStations } from "@repo/api/services/radio";
import { localeAlternates, defaultOpenGraph, defaultTwitter } from "@/lib/seo";
import { RadioPage } from "@/features/radio/components/radio-page";
import type { StationView } from "@/features/radio/types";

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
  const views: StationView[] = stations.map((s) => ({
    id: s.id,
    slug: s.slug,
    name: s[locale].name,
    ...(s[locale].description ? { description: s[locale].description } : {}),
    country: s.country,
    ...(s.city ? { city: s.city } : {}),
    ...(s.image ? { image: s.image } : {}),
    streamUrl: s.streamUrl,
    isFeatured: s.isFeatured,
  }));

  return <RadioPage stations={views} />;
}
