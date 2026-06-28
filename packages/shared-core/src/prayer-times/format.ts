import type { Locale } from "../schemas/locale";

// Split a positive ms duration into whole hours + minutes + seconds (clamped at 0).
export function formatCountdown(ms: number): { h: number; m: number; s: number } {
  const totalSeconds = Math.floor(Math.max(0, ms) / 1000);
  const totalMinutes = Math.floor(totalSeconds / 60);
  return {
    h: Math.floor(totalMinutes / 60),
    m: totalMinutes % 60,
    s: totalSeconds % 60,
  };
}

// Live countdown rendered as a zero-padded HH:MM:SS clock string. Digits are
// localized (Arabic-Indic in `ar`) to match formatClock's prayer times.
export function formatCountdownClock(ms: number, locale: Locale = "en"): string {
  const { h, m, s } = formatCountdown(ms);
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
