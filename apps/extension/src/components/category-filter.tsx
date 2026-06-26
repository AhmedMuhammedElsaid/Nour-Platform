import type { CategorySummary } from "../lib/content";

export type SortMode = "newest" | "az" | "tracks";

type CategoryFilterProps = {
  categories: CategorySummary[];
  activeId: string | null;
  sort: SortMode;
  onCategory: (id: string | null) => void;
  onSort: (sort: SortMode) => void;
};

const active =
  "inline-flex items-center rounded-full bg-primary px-3.5 py-1 text-xs font-semibold text-primary-fg";
const inactive =
  "inline-flex items-center rounded-full border border-primary/20 bg-primary/10 px-3.5 py-1 text-xs font-semibold text-text-2 hover:bg-primary/15 hover:text-primary transition-colors";

const sortActive = "rounded-md border border-primary/40 bg-primary/15 px-2.5 py-1 text-xs font-semibold text-primary";
const sortInactive = "rounded-md border border-border px-2.5 py-1 text-xs text-text-2 hover:text-text transition-colors";

const SORTS: { key: SortMode; label: string }[] = [
  { key: "newest", label: "الأحدث" },
  { key: "az", label: "أ–ي" },
  { key: "tracks", label: "المقاطع" },
];

export function CategoryFilter({ categories, activeId, sort, onCategory, onSort }: CategoryFilterProps) {
  if (categories.length === 0) return null;

  return (
    <div className="space-y-3">
      {/* Category pills */}
      <nav aria-label="تصفية التصنيفات" className="flex flex-wrap gap-2">
        <button
          type="button"
          aria-current={activeId === null ? "true" : undefined}
          onClick={() => onCategory(null)}
          className={activeId === null ? active : inactive}
        >
          الكل
        </button>
        {categories.map((c) => (
          <button
            key={c.id}
            type="button"
            aria-current={activeId === c.id ? "true" : undefined}
            onClick={() => onCategory(c.id)}
            className={activeId === c.id ? active : inactive}
          >
            {c.arName} · {c.enName}
          </button>
        ))}
      </nav>

      {/* Sort row */}
      <div className="flex items-center gap-1.5" role="group" aria-label="الترتيب">
        {SORTS.map((s) => (
          <button
            key={s.key}
            type="button"
            aria-pressed={sort === s.key}
            onClick={() => onSort(s.key)}
            className={sort === s.key ? sortActive : sortInactive}
          >
            {s.label}
          </button>
        ))}
      </div>
    </div>
  );
}
