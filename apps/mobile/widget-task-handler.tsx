// Headless task handler for the "NourHome" OS home-screen widget
// (home_widget_plan.md §5.9). Runs INSIDE the app process (not a separate JS
// context) — registered from index.ts before expo-router/entry boots the app
// UI. Deliberately imports only: RNAW, the shared render composition (which
// in turn imports only shared-core compute/format, the prayer-settings-store
// + three row builders, lib/api.ts, lib/device-local.ts). NO lib/i18n
// (module-scope i18next init side effect), NO player/RNTP, NO TanStack — see
// plan §4/§7 "Headless task pulls in side-effectful modules".
import type { WidgetTaskHandler } from "react-native-android-widget";

import { renderNourHomeWidget } from "@/features/home/widget/render-nour-home-widget";

const WIDGET_NAME = "NourHome";

export const widgetTaskHandler: WidgetTaskHandler = async (props) => {
  const { widgetInfo, widgetAction, renderWidget } = props;
  if (widgetInfo.widgetName !== WIDGET_NAME) return;

  switch (widgetAction) {
    case "WIDGET_ADDED":
    case "WIDGET_UPDATE":
    case "WIDGET_RESIZED":
      renderWidget(await renderNourHomeWidget(widgetInfo));
      return;
    case "WIDGET_DELETED":
    case "WIDGET_CLICK":
      // OPEN_URI click actions run natively (no JS round-trip) — nothing to do.
      return;
    default:
      return;
  }
};
