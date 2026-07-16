import type { Azkar } from "@repo/api/schemas/azkar";
import type { Locale } from "@repo/api/schemas/locale";
import { buildAdhkarPreview } from "@repo/shared-core/adhkar/preview";

import { Link } from "@/i18n/navigation";

// Home "Adhkar" shelf — a short preview of the /adhkar catalog (first
// ADHKAR_PREVIEW_COUNT sets, curated via seed order — see scripts/seed-adhkar.ts).
// Minimal cards (icon + title, no progress bar), mirroring the Radio/Readers
// shelves. Tapping a card opens that set's reader; "Explore more" opens /adhkar.
// Waking Adhkar is hidden here specifically (owner request, 2026-07-17) — it
// still shows on the full /adhkar list, and the extension's home shelf is
// deliberately left unchanged (keeps all 5).
// Plain props (no next-intl server call inside) so it stays a simple,
// independently testable presentational component — the caller passes labels
// from its own already-fetched `getTranslations("home")`.
export function AdhkarPreviewShelf({
  sets,
  locale,
  heading,
  exploreLabel,
}: {
  sets: Azkar[];
  locale: Locale;
  heading: string;
  exploreLabel: string;
}) {
  const preview = buildAdhkarPreview(sets, { excludeWake: true });
  if (preview.length === 0) return null;

  return (
    <section aria-labelledby="adhkar-heading" className="mt-8">
      <div className="flex items-center justify-between">
        <h2 id="adhkar-heading" className="text-lg font-semibold">
          {heading}
        </h2>
        <Link
          href="/adhkar"
          className="inline-flex items-center gap-1 text-sm text-text-2 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm px-2 py-1"
        >
          {exploreLabel}
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="size-3.5 rtl:-scale-x-100" aria-hidden="true">
            <path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {preview.map(({ set, icon }) => {
          const display = set[locale];
          return (
            <Link
              key={set.id}
              href={`/adhkar/${display.slug}`}
              className="group flex flex-col items-center gap-2 rounded-2xl border border-border bg-surface p-4 text-center transition-all duration-200 hover:-translate-y-1 hover:border-primary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <div className="flex size-12 items-center justify-center rounded-xl bg-primary/10">
                <span className="text-2xl select-none" aria-hidden="true">
                  {icon}
                </span>
              </div>
              <span className="line-clamp-2 text-sm font-medium text-text group-hover:text-primary">
                {display.title}
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
