import type { AzkarReminderSettings } from "@repo/api/schemas/prayer-times";

import ar from "../../../messages/ar.json";
import type { AzkarReminderBuilder } from "./azkar-reminder-notifications";

// Adhkar reminders are always delivered in Arabic (the content is Arabic
// dhikr) regardless of the UI language: Arabic title/body + the Arabic slug
// so the click opens the Arabic reader.
export function makeAzkarReminderBuilder(
  settings: AzkarReminderSettings,
): AzkarReminderBuilder {
  return (kind) => {
    const slug = kind === "sabah" ? settings.sabah.ar : settings.masaa.ar;
    const copy = ar.prayer.azkar[kind];
    return {
      url: `/ar/adhkar/${encodeURIComponent(slug)}`,
      title: copy.title,
      body: copy.body,
    };
  };
}
