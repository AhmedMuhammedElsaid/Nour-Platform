// Adhkar row builder for the OS home-screen widget (home_widget_plan.md §3).
// Multi-icon rewrite of the original static-label version: fetches /adhkar
// (reusing the 6s-timeout never-throws pattern from build-radio-row.ts),
// runs the SAME buildAdhkarPreview shared-core helper the in-app
// AdhkarPreviewShelf uses, and deep-links each icon to its own set (mirrors
// features/home/components/adhkar-preview-shelf.tsx's `set[locale] ?? set.ar`
// → `.slug` resolution). Unlike the in-app Home shelf (which passes
// `excludeWake: true` — owner request 2026-07-17, mobile+web only), the
// widget shows ALL 5 preview icons including Wake-up (owner request, this
// session) — a deliberately different choice per surface, not a bug if they
// ever look inconsistent side by side. Resolved slugs are cached so an
// offline refresh still deep-links correctly; a fetch failure with no cache
// falls back to 5 static icons pointing at the plain adhkar list. NEVER
// throws — a row failure must not blank the prayer/radio rows rendered in
// the same update.

import AsyncStorage from "@react-native-async-storage/async-storage";

import type { Azkar } from "@repo/shared-core/schemas/azkar";
import { ADHKAR_PREVIEW_ICONS, buildAdhkarPreview } from "@repo/shared-core/adhkar/preview";

import { getJson } from "@/lib/api";

// Mobile-only, `nour.widget.*` prefix (NOT a cross-surface `nour.*`
// contract — web/extension have no launcher widgets) — same precedent as
// build-radio-row.ts's RADIO_NAME_CACHE_KEY.
export const ADHKAR_SLUGS_CACHE_KEY = "nour.widget.adhkarSlugsCache";

const ADHKAR_TITLE: Record<"ar" | "en", string> = { ar: "الأذكار", en: "Adhkar" };

// Same rationale as build-radio-row.ts's RADIO_FETCH_TIMEOUT_MS: getJson's
// underlying fetch has no default timeout, so a hung request must be raced
// against a timer or it stalls the whole widget render.
const ADHKAR_FETCH_TIMEOUT_MS = 6000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("adhkar row fetch timed out")), ms);
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

export type AdhkarRowItem = { icon: string; uri: string };
export type AdhkarRowResult = { title: string; items: AdhkarRowItem[] };

function isAdhkarRowItems(value: unknown): value is AdhkarRowItem[] {
  return (
    Array.isArray(value) &&
    value.every(
      (v) =>
        typeof v === "object" &&
        v !== null &&
        typeof (v as AdhkarRowItem).icon === "string" &&
        typeof (v as AdhkarRowItem).uri === "string",
    )
  );
}

// ADHKAR_PREVIEW_ICONS is positionally [morning, evening, sleep, wake,
// prayer] (see shared-core comment) — all 5 shown here (unlike the in-app
// Home shelf's excludeWake preview), so the offline fallback matches live.
function staticFallbackItems(): AdhkarRowItem[] {
  return ADHKAR_PREVIEW_ICONS.map((icon) => ({
    icon,
    uri: "nour:///adhkar",
  }));
}

export async function buildAdhkarRow(locale: "ar" | "en"): Promise<AdhkarRowResult> {
  const title = ADHKAR_TITLE[locale];

  try {
    const sets = await withTimeout(getJson<Azkar[]>("/adhkar"), ADHKAR_FETCH_TIMEOUT_MS);
    const preview = buildAdhkarPreview(sets);
    if (preview.length > 0) {
      const items = preview.map(({ set, icon }) => {
        const display = set[locale] ?? set.ar;
        return { icon, uri: `nour:///adhkar/${encodeURIComponent(display.slug)}` };
      });
      try {
        await AsyncStorage.setItem(ADHKAR_SLUGS_CACHE_KEY, JSON.stringify(items));
      } catch {
        // Cache write failure is non-fatal — items still render this cycle.
      }
      return { title, items };
    }
  } catch {
    // Network failure, timeout, or non-2xx — fall through to the cache below.
  }

  try {
    const cached = await AsyncStorage.getItem(ADHKAR_SLUGS_CACHE_KEY);
    if (cached) {
      const parsed: unknown = JSON.parse(cached);
      if (isAdhkarRowItems(parsed) && parsed.length > 0) {
        return { title, items: parsed };
      }
    }
  } catch {
    // Corrupt cache — fall through to the static fallback.
  }

  return { title, items: staticFallbackItems() };
}
