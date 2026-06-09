import type { Locale } from "../schemas/locale";

// Split a positive ms duration into whole hours + minutes (clamped at 0).
export function formatCountdown(ms: number): { h: number; m: number } {
  const clamped = Math.max(0, ms);
  const totalMinutes = Math.floor(clamped / 60_000);
  return { h: Math.floor(totalMinutes / 60), m: totalMinutes % 60 };
}

// Localized clock; `timeZone` optional (defaults to the viewer's device tz).
export function formatClock(
  time: Date | null,
  locale: Locale,
  timeZone?: string,
): string {
  if (time == null) return "—";
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone,
  }).format(time);
}

export function hijriDate(date: Date, locale: Locale): string {
  const tag = locale === "ar" ? "ar-SA-u-ca-islamic" : "en-US-u-ca-islamic";
  return new Intl.DateTimeFormat(tag, {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

export function gregorianDate(date: Date, locale: Locale): string {
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-US", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}
