import { BISMILLAH_UTHMANI } from "@repo/shared-core/quran/basmala";
import { memo, useMemo } from "react";
import { View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";

import { Text } from "@/components/ui/text";
import { cn } from "@/lib/cn";
import { useTheme } from "@/lib/theme-context";
import {
  BANNER_NAME_RATIO,
  BISMILLAH_RATIO,
  DIACRITIC_LINE_RATIO,
} from "../lib/fit-mushaf-font";
import { ayahMarker } from "../lib/page-groups";
import type { PageSegment } from "@repo/shared-core/schemas/quran";
import type { PageRow, PageRowWord } from "@repo/shared-core/quran/page-rows";

// Uthmani Bismillah — Quranic text, not a UI string, so it lives as a module
// constant rather than an i18n key (same literal apps/web/app/[locale]/quran/
// [surah]/page.tsx:84 renders before its Reader).
export const BISMILLAH = BISMILLAH_UTHMANI;

// The cartouche ornament follows the app's own `--color-primary`, per theme
// (dark `#c8a050` / light `#9a7830`, apps/mobile/lib/theme-context.tsx).
// react-native-svg fills can't read NativeWind classes/CSS vars (see
// sun-arc.tsx), so the hex is repeated here literally rather than derived.
const ORNAMENT_HEX: Record<"dark" | "light", string> = {
  dark: "#c8a050",
  light: "#9a7830",
};

export interface MushafSegmentProps {
  segment: PageSegment;
  // This segment's own rows (already filtered + ordered by reader.tsx from
  // one page-level `buildPageRows` call), or `null` when the layout data
  // isn't there (pre-seed cache, or partial layout) — the permanent reflow
  // fallback below then renders instead, unchanged from before this change.
  rows: PageRow[] | null;
  // Resolved ayah font size in dp — already auto-fitted to the page's measured
  // reading area AND multiplied by the user's fontScale pref (see
  // ../lib/fit-mushaf-font.ts). The banner and Bismillah derive from it so the
  // whole segment scales as one block.
  fontSize: number;
  activeGlobal: number | null;
  selectedGlobal: number | null;
  onSelectAyah: (numberGlobal: number) => void;
}

// One surah-run within a Mushaf (Safha) page: an ornamental surah-name
// cartouche, the segment's Bismillah when the API says this segment opens a
// new surah on the page, then its ayahs. A page can hold 2+ segments (short
// surahs sharing a page, common in juz 30) — features/quran/components/
// reader.tsx renders one of these per PageReader.segments entry; the
// Page/Juz footer renders once at the page level, not per segment.
//
// Two render paths, mirroring apps/web/features/quran/components/
// mushaf-page-view.tsx:
//  - `rows` present → line-for-line printed-page layout: each printed line is
//    justified flush to both margins, except the surah's TRUE final line,
//    which is centred (as in print).
//  - `rows` is `null` → the ORIGINAL reflowed-paragraph rendering, kept
//    verbatim. This fallback must keep working indefinitely, not just until
//    the word-layout seed lands everywhere.
export const MushafSegment = memo(function MushafSegment({
  segment,
  rows,
  fontSize,
  activeGlobal,
  selectedGlobal,
  onSelectAyah,
}: MushafSegmentProps) {
  // No `gap-4` on the container, on purpose: MushafRows returns a fragment, so
  // a gap here lands between every printed LINE — 16dp on top of each line box,
  // ~240dp on a 15-line page, which no font size could fit in the viewport (see
  // fit-mushaf-font.ts BLOCK_GAP). Line spacing is owned by lineHeight; the
  // banner and Bismillah carry their own `mb-4`.
  return (
    <View className="border-b border-primary/20 pb-6 pt-4">
      {rows ? (
        <MushafRows
          rows={rows}
          segment={segment}
          fontSize={fontSize}
          activeGlobal={activeGlobal}
          selectedGlobal={selectedGlobal}
          onSelectAyah={onSelectAyah}
        />
      ) : (
        <MushafReflow
          segment={segment}
          fontSize={fontSize}
          activeGlobal={activeGlobal}
          selectedGlobal={selectedGlobal}
          onSelectAyah={onSelectAyah}
        />
      )}
    </View>
  );
});

interface MushafRowsProps {
  rows: PageRow[];
  segment: PageSegment;
  fontSize: number;
  activeGlobal: number | null;
  selectedGlobal: number | null;
  onSelectAyah: (numberGlobal: number) => void;
}

// Row-based renderer, fed this segment's slice of the page-level
// `buildPageRows()` output. Only one ayah run per line carries the
// selection/testID contract (see firstLineByAyah below) — same reasoning as
// web's `firstLineByAyah`, adapted since RN has no DOM id to keep unique, just
// a testID that RNTL's getByTestId still expects to be singular.
function MushafRows({
  rows,
  segment,
  fontSize,
  activeGlobal,
  selectedGlobal,
  onSelectAyah,
}: MushafRowsProps) {
  // Built once per `rows` (not per render) and handed down as a STABLE
  // function — an inline arrow here would change identity every render and
  // defeat <MushafLine>'s memo, re-rendering the whole page's word tree on
  // every ayah tap / playback tick.
  const firstLine = useMemo(() => {
    const firstLineByAyah = new Map<number, number>();
    for (const row of rows) {
      if (row.kind !== "line") continue;
      for (const word of row.words) {
        if (!firstLineByAyah.has(word.numberGlobal)) firstLineByAyah.set(word.numberGlobal, row.lineNumber);
      }
    }
    return (numberGlobal: number) => firstLineByAyah.get(numberGlobal);
  }, [rows]);

  return (
    <>
      {rows.map((row, i) => {
        if (row.kind === "surah-banner") {
          // mb-4 replaces the container's old `gap-4` for this element only —
          // printed lines below get their spacing from lineHeight.
          return (
            <View key={`banner-${i}`} className="mb-4">
              <SurahCartouche
                name={segment.surah.name.ar}
                englishName={segment.surah.name.en}
                meaning={segment.surah.meaning}
                fontSize={fontSize}
              />
            </View>
          );
        }
        if (row.kind === "bismillah") {
          return (
            <Text
              key={`bismillah-${i}`}
              className="mb-4 text-center font-quran text-text"
              style={{
                fontSize: fontSize * BISMILLAH_RATIO,
                lineHeight: fontSize * BISMILLAH_RATIO * DIACRITIC_LINE_RATIO,
                writingDirection: "rtl",
              }}
            >
              {BISMILLAH}
            </Text>
          );
        }
        return (
          <MushafLine
            key={`line-${row.lineNumber}`}
            row={row}
            fontSize={fontSize}
            firstLine={firstLine}
            activeGlobal={activeGlobal}
            selectedGlobal={selectedGlobal}
            onSelectAyah={onSelectAyah}
          />
        );
      })}
    </>
  );
}

interface MushafLineProps {
  row: Extract<PageRow, { kind: "line" }>;
  fontSize: number;
  firstLine: (numberGlobal: number) => number | undefined;
  activeGlobal: number | null;
  selectedGlobal: number | null;
  onSelectAyah: (numberGlobal: number) => void;
}

// One printed line, split into runs of consecutive same-ayah words so each
// run can carry its own press handler/testID — same one-span-per-ayah
// contract as the reflow fallback (and web's MushafLine), just narrower when
// an ayah is split across lines.
function MushafLineImpl({ row, fontSize, firstLine, activeGlobal, selectedGlobal, onSelectAyah }: MushafLineProps) {
  const runs: { numberGlobal: number; words: PageRowWord[] }[] = [];
  for (const word of row.words) {
    const last = runs[runs.length - 1];
    if (last && last.numberGlobal === word.numberGlobal) {
      last.words.push(word);
    } else {
      runs.push({ numberGlobal: word.numberGlobal, words: [word] });
    }
  }

  return (
    <Text
      className="font-quran text-text"
      style={{
        fontSize,
        lineHeight: fontSize * 2.2,
        // Android textAlign:"justify" needs API 26+; below that it silently
        // falls back to start-aligned — acceptable degradation, not a bug.
        textAlign: row.endsSurah ? "center" : "justify",
        writingDirection: "rtl",
      }}
    >
      {runs.map((run) => {
        const isActive = activeGlobal === run.numberGlobal;
        const ownsTestId = firstLine(run.numberGlobal) === row.lineNumber;
        // A run's words are joined into ONE string, with only the ayah-end
        // marker (at most one per run — it's always the ayah's final word)
        // as a separate nested span. Mirrors the reflow fallback's structure
        // exactly (single string child + one marker span), not one <Text>
        // per word — RN's Text-in-Text nesting makes every ancestor's
        // computed text content include its descendants', so a per-word
        // <Text> would make BOTH the word's own span and this wrapping run
        // span match the same word text, breaking single-match text queries
        // for no rendering benefit (words never need independent presses).
        const text = run.words.map((w) => w.arabic).join(" ");
        const endsAyahWord = run.words.find((w) => w.endsAyah);
        return (
          // Every nested span MUST restate fontSize/lineHeight — <Text>'s
          // default variant="body" injects text-base, which beats the size
          // inherited from this line's inline style (device-confirmed
          // 2026-07-25, c28dca3).
          <Text
            key={`${row.lineNumber}-${run.numberGlobal}`}
            {...(ownsTestId ? { testID: `mushaf-ayah-${run.numberGlobal}` } : {})}
            accessibilityRole="button"
            onPress={() => onSelectAyah(run.numberGlobal)}
            style={{ fontSize, lineHeight: fontSize * 2.2 }}
            className={cn(
              selectedGlobal === run.numberGlobal && "bg-surface-2",
              isActive && "text-primary",
            )}
          >
            {text}{" "}
            {endsAyahWord ? (
              <Text className="text-primary" style={{ fontSize, lineHeight: fontSize * 2.2 }}>
                {ayahMarker(endsAyahWord.ayahInSurah)}
              </Text>
            ) : null}{" "}
          </Text>
        );
      })}
    </Text>
  );
}

function rowContains(row: MushafLineProps["row"], numberGlobal: number | null): boolean {
  return numberGlobal != null && row.words.some((w) => w.numberGlobal === numberGlobal);
}

// A page holds ~15 lines, each a nested <Text> tree of every word on it. The
// active/selected ayah pointers change on every tap and on every playback
// advance, and a plain re-render rebuilt ALL of those trees. This comparator
// re-renders only the lines that actually contain the ayah whose highlight
// moved (the one losing it and the one gaining it) — everything else bails.
const MushafLine = memo(MushafLineImpl, (prev, next) => {
  if (
    prev.row !== next.row ||
    prev.fontSize !== next.fontSize ||
    prev.firstLine !== next.firstLine ||
    prev.onSelectAyah !== next.onSelectAyah
  ) {
    return false;
  }
  const highlightMoved = (before: number | null, after: number | null) =>
    before !== after && (rowContains(next.row, before) || rowContains(next.row, after));
  return !(
    highlightMoved(prev.activeGlobal, next.activeGlobal) ||
    highlightMoved(prev.selectedGlobal, next.selectedGlobal)
  );
});

interface MushafReflowProps {
  segment: PageSegment;
  fontSize: number;
  activeGlobal: number | null;
  selectedGlobal: number | null;
  onSelectAyah: (numberGlobal: number) => void;
}

// Reflow fallback — identical to the pre-layout rendering, kept verbatim so a
// pre-seed/cached payload never regresses. No SVG cartouche here on purpose:
// this path predates it, and the owner's bar for this change is the rows
// path — not a fallback redesign.
function MushafReflow({ segment, fontSize, activeGlobal, selectedGlobal, onSelectAyah }: MushafReflowProps) {
  return (
    <>
      {/* Centered surah banner: gilded Arabic name, EN name + meaning as a small
          muted subtitle beneath. No SVG artwork here — Text/CSS only, per the
          original mushaf-redesign decision for this fallback path. This stays
          per-segment rather than being hoisted into the reader's fixed header:
          `segments[0]` is whichever surah owns the page's FIRST ayah, which for
          a surah starting mid-page is the PRECEDING one — a page-level header
          built from it would caption Quraysh's page "Al-Fil". */}
      <View className="mb-4 items-center gap-2">
        {/* Explicit lineHeight is REQUIRED, not cosmetic: the Uthmani font's
            diacritics sit far above the cap height, and with RN's default line
            box they overflow onto whatever follows — the surah name was
            visually colliding with the EN subtitle below it. 1.6x clears the
            tallest marks. Same reason for the Bismillah below. */}
        <Text
          className="text-center font-quran text-text"
          style={{
            fontSize: fontSize * BANNER_NAME_RATIO,
            lineHeight: fontSize * BANNER_NAME_RATIO * DIACRITIC_LINE_RATIO,
            writingDirection: "rtl",
          }}
        >
          {segment.surah.name.ar}
        </Text>
        <Text className="text-center text-text-2">
          {segment.surah.name.en} · {segment.surah.meaning}
        </Text>
      </View>

      {segment.showBismillah ? (
        <Text
          className="mb-4 text-center font-quran text-text"
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
    </>
  );
}

interface SurahCartoucheProps {
  name: string;
  englishName?: string;
  meaning?: string;
  fontSize: number;
}

// Ornamental surah-name frame: arabesque end-caps flanking a divider on
// either side of the centred Arabic name — the printed-mushaf equivalent of a
// chapter heading box, ported from web's SurahCartouche. Symmetric layout
// (endcap-divider-name-divider-endcap), so it reads correctly without any
// RTL row-reversal: nothing here depends on paragraph direction.
function SurahCartouche({ name, englishName, meaning, fontSize }: SurahCartoucheProps) {
  const endcapSize = Math.round(fontSize * 0.85);
  return (
    <View className="my-1 gap-1">
      <View className="flex-row items-center gap-3">
        <CartoucheEndcap size={endcapSize} />
        <View className="h-px flex-1 bg-primary/60" />
        <Text
          className="shrink-0 px-1 text-center font-quran text-primary"
          style={{
            fontSize: fontSize * BANNER_NAME_RATIO,
            lineHeight: fontSize * BANNER_NAME_RATIO * DIACRITIC_LINE_RATIO,
            writingDirection: "rtl",
          }}
        >
          {name}
        </Text>
        <View className="h-px flex-1 bg-primary/60" />
        <CartoucheEndcap size={endcapSize} mirrored />
      </View>
      {englishName ? (
        <Text className="text-center text-sm text-text-2">
          {englishName}
          {meaning ? ` · ${meaning}` : ""}
        </Text>
      ) : null}
    </View>
  );
}

// Simple arabesque petal/teardrop motif, ported from web's inline SVG
// (currentColor there; here the ornament hex directly, since react-native-svg
// fills can't read NativeWind classes). react-native-svg REQUIRES an explicit
// numeric root width/height — a percentage-only root silently renders
// nothing (device-confirmed trap from the sun-arc/widget work).
function CartoucheEndcap({ size, mirrored }: { size: number; mirrored?: boolean }) {
  const { theme } = useTheme();
  const ornamentHex = ORNAMENT_HEX[theme];
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      style={mirrored ? { transform: [{ scaleX: -1 }] } : undefined}
    >
      <Path
        d="M12 2c4 3.5 6 7 6 10.5A6 6 0 0 1 12 19a6 6 0 0 1-6-6.5C6 9 8 5.5 12 2Z"
        fill={ornamentHex}
        opacity={0.85}
      />
      <Circle cx={12} cy={12.5} r={2.1} fill={ornamentHex} />
    </Svg>
  );
}
