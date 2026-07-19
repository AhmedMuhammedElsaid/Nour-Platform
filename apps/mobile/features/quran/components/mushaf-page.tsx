import { View } from "react-native";

import { Text } from "@/components/ui/text";
import { cn } from "@/lib/cn";
import { ayahMarker } from "../lib/page-groups";
import type { PageSegment } from "@repo/shared-core/schemas/quran";

// Uthmani Bismillah — Quranic text, not a UI string, so it lives as a module
// constant rather than an i18n key (same literal apps/web/app/[locale]/quran/
// [surah]/page.tsx:84 renders before its Reader).
const BISMILLAH = "بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ";

export interface MushafSegmentProps {
  segment: PageSegment;
  fontScale: number;
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
  fontScale,
  activeGlobal,
  selectedGlobal,
  onSelectAyah,
}: MushafSegmentProps) {
  return (
    <View className="gap-4 border-b border-border pb-6 pt-4">
      {/* Centered ornamental surah banner: gilded Arabic name flanked by plain
          bracket glyphs (﴾ ﴿), EN name as a small muted subtitle beneath. No
          SVG artwork — Text/CSS only, per the mushaf-redesign decision. */}
      <View className="items-center gap-1">
        <Text
          className="text-center font-quran text-3xl text-primary"
          style={{ writingDirection: "rtl" }}
        >
          {"﴾ "}
          {segment.surah.name.ar}
          {" ﴿"}
        </Text>
        <Text variant="muted" className="text-center">
          {segment.surah.name.en}
        </Text>
      </View>

      {segment.showBismillah ? (
        <Text
          className="text-center font-quran text-primary"
          style={{ fontSize: 26 * fontScale, writingDirection: "rtl" }}
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
          fontSize: 24 * fontScale,
          lineHeight: 24 * fontScale * 2.1,
          textAlign: "justify",
          writingDirection: "rtl",
        }}
      >
        {segment.ayahs.map((ayah) => (
          <Text
            key={ayah.numberGlobal}
            testID={`mushaf-ayah-${ayah.numberGlobal}`}
            accessibilityRole="button"
            onPress={() => onSelectAyah(ayah.numberGlobal)}
            className={cn(
              selectedGlobal === ayah.numberGlobal && "bg-surface-2",
              activeGlobal === ayah.numberGlobal && "text-primary",
            )}
          >
            {ayah.textUthmani}{" "}
            <Text className="text-primary">{ayahMarker(ayah.ayahInSurah)}</Text>{" "}
          </Text>
        ))}
      </Text>
    </View>
  );
}
