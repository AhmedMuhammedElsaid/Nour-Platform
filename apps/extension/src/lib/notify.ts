import type { AdhanPrayerKey } from "@repo/shared-core/schemas/prayer-times";
import type { AzkarReminderKind } from "@repo/shared-core/prayer-times/schedule";

import { get } from "./storage";

// Notification copy mirrors the web app's Arabic strings (apps/web/messages/ar.json
// → prayer.*). Adhan + azkar notifications are always Arabic — the content is
// Arabic, independent of any UI language. Kept inline (no next-intl in the
// extension) so the service worker has zero runtime i18n dependency.
const PRAYER_AR: Record<AdhanPrayerKey, string> = {
  fajr: "الفجر",
  dhuhr: "الظهر",
  asr: "العصر",
  maghrib: "المغرب",
  isha: "العشاء",
};
const ADHAN_BODY = "حان وقت الصلاة.";
const AZKAR_AR: Record<AzkarReminderKind, { title: string; body: string }> = {
  sabah: { title: "أذكار الصباح", body: "حان وقت أذكار الصباح — اضغط للقراءة." },
  masaa: { title: "أذكار المساء", body: "حان وقت أذكار المساء — اضغط للقراءة." },
};

const SITE = __API_BASE_URL__;
const ICON = "icons/icon-192.png";

// Single id per stream so a re-fire (catch-up after a precise alarm already
// fired) replaces rather than stacks. The azkar id carries the kind so the
// click handler can reconstruct the reader slug from settings.
const ADHAN_NID = "nour:adhan";
const AZKAR_NID_PREFIX = "nour:azkar:";

export async function notifyAdhan(key: AdhanPrayerKey): Promise<void> {
  await chrome.notifications.create(ADHAN_NID, {
    type: "basic",
    iconUrl: chrome.runtime.getURL(ICON),
    title: PRAYER_AR[key],
    message: ADHAN_BODY,
    priority: 2,
    silent: false,
  });
}

export async function notifyAzkar(kind: AzkarReminderKind): Promise<void> {
  const copy = AZKAR_AR[kind];
  await chrome.notifications.create(`${AZKAR_NID_PREFIX}${kind}`, {
    type: "basic",
    iconUrl: chrome.runtime.getURL(ICON),
    title: copy.title,
    message: copy.body,
    priority: 2,
  });
}

// Adhan click → open the site (prayer times visible on the home page).
// Azkar click → open the Arabic adhkar reader for that kind's configured slug.
export async function handleNotificationClick(id: string): Promise<void> {
  let url = SITE;
  if (id.startsWith(AZKAR_NID_PREFIX)) {
    const kind = id.slice(AZKAR_NID_PREFIX.length) as AzkarReminderKind;
    const settings = await get("nour.azkar.reminder");
    const slug = kind === "sabah" ? settings.sabah.ar : settings.masaa.ar;
    url = `${SITE}/ar/adhkar/${encodeURIComponent(slug)}`;
  }
  await chrome.tabs.create({ url });
  await chrome.notifications.clear(id);
}
