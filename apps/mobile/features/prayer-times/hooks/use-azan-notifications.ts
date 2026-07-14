// Schedules azan whenever prayer/adhan settings change (and on every app open,
// since the root <AzanScheduler> mounts then). Device-local only — no server/auth.
//
// Android: delegates to the native `nour-adhan` module — ONE exact alarm per prayer
// that starts a foreground service playing the FULL adhan. This replaced the old
// 22-chained-notification scheme that exhausted Android's per-app allow-while-idle
// alarm quota (so Fajr silently never fired). See lib/adhan-native + modules/nour-adhan.
// We build a long (~HORIZON_DAYS) pool of instants and hand ALL of them to native,
// which persists the pool but only ARMS the nearest few — and re-arms the next one
// each time an alarm fires. That way the adhan keeps firing for ~HORIZON_DAYS even if
// the app is never reopened, without ever arming enough alarms to hit the quota.
// (Before this, the horizon was only ~2 days and nothing rolled it forward from the
// closed state, so the adhan silently stopped a couple of days after the last app open.)
//
// iOS: a single expo-notification per prayer with a ≤30s bundled clip (Apple's
// closed-app local-notification sound ceiling — no native-service equivalent to
// Android exists on iOS). interruptionLevel:"critical" + allowCriticalAlerts lets
// the sound pierce Silent/DND once Apple has granted the critical-alerts
// entitlement; degrades to a normal notification otherwise. Same path is the
// fallback if the native module is somehow absent on Android (e.g. Expo Go / stale
// build).

import { useEffect } from "react";
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import type {
  AdhanPrayerKey,
  PrayerLocation,
  PrayerPreferences,
} from "@repo/shared-core/schemas/prayer-times";
import { getNextPrayer } from "@repo/shared-core/prayer-times/compute";
import { getPrayerDay } from "@/features/prayer-times/lib/aladhan";
import { IOS_AZAN_SOUND, AZAN_PREFIX } from "@/lib/notifications";
import * as AdhanNative from "@/lib/adhan-native";

type PrayerNames = Record<AdhanPrayerKey, string>;
type PerPrayer = Record<AdhanPrayerKey, boolean>;

// How many days of adhan instants to build. Android persists the whole pool and
// rolls through it (see the native module), so this is the "keep firing even if the
// app is never reopened" ceiling. Every app open / settings change refills it.
const HORIZON_DAYS = 60;

// iOS can't self-perpetuate (no native scheduler equivalent) and shares a hard 64
// pending-notification OS cap with the azkar reminders, so cap the iOS azan horizon
// well under 64 to leave room. Android ignores this (it pools all of them natively).
const IOS_MAX_AZAN = 40;

type AdhanInstant = {
  id: string;
  key: AdhanPrayerKey;
  fireAtMillis: number;
  fajr: boolean;
};

// Build the next ~HORIZON_DAYS of adhan instants, dropping sunrise, past times, and
// per-prayer-disabled prayers. getPrayerDay returns Aladhan's authoritative times
// (cached per month, so a 60-day build is ≤3 month fetches then cache/offline-compute)
// with an offline local-compute fallback. Exported for unit testing the filtering logic.
export async function buildAdhanInstants(
  location: PrayerLocation,
  prefs: PrayerPreferences,
  perPrayer: PerPrayer,
): Promise<AdhanInstant[]> {
  const now = Date.now();
  const DAY_MS = 24 * 60 * 60 * 1000;
  const out: AdhanInstant[] = [];

  for (let dayOffset = 0; dayOffset < HORIZON_DAYS; dayOffset++) {
    const date = new Date(now + dayOffset * DAY_MS);
    const day = await getPrayerDay(location.lat, location.lng, prefs.method, prefs.madhab, date);

    for (const instant of day.instants) {
      if (instant.key === "sunrise" || instant.time == null) continue;
      const fireAtMillis = instant.time.getTime();
      if (fireAtMillis <= now) continue; // skip past times
      const key = instant.key as AdhanPrayerKey;
      if (!perPrayer[key]) continue; // honour per-prayer toggles
      out.push({ id: `${AZAN_PREFIX}${dayOffset}-${key}`, key, fireAtMillis, fajr: key === "fajr" });
    }
  }
  return out;
}

// Whether to drive the native Android foreground-service adhan (vs the iOS
// notification fallback). Not a React hook — just a capability check.
function nativeAdhanActive(): boolean {
  return Platform.OS === "android" && AdhanNative.isNativeAdhanAvailable();
}

async function cancelIosAzan(): Promise<void> {
  const all = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    all
      .filter((n) => n.identifier.startsWith(AZAN_PREFIX))
      .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
  );
}

async function cancelAllAzan(): Promise<void> {
  if (nativeAdhanActive()) {
    await AdhanNative.cancelAll();
    return;
  }
  await cancelIosAzan();
}

// Exported for unit testing the platform dispatch (Android pools ALL instants
// natively; iOS caps at IOS_MAX_AZAN to stay under the 64-notification OS limit).
export async function scheduleAzanNotifications(
  location: PrayerLocation,
  prefs: PrayerPreferences,
  prayerNames: PrayerNames,
  perPrayer: PerPrayer,
  volume: number,
): Promise<void> {
  const instants = await buildAdhanInstants(location, prefs, perPrayer);

  if (nativeAdhanActive()) {
    await AdhanNative.scheduleAll(
      instants.map((i) => ({ key: i.key, fireAtMillis: i.fireAtMillis, fajr: i.fajr, volume })),
    );
    return;
  }

  // iOS (and Android fallback): one notification per prayer, single ≤30s clip.
  // interruptionLevel:"critical" is what lets the sound pierce Silent/DND/Focus —
  // it only takes effect once Apple has granted the critical-alerts entitlement and
  // the user has granted allowCriticalAlerts; otherwise iOS treats it as a normal
  // notification (no crash, just no DND-piercing).
  // Cap at IOS_MAX_AZAN: iOS enforces a hard 64 pending-notification limit shared with
  // the azkar reminders, and instants is now the full ~HORIZON_DAYS pool.
  await cancelIosAzan();
  for (const instant of instants.slice(0, IOS_MAX_AZAN)) {
    await Notifications.scheduleNotificationAsync({
      identifier: instant.id,
      content: {
        title: prayerNames[instant.key],
        body: "حان وقت الصلاة · It's time for prayer.",
        sound: IOS_AZAN_SOUND,
        interruptionLevel: "critical",
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: new Date(instant.fireAtMillis),
      },
    });
  }
}

export function useAzanNotifications(
  enabled: boolean,
  location: PrayerLocation,
  prefs: PrayerPreferences,
  prayerNames: PrayerNames,
  perPrayer: PerPrayer,
  volume: number,
  hydrated: boolean,
): void {
  useEffect(() => {
    if (!hydrated) return;
    if (!enabled) {
      void cancelAllAzan();
      return;
    }
    // Debounce scheduling: onboarding fires several rapid settingsChanged events
    // (location/adhan/azkar writes), each producing new location/prefs/perPrayer
    // objects. The cleanup clears the timer on every re-run, so only the final
    // event in a burst actually schedules.
    const timer = setTimeout(
      () => void scheduleAzanNotifications(location, prefs, prayerNames, perPrayer, volume),
      350,
    );
    return () => clearTimeout(timer);
  }, [enabled, location, prefs, prayerNames, perPrayer, volume, hydrated]);
}

// Dev/verify helper: fire one adhan ~60s out via the exact same path as the real
// schedule, so the user can lock the phone and confirm it sounds on time.
export async function scheduleTestAzan(title: string): Promise<Date> {
  const fireAt = new Date(Date.now() + 60 * 1000);
  if (nativeAdhanActive()) {
    await AdhanNative.playTest(60 * 1000);
    return fireAt;
  }
  await Notifications.scheduleNotificationAsync({
    identifier: `${AZAN_PREFIX}9-dhuhr`,
    content: {
      title,
      body: "حان وقت الصلاة · It's time for prayer.",
      sound: IOS_AZAN_SOUND,
      interruptionLevel: "critical",
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: fireAt },
  });
  return fireAt;
}

// Utility: request notification permissions. Returns true if granted.
export async function requestNotificationPermission(): Promise<boolean> {
  const { status } = await Notifications.requestPermissionsAsync({
    ios: { allowAlert: true, allowSound: true, allowBadge: false, allowCriticalAlerts: true },
  });
  return status === "granted";
}

// Keep the getNextPrayer re-export here so screens can use it without a separate import.
export { getNextPrayer };
