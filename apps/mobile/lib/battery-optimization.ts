// Opens the OS battery-optimization screen so the user can mark Nour as
// "unrestricted" / "not optimized". This matters because aggressive OEM battery
// managers (Samsung "Sleeping apps", Xiaomi, Huawei) will kill the app's
// scheduled exact alarms while it's closed — defeating the adhan even after the
// SCHEDULE_EXACT_ALARM/USE_EXACT_ALARM permission fix. Device config the app can
// surface but can't enforce.
//
// We PREFER the package-targeted one-tap REQUEST_IGNORE_BATTERY_OPTIMIZATIONS
// dialog ("Allow Nour to ignore battery optimization?  Allow / Deny"): it lands
// directly on Nour and grants in one tap. The plain list screen
// (IGNORE_BATTERY_OPTIMIZATION_SETTINGS) only shows apps that are ALREADY
// exempted, so a fresh install can't find Nour there to enable it — exactly the
// "I opened the page but Nour wasn't listed" report. The REQUEST dialog needs the
// REQUEST_IGNORE_BATTERY_OPTIMIZATIONS permission (declared in app.json); Google
// Play restricts it, but this app currently ships as a sideloaded preview APK and
// USE_EXACT_ALARM already carries the same "revisit at publish" caveat. Fall back
// to the list screen, then the app's own settings page, if the dialog is blocked.

import { Linking, Platform } from "react-native";
import * as IntentLauncher from "expo-intent-launcher";

const PACKAGE = "com.nour.mobile";

export async function openBatteryOptimizationSettings(): Promise<void> {
  if (Platform.OS !== "android") return;
  try {
    // One-tap dialog scoped to our package — the only path that reliably surfaces
    // Nour itself (the list screen hides not-yet-exempted apps).
    await IntentLauncher.startActivityAsync(
      IntentLauncher.ActivityAction.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS,
      { data: `package:${PACKAGE}` },
    );
    return;
  } catch {
    // Permission missing / OEM blocks the dialog — open the exemption list.
    try {
      await IntentLauncher.startActivityAsync(
        IntentLauncher.ActivityAction.IGNORE_BATTERY_OPTIMIZATION_SETTINGS,
      );
      return;
    } catch {
      // Last resort: the app's own settings page (Battery → Unrestricted).
      await Linking.openSettings().catch(() => {});
    }
  }
}
