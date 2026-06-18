// Opens the OS battery-optimization screen so the user can mark Nour as
// "unrestricted" / "not optimized". This matters because aggressive OEM battery
// managers (Samsung "Sleeping apps", Xiaomi, Huawei) will kill the app's
// scheduled exact alarms while it's closed — defeating the adhan even after the
// SCHEDULE_EXACT_ALARM/USE_EXACT_ALARM permission fix. Device config the app can
// surface but can't enforce.
//
// We deliberately use ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS (the list
// screen) rather than the one-tap REQUEST_IGNORE_BATTERY_OPTIMIZATIONS dialog:
// the latter needs the REQUEST_IGNORE_BATTERY_OPTIMIZATIONS permission, which
// Google Play restricts (rejection risk). The list screen needs no permission.

import { Linking, Platform } from "react-native";
import * as IntentLauncher from "expo-intent-launcher";

export async function openBatteryOptimizationSettings(): Promise<void> {
  if (Platform.OS !== "android") return;
  try {
    await IntentLauncher.startActivityAsync(
      IntentLauncher.ActivityAction.IGNORE_BATTERY_OPTIMIZATION_SETTINGS,
    );
  } catch {
    // Some OEMs don't expose that screen — fall back to the app's own settings
    // page, from which the user can reach Battery → Unrestricted.
    await Linking.openSettings().catch(() => {});
  }
}
