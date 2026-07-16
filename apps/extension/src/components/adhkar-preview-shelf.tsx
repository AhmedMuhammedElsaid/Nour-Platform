import { useEffect, useState } from "react";

import { ADHKAR_PREVIEW_COUNT, previewAdhkarIcon } from "@repo/shared-core/adhkar/preview";

import { fetchAdhkarList, type AdhkarSummary } from "../lib/content";
import { useI18n } from "../lib/i18n";
import { navigate } from "../lib/router";

// Pure so the slice is testable without rendering (package has no jsdom —
// see vitest.config.ts `environment: "node"`).
export function previewAdhkarSets(
  sets: AdhkarSummary[],
  limit = ADHKAR_PREVIEW_COUNT,
): AdhkarSummary[] {
  return sets.slice(0, limit);
}

// Home "Adhkar" shelf — a short preview of the /adhkar catalog (first
// ADHKAR_PREVIEW_COUNT sets, curated via seed order — see scripts/seed-adhkar.ts).
// Minimal cards (icon + title, no progress bar). Mirrors web AdhkarPreviewShelf
// and the Radio/Readers shelves already on Home.
export function AdhkarPreviewShelf() {
  const { t } = useI18n();
  const [sets, setSets] = useState<AdhkarSummary[]>([]);

  useEffect(() => {
    void fetchAdhkarList()
      .then(setSets)
      .catch(() => {});
  }, []);

  const preview = previewAdhkarSets(sets);
  if (preview.length === 0) return null;

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-[0.08em] text-text-2">{t("home.adhkar")}</h2>
        <button
          type="button"
          onClick={() => navigate({ view: "adhkar" })}
          className="cursor-pointer text-xs text-text-2 hover:text-primary"
        >
          {t("home.adhkarExplore")}
        </button>
      </div>
      <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {preview.map((set, index) => (
          <li key={set.id}>
            <button
              type="button"
              onClick={() => navigate({ view: "adhkar-read", slug: set.slug })}
              className="group flex w-full flex-col items-center gap-2 rounded-2xl border border-border bg-surface p-4 text-center transition-all duration-200 hover:-translate-y-1 hover:border-primary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <div className="flex size-12 items-center justify-center rounded-xl bg-primary/10">
                <span className="text-2xl select-none" aria-hidden="true">
                  {previewAdhkarIcon(index)}
                </span>
              </div>
              <span className="line-clamp-2 text-sm font-medium text-text group-hover:text-primary">
                {set.title}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
