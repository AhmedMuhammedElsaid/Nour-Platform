// Radio row builder for the OS home-screen widget (home_widget_plan.md §4).
// Runs inside the headless widget task (registerWidgetTaskHandler), so it can
// use AsyncStorage + fetch (via lib/api.ts's getJson) directly — but it MUST
// NEVER throw: a radio-row failure (offline, timeout, 5xx, slug not found)
// must not blank the prayer/adhkar rows rendered in the same widget update.
//
// Multi-pill rewrite: merges recently-played + favorite station slugs
// (recent first), dedupes, and resolves up to RADIO_STATIONS_MAX names via
// one /radio fetch — was previously a single station name.

import AsyncStorage from "@react-native-async-storage/async-storage";

import type { RadioStation } from "@repo/shared-core/schemas/radio";

import { getJson } from "@/lib/api";
import { getRadioFavorites, getRecentStations } from "@/lib/device-local";
import { toStationView } from "@/features/radio/lib/station-view";

// Mobile-only, NOT a cross-surface `nour.*` contract (web/extension have no
// launcher widgets) — kept under a `nour.widget.*` prefix so future
// widget-only state stays visually grouped and obviously exempt from the
// cross-surface key table (CLAUDE.md §5).
export const RADIO_NAME_CACHE_KEY = "nour.widget.radioNameCache";

const RADIO_LABEL: Record<"ar" | "en", string> = { ar: "إذاعة", en: "Radio" };

// getJson's underlying fetch has no default timeout. Without this, a hung
// request (captive portal, server accepts then never responds) never rejects,
// so the catch below never fires and the whole widget render — prayer +
// adhkar rows included — stalls on this await. Racing against a timeout
// guarantees buildRadioRow always settles; the abandoned fetch is simply
// ignored if it resolves later.
const RADIO_FETCH_TIMEOUT_MS = 6000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("radio row fetch timed out")), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err: unknown) => {
        clearTimeout(timer);
        reject(err instanceof Error ? err : new Error(String(err)));
      },
    );
  });
}

export type RadioRowResult = {
  label: string;
  stations: string[]; // up to RADIO_STATIONS_MAX resolved names
};

const RADIO_STATIONS_MAX = 3;

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((v) => typeof v === "string");
}

export async function buildRadioRow(locale: "ar" | "en"): Promise<RadioRowResult> {
  const label = RADIO_LABEL[locale];

  let slugs: string[] = [];
  try {
    const recent = await getRecentStations();
    const favorites = await getRadioFavorites();
    slugs = [...new Set([...recent, ...favorites])].slice(0, RADIO_STATIONS_MAX);
  } catch {
    slugs = [];
  }

  if (slugs.length === 0) return { label, stations: [] };

  try {
    const stations = await withTimeout(getJson<RadioStation[]>("/radio"), RADIO_FETCH_TIMEOUT_MS);
    const names = slugs
      .map((slug) => stations.find((s) => s.slug === slug))
      .filter((s): s is RadioStation => s != null)
      .map((s) => toStationView(s, locale).name);
    if (names.length > 0) {
      try {
        await AsyncStorage.setItem(RADIO_NAME_CACHE_KEY, JSON.stringify(names));
      } catch {
        // Cache write failure is non-fatal — names still render this cycle.
      }
      return { label, stations: names };
    }
  } catch {
    // Network failure, timeout, or non-2xx — fall through to the cache below.
  }

  try {
    const cached = await AsyncStorage.getItem(RADIO_NAME_CACHE_KEY);
    if (cached) {
      const parsed: unknown = JSON.parse(cached);
      if (isStringArray(parsed)) return { label, stations: parsed };
    }
    return { label, stations: [] };
  } catch {
    return { label, stations: [] };
  }
}
