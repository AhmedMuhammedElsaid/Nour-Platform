// New app entry point (home_widget_plan.md §5.9, RNAW's documented Expo
// Router recipe). Replaces "expo-router/entry" as package.json's "main" —
// registerWidgetTaskHandler must run at JS-bundle-load time so the OS can
// invoke it from a headless task even when no app UI is mounted.
import "expo-router/entry";
import { registerWidgetTaskHandler } from "react-native-android-widget";

import { widgetTaskHandler } from "./widget-task-handler";

registerWidgetTaskHandler(widgetTaskHandler);
