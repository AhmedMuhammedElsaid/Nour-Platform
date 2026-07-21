import browser from "webextension-polyfill";

import type { AdhanPrayerKey } from "@repo/shared-core/schemas/prayer-times";
import type { AzkarReminderKind } from "@repo/shared-core/prayer-times/schedule";

import { stop } from "./audio-router";
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
const ADHAN_STOP_BTN = "إيقاف الأذان";
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
    // Firefox's notifications schema rejects `buttons` outright (the create call
    // throws), so the stop affordance there is a body click — see
    // handleNotificationClick. The branch is tree-shaken per target.
    ...(__BROWSER__ === "firefox" ? {} : { buttons: [{ title: ADHAN_STOP_BTN }] }),
  });
}

// Chrome only — the adhan notification's single action button stops playback.
export async function handleAdhanNotificationButton(
  id: string,
  buttonIndex: number,
): Promise<void> {
  if (id !== ADHAN_NID || buttonIndex !== 0) return;
  await stop();
  await browser.notifications.clear(id);
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
  // Firefox has no notification buttons, so the body click is the only stop
  // affordance there. Chrome keeps the open-the-site behaviour (it has a button).
  if (id === ADHAN_NID && __BROWSER__ === "firefox") {
    await stop();
    await browser.notifications.clear(id);
    return;
  }

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
