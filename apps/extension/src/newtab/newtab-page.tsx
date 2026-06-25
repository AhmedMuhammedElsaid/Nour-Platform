import { useEffect, useState } from "react";

import {
  ARC,
  arcPath,
  arcPoint,
  tForFraction,
} from "@repo/shared-core/prayer-times/sun-arc";
import type { PrayerKey } from "@repo/shared-core/prayer-times/compute";
import {
  formatClock,
  formatCountdown,
  gregorianDate,
  hijriDate,
} from "@repo/shared-core/prayer-times/format";

import { getJson } from "../lib/api";
import { usePrayerTimes } from "../lib/use-prayer-times";
import { useAdhanSettings } from "../options/use-settings";
import { get } from "../lib/storage";
import type { RecentItem } from "../lib/storage";

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

// ── Sun arc ────────────────────────────────────────────────────────────────

function SunArcWidget({
  fraction,
  isNight,
  dots,
}: {
  fraction: number;
  isNight: boolean;
  dots: Array<{ key: PrayerKey; f: number }>;
}) {
  const t = tForFraction(fraction);
  const pos = arcPoint(t);
  const r = 9;

  return (
    <svg
      viewBox={`0 0 ${ARC.w} ${ARC.h}`}
      preserveAspectRatio="xMidYMid meet"
      className="w-full"
      aria-hidden="true"
    >
      {/* Horizon baseline */}
      <line
        x1={ARC.p0.x}
        y1={ARC.p0.y}
        x2={ARC.p2.x}
        y2={ARC.p2.y}
        stroke="var(--color-border)"
        strokeWidth="1"
      />

      {/* Arc track */}
      <path
        d={arcPath()}
        fill="none"
        stroke="var(--color-border)"
        strokeWidth="1.5"
      />

      {/* Prayer dots */}
      {dots.map(({ key, f }) => {
        const dp = arcPoint(tForFraction(f));
        return (
          <circle
            key={key}
            cx={dp.x}
            cy={dp.y}
            r={3}
            fill={key === "sunrise" ? "var(--color-muted)" : "var(--color-text-2)"}
          />
        );
      })}

      {/* Celestial body — sun or moon */}
      <circle
        cx={pos.x}
        cy={pos.y}
        r={r}
        fill={isNight ? "var(--color-moon, #d6e3ff)" : "var(--color-sun)"}
        opacity={0.9}
      />
    </svg>
  );
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

function ContinueListeningShelf() {
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
            <a
              href={`${__API_BASE_URL__}/${item.type === "quran" ? "quran" : "playlists"}/${item.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-16 w-36 items-end rounded-md border border-border bg-surface p-2 text-xs text-text hover:bg-surface-2"
            >
              <span className="line-clamp-2">{item.title}</span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────

export function NewtabPage() {
  const pt = usePrayerTimes();
  const { adhan } = useAdhanSettings();

  if (!pt) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-bg">
        <p className="text-sm text-text-2">جاري التحميل…</p>
      </main>
    );
  }

  const { today, upcoming, arcPos, now } = pt;

  // Countdown display (h:mm or m:ss when under an hour)
  const { h, m } = formatCountdown(upcoming.msUntil);
  const totalSeconds = Math.floor(upcoming.msUntil / 1000);
  const s = totalSeconds % 60;
  const countdownStr =
    h > 0
      ? `${String(h)}:${String(m).padStart(2, "0")}`
      : `${String(m)}:${String(s).padStart(2, "0")}`;

  // Arc dots: fraction of each prayer along the Fajr→Isha track
  const fajrTime = today.instants.find((i) => i.key === "fajr")?.time;
  const ishaTime = today.instants.find((i) => i.key === "isha")?.time;
  const arcDots = today.instants
    .filter((i) => i.time != null && fajrTime != null && ishaTime != null)
    .map(({ key, time }) => {
      const range = ishaTime!.getTime() - fajrTime!.getTime();
      const f = range > 0 ? (time!.getTime() - fajrTime!.getTime()) / range : 0;
      return { key, f: Math.min(1, Math.max(0, f)) };
    });

  return (
    <main className="min-h-screen bg-bg px-6 py-8 text-text" dir="rtl">
      <div className="mx-auto max-w-2xl space-y-8">

        {/* ── Header ──────────────────────────────────────────────────── */}
        <header className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-primary">نور</h1>
          <div className="text-left text-sm text-text-2">
            <p>{gregorianDate(now, "ar")}</p>
            <p className="text-xs">{hijriDate(now, "ar")}</p>
          </div>
        </header>

        {/* ── Next prayer countdown ──────────────────────────────────── */}
        <section className="rounded-lg border border-border bg-surface p-6 text-center">
          <p className="mb-1 text-xs uppercase tracking-[0.08em] text-text-2">
            الصلاة القادمة
          </p>
          <p className="text-3xl font-bold text-primary">
            {PRAYER_AR[upcoming.key]}
          </p>
          <p className="mt-1 font-mono text-5xl font-light tracking-wide text-sun">
            {countdownStr}
          </p>
          <p className="mt-2 text-sm text-text-2">
            {formatClock(upcoming.time, "ar")}
            {adhan?.enabled && adhan.perPrayer[upcoming.key as keyof typeof adhan.perPrayer] ? (
              <span className="ms-2 text-xs text-primary">🔊</span>
            ) : null}
          </p>
        </section>

        {/* ── Sun arc ─────────────────────────────────────────────────── */}
        <section>
          <SunArcWidget
            fraction={arcPos.fraction}
            isNight={arcPos.isNight}
            dots={arcDots}
          />
        </section>

        {/* ── Prayer timetable ──────────────────────────────────────── */}
        <section className="space-y-1">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.08em] text-text-2">
            مواقيت اليوم
          </h2>
          {today.instants.map(({ key, time }) => (
            <div
              key={key}
              className={[
                "flex items-center justify-between rounded-md px-3 py-2 text-sm",
                key === upcoming.key
                  ? "bg-surface border border-border text-text font-semibold"
                  : "text-text-2",
              ].join(" ")}
            >
              <span>{PRAYER_AR[key]}</span>
              <span className="font-mono">{formatClock(time, "ar")}</span>
            </div>
          ))}
        </section>

        {/* ── Daily dhikr ─────────────────────────────────────────────── */}
        <DhikrWidget now={now} />

        {/* ── Continue listening ──────────────────────────────────────── */}
        <ContinueListeningShelf />

      </div>
    </main>
  );
}
