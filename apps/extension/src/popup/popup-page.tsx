import browser from "webextension-polyfill";

import { formatClock, formatCountdownClock } from "@repo/shared-core/prayer-times/format";
import type { PrayerKey } from "@repo/shared-core/prayer-times/compute";

import { PlayerBar } from "../components/player-bar";
import { SunArc, buildArcDots } from "../components/sun-arc";
import { usePlayer } from "../lib/use-player";
import { usePrayerTimes } from "../lib/use-prayer-times";

const PRAYER_AR: Record<PrayerKey, string> = {
  fajr: "الفجر",
  sunrise: "الشروق",
  dhuhr: "الظهر",
  asr: "العصر",
  maghrib: "المغرب",
  isha: "العشاء",
};

export function PopupPage() {
  const pt = usePrayerTimes();
  const { state: playerState, send } = usePlayer();

  if (!pt) {
    return (
      <div className="flex min-h-40 items-center justify-center bg-bg p-4" dir="rtl">
        <p className="text-sm text-text-2">جاري التحميل…</p>
      </div>
    );
  }

  const { today, upcoming, arcPos, now } = pt;
  const arcDots = buildArcDots(today, upcoming.key, (key) => PRAYER_AR[key]);

  const countdownStr = formatCountdownClock(upcoming.msUntil, "ar");

  // Progress within the day (Fajr → Isha elapsed fraction, 0–1)
  const fajrTime = today.instants.find((i) => i.key === "fajr")?.time;
  const ishaTime = today.instants.find((i) => i.key === "isha")?.time;
  const dayProgress =
    fajrTime && ishaTime && ishaTime.getTime() > fajrTime.getTime()
      ? Math.min(
          1,
          Math.max(
            0,
            (now.getTime() - fajrTime.getTime()) /
              (ishaTime.getTime() - fajrTime.getTime()),
          ),
        )
      : 0;

  return (
    <div className="bg-bg p-4 text-text" dir="rtl">

      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-bold text-primary">نور</span>
        <a
          href={browser.runtime.getURL("src/options/index.html")}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-text-2 hover:text-text"
          aria-label="الإعدادات"
        >
          ⚙
        </a>
      </div>

      {/* Sun/moon arc — current time rides the Fajr→Isha track; the next prayer
          glows. In-arc labels auto-hide at the popup's 360px width; the list
          below carries the names. */}
      <div className="mb-2 -mx-1">
        <SunArc
          dots={arcDots}
          sunFraction={arcPos.fraction}
          nextLabel={PRAYER_AR[upcoming.key]}
          isNight={arcPos.isNight}
          onNightBand={arcPos.onNightBand}
          alwaysShowLabels
        />
      </div>

      {/* Countdown */}
      <div className="mb-3 text-center">
        <p className="text-xs text-text-2">
          {PRAYER_AR[upcoming.key]} · {formatClock(upcoming.time, "ar")}
        </p>
        <p className="font-mono text-3xl font-light tracking-wide text-sun">
          {countdownStr}
        </p>
      </div>

      {/* Day progress bar */}
      <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-surface-2">
        <div
          className="h-full rounded-full bg-primary transition-all duration-1000"
          style={{ width: `${Math.round(dayProgress * 100)}%` }}
        />
      </div>

      {/* Today's prayers compact list */}
      <ul className="space-y-1">
        {today.instants
          .filter((i) => i.key !== "sunrise")
          .map(({ key, time }) => (
            <li
              key={key}
              className={[
                "flex justify-between text-xs",
                key === upcoming.key ? "font-semibold text-text" : "text-text-2",
              ].join(" ")}
            >
              <span>{PRAYER_AR[key]}</span>
              <span className="font-mono">{formatClock(time, "ar")}</span>
            </li>
          ))}
      </ul>

      {/* Spacer + now-playing bar (renders nothing when idle). */}
      {playerState && playerState.status !== "stopped" ? (
        <div className="h-24" aria-hidden="true" />
      ) : null}
      <PlayerBar state={playerState} send={send} />
    </div>
  );
}
