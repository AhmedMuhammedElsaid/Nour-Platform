// Dumb RNAW widget tree for the "NourHome" OS home-screen widget
// (home_widget_plan.md §5). Pure presentation — all data comes from the
// three builders (build-prayer-rows / build-radio-row / build-adhkar-row)
// plus the arc SVG string (build-arc-svg.ts), composed by
// render-nour-home-widget.tsx. RNAW rasterizes this tree to a bitmap (not
// native text), so NativeWind/Tailwind classes cannot reach it — style
// values are raw RNAW style objects. FlexWidget has no `gap` — use
// `flexGap` (RNAW-specific) or margins for spacing between siblings.
//
// Colors are hardcoded hex, each commented against the token it mirrors in
// packages/ui/src/styles/tokens.css (dark theme) — same sanctioned exception
// to the no-inline-hex rule as the PALETTES const in
// features/prayer-times/components/sun-arc.tsx, since a widget bitmap has no
// Tailwind/CSS pipeline to draw tokens from.
//
// ⚠️ NEVER use a React Fragment (`<>...</>`) as a widget child, even to group
// a conditionally-reordered run of siblings (e.g. the RTL next-prayer row
// below). RNAW's buildWidgetTree walks `element.type` and calls it as a
// function for anything that isn't a real widget descriptor
// (`while (!jsxTree.type.__name__) { jsxTree = jsxTree.type(jsxTree.props); }`
// in build-widget-tree.ts) — a Fragment's type is `Symbol(react.fragment)`,
// which isn't callable, so it throws `TypeError: ... is not a function`
// deep inside the tree builder. Because that throw happens inside the
// headless widget task, React Native's task-finish machinery still reports
// the task as SUCCESSFUL, so nothing ever fails visibly — the widget just
// stays on whatever it last rendered (blank on first add). Use a plain
// array of children (with `key`s) instead — buildWidgetTree already
// flattens arrays via `.flat(1)`. See __tests__/nour-home-widget.test.tsx.
import { FlexWidget, SvgWidget, TextWidget } from "react-native-android-widget";

import { ARC } from "@repo/shared-core/prayer-times/sun-arc";

import type { AdhkarRowResult } from "@/features/adhkar/widget/build-adhkar-row";
import type { PrayerRowsResult } from "@/features/prayer-times/widget/build-prayer-rows";
import type { RadioRowResult } from "@/features/radio/widget/build-radio-row";

const BG = "#1c1915"; // --color-surface
const GOLD = "#c8a050"; // --color-primary / brand gold
const SUN = "#e4c57e"; // --color-sun — next-prayer/hijri-date tint (prayer-times-widget.tsx:154)
const TEXT = "#f0e6cc"; // --color-text (dark theme)
const MUTED = "#8a7a62"; // --color-text-2 (dark theme)
const ROW_HIGHLIGHT_BG = "#252018"; // --color-surface-2
const DIVIDER = "rgba(200, 160, 80, 0.15)"; // --color-border (dark theme)
const ICON_CHIP_BG = "rgba(200, 160, 80, 0.10)"; // --color-primary/10 — adhkar-preview-shelf.tsx icon chip

// The arc SVG's own viewBox is 600x150 (ARC.w/ARc.h) — scale height to the
// widget's actual rendered width, capped so a very wide/short cell doesn't
// blow up the arc past a sane portion of the widget's height.
const ARC_ASPECT = ARC.h / ARC.w;
const ARC_MAX_HEIGHT = 130;

export type NourHomeWidgetProps = {
  width: number;
  height: number;
  locale: "ar" | "en";
  hijriDateLabel: string;
  arcSvg: string;
  prayer: PrayerRowsResult;
  radio: RadioRowResult;
  adhkar: AdhkarRowResult;
};

export function NourHomeWidget({
  width,
  height,
  locale,
  hijriDateLabel,
  arcSvg,
  prayer,
  radio,
  adhkar,
}: NourHomeWidgetProps) {
  const radioLabel = radio.label;
  const arcHeight = Math.min(Math.round(width * ARC_ASPECT), ARC_MAX_HEIGHT);

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
      {/* Header — city + hijri date, tap → /prayer-times */}
      <FlexWidget
        clickAction="OPEN_URI"
        clickActionData={{ uri: "nour:///prayer-times" }}
        accessibilityLabel={prayer.city}
        style={{
          flexDirection: "row",
          width: "match_parent",
          justifyContent: "space-between",
          paddingLeft: 14,
          paddingRight: 14,
          paddingTop: 10,
        }}
      >
        <TextWidget text={`🕌 ${prayer.city}`} style={{ color: GOLD, fontSize: 14, fontWeight: "bold" }} />
        <TextWidget text={hijriDateLabel} style={{ color: SUN, fontSize: 11 }} />
      </FlexWidget>

      {/* Sun/moon arc — dynamic SVG string, regenerated each refresh. This
          wrapper is the widget's flexible region: `flex: 1` (LinearLayout
          weight, same prop the prayer cells below use) lets it absorb any
          launcher height beyond the fixed rows, so the rows stay flush at
          the bottom instead of leaving a large empty void. The inner
          SvgWidget keeps explicit numeric width/height so the centered
          child preserves the 600:150 aspect inside the now-flexible band. */}
      <FlexWidget
        style={{ width: "match_parent", flex: 1, justifyContent: "center", alignItems: "center", paddingTop: 2 }}
      >
        <SvgWidget svg={arcSvg} style={{ width, height: arcHeight }} />
      </FlexWidget>

      {/* Next-prayer remaining time — static H:MM (no live ticking; the
          bitmap can't animate), not the in-app PrayerCountdown's mm:ss.
          Order mirrors PrayerCountdown's "label → name → countdown" reading
          order (prayer-countdown.tsx) — but unlike a plain RN <View>, RNAW's
          FlexWidget has NO automatic RTL mirroring (confirmed: no
          layoutDirection/RTL handling anywhere in the library, and the
          existing prayer-time cells below already render in fixed
          chronological left-to-right order in Arabic, unmirrored). So for
          "ar" the child order is manually reversed here to reproduce the
          same right-to-left READING order RN produces automatically —
          the one deliberate exception to "never flex-row-reverse" (CLAUDE.md
          §4.3), since that rule assumes RN's dir="rtl" auto-mirror, which
          RNAW doesn't have. */}
      {prayer.next ? (
        <FlexWidget
          clickAction="OPEN_URI"
          clickActionData={{ uri: "nour:///prayer-times" }}
          accessibilityLabel={`${prayer.next.title} ${prayer.next.name} ${prayer.next.remaining}`}
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            width: "match_parent",
            paddingTop: 2,
            flexGap: 6,
          }}
        >
          {locale === "ar"
            ? [
                <TextWidget
                  key="remaining"
                  text={prayer.next.remaining}
                  style={{ color: SUN, fontSize: 16, fontWeight: "bold" }}
                />,
                <TextWidget
                  key="name"
                  text={prayer.next.name}
                  style={{ color: GOLD, fontSize: 13, fontWeight: "bold" }}
                />,
                <TextWidget key="title" text={prayer.next.title} style={{ color: MUTED, fontSize: 9 }} />,
              ]
            : [
                <TextWidget key="title" text={prayer.next.title} style={{ color: MUTED, fontSize: 9 }} />,
                <TextWidget
                  key="name"
                  text={prayer.next.name}
                  style={{ color: GOLD, fontSize: 13, fontWeight: "bold" }}
                />,
                <TextWidget
                  key="remaining"
                  text={prayer.next.remaining}
                  style={{ color: SUN, fontSize: 16, fontWeight: "bold" }}
                />,
              ]}
        </FlexWidget>
      ) : null}

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
          paddingTop: 4,
          paddingBottom: 8,
        }}
      >
        <FlexWidget style={{ flexDirection: "row", width: "match_parent", justifyContent: "space-between" }}>
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
              <TextWidget text={row.label} style={{ color: row.isNext ? GOLD : MUTED, fontSize: 9 }} />
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

      {/* Adhkar row — row itself → /adhkar (tap outside an icon), each icon → its own set */}
      <FlexWidget
        clickAction="OPEN_URI"
        clickActionData={{ uri: "nour:///adhkar" }}
        accessibilityLabel={adhkar.title}
        style={{
          flexDirection: "column",
          width: "match_parent",
          paddingLeft: 14,
          paddingRight: 14,
          paddingTop: 8,
          paddingBottom: 8,
        }}
      >
        <FlexWidget style={{ flexDirection: "row", width: "match_parent", justifyContent: "space-between" }}>
          {adhkar.items.map((item, index) => (
            <FlexWidget
              key={`${item.uri}-${index}`}
              clickAction="OPEN_URI"
              clickActionData={{ uri: item.uri }}
              accessibilityLabel={`${adhkar.title} ${item.icon}`}
              style={{
                width: 28,
                height: 28,
                borderRadius: 10,
                backgroundColor: ICON_CHIP_BG,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <TextWidget text={item.icon} style={{ fontSize: 14 }} />
            </FlexWidget>
          ))}
        </FlexWidget>
      </FlexWidget>

      <FlexWidget style={{ height: 1, width: "match_parent", backgroundColor: DIVIDER }} />

      {/* Radio row — whole row → /radio (no per-station route exists) */}
      <FlexWidget
        clickAction="OPEN_URI"
        clickActionData={{ uri: "nour:///radio" }}
        accessibilityLabel={radioLabel}
        style={{
          flexDirection: "column",
          width: "match_parent",
          paddingLeft: 14,
          paddingRight: 14,
          paddingTop: 8,
          paddingBottom: 10,
        }}
      >
        {radio.stations.length > 0 ? (
          <FlexWidget style={{ flexDirection: "row", width: "match_parent", flexGap: 6 }}>
            {radio.stations.map((name, index) => (
              <FlexWidget
                key={`${name}-${index}`}
                style={{
                  flex: 1,
                  borderRadius: 10,
                  backgroundColor: ICON_CHIP_BG,
                  paddingLeft: 8,
                  paddingRight: 8,
                  paddingTop: 4,
                  paddingBottom: 4,
                }}
              >
                <TextWidget text={name} style={{ color: TEXT, fontSize: 11 }} truncate="END" maxLines={1} />
              </FlexWidget>
            ))}
          </FlexWidget>
        ) : (
          // No recent/favorite station resolved — a single generic pill (NOT
          // the removed row-title text) keeps the row from rendering empty.
          // Row wrapper (not FlexWidget's unsupported alignSelf) keeps it
          // hugging the start instead of stretching full width.
          <FlexWidget style={{ flexDirection: "row", width: "match_parent", justifyContent: "flex-start" }}>
            <FlexWidget
              style={{
                borderRadius: 10,
                backgroundColor: ICON_CHIP_BG,
                paddingLeft: 8,
                paddingRight: 8,
                paddingTop: 4,
                paddingBottom: 4,
              }}
            >
              <TextWidget text={radioLabel} style={{ color: TEXT, fontSize: 11 }} />
            </FlexWidget>
          </FlexWidget>
        )}
      </FlexWidget>
    </FlexWidget>
  );
}
