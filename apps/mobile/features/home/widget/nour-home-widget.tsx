// Dumb RNAW widget tree for the "NourHome" OS home-screen widget
// (home_widget_plan.md §5.8). Pure presentation — all data comes from the
// three builders (build-prayer-rows / build-radio-row / build-adhkar-row),
// composed by widget-task-handler.tsx. RNAW rasterizes this tree to a bitmap
// (not native text), so NativeWind/Tailwind classes cannot reach it — style
// values are raw RNAW style objects.
//
// Colors are hardcoded hex, each commented against the token it mirrors in
// packages/ui/src/styles/tokens.css (dark theme) — same sanctioned exception
// to the no-inline-hex rule as the PALETTES const in
// features/prayer-times/components/sun-arc.tsx, since a widget bitmap has no
// Tailwind/CSS pipeline to draw tokens from.
import { FlexWidget, TextWidget } from "react-native-android-widget";

import type { PrayerRowsResult } from "@/features/prayer-times/widget/build-prayer-rows";
import type { RadioRowResult } from "@/features/radio/widget/build-radio-row";
import type { AdhkarRowResult } from "@/features/adhkar/widget/build-adhkar-row";

// bg-surface, not the darker app-bg — the widget itself IS the card, same as
// the in-app PrayerTimesWidget's own bg-surface card (home_widget_plan.md §5.8).
const BG = "#1c1915"; // --color-surface
const GOLD = "#c8a050"; // --color-primary / brand gold
const SUN = "#e4c57e"; // --color-sun — next-prayer time tint (prayer-times-widget.tsx:154)
const TEXT = "#f0e6cc"; // --color-text (dark theme)
const MUTED = "#8a7a62"; // --color-text-2 (dark theme)
const ROW_HIGHLIGHT_BG = "#252018"; // --color-surface-2
const DIVIDER = "rgba(200, 160, 80, 0.15)"; // --color-border (dark theme)
const ICON_CHIP_BG = "rgba(200, 160, 80, 0.10)"; // --color-primary/10 — adhkar-preview-shelf.tsx icon chip

export type NourHomeWidgetProps = {
  width: number;
  height: number;
  locale: "ar" | "en";
  prayer: PrayerRowsResult;
  radio: RadioRowResult;
  adhkar: AdhkarRowResult;
};

export function NourHomeWidget({ width, height, locale, prayer, radio, adhkar }: NourHomeWidgetProps) {
  const radioText = radio.stationName ?? radio.label;
  const radioIcon = "🔊";
  const adhkarIcon = "📿";

  return (
    <FlexWidget
      style={{
        width,
        height,
        flexDirection: "column",
        backgroundColor: BG,
        borderRadius: 20,
      }}
    >
      {/* Prayer row — tap → /prayer-times */}
      <FlexWidget
        clickAction="OPEN_URI"
        clickActionData={{ uri: "nour:///prayer-times" }}
        accessibilityLabel={locale === "ar" ? "مواقيت الصلاة" : "Prayer times"}
        style={{
          flexDirection: "column",
          width: "match_parent",
          paddingLeft: 14,
          paddingRight: 14,
          paddingTop: 10,
          paddingBottom: 8,
          flex: 3,
        }}
      >
        <TextWidget
          text={prayer.city}
          style={{ color: GOLD, fontSize: 14, fontWeight: "bold" }}
        />
        <FlexWidget
          style={{ flexDirection: "row", width: "match_parent", marginTop: 6, justifyContent: "space-between" }}
        >
          {prayer.rows.map((row) => (
            <FlexWidget
              key={row.key}
              style={{
                flexDirection: "column",
                alignItems: "center",
                flex: 1,
                paddingTop: 2,
                paddingBottom: 2,
                borderRadius: 8,
                backgroundColor: row.isNext ? ROW_HIGHLIGHT_BG : BG,
              }}
            >
              <TextWidget
                text={row.label}
                style={{ color: row.isNext ? GOLD : MUTED, fontSize: 9 }}
              />
              <TextWidget
                text={row.time}
                style={{
                  color: row.isNext ? SUN : TEXT,
                  fontSize: 11,
                  fontWeight: row.isNext ? "bold" : "normal",
                  marginTop: 2,
                }}
              />
            </FlexWidget>
          ))}
        </FlexWidget>
      </FlexWidget>

      <FlexWidget style={{ height: 1, width: "match_parent", backgroundColor: DIVIDER }} />

      {/* Radio row — tap → /radio (regardless of whether a name resolved) */}
      <FlexWidget
        clickAction="OPEN_URI"
        clickActionData={{ uri: "nour:///radio" }}
        accessibilityLabel={radioText}
        style={{
          flexDirection: "row",
          alignItems: "center",
          width: "match_parent",
          paddingLeft: 14,
          paddingRight: 14,
          paddingTop: 8,
          paddingBottom: 8,
          flex: 1,
        }}
      >
        <FlexWidget
          style={{
            width: 28,
            height: 28,
            borderRadius: 10,
            backgroundColor: ICON_CHIP_BG,
            alignItems: "center",
            justifyContent: "center",
            marginRight: 10,
            marginLeft: 10,
          }}
        >
          <TextWidget text={radioIcon} style={{ fontSize: 14 }} />
        </FlexWidget>
        <TextWidget text={radioText} style={{ color: TEXT, fontSize: 12 }} truncate="END" maxLines={1} />
      </FlexWidget>

      <FlexWidget style={{ height: 1, width: "match_parent", backgroundColor: DIVIDER }} />

      {/* Adhkar row — tap → /adhkar */}
      <FlexWidget
        clickAction="OPEN_URI"
        clickActionData={{ uri: "nour:///adhkar" }}
        accessibilityLabel={adhkar.label}
        style={{
          flexDirection: "row",
          alignItems: "center",
          width: "match_parent",
          paddingLeft: 14,
          paddingRight: 14,
          paddingTop: 8,
          paddingBottom: 8,
          flex: 1,
        }}
      >
        <FlexWidget
          style={{
            width: 28,
            height: 28,
            borderRadius: 10,
            backgroundColor: ICON_CHIP_BG,
            alignItems: "center",
            justifyContent: "center",
            marginRight: 10,
            marginLeft: 10,
          }}
        >
          <TextWidget text={adhkarIcon} style={{ fontSize: 14 }} />
        </FlexWidget>
        <TextWidget text={adhkar.label} style={{ color: TEXT, fontSize: 12 }} />
      </FlexWidget>
    </FlexWidget>
  );
}
