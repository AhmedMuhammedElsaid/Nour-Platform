import type { Locale } from "../schemas/locale";

// Split a positive ms duration into whole hours + minutes (clamped at 0).
export function formatCountdown(ms: number): { h: number; m: number } {
  const totalMinutes = Math.floor(Math.max(0, ms) / 60_000);
  return { h: Math.floor(totalMinutes / 60), m: totalMinutes % 60 };
}

// Live countdown clock string. Shows MM:SS under an hour and H:MM:SS once an
// hour or more remains (the hours segment is dropped when zero). The leading
// hours segment is NOT zero-padded (4:28:20, not 04:28:20 — two-digit hours like
// 11/12 render naturally); minutes and seconds stay 2-digit. Digits localized
// (Arabic-Indic in `ar`) to match formatClock's prayer times.
export function formatCountdownClock(ms: number, locale: Locale = "en"): string {
  const totalSeconds = Math.floor(Math.max(0, ms) / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const bcp47 = locale === "ar" ? "ar-EG" : "en-US";
  const pad2 = new Intl.NumberFormat(bcp47, {
    minimumIntegerDigits: 2,
    useGrouping: false,
  });
  const plain = new Intl.NumberFormat(bcp47, { useGrouping: false });
  return h > 0
    ? [plain.format(h), pad2.format(m), pad2.format(s)].join(":")
    : [pad2.format(m), pad2.format(s)].join(":");
}

// Static (non-ticking) hours:minutes remaining until a prayer — for surfaces
// that can't animate a live per-second countdown (e.g. a rasterized OS
// widget bitmap, regenerated on refresh rather than ticking). Always shows
// both segments (including a zero hours segment) so the shape is fixed and
// unambiguous, unlike formatCountdownClock's h>0 conditional. Digits
// localized the same way.
export function formatRemainingHM(ms: number, locale: Locale = "en"): string {
  const { h, m } = formatCountdown(ms);
  const bcp47 = locale === "ar" ? "ar-EG" : "en-US";
  const pad2 = new Intl.NumberFormat(bcp47, {
    minimumIntegerDigits: 2,
    useGrouping: false,
  });
  const plain = new Intl.NumberFormat(bcp47, { useGrouping: false });
  return [plain.format(h), pad2.format(m)].join(":");
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
