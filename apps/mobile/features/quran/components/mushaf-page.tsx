import { View } from "react-native";

import { Text } from "@/components/ui/text";
import { cn } from "@/lib/cn";
import {
  BANNER_NAME_RATIO,
  BISMILLAH_RATIO,
  DIACRITIC_LINE_RATIO,
} from "../lib/fit-mushaf-font";
import { ayahMarker } from "../lib/page-groups";
import type { PageSegment } from "@repo/shared-core/schemas/quran";

// Uthmani Bismillah — Quranic text, not a UI string, so it lives as a module
// constant rather than an i18n key (same literal apps/web/app/[locale]/quran/
// [surah]/page.tsx:84 renders before its Reader).
export const BISMILLAH = "بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ";

export interface MushafSegmentProps {
  segment: PageSegment;
  // Resolved ayah font size in dp — already auto-fitted to the page's measured
  // reading area AND multiplied by the user's fontScale pref (see
  // ../lib/fit-mushaf-font.ts). The banner and Bismillah derive from it so the
  // whole segment scales as one block.
  fontSize: number;
  activeGlobal: number | null;
  selectedGlobal: number | null;
  onSelectAyah: (numberGlobal: number) => void;
}

// One surah-run within a Mushaf (Safha) page: a lightweight EN/AR surah-name
// banner (same title-pairing treatment as the Reader's own header), the
// segment's Bismillah when the API says this segment opens a new surah on the
// page, then its ayahs as one justified Uthmani paragraph with inline U+06DD
// end-of-ayah markers. A page can hold 2+ segments (short surahs sharing a
// page, common in juz 30) — features/quran/components/reader.tsx renders one
// of these per PageReader.segments entry; the Page/Juz footer renders once at
// the page level, not per segment. Mobile-only; no web/extension equivalent yet.
export function MushafSegment({
  segment,
  fontSize,
  activeGlobal,
  selectedGlobal,
  onSelectAyah,
}: MushafSegmentProps) {
  return (
    <View className="gap-4 border-b border-border pb-6 pt-4">
      {/* Centered surah banner: gilded Arabic name, EN name + meaning as a small
          muted subtitle beneath. No SVG artwork — Text/CSS only, per the
          mushaf-redesign decision. No bracket glyphs (web parity). This stays
          per-segment rather than being hoisted into the reader's fixed header:
          `segments[0]` is whichever surah owns the page's FIRST ayah, which for
          a surah starting mid-page is the PRECEDING one — a page-level header
          built from it would caption Quraysh's page "Al-Fil". */}
      <View className="items-center gap-2">
        {/* Explicit lineHeight is REQUIRED, not cosmetic: the Uthmani font's
            diacritics sit far above the cap height, and with RN's default line
            box they overflow onto whatever follows — the surah name was
            visually colliding with the EN subtitle below it. 1.6x clears the
            tallest marks. Same reason for the Bismillah below. */}
        <Text
          className="text-center font-quran text-primary"
          style={{
            fontSize: fontSize * BANNER_NAME_RATIO,
            lineHeight: fontSize * BANNER_NAME_RATIO * DIACRITIC_LINE_RATIO,
            writingDirection: "rtl",
          }}
        >
          {segment.surah.name.ar}
        </Text>
        <Text variant="muted" className="text-center">
          {segment.surah.name.en} · {segment.surah.meaning}
        </Text>
      </View>

      {segment.showBismillah ? (
        <Text
          className="text-center font-quran text-text"
          style={{
            fontSize: fontSize * BISMILLAH_RATIO,
            lineHeight: fontSize * BISMILLAH_RATIO * DIACRITIC_LINE_RATIO,
            writingDirection: "rtl",
          }}
        >
          {BISMILLAH}
        </Text>
      ) : null}

      {/* Android `textAlign: "justify"` needs API 26+ — below that it silently
          falls back to start-aligned text (no crash, no blank page).
          `writingDirection` only affects iOS; Android resolves RTL from the
          first strong Arabic character, same as ayah-row.tsx today. */}
      <Text
        className="font-quran text-text"
        style={{
          fontSize,
          lineHeight: fontSize * 2.2,
          textAlign: "justify",
          writingDirection: "rtl",
        }}
      >
        {segment.ayahs.map((ayah) => (
          // Every nested span MUST restate fontSize/lineHeight. <Text>'s default
          // variant="body" injects `text-base` (16dp / 24dp line), and on a child
          // span that beats the size inherited from this paragraph's inline
          // style — so without this the whole mushaf renders at 16dp no matter
          // what the parent asks for. Device-confirmed 2026-07-25: this is why
          // the paragraph never actually rendered at its nominal 24dp, and why
          // the Bismillah (no nested children) scaled correctly while the ayahs
          // did not. ayah-row.tsx is unaffected — its text is a direct string
          // child, so only its marker span was ever shrunk.
          <Text
            key={ayah.numberGlobal}
            testID={`mushaf-ayah-${ayah.numberGlobal}`}
            accessibilityRole="button"
            onPress={() => onSelectAyah(ayah.numberGlobal)}
            style={{ fontSize, lineHeight: fontSize * 2.2 }}
            className={cn(
              selectedGlobal === ayah.numberGlobal && "bg-surface-2",
              activeGlobal === ayah.numberGlobal && "text-primary",
            )}
          >
            {ayah.textUthmani}{" "}
            <Text className="text-primary" style={{ fontSize, lineHeight: fontSize * 2.2 }}>
              {ayahMarker(ayah.ayahInSurah)}
            </Text>{" "}
          </Text>
        ))}
      </Text>
    </View>
  );
}
