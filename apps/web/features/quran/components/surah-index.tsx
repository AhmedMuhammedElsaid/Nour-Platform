import type { QuranSurah } from "@repo/api/schemas/quran";
import { Link } from "@/i18n/navigation";

export function SurahIndex({ surahs }: { surahs: QuranSurah[] }) {
  return (
    <ul className="divide-border divide-y">
      {surahs.map((s) => (
        <li key={s.number}>
          <Link
            href={`/quran/${s.number}`}
            className="hover:bg-primary/5 flex items-center gap-3 px-2 py-3"
          >
            <span className="bg-primary/15 text-primary inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-medium">
              {s.number}
            </span>
            <span className="min-w-0 flex-1">
              <span className="text-text block font-medium">{s.name.en}</span>
              <span className="text-text-2 block text-sm">
                {s.meaning} · {s.ayahCount} ayahs · {s.revelationPlace}
              </span>
            </span>
            <span dir="rtl" className="font-quran text-primary text-xl">
              {s.name.ar}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
