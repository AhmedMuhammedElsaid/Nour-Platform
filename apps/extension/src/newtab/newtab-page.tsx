import { useEffect, useMemo, useState } from "react";

import type { PrayerKey } from "@repo/shared-core/prayer-times/compute";
import {
  formatClock,
  formatCountdownClock,
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
  fetchCategories,
  fetchPlaylists,
  recordRecent,
  type CategorySummary,
  type PlaylistSummary,
} from "../lib/content";
import { getCoverEmoji, getCoverGradient } from "../lib/cover-art";
import { useI18n } from "../lib/i18n";
import { navigate, useRoute } from "../lib/router";
import type { SortMode } from "../components/category-filter";
import { CategoryFilter } from "../components/category-filter";
import { PlaylistCard } from "../components/playlist-card";
import { AdhkarLanding } from "../components/adhkar-landing";
import { PrayerPage } from "../components/prayer-page";
import { AdhkarReader } from "../components/adhkar-reader";
import { BookmarksList } from "../components/bookmarks-list";
import { QuranLanding } from "../components/quran-landing";
import { QuranReader } from "../components/quran-reader";
import { PlayerBar } from "../components/player-bar";
import { PlaylistDetail } from "../components/playlist-detail";
import { SearchView } from "../components/search-view";
import { SiteHeader } from "../components/site-header";
import { SunArc, buildArcDots } from "../components/sun-arc";

// ── Helpers ─────────────────────────────────────────────────────────────────

function dayOfYear(d: Date): number {
  const start = new Date(d.getFullYear(), 0, 0);
  return Math.floor((d.getTime() - start.getTime()) / 86_400_000);
}

function applySort(playlists: PlaylistSummary[], sort: SortMode): PlaylistSummary[] {
  const copy = [...playlists];
  if (sort === "az") copy.sort((a, b) => a.title.localeCompare(b.title, "ar"));
  else if (sort === "tracks") copy.sort((a, b) => b.trackCount - a.trackCount);
  // "newest" preserves server order (already by `order` field).
  return copy;
}

// ── Sub-widgets ──────────────────────────────────────────────────────────────

type DhikrItem = { ar: string; repeat: number };
type AzkarResponse = { items: DhikrItem[] };

function DhikrWidget({ now }: { now: Date }) {
  const { t } = useI18n();
  const [dhikr, setDhikr] = useState<DhikrItem | null>(null);
  useEffect(() => {
    void getJson<AzkarResponse>("/adhkar/أذكار-الصباح", { locale: "ar" })
      .then((res) => {
        const items = res.items;
        if (items.length > 0) setDhikr(items[dayOfYear(now) % items.length] ?? null);
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (!dhikr) return null;
  return (
    <section className="space-y-2">
      <h2 className="text-xs font-semibold uppercase tracking-[0.08em] text-text-2">{t("home.dhikrOfDay")}</h2>
      <div className="rounded-xl border border-border bg-surface p-4">
        <p className="text-right text-base leading-relaxed text-text">{dhikr.ar}</p>
        <p className="mt-2 text-end text-xs text-text-2">× {dhikr.repeat}</p>
      </div>
    </section>
  );
}

function ContinueListeningShelf({
  onPlay,
  onOpen,
}: {
  onPlay: (slug: string) => void;
  onOpen: (slug: string, trackId?: string) => void;
}) {
  const { t } = useI18n();
  const [recent, setRecent] = useState<RecentItem[]>([]);
  const [positions, setPositions] = useState<Record<string, { t: number }>>({});

  useEffect(() => {
    void get("nour.player.recent").then(setRecent);
    void get("nour.player.positions").then(setPositions);
  }, []);

  const linkable = recent.filter((r) => r.type === "playlist").slice(0, 6);
  if (linkable.length === 0) return null;

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-[0.08em] text-text-2">
          {t("home.continueListening")}
        </h2>
        <button
          type="button"
          onClick={() => setRecent([])}
          className="text-xs text-text-2 hover:text-primary"
        >
          {t("home.clearListening")}
        </button>
      </div>
      <ul className="flex gap-3 overflow-x-auto pb-2 pt-1">
        {linkable.map((item) => {
          const savedT = item.trackId ? (positions[item.trackId]?.t ?? 0) : 0;
          const pct =
            item.durationSecs && item.durationSecs > 0 && savedT > 0
              ? Math.min(1, savedT / item.durationSecs)
              : null;
          const [gradFrom, gradTo] = getCoverGradient(item.trackId ?? item.slug);
          const emoji = getCoverEmoji(item.trackId ?? item.slug);

          return (
            <li key={item.slug} className="shrink-0 w-36">
              <button
                type="button"
                onClick={() =>
                  item.trackId
                    ? onOpen(item.slug, item.trackId)
                    : onPlay(item.slug)
                }
                className="group relative flex w-full flex-col items-center gap-2 rounded-2xl border border-border bg-surface p-3 text-center transition-all duration-200 hover:-translate-y-1 hover:border-primary/30"
              >
                {/* Circle cover */}
                <div className="relative w-[78%] aspect-square rounded-full overflow-hidden">
                  {item.cover ? (
                    <img
                      src={item.cover}
                      alt=""
                      loading="lazy"
                      className="size-full object-cover transition-transform group-hover:scale-105"
                    />
                  ) : (
                    <div
                      className="size-full flex items-center justify-center"
                      style={{ background: `linear-gradient(to bottom, ${gradFrom}, ${gradTo})` }}
                    >
                      <span className="text-3xl select-none" aria-hidden="true">{emoji}</span>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <div className="size-7 rounded-full bg-primary/90 flex items-center justify-center">
                      <svg className="size-3 text-primary-fg ms-0.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    </div>
                  </div>
                </div>

                {/* Resume bar */}
                {pct !== null && (
                  <div className="w-[78%] h-0.5 rounded-full bg-primary/20">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${Math.round(pct * 100)}%` }}
                    />
                  </div>
                )}

                <p className="w-full truncate text-xs font-medium text-text group-hover:text-primary">
                  {item.title}
                </p>
                {item.playlistTitle ? (
                  <p className="w-full truncate text-2xs text-text-2">{item.playlistTitle}</p>
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function LibrarySection({
  onPlay,
  onOpen,
  categories,
}: {
  onPlay: (slug: string) => void;
  onOpen: (slug: string) => void;
  categories: CategorySummary[];
}) {
  const [playlists, setPlaylists] = useState<PlaylistSummary[]>([]);
  const [activeCat, setActiveCat] = useState<string | null>(null);
  const [sort, setSort] = useState<SortMode>("newest");

  useEffect(() => {
    void fetchPlaylists()
      .then(setPlaylists)
      .catch(() => {});
  }, []);

  const visible = useMemo(() => {
    const filtered = activeCat
      ? playlists.filter((p) => p.categoryIds.includes(activeCat))
      : playlists;
    return applySort(filtered, sort);
  }, [playlists, activeCat, sort]);

  const { t: tLib } = useI18n();
  if (playlists.length === 0) return null;

  return (
    <section className="space-y-4">
      <h2 className="text-xs font-semibold uppercase tracking-[0.08em] text-text-2">{tLib("home.library")}</h2>
      <CategoryFilter
        categories={categories}
        activeId={activeCat}
        sort={sort}
        onCategory={setActiveCat}
        onSort={setSort}
      />
      <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
        {visible.map((p) => (
          <li key={p.slug}>
            <PlaylistCard
              playlist={p}
              categories={categories}
              onPlay={onPlay}
              onOpen={onOpen}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}


// ── Main page ────────────────────────────────────────────────────────────────

export function NewtabPage() {
  const route = useRoute();
  const pt = usePrayerTimes();
  const { location } = useLocation();
  const { state: playerState, send } = usePlayer();
  const { t, locale } = useI18n();
  const [categories, setCategories] = useState<CategorySummary[]>([]);

  useEffect(() => {
    void fetchCategories()
      .then(setCategories)
      .catch(() => {});
  }, []);

  async function playBySlug(slug: string): Promise<void> {
    const { queue, recent } = await buildPlaylistQueue(slug);
    if (queue.length === 0) return;
    send({ type: "load", queue, index: 0 });
    await recordRecent(recent);
  }

  // Dispatch non-home views (stubs until their phases land).
  const view = route.view;
  const headerEl = <SiteHeader activeView={view} />;

  if (view === "quran") {
    return (
      <div className="min-h-screen bg-bg text-text" dir="rtl">
        {headerEl}
        <QuranLanding />
        <PlayerBar state={playerState} send={send} />
      </div>
    );
  }
  if (view === "quran-read") {
    return (
      <div className="min-h-screen bg-bg text-text" dir="rtl">
        {headerEl}
        <QuranReader surah={route.surah} state={playerState} send={send} />
        <PlayerBar state={playerState} send={send} />
      </div>
    );
  }
  if (view === "bookmarks") {
    return (
      <div className="min-h-screen bg-bg text-text" dir="rtl">
        {headerEl}
        <BookmarksList />
        <PlayerBar state={playerState} send={send} />
      </div>
    );
  }
  if (view === "adhkar") {
    return (
      <div className="min-h-screen bg-bg text-text" dir="rtl">
        {headerEl}
        <AdhkarLanding />
        <PlayerBar state={playerState} send={send} />
      </div>
    );
  }
  if (view === "adhkar-read") {
    return (
      <div className="min-h-screen bg-bg text-text" dir="rtl">
        {headerEl}
        <AdhkarReader slug={route.slug} />
        <PlayerBar state={playerState} send={send} />
      </div>
    );
  }
  if (view === "prayer-times") {
    return (
      <div className="min-h-screen bg-bg text-text" dir="rtl">
        {headerEl}
        <PrayerPage />
        <PlayerBar state={playerState} send={send} />
      </div>
    );
  }
  if (view === "search") {
    return (
      <div className="min-h-screen bg-bg text-text" dir="rtl">
        {headerEl}
        <SearchView initialQ={route.q} state={playerState} send={send} />
        <PlayerBar state={playerState} send={send} />
      </div>
    );
  }
  if (view === "playlist") {
    return (
      <div className="min-h-screen bg-bg text-text" dir="rtl">
        {headerEl}
        <PlaylistDetail
          slug={route.slug}
          startTrackId={route.trackId}
          state={playerState}
          send={send}
          categories={categories}
        />
        <PlayerBar state={playerState} send={send} />
      </div>
    );
  }

  // ── Home view ──────────────────────────────────────────────────────────────

  const loading = !pt;
  const rowKeys: PrayerKey[] = ["fajr", "sunrise", "dhuhr", "asr", "maghrib", "isha"];

  return (
    <div className="min-h-screen bg-bg text-text" dir="rtl">
      {headerEl}

      <main className="mx-auto max-w-5xl space-y-10 px-4 py-8">
        {/* ── Prayer widget ────────────────────────────────────────────── */}
        {loading ? (
          <div className="flex h-48 items-center justify-center">
            <p className="text-sm text-text-2">{t("common.loading")}</p>
          </div>
        ) : (() => {
          const { today, upcoming, arcPos, now } = pt;
          const countdownStr = formatCountdownClock(upcoming.msUntil, locale);
          const arcDots = buildArcDots(today, upcoming.key, (key) => t(`prayer.${key}`));

          return (
            <section
              aria-label={t("prayer.title")}
              className="overflow-hidden rounded-2xl border border-border bg-surface"
            >
              <div className="px-6 pt-5">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-sm text-text">
                    🕌 {location?.label ?? t("home.location")}
                  </span>
                  <span className="text-xs text-sun">{hijriDate(now, "ar")}</span>
                </div>
              </div>
              <div className="mt-1">
                <SunArc
                  dots={arcDots}
                  sunFraction={arcPos.fraction}
                  nextLabel={t(`prayer.${upcoming.key}`)}
                  isNight={arcPos.isNight}
                  onNightBand={arcPos.onNightBand}
                />
              </div>
              <div className="mb-3 flex items-baseline justify-center gap-2.5">
                <span className="text-xs uppercase tracking-widest text-text-2">{t("home.nextPrayer")}</span>
                <span className="font-display text-xl font-semibold text-text">
                  {t(`prayer.${upcoming.key}`)}
                </span>
                <span className="font-display text-lg font-semibold text-sun">{countdownStr}</span>
              </div>
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
                        {t(`prayer.${key}`)}
                      </div>
                      <div className={`mt-1 text-sm tabular-nums ${isNext ? "font-semibold text-sun" : "text-text"}`}>
                        {formatClock(inst.time, "ar")}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })()}

        {/* ── Daily dhikr ──────────────────────────────────────────────── */}
        {pt ? <DhikrWidget now={pt.now} /> : null}

        {/* ── Continue listening ────────────────────────────────────────── */}
        <ContinueListeningShelf
          onPlay={(slug) => void playBySlug(slug)}
          onOpen={(slug, trackId) => navigate({ view: "playlist", slug, trackId })}
        />

        {/* ── Library ──────────────────────────────────────────────────── */}
        <LibrarySection
          onPlay={(slug) => void playBySlug(slug)}
          onOpen={(slug) => navigate({ view: "playlist", slug })}
          categories={categories}
        />

        <div className="h-28" aria-hidden="true" />
      </main>

      <PlayerBar state={playerState} send={send} />
    </div>
  );
}
