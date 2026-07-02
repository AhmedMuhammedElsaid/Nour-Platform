import { useEffect, useState } from "react";

import { reciterGradient, reciterInitials } from "@repo/shared-core/quran/reciter-avatar";

import { fetchReciters, type QuranReciter } from "../lib/content";
import { useI18n } from "../lib/i18n";

// Home "Readers" shelf — a horizontal row of Quran reciters. Tapping a reader
// sets it as the active reader voice (nour.quran.prefs) and opens the Quran view,
// so any surah opened afterward recites in that voice. Mirrors the web ReadersShelf
// and the newtab continue-listening shelf.
export function ReadersShelf({ onSelect }: { onSelect: (slug: string) => void }) {
  const { t, locale } = useI18n();
  const [reciters, setReciters] = useState<QuranReciter[]>([]);

  useEffect(() => {
    void fetchReciters()
      .then(setReciters)
      .catch(() => {});
  }, []);

  // Drop any row without a usable slug/name so a malformed API response can never
  // break the home view (a reciter with no slug is unselectable anyway).
  const usable = reciters.filter(
    (r) => typeof r.slug === "string" && r.slug.length > 0 && typeof r.name === "string",
  );
  if (usable.length === 0) return null;

  return (
    <section className="space-y-3">
      <h2 className="text-xs font-semibold uppercase tracking-[0.08em] text-text-2">
        {t("home.reciters")}
      </h2>
      <ul className="shelf-scroll flex gap-4 overflow-x-auto pb-2 pt-1">
        {usable.map((reciter) => {
          const displayName =
            locale === "ar" && reciter.arabicName ? reciter.arabicName : reciter.name;
          return (
            <li key={reciter.slug} className="shrink-0 w-24">
              <button
                type="button"
                onClick={() => onSelect(reciter.slug)}
                aria-label={displayName}
                className="group flex w-full flex-col items-center gap-2 rounded-2xl p-2 text-center transition-all duration-200 hover:-translate-y-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
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

// Circular avatar: the reciter photo when present, else a deterministic gradient
// + initials fallback. `onError` degrades a set-but-missing image to the same
// fallback so a not-yet-uploaded photo never shows a broken image.
function ReaderAvatar({ reciter }: { reciter: QuranReciter }) {
  const [broken, setBroken] = useState(false);
  const [gradFrom, gradTo] = reciterGradient(reciter.slug);

  if (reciter.image && !broken) {
    return (
      <div className="relative aspect-square w-20 overflow-hidden rounded-full ring-1 ring-border">
        <img
          src={reciter.image}
          alt=""
          loading="lazy"
          className="size-full object-cover transition-transform group-hover:scale-105"
          onError={() => setBroken(true)}
        />
      </div>
    );
  }

  return (
    <div
      className="flex aspect-square w-20 items-center justify-center rounded-full ring-1 ring-border"
      style={{ background: `linear-gradient(to bottom, ${gradFrom}, ${gradTo})` }}
    >
      <span className="select-none text-lg font-semibold text-white/90" aria-hidden="true">
        {reciterInitials(reciter.name)}
      </span>
    </div>
  );
}
