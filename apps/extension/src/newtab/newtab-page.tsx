import { useEffect, useState } from "react";

import type { PrayerDay, PrayerKey } from "@repo/shared-core/prayer-times/compute";
import {
  formatClock,
  formatCountdown,
  gregorianDate,
  hijriDate,
} from "@repo/shared-core/prayer-times/format";

import { getJson } from "../lib/api";
import { usePrayerTimes } from "../lib/use-prayer-times";
import { useLocation } from "../options/use-settings";
import { get } from "../lib/storage";
import type { RecentItem } from "../lib/storage";
import { usePlayer } from "../lib/use-player";
import {
  buildPlaylistQueue,
  fetchPlaylists,
  recordRecent,
  type PlaylistSummary,
} from "../lib/content";
import { PlayerBar } from "../components/player-bar";
import { SunArc, type ArcDot } from "../components/sun-arc";
import { ThemeToggle } from "../components/theme-toggle";
import { useI18n } from "../lib/i18n";

// ── Arabic labels ──────────────────────────────────────────────────────────

const PRAYER_AR: Record<PrayerKey, string> = {
  fajr: "الفجر",
  sunrise: "الشروق",
  dhuhr: "الظهر",
  asr: "العصر",
  maghrib: "المغرب",
  isha: "العشاء",
};

// ── Types ──────────────────────────────────────────────────────────────────

type DhikrItem = { ar: string; repeat: number };
type AzkarResponse = { items: DhikrItem[] };

// ── Sun arc dots ─────────────────────────────────────────────────────────────

// Day fraction (Fajr→Isha) for each instant — used to place arc dots. Mirrors
// the web `buildArcDots`; adds `isNext`/`label` for the rich SunArc.
function buildArcDots(day: PrayerDay, nextKey: PrayerKey | null): ArcDot[] {
  const fajr = day.instants.find((i) => i.key === "fajr")?.time ?? null;
  const isha = day.instants.find((i) => i.key === "isha")?.time ?? null;
  const span =
    fajr && isha && isha.getTime() > fajr.getTime()
      ? isha.getTime() - fajr.getTime()
      : 1;
  return day.instants
    .filter((i) => i.time != null)
    .map((i) => ({
      key: i.key,
      fraction: fajr
        ? Math.min(1, Math.max(0, (i.time!.getTime() - fajr.getTime()) / span))
        : 0.5,
      isNext: i.key === nextKey,
      label: PRAYER_AR[i.key],
    }));
}

// ── Daily dhikr ────────────────────────────────────────────────────────────

// Picks a dhikr by day-of-year so it rotates daily without repeating.
function dayOfYear(d: Date): number {
  const start = new Date(d.getFullYear(), 0, 0);
  return Math.floor((d.getTime() - start.getTime()) / 86_400_000);
}

function DhikrWidget({ now }: { now: Date }) {
  const [dhikr, setDhikr] = useState<DhikrItem | null>(null);

  useEffect(() => {
    void getJson<AzkarResponse>("/adhkar/أذكار-الصباح", { locale: "ar" })
      .then((res) => {
        const items = res.items;
        if (items.length > 0) {
          const idx = dayOfYear(now) % items.length;
          setDhikr(items[idx] ?? null);
        }
      })
      .catch(() => {/* offline — widget stays empty */});
  // Only fetch on mount — the day's dhikr doesn't change during a session.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!dhikr) return null;

  return (
    <section className="space-y-2">
      <h2 className="text-xs font-semibold uppercase tracking-[0.08em] text-text-2">
        ذكر اليوم
      </h2>
      <div className="rounded-md border border-border bg-surface p-4">
        <p className="text-right text-base leading-relaxed text-text">{dhikr.ar}</p>
        <p className="mt-2 text-xs text-text-2 text-right">× {dhikr.repeat}</p>
      </div>
    </section>
  );
}

// ── Continue listening ─────────────────────────────────────────────────────

function ContinueListeningShelf({ onPlay }: { onPlay: (slug: string) => void }) {
  const [recent, setRecent] = useState<RecentItem[]>([]);

  useEffect(() => {
    void get("nour.player.recent").then(setRecent);
  }, []);

  if (recent.length === 0) return null;

  return (
    <section className="space-y-2">
      <h2 className="text-xs font-semibold uppercase tracking-[0.08em] text-text-2">
        استمر في الاستماع
      </h2>
      <ul className="flex gap-3 overflow-x-auto pb-1">
        {recent.slice(0, 5).map((item) => (
          <li key={item.slug} className="shrink-0">
            <button
              type="button"
              onClick={() => onPlay(item.slug)}
              className="flex h-16 w-36 items-end rounded-md border border-border bg-surface p-2 text-start text-xs text-text hover:bg-surface-2"
            >
              <span className="line-clamp-2">{item.title}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function LibrarySection({ onPlay }: { onPlay: (slug: string) => void }) {
  const [playlists, setPlaylists] = useState<PlaylistSummary[]>([]);

  useEffect(() => {
    void fetchPlaylists()
      .then((list) => setPlaylists(list.slice(0, 8)))
      .catch(() => {/* offline — section stays empty */});
  }, []);

  if (playlists.length === 0) return null;

  return (
    <section className="space-y-2">
      <h2 className="text-xs font-semibold uppercase tracking-[0.08em] text-text-2">
        المكتبة
      </h2>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {playlists.map((p) => (
          <li key={p.slug}>
            <button
              type="button"
              onClick={() => onPlay(p.slug)}
              className="flex w-full items-center gap-3 rounded-md border border-border bg-surface p-2 text-start hover:bg-surface-2"
            >
              {p.cover ? (
                <img
                  src={p.cover}
                  alt=""
                  className="size-12 shrink-0 rounded object-cover"
                />
              ) : (
                <span className="flex size-12 shrink-0 items-center justify-center rounded bg-surface-2 text-lg">
                  ▶
                </span>
              )}
              <span className="min-w-0">
                <span className="block truncate text-sm text-text">{p.title}</span>
                <span className="block text-xs text-text-2">{p.trackCount} مقطع</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────

export function NewtabPage() {
  const pt = usePrayerTimes();
  const { location } = useLocation();
  const { state: playerState, send } = usePlayer();
  const { t } = useI18n();

  // Fetch a playlist's tracks, start playback, and record it as recently played.
  async function playBySlug(slug: string): Promise<void> {
    const { queue, recent } = await buildPlaylistQueue(slug);
    if (queue.length === 0) return;
    send({ type: "load", queue, index: 0 });
    await recordRecent(recent);
  }

  if (!pt) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-bg">
        <p className="text-sm text-text-2">جاري التحميل…</p>
      </main>
    );
  }

  const { today, upcoming, arcPos, now } = pt;

  // Countdown display (h:mm) — mirrors the web widget format.
  const { h, m } = formatCountdown(upcoming.msUntil);
  const countdownStr = `${String(h)}:${String(m).padStart(2, "0")}`;

  const arcDots = buildArcDots(today, upcoming.key);
  const rowKeys: PrayerKey[] = ["fajr", "sunrise", "dhuhr", "asr", "maghrib", "isha"];

  return (
    <main className="min-h-screen bg-bg px-6 py-8 text-text" dir="rtl">
      <div className="mx-auto max-w-2xl space-y-8">

        {/* ── Header ──────────────────────────────────────────────────── */}
        <header className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-primary">{t("common.appName")}</h1>
          <div className="flex items-center gap-3">
            <div className="text-end text-sm text-text-2">
              <p>{gregorianDate(now, "ar")}</p>
              <p className="text-xs">{hijriDate(now, "ar")}</p>
            </div>
            <ThemeToggle label={t} />
          </div>
        </header>

        {/* ── Prayer widget (mirrors the web home card) ──────────────── */}
        <section
          aria-label="مواقيت الصلاة"
          className="overflow-hidden rounded-xl border border-border bg-surface"
        >
          {/* header: location + Hijri date */}
          <div className="px-6 pt-5">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-sm text-text">
                🕌 {location?.label ?? "موقعك"}
              </span>
              <span className="text-xs text-sun">{hijriDate(now, "ar")}</span>
            </div>
          </div>

          {/* full-bleed arc */}
          <div className="mt-1">
            <SunArc
              dots={arcDots}
              sunFraction={arcPos.fraction}
              nextLabel={PRAYER_AR[upcoming.key]}
              isNight={arcPos.isNight}
              onNightBand={arcPos.onNightBand}
            />
          </div>

          {/* countdown */}
          <div className="mb-3 flex items-baseline justify-center gap-2.5">
            <span className="text-xs uppercase tracking-widest text-text-2">القادمة</span>
            <span className="font-display text-xl font-semibold text-text sm:text-2xl">
              {PRAYER_AR[upcoming.key]}
            </span>
            <span className="font-display text-lg font-semibold text-sun">
              {countdownStr}
            </span>
          </div>

          {/* times row */}
          <div className="flex gap-1.5 border-t border-border px-6 py-4">
            {rowKeys.map((key) => {
              const inst = today.instants.find((i) => i.key === key)!;
              const isNext = upcoming.key === key;
              return (
                <div
                  key={key}
                  className={`flex-1 rounded-md px-0.5 py-1 text-center ${isNext ? "bg-primary/10" : ""}`}
                >
                  <div className={`text-2xs uppercase tracking-[0.05em] ${isNext ? "text-primary" : "text-text-2"}`}>
                    {PRAYER_AR[key]}
                  </div>
                  <div className={`mt-1 text-sm tabular-nums ${isNext ? "font-semibold text-sun" : "text-text"}`}>
                    {formatClock(inst.time, "ar")}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ── Daily dhikr ─────────────────────────────────────────────── */}
        <DhikrWidget now={now} />

        {/* ── Continue listening ──────────────────────────────────────── */}
        <ContinueListeningShelf onPlay={(slug) => void playBySlug(slug)} />

        {/* ── Library ─────────────────────────────────────────────────── */}
        <LibrarySection onPlay={(slug) => void playBySlug(slug)} />

        {/* Spacer so the fixed player bar never overlaps the last section. */}
        <div className="h-24" aria-hidden="true" />

      </div>

      <PlayerBar state={playerState} send={send} />
    </main>
  );
}
