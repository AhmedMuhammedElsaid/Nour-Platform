import browser from "webextension-polyfill";

import { computePrayerTimes } from "@repo/shared-core/prayer-times/compute";
import {
  type AdhanEvent,
  type AzkarReminderEvent,
  nextAdhanEvent,
  nextAzkarReminderEvent,
  recentlyMissedAdhan,
  recentlyMissedAzkarReminder,
} from "@repo/shared-core/prayer-times/schedule";

import { playAdhan } from "../lib/audio-router";
import {
  ADHAN_FIRED_KEY,
  AZKAR_REMINDER_FIRED_KEY,
  claimFiredEvent,
} from "../lib/fired-claim";
import { notifyAdhan, notifyAzkar } from "../lib/notify";
import { get } from "../lib/storage";

export const ALARM_TICK = "nour:tick";
export const ALARM_ADHAN = "nour:adhan";
export const ALARM_AZKAR = "nour:azkar";

const TICK_PERIOD_MIN = 1;

// Catch-up window matches the web scheduler's 2 min. Unlike the web, this
// scheduler recomputes from the live clock on every wake, so stale post-sleep
// fires are structurally impossible — no isAdhanEventStale guard needed.
const CATCH_UP_MS = 2 * 60_000;

type Inputs = Awaited<ReturnType<typeof loadInputs>>;

async function loadInputs() {
  const [adhan, azkar, location, prefs] = await Promise.all([
    get("nour.prayer.adhan"),
    get("nour.azkar.reminder"),
    get("nour.prayer.location"),
    get("nour.prayer.prefs"),
  ]);
  return { adhan, azkar, location, prefs };
}

async function fireAdhan(event: AdhanEvent, volume: number): Promise<void> {
  const owned = await claimFiredEvent(ADHAN_FIRED_KEY, event.time.toISOString());
  if (!owned) return;
  await notifyAdhan(event.key);
  await playAdhan(event.key, volume);
}

async function fireAzkar(event: AzkarReminderEvent): Promise<void> {
  const owned = await claimFiredEvent(
    AZKAR_REMINDER_FIRED_KEY,
    event.time.toISOString(),
  );
  if (!owned) return;
  await notifyAzkar(event.kind);
}

async function ensureTick(): Promise<void> {
  const existing = await browser.alarms.get(ALARM_TICK);
  if (!existing) {
    await browser.alarms.create(ALARM_TICK, { periodInMinutes: TICK_PERIOD_MIN });
  }
}

async function armPrecise(
  name: string,
  next: { time: Date } | null,
): Promise<void> {
  if (next) await browser.alarms.create(name, { when: next.time.getTime() });
  else await browser.alarms.clear(name);
}

export async function tick(): Promise<void> {
  const inputs = await loadInputs();
  const { adhan, azkar } = inputs;

  if (!adhan.enabled && !azkar.enabled) {
    await browser.alarms.clearAll();
    return;
  }

  const now = new Date();
  const day = computePrayerTimes({
    lat: inputs.location.lat,
    lng: inputs.location.lng,
    date: now,
    method: inputs.prefs.method,
    madhab: inputs.prefs.madhab,
  });

  if (adhan.enabled) {
    const missed = recentlyMissedAdhan(day.instants, adhan, now, CATCH_UP_MS);
    if (missed) await fireAdhan(missed, adhan.volume);
  }
  if (azkar.enabled) {
    const missed = recentlyMissedAzkarReminder(day.instants, azkar, now, CATCH_UP_MS);
    if (missed) await fireAzkar(missed);
  }

  await rearm(inputs, day, now);
}

async function rearm(inputs: Inputs, day: ReturnType<typeof computePrayerTimes>, now: Date): Promise<void> {
  await ensureTick();
  await armPrecise(
    ALARM_ADHAN,
    inputs.adhan.enabled ? nextAdhanEvent(day.instants, inputs.adhan, now) : null,
  );
  await armPrecise(
    ALARM_AZKAR,
    inputs.azkar.enabled
      ? nextAzkarReminderEvent(day.instants, inputs.azkar, now)
      : null,
  );
}
