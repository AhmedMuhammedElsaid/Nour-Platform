import type { Locale } from "../schemas/locale";

// Split a positive ms duration into whole hours + minutes (clamped at 0).
export function formatCountdown(ms: number): { h: number; m: number } {
  const totalMinutes = Math.floor(Math.max(0, ms) / 60_000);
  return { h: Math.floor(totalMinutes / 60), m: totalMinutes % 60 };
}

// Live countdown rendered as a zero-padded HH:MM:SS clock string. Digits are
// localized (Arabic-Indic in `ar`) to match formatClock's prayer times.
export function formatCountdownClock(ms: number, locale: Locale = "en"): string {
  const totalSeconds = Math.floor(Math.max(0, ms) / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const nf = new Intl.NumberFormat(locale === "ar" ? "ar-EG" : "en-US", {
    minimumIntegerDigits: 2,
    useGrouping: false,
  });
  return [h, m, s].map((n) => nf.format(n)).join(":");
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
