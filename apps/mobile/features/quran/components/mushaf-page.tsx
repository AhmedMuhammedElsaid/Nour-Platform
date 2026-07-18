import { View } from "react-native";
import { useTranslation } from "react-i18next";

import { Text } from "@/components/ui/text";
import { cn } from "@/lib/cn";
import { ayahMarker, type AyahPageGroup } from "../lib/page-groups";

// Uthmani Bismillah — Quranic text, not a UI string, so it lives as a module
// constant rather than an i18n key (same literal apps/web/app/[locale]/quran/
// [surah]/page.tsx:84 renders before its Reader).
const BISMILLAH = "بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ";

export interface MushafPageProps {
  group: AyahPageGroup;
  fontScale: number;
  showBismillah: boolean;
  activeGlobal: number | null;
  selectedGlobal: number | null;
  onSelectAyah: (numberGlobal: number) => void;
}

// One Mushaf (Safha) page block: the page's ayahs flow as one justified
// Uthmani paragraph with inline U+06DD end-of-ayah markers (upgrading list
// mode's Western-digit badge — same nested-Text idiom as ayah-row.tsx:85-91,
// proven to render there), instead of AyahRow's one-ayah-per-row layout.
// Mobile-only; no web/extension equivalent yet.
export function MushafPage({
  group,
  fontScale,
  showBismillah,
  activeGlobal,
  selectedGlobal,
  onSelectAyah,
}: MushafPageProps) {
  const { t } = useTranslation();

  return (
    <View className="border-b border-border pb-6 pt-4">
      {showBismillah ? (
        <Text
          className="mb-4 text-center font-quran text-text"
          style={{ fontSize: 24 * fontScale, writingDirection: "rtl" }}
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
        {group.ayahs.map((ayah) => (
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

      <View className="mt-4 items-center border-t border-border pt-3">
        <Text variant="muted">
          {t("quran.pageN", { number: group.page })} · {t("quran.juzN", { number: group.juz })}
        </Text>
      </View>
    </View>
  );
}
