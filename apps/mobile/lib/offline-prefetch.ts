import AsyncStorage from "@react-native-async-storage/async-storage";
import type { QueryClient } from "@tanstack/react-query";
import type { Locale } from "@repo/shared-core/schemas/locale";

import { getQuranPrefs } from "@/lib/device-local";
import {
  adhkarDetailQuery,
  adhkarListQuery,
  quranSurahReaderQuery,
  quranSurahsQuery,
} from "@/lib/queries";
import { pruneStaleSurahs, writeSurah } from "@/lib/quran-offline-store";

// Completion marker — mobile-only cache bookkeeping key, NOT one of the
// cross-surface `nour.*` device-local contracts (CLAUDE.md §5). Only ever
// read/written here.
const MARKER_KEY = "nour.quran.offline.v1";
const CONCURRENCY = 3;

type OfflineMarker = {
  locale: Locale;
  translation: string;
  reciter: string;
  // App version the marker was written under (same string as _layout.tsx's
  // persisted-cache `buster`). Without this, an app update that wipes the
  // persisted query cache (buster mismatch) would still leave this marker
  // matching current prefs, so runOfflinePrefetch would early-return forever
  // and the offline set would never be rebuilt post-update.
  version: string;
};

function isOfflineMarker(value: unknown): value is OfflineMarker {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as OfflineMarker).locale === "string" &&
    typeof (value as OfflineMarker).translation === "string" &&
    typeof (value as OfflineMarker).reciter === "string" &&
    typeof (value as OfflineMarker).version === "string"
  );
}

async function readMarker(): Promise<OfflineMarker | null> {
  try {
    const raw = await AsyncStorage.getItem(MARKER_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isOfflineMarker(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

async function writeMarker(marker: OfflineMarker): Promise<void> {
  try {
    await AsyncStorage.setItem(MARKER_KEY, JSON.stringify(marker));
  } catch {
    /* storage unavailable — non-fatal; next launch just retries the pass */
  }
}

// Bounded-concurrency runner. Rethrows the first failure (after in-flight
// siblings settle) so the caller can abort the whole prefetch pass and leave
// the completion marker unset.
async function runWithConcurrency<T>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  let index = 0;
  let firstError: unknown;

  async function next(): Promise<void> {
    for (;;) {
      const i = index++;
      if (i >= items.length) return;
      if (firstError !== undefined) return;
      try {
        await worker(items[i] as T);
      } catch (err) {
        if (firstError === undefined) firstError = err;
        return;
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => next()));
  if (firstError !== undefined) throw firstError;
}

// Prefetches the full adhkar catalog + Quran surah text (for the user's
// current reader prefs) into the persisted TanStack Query cache, so both
// read offline after first launch. Reuses the SAME query factories the
// screens use (lib/queries.ts) so cache keys match exactly.
//
// Uses queryClient.fetchQuery (not prefetchQuery) deliberately: prefetchQuery
// swallows fetch errors internally (it never rejects), which would make the
// "stop silently on failure, leave the marker unset" requirement below
// unobservable. fetchQuery still resolves from cache without a network call
// once a query is fresh (the Quran queries carry staleTime: Infinity), so
// already-cached surahs are still skipped for free on a resumed/retried run.
//
// On ANY fetch failure this stops silently and leaves the completion marker
// unset (or stale), so the next app launch's call retries the whole pass.
//
// appVersion must be the SAME string passed as _layout.tsx's persisted-cache
// `buster` (app.json expo.version) — see the OfflineMarker.version comment.
export async function runOfflinePrefetch(
  queryClient: QueryClient,
  locale: Locale,
  appVersion: string,
): Promise<void> {
  const prefs = await getQuranPrefs();
  const marker = await readMarker();
  const upToDate =
    marker != null &&
    marker.locale === locale &&
    marker.translation === prefs.translationSlug &&
    marker.reciter === prefs.reciterSlug &&
    marker.version === appVersion;
  if (upToDate) return;

  try {
    // Drop surah files from a previous translation/reciter (or a completely
    // different marker state) before writing the new set, so a prefs switch
    // doesn't leak orphaned files.
    await pruneStaleSurahs({
      locale,
      translationSlug: prefs.translationSlug,
      reciterSlug: prefs.reciterSlug,
    });

    const adhkarList = await queryClient.fetchQuery(adhkarListQuery());
    await runWithConcurrency(adhkarList, CONCURRENCY, async (item) => {
      const display = item[locale] ?? item.ar ?? item.en;
      if (display == null) return;
      await queryClient.fetchQuery(adhkarDetailQuery(display.slug, locale));
    });

    const surahs = await queryClient.fetchQuery(quranSurahsQuery());
    await runWithConcurrency(surahs, CONCURRENCY, async (surah) => {
      const data = await queryClient.fetchQuery(
        quranSurahReaderQuery(surah.number, locale, prefs.translationSlug, prefs.reciterSlug),
      );
      // Surah payloads are excluded from the persisted AsyncStorage blob
      // (see _layout.tsx shouldDehydrateQuery) — write them to the per-surah
      // file store instead, so they survive a restart without inflating the
      // single dehydrated-cache value past Android's CursorWindow row limit.
      await writeSurah(
        { surah: surah.number, locale, translationSlug: prefs.translationSlug, reciterSlug: prefs.reciterSlug },
        data,
      );
    });

    await writeMarker({
      locale,
      translation: prefs.translationSlug,
      reciter: prefs.reciterSlug,
      version: appVersion,
    });
  } catch {
    // Network/API failure mid-run — marker stays unset (or stale from a
    // previous prefs combo), so the next launch retries from scratch.
  }
}
