export type ReaderLayout = "list" | "mushaf";

export interface QuranPrefs {
  translationSlug: string;
  reciterSlug: string;
  showTranslation: boolean;
  showWordByWord: boolean;
  fontScale: number; // 1 = base; clamped 0.8..1.6 by the settings UI
  layout: ReaderLayout;
}

const KEY = "nour.quran.prefs";

export const DEFAULT_PREFS: QuranPrefs = {
  translationSlug: "en.sahih",
  reciterSlug: "qatami",
  showTranslation: true,
  showWordByWord: false,
  fontScale: 1,
  layout: "list",
};

export function loadPrefs(): QuranPrefs {
  if (typeof window === "undefined") return DEFAULT_PREFS;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return DEFAULT_PREFS;
    return { ...DEFAULT_PREFS, ...(JSON.parse(raw) as Partial<QuranPrefs>) };
  } catch {
    return DEFAULT_PREFS;
  }
}

export function savePrefs(prefs: QuranPrefs): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(prefs));
  } catch {
    // best-effort — prefs are non-critical
  }
}
