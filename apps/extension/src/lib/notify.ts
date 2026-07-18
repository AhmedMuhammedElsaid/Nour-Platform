import browser from "webextension-polyfill";

import type { AdhanPrayerKey } from "@repo/shared-core/schemas/prayer-times";
import type { AzkarReminderKind } from "@repo/shared-core/prayer-times/schedule";

import { routeToHash } from "./router";
import { get } from "./storage";

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

const ADHAN_NID = "nour:adhan";
const AZKAR_NID_PREFIX = "nour:azkar:";
// Exact id — must never prefix-collide with the azkar ids, or the click
// handler would misroute it to the adhkar reader.
const KAHF_NID = "nour:kahf:reminder";

export async function notifyAdhan(key: AdhanPrayerKey): Promise<void> {
  await browser.notifications.create(ADHAN_NID, {
    type: "basic",
    iconUrl: browser.runtime.getURL(ICON),
    title: PRAYER_AR[key],
    message: ADHAN_BODY,
    priority: 2,
  });
}

export async function notifyAzkar(kind: AzkarReminderKind): Promise<void> {
  const copy = AZKAR_AR[kind];
  await browser.notifications.create(`${AZKAR_NID_PREFIX}${kind}`, {
    type: "basic",
    iconUrl: browser.runtime.getURL(ICON),
    title: copy.title,
    message: copy.body,
    priority: 2,
  });
}

export async function notifyKahf(): Promise<void> {
  await browser.notifications.create(KAHF_NID, {
    type: "basic",
    iconUrl: browser.runtime.getURL(ICON),
    title: "سورة الكهف",
    message: "يوم الجمعة — اضغط لقراءة سورة الكهف.",
    priority: 2,
  });
}

export async function handleNotificationClick(id: string): Promise<void> {
  let url = SITE;
  if (id === KAHF_NID) {
    // Open the extension's own new-tab Quran reader at Al-Kahf (no autoplay).
    url = `${browser.runtime.getURL("src/newtab/index.html")}#${routeToHash({ view: "quran-read", surah: "18" })}`;
  } else if (id.startsWith(AZKAR_NID_PREFIX)) {
    const kind = id.slice(AZKAR_NID_PREFIX.length) as AzkarReminderKind;
    const settings = await get("nour.azkar.reminder");
    const slug = kind === "sabah" ? settings.sabah.ar : settings.masaa.ar;
    // Open the extension's own new-tab reader (not the website) so the dhikr
    // is readable immediately, offline-capable, and stays in-extension.
    url = `${browser.runtime.getURL("src/newtab/index.html")}#${routeToHash({ view: "adhkar-read", slug })}`;
  }
  await browser.tabs.create({ url });
  await browser.notifications.clear(id);
}
