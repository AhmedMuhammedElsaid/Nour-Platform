import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { getSurahReader } from "@repo/api/services/quran";
import { isLocale, type Locale } from "@repo/api/schemas/locale";
import type { SurahReader } from "@repo/api/schemas/quran";

export const dynamic = "force-dynamic";

import { Reader } from "@/features/quran/components/reader";

interface PageProps {
  params: Promise<{ locale: string; surah: string }>;
  searchParams: Promise<{ translation?: string; reciter?: string }>;
}

function parseSurah(raw: string): number | null {
  const n = Number(raw);
  return Number.isInteger(n) && n >= 1 && n <= 114 ? n : null;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { surah } = await params;
  const n = parseSurah(surah);
  if (n === null) return { title: "Quran", robots: { index: false } };
  try {
    const data = await getSurahReader(n, {});
    return { title: data.surah.name.en };
  } catch {
    return { title: "Quran", robots: { index: false } };
  }
}

export default async function SurahReaderPage({ params, searchParams }: PageProps) {
  const { locale, surah } = await params;
  const { translation, reciter } = await searchParams;
  const n = parseSurah(surah);
  if (n === null) notFound();

  const loc: Locale = isLocale(locale) ? locale : "ar";
  setRequestLocale(loc);

  let data: SurahReader;
  try {
    data = await getSurahReader(n, {
      locale: loc,
      ...(translation ? { translationSlug: translation } : {}),
      ...(reciter ? { reciterSlug: reciter } : {}),
    });
  } catch {
    notFound();
  }

  const t = await getTranslations("quran");
  const translationDir = data.translationEdition?.dir ?? "ltr";

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <header className="border-border mb-4 border-b pb-4 text-center">
        <h1 dir="rtl" className="font-quran text-primary text-3xl">
          {data.surah.name.ar}
        </h1>
        <p className="text-text-2 mt-1 text-sm">
          {data.surah.name.en} · {data.surah.meaning} · {data.surah.ayahCount}{" "}
          {t("ayahs")}
        </p>
        {data.surah.bismillahPre ? (
          <p dir="rtl" className="font-quran text-text mt-4 text-2xl">
            بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ
          </p>
        ) : null}
      </header>
      <Reader data={data} translationDir={translationDir} locale={loc} />
    </div>
  );
}
