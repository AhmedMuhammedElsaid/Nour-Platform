# Skeleton Loading Audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the remaining skeleton-loading gaps on web (6 routes), mobile (Radio + 3 screens that had a lower-fidelity Spinner), and the extension newtab (11 view components with zero or "Loading…"-text-only feedback) — the top-of-page nav progress bar is already shipped on all 3 surfaces and is untouched by this plan.

**Architecture:** Each surface keeps its own existing skeleton convention — no shared cross-platform component. Web adds Next.js `loading.tsx` Suspense fallbacks (`animate-pulse` + `bg-surface-2` divs). Mobile reuses the existing `apps/mobile/components/ui/skeleton.tsx` `<Skeleton>` component. Extension gets one new small `<Skeleton>` primitive (same `animate-pulse bg-surface-2` recipe, since extension's Tailwind tokens mirror web's 1:1) wired into newtab views.

**Tech Stack:** Next.js 16 (web), Expo/React Native + NativeWind v4 + TanStack Query (mobile), React DOM + Tailwind v4 + Vite (extension, no jsdom in its vitest environment — `environment: "node"`).

## Global Constraints

- No new dependencies.
- No hex colors or arbitrary Tailwind values — use existing tokens (`bg-surface-2`, `border-border`, etc.) exactly as the existing skeletons already do.
- All skeleton markup is presentational only: web `loading.tsx` files get `aria-hidden="true"` on the root; extension skeleton blocks get `aria-hidden="true"` too; mobile's `<Skeleton>` already sets `accessibilityRole="progressbar"` itself.
- Do **not** touch: the top progress bar (already shipped), extension popup/options, mobile Bookmarks/Downloads/Qibla/Prayer-times screens (no network fetch, nothing to skeleton), mobile's `<Skeleton>` component itself (stays animation-free — deliberate, documented choice), any pure logic functions in extension components (`previewStations`, `sortFavoritesFirst`, `resolveRecentStations`, `previewAdhkarSets` — existing tests for these must stay green untouched).
- Commit grouping follows the approved spec (`docs/superpowers/specs/2026-07-21-skeleton-loading-audit-design.md`): **one commit per surface**, not per file — `[fix]: web - skeleton loading for quran/radio/qibla/prayer-times routes`, `[fix]: mobile - wire skeleton into radio + spinner screens`, `[feat]: extension - skeleton primitive + newtab loading states`. Each ends with the `Co-Authored-By: Ahmed Muhammed Elsaid <ahmed.muhammed.elsaid@gmail.com>` trailer per CLAUDE.md §5.1.
- Before any push: re-run `git status` + `git log -1` (concurrent sessions may be on `main`); stage explicit paths only, never `git add -A`.

---

## Part A — Web (6 tasks + 1 commit task)

### Task 1: Quran surah-list loading skeleton

**Files:**
- Create: `apps/web/app/[locale]/quran/loading.tsx`

**Interfaces:** None (standalone Next.js Suspense fallback, no props).

- [ ] **Step 1: Create the file**

```tsx
// Quran surah-list Suspense fallback — tabs row + surah grid skeleton.
export default function QuranLoading() {
  return (
    <div className="mx-auto max-w-6xl px-6 py-16" aria-hidden="true">
      <div className="h-9 w-40 animate-pulse rounded-md bg-surface-2" />
      <div className="mt-6 h-4 w-24 animate-pulse rounded bg-surface-2" />
      <div className="mt-6 flex gap-2 border-b border-border pb-2">
        <div className="h-8 w-20 animate-pulse rounded bg-surface-2" />
        <div className="h-8 w-20 animate-pulse rounded bg-surface-2" />
      </div>
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} className="space-y-3 rounded-2xl border border-border bg-surface p-4">
            <div className="h-12 w-12 animate-pulse rounded-xl bg-surface-2" />
            <div className="h-5 w-3/4 animate-pulse rounded bg-surface-2" />
            <div className="h-4 w-1/2 animate-pulse rounded bg-surface-2" />
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter web typecheck`
Expected: no errors.

---

### Task 2: Quran surah-reader loading skeleton

**Files:**
- Create: `apps/web/app/[locale]/quran/[surah]/loading.tsx`

**Interfaces:** None.

- [ ] **Step 1: Create the file**

```tsx
// Quran surah reader Suspense fallback — header + stacked ayah-line skeleton.
export default function SurahReaderLoading() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-8" aria-hidden="true">
      <div className="h-4 w-16 animate-pulse rounded bg-surface-2" />
      <header className="mt-4 border-b border-border pb-4 text-center">
        <div className="mx-auto h-9 w-48 animate-pulse rounded-md bg-surface-2" />
        <div className="mx-auto mt-3 h-4 w-40 animate-pulse rounded bg-surface-2" />
        <div className="mx-auto mt-4 h-7 w-64 animate-pulse rounded bg-surface-2" />
      </header>
      <div className="mt-8 space-y-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-6 w-full animate-pulse rounded bg-surface-2" />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter web typecheck`
Expected: no errors.

---

### Task 3: Quran bookmarks loading skeleton

**Files:**
- Create: `apps/web/app/[locale]/quran/bookmarks/loading.tsx`

**Interfaces:** None.

- [ ] **Step 1: Create the file**

```tsx
// Quran bookmarks Suspense fallback — title + grouped-row skeleton.
export default function BookmarksLoading() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-8" aria-hidden="true">
      <div className="mb-6 h-9 w-40 animate-pulse rounded-md bg-surface-2" />
      <div className="divide-y divide-border">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-2 py-3">
            <div className="h-4 w-32 animate-pulse rounded bg-surface-2" />
            <div className="flex gap-2">
              {Array.from({ length: 3 }).map((_, j) => (
                <div key={j} className="h-7 w-10 animate-pulse rounded-full bg-surface-2" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter web typecheck`
Expected: no errors.

---

### Task 4: Radio loading skeleton

**Files:**
- Create: `apps/web/app/[locale]/radio/loading.tsx`

**Interfaces:** None.

- [ ] **Step 1: Create the file**

```tsx
// Radio Suspense fallback — title + station-grid skeleton.
export default function RadioLoading() {
  return (
    <section className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12" aria-hidden="true">
      <div className="h-9 w-32 animate-pulse rounded-md bg-surface-2" />
      <div className="mt-1 h-4 w-48 animate-pulse rounded bg-surface-2" />
      <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="aspect-square w-full animate-pulse rounded-xl bg-surface-2" />
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter web typecheck`
Expected: no errors.

---

### Task 5: Qibla loading skeleton

**Files:**
- Create: `apps/web/app/[locale]/qibla/loading.tsx`

**Interfaces:** None.

- [ ] **Step 1: Create the file**

```tsx
// Qibla Suspense fallback — title + compass-card skeleton.
export default function QiblaLoading() {
  return (
    <section className="mx-auto max-w-2xl px-4 py-8 sm:px-6 sm:py-12" aria-hidden="true">
      <div className="h-9 w-28 animate-pulse rounded-md bg-surface-2" />
      <div className="mt-1 h-4 w-40 animate-pulse rounded bg-surface-2" />
      <div className="mt-6 rounded-xl border border-border bg-surface p-4 sm:p-6">
        <div className="mx-auto h-56 w-56 animate-pulse rounded-full bg-surface-2" />
        <div className="mx-auto mt-4 h-6 w-32 animate-pulse rounded bg-surface-2" />
        <div className="mx-auto mt-2 h-4 w-24 animate-pulse rounded bg-surface-2" />
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter web typecheck`
Expected: no errors.

---

### Task 6: Prayer-times loading skeleton + commit all web files

**Files:**
- Create: `apps/web/app/[locale]/prayer-times/loading.tsx`

**Interfaces:** None.

- [ ] **Step 1: Create the file**

```tsx
// Prayer times Suspense fallback — countdown + arc + timetable skeleton.
export default function PrayerTimesLoading() {
  return (
    <section className="mx-auto max-w-2xl px-4 py-8 sm:px-6 sm:py-12" aria-hidden="true">
      <div className="h-9 w-40 animate-pulse rounded-md bg-surface-2" />
      <div className="mt-6 h-40 w-full animate-pulse rounded-xl bg-surface-2" />
      <div className="mt-6 h-8 w-48 animate-pulse rounded-md bg-surface-2" />
      <div className="mt-6 overflow-hidden rounded-lg border border-border bg-surface">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-3.5 border-b border-border px-4 py-3 last:border-b-0"
          >
            <div className="size-8 animate-pulse rounded-md bg-surface-2" />
            <div className="h-4 flex-1 animate-pulse rounded bg-surface-2" />
            <div className="h-4 w-14 animate-pulse rounded bg-surface-2" />
          </div>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Full web gate**

Run: `pnpm --filter web typecheck && pnpm --filter web lint`
Expected: no errors.

- [ ] **Step 3: Re-check git state, stage, and commit**

```bash
git status --short
git log -1
git add apps/web/app/\[locale\]/quran/loading.tsx apps/web/app/\[locale\]/quran/\[surah\]/loading.tsx apps/web/app/\[locale\]/quran/bookmarks/loading.tsx apps/web/app/\[locale\]/radio/loading.tsx apps/web/app/\[locale\]/qibla/loading.tsx apps/web/app/\[locale\]/prayer-times/loading.tsx
git commit -m "[AhmedMuhammedElsaid][fix]: web - skeleton loading for quran/radio/qibla/prayer-times routes" -m "Co-Authored-By: Ahmed Muhammed Elsaid <ahmed.muhammed.elsaid@gmail.com>"
git status --short
```

Expected: commit created, `git status` clean for these 6 files.

---

## Part B — Mobile (4 tasks + 1 commit task)

### Task 7: Radio screen — upgrade "Loading…" text to a Skeleton grid

**Files:**
- Modify: `apps/mobile/app/radio/index.tsx:14-19` (imports), `apps/mobile/app/radio/index.tsx:127-128` (loading branch)
- Test: `apps/mobile/__tests__/radio.test.tsx` (add a new `RadioScreen` describe block — none exists yet, only `StationCard` is tested there)

**Interfaces:** Consumes `Skeleton` from `@/components/ui/skeleton` (existing, `{ className }: { className?: string }` prop).

- [ ] **Step 1: Add the import**

In `apps/mobile/app/radio/index.tsx`, change:

```tsx
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
```

to:

```tsx
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
```

- [ ] **Step 2: Replace the loading branch**

Change:

```tsx
      {stationsQuery.isPending ? (
        <Text variant="muted">{t("common.loading")}</Text>
      ) : stationsQuery.isError && !stationsQuery.data ? (
```

to:

```tsx
      {stationsQuery.isPending ? (
        <View className="flex-row flex-wrap gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <View key={i} className="w-[48%] gap-2">
              <Skeleton className="aspect-square w-full" />
              <Skeleton className="h-4 w-3/4" />
            </View>
          ))}
        </View>
      ) : stationsQuery.isError && !stationsQuery.data ? (
```

- [ ] **Step 3: Write a failing test**

Append to `apps/mobile/__tests__/radio.test.tsx` (add these imports at the top alongside the existing ones, and this new `describe` block at the end of the file):

```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import RadioScreen from "@/app/radio/index";
import { getJson } from "@/lib/api";
import { PlayerProvider } from "@/lib/player-context";

jest.mock("@/lib/api", () => ({ getJson: jest.fn(), assetUrl: (p: string) => p }));
jest.mock("expo-router", () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn() }),
  Stack: { Screen: () => null },
}));

function renderRadioScreen() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <PlayerProvider>
        <RadioScreen />
      </PlayerProvider>
    </QueryClientProvider>,
  );
}

describe("RadioScreen", () => {
  it("shows skeleton placeholders while stations are loading", () => {
    (jest.mocked(getJson) as jest.Mock).mockReturnValue(new Promise(() => {}));
    renderRadioScreen();
    expect(screen.UNSAFE_getAllByProps({ accessibilityRole: "progressbar" }).length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 4: Run the test to verify it fails, then passes**

Run: `pnpm --filter mobile test -- radio.test.tsx`
Expected: FAIL first (before Step 2's edit is in place — if run standalone after Step 2 is already applied, it PASSes immediately; if you're following TDD strictly, run this once before Step 2 to confirm the old "Loading…" text path has no `progressbar` role, then again after).
Then after Step 1+2 are applied: PASS.

---

### Task 8: Quran surah-list screen — replace Spinner with Skeleton grid

**Files:**
- Modify: `apps/mobile/app/quran/index.tsx:11` (import), `apps/mobile/app/quran/index.tsx:67-73` (pending branch)
- Test: `apps/mobile/__tests__/quran.test.tsx`

**Interfaces:** Consumes `Skeleton` from `@/components/ui/skeleton`.

- [ ] **Step 1: Swap the import**

Change:

```tsx
import { Spinner } from "@/components/ui/spinner";
```

to:

```tsx
import { Skeleton } from "@/components/ui/skeleton";
```

- [ ] **Step 2: Replace the pending branch**

Change:

```tsx
  if (surahs.isPending) {
    return (
      <View className="flex-1 items-center justify-center bg-bg">
        <Spinner label={t("common.loading")} />
      </View>
    );
  }
```

to:

```tsx
  if (surahs.isPending) {
    return (
      <View className="flex-1 gap-4 bg-bg px-4 pt-16">
        <Skeleton className="h-9 w-40" />
        <View className="flex-row flex-wrap gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <View
              key={i}
              className="w-[48%] gap-2 rounded-xl border border-border bg-surface p-3"
            >
              <Skeleton className="h-11 w-11 rounded-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </View>
          ))}
        </View>
      </View>
    );
  }
```

- [ ] **Step 3: Add a skeleton assertion to the existing test file**

In `apps/mobile/__tests__/quran.test.tsx`, add this test inside the existing `describe("QuranIndexScreen", ...)` block (alongside `"renders the surah list"` and `"shows an error state on failure"`):

```tsx
  it("shows skeleton placeholders while the surah list is loading", () => {
    (jest.mocked(getJson) as jest.Mock).mockReturnValue(new Promise(() => {}));
    renderWith(<QuranIndexScreen />);
    expect(screen.UNSAFE_getAllByProps({ accessibilityRole: "progressbar" }).length).toBeGreaterThan(0);
  });
```

- [ ] **Step 4: Run the tests**

Run: `pnpm --filter mobile test -- quran.test.tsx`
Expected: all `QuranIndexScreen` + `QuranReaderScreen` tests PASS (the new one asserts the skeleton; the pre-existing ones still `waitFor` final content, unaffected by the swap).

---

### Task 9: Quran surah-reader screen — replace Spinner with Skeleton

**Files:**
- Modify: `apps/mobile/app/quran/[surah].tsx:9` (import), `apps/mobile/app/quran/[surah].tsx:79-91` (pending branch)
- Test: `apps/mobile/__tests__/quran.test.tsx`

**Interfaces:** Consumes `Skeleton` from `@/components/ui/skeleton`.

- [ ] **Step 1: Swap the import**

Change:

```tsx
import { Spinner } from "@/components/ui/spinner";
```

to:

```tsx
import { Skeleton } from "@/components/ui/skeleton";
```

- [ ] **Step 2: Replace the pending branch**

Change:

```tsx
  if (!hydrated || resolvingPage || active.isPending) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <View className="flex-1 bg-bg" style={{ paddingTop: insets.top }}>
          <BackRow onBack={() => router.back()} label={t("common.back")} />
          <View className="flex-1 items-center justify-center">
            <Spinner label={t("common.loading")} />
          </View>
        </View>
      </>
    );
  }
```

to:

```tsx
  if (!hydrated || resolvingPage || active.isPending) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <View className="flex-1 gap-4 bg-bg px-4" style={{ paddingTop: insets.top + 8 }}>
          <BackRow onBack={() => router.back()} label={t("common.back")} />
          <View className="items-center gap-3 border-b border-border pb-4">
            <Skeleton className="h-9 w-48" />
            <Skeleton className="h-4 w-40" />
          </View>
          <View className="gap-4 pt-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-6 w-full" />
            ))}
          </View>
        </View>
      </>
    );
  }
```

- [ ] **Step 3: Add a skeleton assertion to the existing test file**

In `apps/mobile/__tests__/quran.test.tsx`, add this test inside `describe("QuranReaderScreen", ...)`:

```tsx
  it("shows skeleton placeholders while the reader data is loading", () => {
    (jest.mocked(getJson) as jest.Mock).mockReturnValue(new Promise(() => {}));
    renderWith(<QuranReaderScreen />);
    expect(screen.UNSAFE_getAllByProps({ accessibilityRole: "progressbar" }).length).toBeGreaterThan(0);
  });
```

- [ ] **Step 4: Run the tests**

Run: `pnpm --filter mobile test -- quran.test.tsx`
Expected: all tests PASS.

---

### Task 10: Adhkar reader screen — replace Spinner with Skeleton + commit all mobile files

**Files:**
- Modify: `apps/mobile/app/adhkar/[slug].tsx:11` (import), `apps/mobile/app/adhkar/[slug].tsx:107-113` (pending branch)
- Test: `apps/mobile/__tests__/adhkar.test.tsx`

**Interfaces:** Consumes `Skeleton` from `@/components/ui/skeleton`.

- [ ] **Step 1: Swap the import**

Change:

```tsx
import { Progress } from "@/components/ui/progress";
import { Spinner } from "@/components/ui/spinner";
import { Text } from "@/components/ui/text";
```

to:

```tsx
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
```

- [ ] **Step 2: Replace the pending branch**

Change:

```tsx
  if (detail.isPending) {
    return (
      <View className="flex-1 items-center justify-center bg-bg">
        <Spinner label={t("common.loading")} />
      </View>
    );
  }
```

to:

```tsx
  if (detail.isPending) {
    return (
      <View className="flex-1 gap-4 bg-bg px-4" style={{ paddingTop: insets.top + 8 }}>
        <View className="flex-row items-center gap-2">
          <Skeleton className="h-9 w-9 rounded-full" />
          <Skeleton className="h-6 flex-1" />
        </View>
        <Skeleton className="h-2 w-full rounded-full" />
        <View className="gap-4 pt-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-40 w-full rounded-lg" />
          ))}
        </View>
      </View>
    );
  }
```

- [ ] **Step 3: Add a skeleton assertion to the existing test file**

In `apps/mobile/__tests__/adhkar.test.tsx`, add this test inside `describe("AdhkarReaderScreen", ...)`:

```tsx
  it("shows skeleton placeholders while the dhikr set is loading", () => {
    jest.mocked(getJson).mockReturnValue(new Promise(() => {}));
    renderWith(<AdhkarReaderScreen />);
    expect(screen.UNSAFE_getAllByProps({ accessibilityRole: "progressbar" }).length).toBeGreaterThan(0);
  });
```

- [ ] **Step 4: Full mobile gate**

Run: `pnpm --filter mobile test`
Expected: all suites PASS (re-run once if `home-screen.test.tsx` flakes under full-suite load — documented pre-existing flake, unrelated to this change).

- [ ] **Step 5: Re-check git state, stage, and commit**

```bash
git status --short
git log -1
git add apps/mobile/app/radio/index.tsx apps/mobile/app/quran/index.tsx "apps/mobile/app/quran/[surah].tsx" "apps/mobile/app/adhkar/[slug].tsx" apps/mobile/__tests__/radio.test.tsx apps/mobile/__tests__/quran.test.tsx apps/mobile/__tests__/adhkar.test.tsx
git commit -m "[AhmedMuhammedElsaid][fix]: mobile - wire skeleton into radio + spinner screens" -m "Co-Authored-By: Ahmed Muhammed Elsaid <ahmed.muhammed.elsaid@gmail.com>"
git status --short
```

Expected: commit created, working tree clean for these files.

---

## Part C — Extension (12 tasks + 1 commit task)

### Task 11: New `Skeleton` primitive

**Files:**
- Create: `apps/extension/src/components/skeleton.tsx`

**Interfaces:** Produces `Skeleton({ className }: { className?: string })` — a `<div>` with `animate-pulse rounded-md bg-surface-2 {className}` and `aria-hidden="true"`. Consumed by Tasks 12–22.

- [ ] **Step 1: Create the file**

```tsx
type SkeletonProps = {
  className?: string;
};

// Static placeholder block for newtab loading states — same
// `animate-pulse bg-surface-2` recipe as the web `loading.tsx` fallbacks
// (tokens match 1:1, see apps/extension/src/styles/tailwind.css).
export function Skeleton({ className = "" }: SkeletonProps) {
  return <div aria-hidden="true" className={`animate-pulse rounded-md bg-surface-2 ${className}`} />;
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter extension typecheck`
Expected: no errors.

(No dedicated unit test for this component: the extension's vitest environment is `"node"` — no jsdom/`@testing-library/react` available in this package, see `apps/extension/vitest.config.ts:11` — and the component has no logic branches to test in isolation. Its behavior is covered by typecheck + the manual browser-verify pass in Task 23.)

---

### Task 12: `RadioSection` (home shelf) — skeleton instead of pop-in

**Files:**
- Modify: `apps/extension/src/components/radio-section.tsx`

**Interfaces:** Consumes `Skeleton` from `./skeleton` (Task 11).

- [ ] **Step 1: Add the import**

```tsx
import { Skeleton } from "./skeleton";
```

(add alongside the existing imports at the top of the file).

- [ ] **Step 2: Add a loading flag and gate the empty-return on it**

Change:

```tsx
  const { t } = useI18n();
  const [stations, setStations] = useState<RadioStationSummary[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);

  useEffect(() => {
    void fetchStations()
      .then(setStations)
      .catch(() => {});
    void getRadioFavorites().then(setFavorites);
  }, []);

  const preview = previewStations(stations);
  if (preview.length === 0) return null;
```

to:

```tsx
  const { t } = useI18n();
  const [stations, setStations] = useState<RadioStationSummary[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void fetchStations()
      .then(setStations)
      .catch(() => {})
      .finally(() => setLoading(false));
    void getRadioFavorites().then(setFavorites);
  }, []);

  const preview = previewStations(stations);
  if (!loading && preview.length === 0) return null;
```

- [ ] **Step 3: Render the skeleton before the real content**

Change the `return (...)` block's opening (right after the `<h2>`/explore-button header row, before `<ul className="grid grid-cols-2 gap-4 sm:grid-cols-4">`):

```tsx
      <ul className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {preview.map((station) => {
```

to:

```tsx
      {loading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="aspect-square w-full" />
          ))}
        </div>
      ) : (
      <ul className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {preview.map((station) => {
```

and close the new conditional right after the existing `</ul>` (the last line before the closing `</section>`):

```tsx
      </ul>
    </section>
  );
}
```

to:

```tsx
      </ul>
      )}
    </section>
  );
}
```

- [ ] **Step 4: Run existing tests + typecheck**

Run: `pnpm --filter extension test -- radio-section.test.ts && pnpm --filter extension typecheck`
Expected: existing `previewStations` tests still PASS (unchanged), typecheck clean.

---

### Task 13: `RadioPage` (`/radio` view) — skeleton grid while loading

**Files:**
- Modify: `apps/extension/src/components/radio-page.tsx`

**Interfaces:** Consumes `Skeleton` from `./skeleton`.

- [ ] **Step 1: Add the import**

```tsx
import { Skeleton } from "./skeleton";
```

- [ ] **Step 2: Add a loading flag**

Change:

```tsx
  const { t } = useI18n();
  const [stations, setStations] = useState<RadioStationSummary[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [recent, setRecent] = useState<string[]>([]);

  useEffect(() => {
    void fetchStations()
      .then(setStations)
```

to:

```tsx
  const { t } = useI18n();
  const [stations, setStations] = useState<RadioStationSummary[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [recent, setRecent] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void fetchStations()
      .then(setStations)
```

and just below (the same effect's `.catch`), change:

```tsx
      .catch(() => {});
    void getRadioFavorites().then(setFavorites);
    void getRecentStations().then(setRecent);
  }, []);
```

to:

```tsx
      .catch(() => {})
      .finally(() => setLoading(false));
    void getRadioFavorites().then(setFavorites);
    void getRecentStations().then(setRecent);
  }, []);
```

- [ ] **Step 3: Render the skeleton ahead of the empty/content branch**

Change:

```tsx
      {stations.length === 0 ? (
        <p className="rounded-xl border border-border bg-surface p-6 text-center text-text-2">
          {t("radio.empty")}
        </p>
```

to:

```tsx
      {loading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="aspect-square w-full" />
          ))}
        </div>
      ) : stations.length === 0 ? (
        <p className="rounded-xl border border-border bg-surface p-6 text-center text-text-2">
          {t("radio.empty")}
        </p>
```

- [ ] **Step 4: Run existing tests + typecheck**

Run: `pnpm --filter extension test -- radio-page.test.ts && pnpm --filter extension typecheck`
Expected: existing `sortFavoritesFirst`/`resolveRecentStations` tests still PASS, typecheck clean.

---

### Task 14: `AdhkarLanding` — skeleton grid distinct from the true-empty state

**Files:**
- Modify: `apps/extension/src/components/adhkar-landing.tsx`

**Interfaces:** Consumes `Skeleton` from `./skeleton`.

- [ ] **Step 1: Add the import**

```tsx
import { Skeleton } from "./skeleton";
```

- [ ] **Step 2: Add a loading flag**

Change:

```tsx
  const { t, locale } = useI18n();
  const [sets, setSets] = useState<AdhkarSummary[]>([]);
  const [progress, setProgress] = useState<AzkarProgress | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    void fetchAdhkarList()
      .then(setSets)
      .catch(() => setError(true));
    void loadProgress().then(setProgress);
  }, []);
```

to:

```tsx
  const { t, locale } = useI18n();
  const [sets, setSets] = useState<AdhkarSummary[]>([]);
  const [progress, setProgress] = useState<AzkarProgress | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void fetchAdhkarList()
      .then(setSets)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
    void loadProgress().then(setProgress);
  }, []);
```

- [ ] **Step 3: Gate the empty/error/content branch on loading**

Change:

```tsx
      {error ? (
        <p className="text-center text-sm text-danger">{t("adhkar.error")}</p>
      ) : sets.length === 0 ? (
        <p className="text-text-2">
          {locale === "ar" ? "لا توجد أذكار منشورة" : "No adhkar published yet."}
        </p>
      ) : (
```

to:

```tsx
      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="space-y-3 rounded-2xl border border-border bg-surface p-4">
              <Skeleton className="size-12 rounded-xl" />
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-1/3 rounded-full" />
            </div>
          ))}
        </div>
      ) : error ? (
        <p className="text-center text-sm text-danger">{t("adhkar.error")}</p>
      ) : sets.length === 0 ? (
        <p className="text-text-2">
          {locale === "ar" ? "لا توجد أذكار منشورة" : "No adhkar published yet."}
        </p>
      ) : (
```

- [ ] **Step 4: Typecheck**

Run: `pnpm --filter extension typecheck`
Expected: no errors.

---

### Task 15: `AdhkarPreviewShelf` — skeleton instead of pop-in

**Files:**
- Modify: `apps/extension/src/components/adhkar-preview-shelf.tsx`

**Interfaces:** Consumes `Skeleton` from `./skeleton`.

- [ ] **Step 1: Add the import**

```tsx
import { Skeleton } from "./skeleton";
```

- [ ] **Step 2: Add a loading flag and gate the empty-return on it**

Change:

```tsx
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
```

to:

```tsx
export function AdhkarPreviewShelf() {
  const { t } = useI18n();
  const [sets, setSets] = useState<AdhkarSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void fetchAdhkarList()
      .then(setSets)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const preview = previewAdhkarSets(sets);
  if (!loading && preview.length === 0) return null;
```

- [ ] **Step 3: Render the skeleton before the real content**

Change:

```tsx
      <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {preview.map((set, index) => (
```

to:

```tsx
      {loading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full rounded-2xl" />
          ))}
        </div>
      ) : (
      <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {preview.map((set, index) => (
```

and close it right after the existing `</ul>`:

```tsx
      </ul>
    </section>
  );
}
```

to:

```tsx
      </ul>
      )}
    </section>
  );
}
```

- [ ] **Step 4: Run existing tests + typecheck**

Run: `pnpm --filter extension test -- adhkar-preview-shelf.test.ts && pnpm --filter extension typecheck`
Expected: existing `previewAdhkarSets` tests still PASS, typecheck clean.

---

### Task 16: `QuranLanding` — skeleton grid while surahs load

**Files:**
- Modify: `apps/extension/src/components/quran-landing.tsx`

**Interfaces:** Consumes `Skeleton` from `./skeleton`.

- [ ] **Step 1: Add the import**

```tsx
import { Skeleton } from "./skeleton";
```

- [ ] **Step 2: Add a loading flag**

Change:

```tsx
  const [surahs, setSurahs] = useState<QuranSurahSummary[]>([]);
  const [lastRead, setLastReadState] = useState<AyahRef | null>(null);
  const [q, setQ] = useState("");

  useEffect(() => {
    void fetchSurahs().then(setSurahs).catch(() => {});
    void getLastRead().then(setLastReadState);
  }, []);
```

to:

```tsx
  const [surahs, setSurahs] = useState<QuranSurahSummary[]>([]);
  const [lastRead, setLastReadState] = useState<AyahRef | null>(null);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void fetchSurahs()
      .then(setSurahs)
      .catch(() => {})
      .finally(() => setLoading(false));
    void getLastRead().then(setLastReadState);
  }, []);
```

- [ ] **Step 3: Render the skeleton in place of the grid while loading**

Change:

```tsx
      {/* Surah grid — mirrors apps/web/features/quran/components/surah-index.tsx */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {filtered.map((s) => {
```

to:

```tsx
      {/* Surah grid — mirrors apps/web/features/quran/components/surah-index.tsx */}
      {loading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="space-y-2 rounded-lg border border-border bg-surface p-4">
              <Skeleton className="mx-auto size-9 rounded-full" />
              <Skeleton className="mx-auto h-4 w-3/4" />
            </div>
          ))}
        </div>
      ) : (
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {filtered.map((s) => {
```

and close it right after the grid's closing `</div>` (immediately before the component's final `</div>`):

```tsx
        })}
      </div>
    </div>
  );
}
```

to:

```tsx
        })}
      </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Typecheck**

Run: `pnpm --filter extension typecheck`
Expected: no errors.

---

### Task 17: `BookmarksList` (extension) — skeleton rows while loading

**Files:**
- Modify: `apps/extension/src/components/bookmarks-list.tsx`

**Interfaces:** Consumes `Skeleton` from `./skeleton`.

- [ ] **Step 1: Add the import**

```tsx
import { Skeleton } from "./skeleton";
```

- [ ] **Step 2: Add a loading flag**

Change:

```tsx
  const { t } = useI18n();
  const [bookmarks, setBookmarks] = useState<AyahRef[]>([]);

  useEffect(() => {
    void getBookmarks().then(setBookmarks);
  }, []);
```

to:

```tsx
  const { t } = useI18n();
  const [bookmarks, setBookmarks] = useState<AyahRef[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void getBookmarks()
      .then(setBookmarks)
      .finally(() => setLoading(false));
  }, []);
```

- [ ] **Step 3: Render skeleton rows ahead of the empty/content branch**

Change:

```tsx
      {bookmarks.length === 0 ? (
        <p className="text-center text-sm text-text-2">{t("quran.noBookmarks")}</p>
      ) : (
```

to:

```tsx
      {loading ? (
        <div className="space-y-2 overflow-hidden rounded-xl border border-border bg-surface p-1">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-11 w-full" />
          ))}
        </div>
      ) : bookmarks.length === 0 ? (
        <p className="text-center text-sm text-text-2">{t("quran.noBookmarks")}</p>
      ) : (
```

- [ ] **Step 4: Typecheck**

Run: `pnpm --filter extension typecheck`
Expected: no errors.

---

### Task 18: newtab `DhikrWidget` — skeleton instead of pop-in

**Files:**
- Modify: `apps/extension/src/newtab/newtab-page.tsx:72-94`

**Interfaces:** Consumes `Skeleton` from `../components/skeleton`.

- [ ] **Step 1: Add the import**

Add alongside the other `../components/...` imports near the top of `newtab-page.tsx`:

```tsx
import { Skeleton } from "../components/skeleton";
```

- [ ] **Step 2: Add a loading flag and render a skeleton instead of `null`**

Change:

```tsx
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
```

to:

```tsx
function DhikrWidget({ now }: { now: Date }) {
  const { t } = useI18n();
  const [dhikr, setDhikr] = useState<DhikrItem | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    void getJson<AzkarResponse>("/adhkar/أذكار-الصباح", { locale: "ar" })
      .then((res) => {
        const items = res.items;
        if (items.length > 0) setDhikr(items[dayOfYear(now) % items.length] ?? null);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (loading) {
    return (
      <section className="space-y-2">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-20 w-full rounded-xl" />
      </section>
    );
  }
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
```

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter extension typecheck`
Expected: no errors.

---

### Task 19: `PlaylistDetail` — upgrade "Loading…" text to a header + track-row skeleton

**Files:**
- Modify: `apps/extension/src/components/playlist-detail.tsx`

**Interfaces:** Consumes `Skeleton` from `./skeleton`.

- [ ] **Step 1: Add the import**

```tsx
import { Skeleton } from "./skeleton";
```

- [ ] **Step 2: Replace the loading branch**

Change:

```tsx
  if (!detail) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-sm text-text-2">{t("common.loading")}</p>
      </div>
    );
  }
```

to:

```tsx
  if (!detail) {
    return (
      <div className="mx-auto max-w-3xl space-y-6 px-4 py-8" aria-hidden="true">
        <Skeleton className="h-48 w-full rounded-xl sm:h-64" />
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-4 w-1/2" />
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 py-2">
              <Skeleton className="h-4 w-6" />
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-4 w-10" />
            </div>
          ))}
        </div>
      </div>
    );
  }
```

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter extension typecheck`
Expected: no errors.

---

### Task 20: `PrayerPage` — upgrade "Loading…" text to a countdown + arc + timetable skeleton

**Files:**
- Modify: `apps/extension/src/components/prayer-page.tsx`

**Interfaces:** Consumes `Skeleton` from `./skeleton`.

- [ ] **Step 1: Add the import**

```tsx
import { Skeleton } from "./skeleton";
```

- [ ] **Step 2: Replace the loading branch**

Change:

```tsx
  if (!times || !prefs || !adhan || !azkar || !location) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-sm text-text-2">{t("common.loading")}</p>
      </div>
    );
  }
```

to:

```tsx
  if (!times || !prefs || !adhan || !azkar || !location) {
    return (
      <div className="mx-auto max-w-3xl space-y-6 px-4 py-8" aria-hidden="true">
        <div className="space-y-1">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-4 w-32" />
        </div>
        <Skeleton className="h-40 w-full rounded-xl" />
        <Skeleton className="h-8 w-48" />
        <div className="overflow-hidden rounded-lg border border-border bg-surface">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-3.5 border-b border-border px-4 py-3 last:border-b-0"
            >
              <Skeleton className="size-8" />
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-4 w-14" />
            </div>
          ))}
        </div>
      </div>
    );
  }
```

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter extension typecheck`
Expected: no errors.

---

### Task 21: `QuranReader` (extension) — upgrade "Loading…" text to a header + ayah-line skeleton

**Files:**
- Modify: `apps/extension/src/components/quran-reader.tsx`

**Interfaces:** Consumes `Skeleton` from `./skeleton`.

- [ ] **Step 1: Add the import**

```tsx
import { Skeleton } from "./skeleton";
```

- [ ] **Step 2: Replace the loading branch**

Change:

```tsx
  if (prefs.layout === "mushaf" ? !pageData : !data) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-sm text-text-2">{t("common.loading")}</p>
      </div>
    );
  }
```

to:

```tsx
  if (prefs.layout === "mushaf" ? !pageData : !data) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 px-4 py-8" aria-hidden="true">
        <Skeleton className="mx-auto h-9 w-48" />
        <Skeleton className="mx-auto h-4 w-40" />
        <div className="space-y-3 pt-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-6 w-full" />
          ))}
        </div>
      </div>
    );
  }
```

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter extension typecheck`
Expected: no errors.

---

### Task 22: `SearchView` — first-search skeleton rows (don't disturb subsequent-query behavior)

**Files:**
- Modify: `apps/extension/src/components/search-view.tsx`

**Interfaces:** Consumes `Skeleton` from `./skeleton`.

**Note:** `result` is only cleared when the query is emptied, not on each new debounced search — so on a *refinement* keystroke, the previous results stay visible while `loading` is true, and are replaced once the new ones resolve. This skeleton must only show on the *first* search of a fresh query (`loading && !result`), so it doesn't hide perfectly good existing results during a refinement.

- [ ] **Step 1: Add the import**

```tsx
import { Skeleton } from "./skeleton";
```

- [ ] **Step 2: Insert the skeleton block**

Change:

```tsx
      {/* Error */}
      {error ? (
        <p className="text-center text-sm text-danger">{t("search.error")}</p>
      ) : null}

      {/* Empty */}
      {isEmpty ? (
```

to:

```tsx
      {/* First-search skeleton (subsequent refinements keep showing stale results while loading) */}
      {loading && !result ? (
        <div className="space-y-2" aria-hidden="true">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-xl" />
          ))}
        </div>
      ) : null}

      {/* Error */}
      {error ? (
        <p className="text-center text-sm text-danger">{t("search.error")}</p>
      ) : null}

      {/* Empty */}
      {isEmpty ? (
```

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter extension typecheck`
Expected: no errors.

---

### Task 23: Full extension gate + commit

**Files:** None new — verification + commit only.

- [ ] **Step 1: Full extension gate**

Run: `pnpm --filter extension typecheck && pnpm --filter extension lint && pnpm --filter extension test`
Expected: all green — existing `radio-section.test.ts`, `radio-page.test.ts`, `adhkar-preview-shelf.test.ts` pure-function tests unaffected.

- [ ] **Step 2: Build both targets (extension builds are dual-target, not covered by typecheck alone)**

Run: `pnpm --filter extension build:chrome && pnpm --filter extension build:firefox`
Expected: both builds succeed with no errors.

- [ ] **Step 3: Re-check git state, stage, and commit**

```bash
git status --short
git log -1
git add apps/extension/src/components/skeleton.tsx apps/extension/src/components/radio-section.tsx apps/extension/src/components/radio-page.tsx apps/extension/src/components/adhkar-landing.tsx apps/extension/src/components/adhkar-preview-shelf.tsx apps/extension/src/components/quran-landing.tsx apps/extension/src/components/bookmarks-list.tsx apps/extension/src/newtab/newtab-page.tsx apps/extension/src/components/playlist-detail.tsx apps/extension/src/components/prayer-page.tsx apps/extension/src/components/quran-reader.tsx apps/extension/src/components/search-view.tsx
git commit -m "[AhmedMuhammedElsaid][feat]: extension - skeleton primitive + newtab loading states" -m "Co-Authored-By: Ahmed Muhammed Elsaid <ahmed.muhammed.elsaid@gmail.com>"
git status --short
```

Expected: commit created, working tree clean for these files.

---

## Part D — Session wrap

### Task 24: Update APP_CONTEXT.md + memory (per CLAUDE.md §16)

**Files:**
- Modify: root `APP_CONTEXT.md` (append a short wave entry)
- Modify: `apps/mobile/APP_CONTEXT.md` (append the Radio/Quran/Adhkar Skeleton-over-Spinner change, superseding the stale "Skeleton-based loaders (Home/Playlist/Adhkar list) intentionally left as-is" line if it now reads as contradicting the new state)

- [ ] **Step 1: Append entries**

Append one row/paragraph to each context file's relevant section citing: what changed, the 3 commit SHAs (fill in after Tasks 6/10/23 land), and "device-verify pending" for mobile/extension (native/browser visual confirmation not done in this session).

- [ ] **Step 2: Update memory**

Save/update a `project` memory entry (`skeleton_loading_audit`) summarizing: scope corrected mid-plan (mobile shrank from an assumed 8 screens to Radio + 3 Spinner→Skeleton conversions; Bookmarks/Downloads/Qibla/Prayer-times excluded — no network delay), extension gained its first-ever skeleton pattern across 11 newtab views, 3 commits total (one per surface, matching the approved spec's commit plan). Update `MEMORY.md`'s index line accordingly, and note the top-progress-bar memory entry is unaffected (untouched by this work).
