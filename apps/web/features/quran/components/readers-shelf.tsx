"use client";

import { useState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";

import type { QuranReciter } from "@repo/api/schemas/quran";
import type { Locale } from "@repo/api/schemas/locale";
import { reciterGradient, reciterInitials } from "@repo/shared-core/quran/reciter-avatar";

import { useRouter } from "@/i18n/navigation";
import { loadPrefs, savePrefs } from "@/features/quran/lib/quran-prefs";

// Home "Readers" shelf — a horizontal row of Quran reciters. Tapping a reader
// sets it as the active reader voice (nour.quran.prefs) AND opens Al-Fatiha in
// that voice with playback auto-started. `?reciter=` makes the RSC fetch that
// reciter's ayah audio (it can't read localStorage); `?autoplay=1` tells the
// Reader to start playing on mount. Client island: it writes localStorage and
// navigates.
export function ReadersShelf({
  reciters,
  locale,
}: {
  reciters: QuranReciter[];
  locale: Locale;
}) {
  const t = useTranslations("home");
  const router = useRouter();

  if (reciters.length === 0) return null;

  const selectReader = (slug: string): void => {
    savePrefs({ ...loadPrefs(), reciterSlug: slug });
    router.push(`/quran/1?reciter=${encodeURIComponent(slug)}&autoplay=1`);
  };

  return (
    <section aria-labelledby="readers-heading" className="mt-8">
      <h2 id="readers-heading" className="text-lg font-semibold">
        {t("readers")}
      </h2>

      <ul className="mt-3 flex gap-4 overflow-x-auto pb-2 pt-2">
        {reciters.map((reciter) => {
          const displayName =
            locale === "ar" && reciter.arabicName ? reciter.arabicName : reciter.name;
          return (
            <li key={reciter.slug} className="shrink-0 w-28">
              <button
                type="button"
                onClick={() => selectReader(reciter.slug)}
                aria-label={displayName}
                className="group flex w-full flex-col items-center gap-2 rounded-2xl p-2 text-center transition-all duration-200 hover:-translate-y-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <ReaderAvatar reciter={reciter} />
                <span className="line-clamp-2 w-full text-xs font-medium text-text group-hover:text-primary">
                  {displayName}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// Circular avatar: the reciter photo when present, else a deterministic
// gradient + initials fallback. `onError` degrades a set-but-missing image to
// the same fallback so a not-yet-uploaded photo never shows a broken image.
function ReaderAvatar({ reciter }: { reciter: QuranReciter }) {
  const [broken, setBroken] = useState(false);
  const [from, to] = reciterGradient(reciter.slug);

  if (reciter.image && !broken) {
    return (
      <div className="relative aspect-square w-20 overflow-hidden rounded-full ring-1 ring-border">
        <Image
          src={reciter.image}
          alt=""
          fill
          unoptimized
          sizes="80px"
          className="object-cover transition-transform group-hover:scale-105"
          onError={() => setBroken(true)}
        />
      </div>
    );
  }

  return (
    <div
      className="flex aspect-square w-20 items-center justify-center rounded-full ring-1 ring-border"
      style={{ background: `linear-gradient(to bottom, ${from}, ${to})` }}
    >
      <span className="text-lg font-semibold text-white/90 select-none" aria-hidden="true">
        {reciterInitials(reciter.name)}
      </span>
    </div>
  );
}
