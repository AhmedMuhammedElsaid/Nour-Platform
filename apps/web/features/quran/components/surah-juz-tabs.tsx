"use client";

import { useState } from "react";
import type { QuranSurah } from "@repo/api/schemas/quran";
import { JuzShelf } from "./juz-shelf";
import { SurahIndex } from "./surah-index";

export function SurahJuzTabs({ surahs }: { surahs: QuranSurah[] }) {
  const [tab, setTab] = useState<"surah" | "juz">("surah");
  return (
    <div>
      <div role="tablist" className="border-border mb-4 flex gap-2 border-b">
        {(["surah", "juz"] as const).map((t) => (
          <button
            key={t}
            role="tab"
            type="button"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm capitalize ${
              tab === t ? "text-primary border-primary border-b-2" : "text-text-2"
            }`}
          >
            {t}
          </button>
        ))}
      </div>
      {tab === "surah" ? <SurahIndex surahs={surahs} /> : <JuzShelf surahs={surahs} />}
    </div>
  );
}
