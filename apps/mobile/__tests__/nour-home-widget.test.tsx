// Regression test for the "Symbol(react.fragment) is not a function" crash
// that silently blanked the NourHome OS widget (2026-07-22 on-device report).
// jest.setup.js globally mocks react-native-android-widget with bare-string
// widget types for every other test — that mock can't catch this bug, since
// the crash lives in the REAL library's buildWidgetTree walking real
// FlexWidget/TextWidget/SvgWidget descriptors. jest.unmock() does NOT reverse
// an explicit jest.mock(name, factory) registered in a setup file (only
// automocking/`__mocks__` files) — re-registering the mock here with the
// real module is what actually overrides it for this test file.
jest.mock("react-native-android-widget", () => jest.requireActual("react-native-android-widget"));

// buildWidgetTree isn't part of the package's public exports (src/index.ts) —
// it's an internal used only by registerWidgetTaskHandler — so it must be
// reached via its compiled deep path (untyped, no .d.ts for a non-exported
// subpath), same commonjs build the top-level import above resolves to (no
// separate module instances).
// eslint-disable-next-line @typescript-eslint/no-require-imports -- deep internal path has no ESM types
const { buildWidgetTree } = require("react-native-android-widget/lib/commonjs/api/build-widget-tree") as {
  buildWidgetTree: (jsxTree: unknown) => unknown;
};

import { NourHomeWidget } from "@/features/home/widget/nour-home-widget";
import type { PrayerRowsResult } from "@/features/prayer-times/widget/build-prayer-rows";
import type { RadioRowResult } from "@/features/radio/widget/build-radio-row";
import type { AdhkarRowResult } from "@/features/adhkar/widget/build-adhkar-row";

const prayer: PrayerRowsResult = {
  city: "Cairo",
  rows: [
    { key: "fajr", label: "Fajr", time: "04:12", isNext: false },
    { key: "sunrise", label: "Sunrise", time: "05:42", isNext: false },
    { key: "dhuhr", label: "Dhuhr", time: "11:55", isNext: true },
    { key: "asr", label: "Asr", time: "15:20", isNext: false },
    { key: "maghrib", label: "Maghrib", time: "18:10", isNext: false },
    { key: "isha", label: "Isha", time: "19:40", isNext: false },
  ],
  next: { title: "Next prayer", name: "Dhuhr", remaining: "1:05" },
  arc: { fraction: 0.4, isNight: false, onNightBand: false },
  dots: [],
};

const radio: RadioRowResult = { label: "Radio", stations: ["Quran Radio"] };
const adhkar: AdhkarRowResult = {
  title: "Adhkar",
  items: [{ icon: "🌅", uri: "nour:///adhkar/sabah" }],
};

describe("NourHomeWidget", () => {
  it.each(["ar", "en"] as const)(
    "builds a widget tree without throwing (locale=%s)",
    (locale) => {
      const element = NourHomeWidget({
        width: 300,
        height: 240,
        locale,
        hijriDateLabel: "1 محرم 1448",
        arcSvg: "<svg></svg>",
        prayer,
        radio,
        adhkar,
      });

      expect(() => buildWidgetTree(element)).not.toThrow();
    },
  );
});
