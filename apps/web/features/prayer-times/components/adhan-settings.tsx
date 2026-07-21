import { useTranslations } from "next-intl";

// Web adhan playback is switched off site-wide (owner report: fires at
// inaccurate times, unfixable from the delivery-layer debugging already spent
// — see APP_CONTEXT). <AdhanController/> is no longer mounted in the root
// layout, so this is a static notice rather than the old enable/per-prayer/
// volume/background-notification form; the underlying settings hook, scheduler,
// and notification code are left in place, untouched, in case a real fix
// reinstates the feature later.
export function AdhanSettings() {
  const t = useTranslations("prayer");

  return <p className="text-sm text-text-2">{t("adhan.unavailableWeb")}</p>;
}
