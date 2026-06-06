# Prayer Times Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Islamic prayer times to the public `web` app as a homepage **Sun Arc widget** plus a dedicated **`/prayer-times` page**, sharing one isomorphic compute path and one device-local saved location.

**Architecture:** A pure, dependency-light compute function in `packages/api` wraps `adhan` (npm package name of adhan-js) and runs identically on the server (RSC first paint with a default city) and the client (recompute for the user's saved/geolocated location, plus the live countdown). No DB, no auth, no external API. Location + calculation preferences persist to `localStorage` under `nour.prayer.*`, mirroring the existing `nour.player.*`/`nour.theme` convention. Hijri dates use built-in `Intl` (no dependency).

**Tech Stack:** TypeScript (strict), `adhan` (new dep), Zod, Next.js 16 RSC + client islands, next-intl (AR/EN), Tailwind v4 tokens, Vitest + React Testing Library.

**Spec:** `docs/superpowers/specs/2026-06-05-prayer-times-design.md`

---

## Conventions for this plan

- Run all commands from the repo root `D:\CodeLab\Nour Platform` unless stated.
- Package-manager: **pnpm** (workspaces). Test runner: **vitest**.
- API unit tests: `pnpm --filter @repo/api test`. Web tests: `pnpm --filter web test`.
- Commit style (repo rule): `[AhmedMuhammedElsaid][<verb>]: …` with the trailer `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`. Use `[wip]` for feature steps, `[build]` for the dependency/ADR, `[docs]` for doc-only. One commit per concern.
- Tokens only — never hex literals in `.tsx`. Available tokens: `bg`, `surface`, `surface-2`, `border`, `text`, `text-2`, `muted`, `primary`, `primary-fg`/`primary-foreground`, `ring`, fonts `font-display` (Fraunces) / `font-sans`. The gold is `--color-primary` `#c8a050`. For the brighter sun glow we add ONE new token in Task 2.
- SVG `fill`/`stroke` may reference `currentColor` or `var(--color-…)` — that is the sanctioned way to keep SVG on-token.

---

## File structure (created/modified)

```
packages/api/src/
  schemas/prayer-times.ts                 (new) zod + types: method/madhab/location/prefs
  services/prayer-times.service.ts        (new) computePrayerTimes + getNextPrayer + getUpcomingPrayer + getDayProgress
  services/prayer-times.service.test.ts   (new) vitest unit
packages/api/package.json                 (mod) add `adhan` dep + 2 export subpaths
docs/adr/0004-adhan-js.md                 (new) ADR for the new dependency

packages/ui/src/styles/tokens.css         (mod) add --color-sun glow token

apps/web/messages/ar.json                 (mod) + `prayer` namespace
apps/web/messages/en.json                 (mod) + `prayer` namespace
apps/web/features/prayer-times/
  data/cities.ts                          (new) curated city → coords list
  lib/format.ts                           (new) time + Hijri + Gregorian formatters
  lib/format.test.ts                      (new)
  lib/sun-arc.ts                          (new) arc geometry (pure)
  lib/sun-arc.test.ts                     (new)
  hooks/use-prayer-settings.ts            (new) localStorage location + prefs (SSR-safe)
  components/sun-arc.tsx                   (new) the SVG arc [client]
  components/prayer-countdown.tsx          (new) live countdown + next name [client]
  components/prayer-countdown.test.tsx     (new)
  components/prayer-timetable.tsx          (new) full day list
  components/location-picker.tsx           (new) city search + geolocation [client]
  components/location-picker.test.tsx      (new)
  components/method-settings.tsx           (new) method + madhab selects [client]
  components/date-card.tsx                 (new) Hijri + Gregorian
  components/prayer-times-widget.tsx       (new) homepage card [client]
apps/web/app/[locale]/prayer-times/page.tsx  (new) RSC page
apps/web/app/[locale]/page.tsx               (mod) mount the widget
apps/web/features/layout/components/site-header.tsx  (mod) add nav link to /prayer-times

APP_CONTEXT.md                            (mod) append wave row + file locations
```

---

## Task 1: Add the `adhan` dependency + ADR

**Files:**
- Create: `docs/adr/0004-adhan-js.md`
- Modify: `packages/api/package.json` (dependencies block)

- [ ] **Step 1: Write the ADR**

Create `docs/adr/0004-adhan-js.md`:

```markdown
# ADR 0004: Use `adhan` (adhan-js) for prayer-time calculation

- Status: Accepted
- Date: 2026-06-05

## Context
We are adding Islamic prayer times (homepage widget + `/prayer-times` page). Times
must be accurate for a user-chosen location and selectable calculation method/madhab,
work offline (we ship a PWA), and not depend on an external runtime service.

## Decision
Add `adhan` (npm package name of the batoulapps/adhan-js library) as a runtime
dependency in `packages/api`. It is small, ISC-licensed, has no transitive runtime
deps, and implements the standard calculation conventions (Muslim World League,
Egyptian, Umm al-Qura, Karachi, ISNA, etc.) plus Asr madhab and high-latitude rules.

The compute function is written as a **pure, isomorphic** function with no DB/auth,
so the SAME code runs in the RSC (server first paint) and in client islands
(recompute for the user's location + the per-second countdown). This avoids an
external prayer-times API (no key, no rate limits, no network in the hot path) and
keeps results deterministic and unit-testable.

Hijri dates use built-in `Intl.DateTimeFormat` (Islamic calendar) — no extra dependency.

## Consequences
- One new dependency in `packages/api`; `adhan` is also bundled to the client (small).
- Calculation correctness is owned by a vetted library rather than hand-rolled angles.
- Display timezone for v1 is the viewer's device timezone (acceptable when users view
  their own city); a per-location timezone is a future enhancement.
```

- [ ] **Step 2: Add the dependency to `packages/api/package.json`**

In the `"dependencies"` object, add the `adhan` line (keep alphabetical-ish; place after `@repo/config`):

```jsonc
  "dependencies": {
    "@auth/mongodb-adapter": "^3.7.4",
    "@aws-sdk/client-s3": "^3.689.0",
    "@aws-sdk/s3-request-presigner": "^3.689.0",
    "@node-rs/argon2": "^2.0.2",
    "@repo/config": "workspace:*",
    "adhan": "^4.4.3",
    "mongodb": "^6.12.0",
    "mongoose": "^8.9.0",
    "next-auth": "5.0.0-beta.25",
    "zod": "^3.23.8"
  },
```

- [ ] **Step 3: Install**

Run: `pnpm install`
Expected: lockfile updates, `adhan` resolved under `packages/api`. No other dep churn.

- [ ] **Step 4: Verify the import resolves**

Run: `pnpm --filter @repo/api exec node -e "const a=require('adhan'); console.log(typeof a.PrayerTimes, typeof a.CalculationMethod.Egyptian)"`
Expected: prints `function function`.

> If `adhan` is ESM-only and the require check fails, instead verify via the typecheck in Task 3. Do not block on this step.

- [ ] **Step 5: Commit**

```bash
git add docs/adr/0004-adhan-js.md packages/api/package.json pnpm-lock.yaml
git commit -m "$(cat <<'EOF'
[AhmedMuhammedElsaid][build]: add adhan dependency + ADR 0004 for prayer times

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Prayer-times schemas + sun glow token

**Files:**
- Create: `packages/api/src/schemas/prayer-times.ts`
- Modify: `packages/api/package.json` (exports map)
- Modify: `packages/ui/src/styles/tokens.css`

- [ ] **Step 1: Write the schema file**

Create `packages/api/src/schemas/prayer-times.ts`:

```ts
import { z } from "zod";

// Supported calculation conventions. Each maps 1:1 to an adhan CalculationMethod
// factory in the service. Keep this list in sync with methodFactory().
export const CALCULATION_METHOD_IDS = [
  "MuslimWorldLeague",
  "Egyptian",
  "Karachi",
  "UmmAlQura",
  "Dubai",
  "MoonsightingCommittee",
  "NorthAmerica",
  "Kuwait",
  "Qatar",
  "Singapore",
  "Turkey",
  "Tehran",
] as const;

export const calculationMethodSchema = z.enum(CALCULATION_METHOD_IDS);
export type CalculationMethodId = z.infer<typeof calculationMethodSchema>;

export const madhabSchema = z.enum(["standard", "hanafi"]);
export type MadhabId = z.infer<typeof madhabSchema>;

export const DEFAULT_METHOD: CalculationMethodId = "Egyptian";
export const DEFAULT_MADHAB: MadhabId = "standard";

// A resolved geographic point with a human label for display.
export const prayerLocationSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  label: z.string().min(1),
});
export type PrayerLocation = z.infer<typeof prayerLocationSchema>;

export const prayerPreferencesSchema = z.object({
  method: calculationMethodSchema.default(DEFAULT_METHOD),
  madhab: madhabSchema.default(DEFAULT_MADHAB),
});
export type PrayerPreferences = z.infer<typeof prayerPreferencesSchema>;

// Default location used for SSR first paint and before the user picks a city.
export const DEFAULT_LOCATION: PrayerLocation = {
  lat: 30.0444,
  lng: 31.2357,
  label: "Cairo",
};
```

- [ ] **Step 2: Add export subpaths to `packages/api/package.json`**

In `"exports"`, add these two entries (after `"./schemas/category"` and `"./services/search"` respectively):

```jsonc
    "./schemas/prayer-times": "./src/schemas/prayer-times.ts",
    "./services/prayer-times": "./src/services/prayer-times.service.ts",
```

- [ ] **Step 3: Add the sun glow token**

In `packages/ui/src/styles/tokens.css`, inside BOTH the dark block (`:root, [data-theme="dark"]`) and the light block (`[data-theme="light"]`), add a sun token after the `--color-primary` line. Dark uses the brighter gold; light reuses the dark-gold primary so it stays legible on cream:

Dark block (after `--color-primary: #c8a050;`):
```css
  /* Brighter gold for the prayer-times sun + next-prayer glow. */
  --color-sun: #e4c57e;
```
Light block (after `--color-primary: #9a7830;`):
```css
  --color-sun: #c8a050;
```

- [ ] **Step 4: Expose the token as a Tailwind utility**

Open `apps/web` globals (the file with the `@theme inline` bridge — `apps/web/app/globals.css`). Find the color mappings (e.g. `--color-primary: var(--color-primary);`) and add alongside them:

```css
  --color-sun: var(--color-sun);
```

This makes `text-sun`, `fill-sun`, `stroke-sun`, `bg-sun` available. If the bridge instead lists colors a different way, mirror the exact pattern used for `primary`.

- [ ] **Step 5: Typecheck**

Run: `pnpm --filter @repo/api typecheck`
Expected: PASS (no usages yet; this just confirms the schema compiles).

- [ ] **Step 6: Commit**

```bash
git add packages/api/src/schemas/prayer-times.ts packages/api/package.json packages/ui/src/styles/tokens.css apps/web/app/globals.css
git commit -m "$(cat <<'EOF'
[AhmedMuhammedElsaid][wip]: prayer-times schemas + sun glow token

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Compute service (TDD)

**Files:**
- Create: `packages/api/src/services/prayer-times.service.ts`
- Test: `packages/api/src/services/prayer-times.service.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/api/src/services/prayer-times.service.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import {
  computePrayerTimes,
  getNextPrayer,
  getUpcomingPrayer,
  getDayProgress,
  type PrayerDay,
} from "./prayer-times.service";

// Cairo, fixed civil date. Egyptian method, standard madhab.
const CAIRO = { lat: 30.0444, lng: 31.2357 } as const;
const DATE = new Date("2026-06-05T09:00:00Z");

function cairoDay(): PrayerDay {
  return computePrayerTimes({
    ...CAIRO,
    date: DATE,
    method: "Egyptian",
    madhab: "standard",
  });
}

describe("computePrayerTimes", () => {
  it("returns six ordered instants with valid Dates for a normal location", () => {
    const day = cairoDay();
    expect(day.instants.map((i) => i.key)).toEqual([
      "fajr",
      "sunrise",
      "dhuhr",
      "asr",
      "maghrib",
      "isha",
    ]);
    for (const inst of day.instants) {
      expect(inst.time).toBeInstanceOf(Date);
      expect(Number.isNaN((inst.time as Date).getTime())).toBe(false);
    }
  });

  it("orders the instants chronologically through the day", () => {
    const times = cairoDay().instants.map((i) => (i.time as Date).getTime());
    const sorted = [...times].sort((a, b) => a - b);
    expect(times).toEqual(sorted);
  });

  it("yields null times for a high-latitude location where a prayer may not occur", () => {
    // Longyearbyen, Svalbard in June — polar day; some angles never reached.
    const day = computePrayerTimes({
      lat: 78.22,
      lng: 15.65,
      date: new Date("2026-06-21T12:00:00Z"),
      method: "MuslimWorldLeague",
      madhab: "standard",
    });
    const hasNull = day.instants.some((i) => i.time === null);
    expect(hasNull).toBe(true);
  });
});

describe("getNextPrayer", () => {
  it("returns the first countdown-prayer after `now` (skips sunrise)", () => {
    const day = cairoDay();
    const fajr = day.instants.find((i) => i.key === "fajr")!.time as Date;
    // One minute after Fajr → next countdown prayer is Dhuhr (sunrise skipped).
    const now = new Date(fajr.getTime() + 60_000);
    const next = getNextPrayer(day, now);
    expect(next?.key).toBe("dhuhr");
    expect(next!.msUntil).toBeGreaterThan(0);
  });

  it("returns null after Isha", () => {
    const day = cairoDay();
    const isha = day.instants.find((i) => i.key === "isha")!.time as Date;
    const now = new Date(isha.getTime() + 60_000);
    expect(getNextPrayer(day, now)).toBeNull();
  });
});

describe("getUpcomingPrayer", () => {
  it("rolls over to tomorrow's Fajr after Isha", () => {
    const today = cairoDay();
    const isha = today.instants.find((i) => i.key === "isha")!.time as Date;
    const now = new Date(isha.getTime() + 60_000);
    const up = getUpcomingPrayer(
      { ...CAIRO, method: "Egyptian", madhab: "standard" },
      now,
    );
    expect(up.key).toBe("fajr");
    expect(up.time.getTime()).toBeGreaterThan(now.getTime());
  });
});

describe("getDayProgress", () => {
  it("is 0 at Fajr, 1 at Isha, ~0.5 midway", () => {
    const day = cairoDay();
    const fajr = day.instants.find((i) => i.key === "fajr")!.time as Date;
    const isha = day.instants.find((i) => i.key === "isha")!.time as Date;
    expect(getDayProgress(day, fajr)).toBeCloseTo(0, 2);
    expect(getDayProgress(day, isha)).toBeCloseTo(1, 2);
    const mid = new Date((fajr.getTime() + isha.getTime()) / 2);
    expect(getDayProgress(day, mid)).toBeCloseTo(0.5, 2);
  });

  it("clamps to [0,1] outside the Fajr–Isha window", () => {
    const day = cairoDay();
    const fajr = day.instants.find((i) => i.key === "fajr")!.time as Date;
    expect(getDayProgress(day, new Date(fajr.getTime() - 3_600_000))).toBe(0);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @repo/api test prayer-times`
Expected: FAIL — cannot find module `./prayer-times.service`.

- [ ] **Step 3: Write the implementation**

Create `packages/api/src/services/prayer-times.service.ts`:

```ts
import {
  CalculationMethod,
  type CalculationParameters,
  Coordinates,
  HighLatitudeRule,
  Madhab,
  PrayerTimes,
} from "adhan";

import {
  type CalculationMethodId,
  type MadhabId,
} from "../schemas/prayer-times";

export type PrayerKey =
  | "fajr"
  | "sunrise"
  | "dhuhr"
  | "asr"
  | "maghrib"
  | "isha";

export type PrayerInstant = { key: PrayerKey; time: Date | null };
export type PrayerDay = { date: Date; instants: PrayerInstant[] };

// Prayers shown on the arc/timetable, in chronological order.
const PRAYER_ORDER: PrayerKey[] = [
  "fajr",
  "sunrise",
  "dhuhr",
  "asr",
  "maghrib",
  "isha",
];

// Sunrise is a marker, not a prayer — excluded from "next prayer" countdown.
const COUNTDOWN_ORDER: Exclude<PrayerKey, "sunrise">[] = [
  "fajr",
  "dhuhr",
  "asr",
  "maghrib",
  "isha",
];

const DAY_MS = 24 * 60 * 60 * 1000;

function methodFactory(method: CalculationMethodId): CalculationParameters {
  switch (method) {
    case "MuslimWorldLeague":
      return CalculationMethod.MuslimWorldLeague();
    case "Egyptian":
      return CalculationMethod.Egyptian();
    case "Karachi":
      return CalculationMethod.Karachi();
    case "UmmAlQura":
      return CalculationMethod.UmmAlQura();
    case "Dubai":
      return CalculationMethod.Dubai();
    case "MoonsightingCommittee":
      return CalculationMethod.MoonsightingCommittee();
    case "NorthAmerica":
      return CalculationMethod.NorthAmerica();
    case "Kuwait":
      return CalculationMethod.Kuwait();
    case "Qatar":
      return CalculationMethod.Qatar();
    case "Singapore":
      return CalculationMethod.Singapore();
    case "Turkey":
      return CalculationMethod.Turkey();
    case "Tehran":
      return CalculationMethod.Tehran();
  }
}

function validDate(d: Date | null | undefined): Date | null {
  return d != null && !Number.isNaN(d.getTime()) ? d : null;
}

export function computePrayerTimes(input: {
  lat: number;
  lng: number;
  date: Date;
  method: CalculationMethodId;
  madhab: MadhabId;
}): PrayerDay {
  const coords = new Coordinates(input.lat, input.lng);
  const params = methodFactory(input.method);
  params.madhab = input.madhab === "hanafi" ? Madhab.Hanafi : Madhab.Shafi;
  params.highLatitudeRule = HighLatitudeRule.recommended(coords);

  const pt = new PrayerTimes(coords, input.date, params);
  const raw: Record<PrayerKey, Date | null | undefined> = {
    fajr: pt.fajr,
    sunrise: pt.sunrise,
    dhuhr: pt.dhuhr,
    asr: pt.asr,
    maghrib: pt.maghrib,
    isha: pt.isha,
  };

  return {
    date: input.date,
    instants: PRAYER_ORDER.map((key) => ({ key, time: validDate(raw[key]) })),
  };
}

export type NextPrayer = {
  key: Exclude<PrayerKey, "sunrise">;
  time: Date;
  msUntil: number;
};

// First countdown-prayer strictly after `now` within this day, or null if `now`
// is past Isha.
export function getNextPrayer(day: PrayerDay, now: Date): NextPrayer | null {
  for (const key of COUNTDOWN_ORDER) {
    const time = day.instants.find((i) => i.key === key)?.time ?? null;
    if (time != null && time.getTime() > now.getTime()) {
      return { key, time, msUntil: time.getTime() - now.getTime() };
    }
  }
  return null;
}

// The prayer the UI counts down to — rolls over to tomorrow's Fajr after Isha.
export function getUpcomingPrayer(
  input: {
    lat: number;
    lng: number;
    method: CalculationMethodId;
    madhab: MadhabId;
  },
  now: Date,
): NextPrayer {
  const today = computePrayerTimes({ ...input, date: now });
  const next = getNextPrayer(today, now);
  if (next) return next;

  const tomorrow = computePrayerTimes({
    ...input,
    date: new Date(now.getTime() + DAY_MS),
  });
  const fajr = tomorrow.instants.find((i) => i.key === "fajr")?.time;
  if (fajr == null) {
    // Degenerate high-latitude fallback: point at the day boundary.
    const midnight = new Date(now.getTime() + DAY_MS);
    return { key: "fajr", time: midnight, msUntil: DAY_MS };
  }
  return { key: "fajr", time: fajr, msUntil: fajr.getTime() - now.getTime() };
}

// Position of the sun along the day, anchored Fajr(0) → Isha(1), clamped.
export function getDayProgress(day: PrayerDay, now: Date): number {
  const fajr = day.instants.find((i) => i.key === "fajr")?.time ?? null;
  const isha = day.instants.find((i) => i.key === "isha")?.time ?? null;
  if (fajr == null || isha == null || isha.getTime() <= fajr.getTime()) {
    return 0.5;
  }
  const t =
    (now.getTime() - fajr.getTime()) / (isha.getTime() - fajr.getTime());
  return Math.min(1, Math.max(0, t));
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter @repo/api test prayer-times`
Expected: PASS (all cases green).

> If `HighLatitudeRule.recommended` is not a function in the installed adhan version, replace that line with `params.highLatitudeRule = HighLatitudeRule.MiddleOfTheNight;` and re-run.

- [ ] **Step 5: Typecheck**

Run: `pnpm --filter @repo/api typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/api/src/services/prayer-times.service.ts packages/api/src/services/prayer-times.service.test.ts
git commit -m "$(cat <<'EOF'
[AhmedMuhammedElsaid][wip]: prayer-times compute service (adhan) + unit tests

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: i18n `prayer` namespace

**Files:**
- Modify: `apps/web/messages/ar.json`
- Modify: `apps/web/messages/en.json`

- [ ] **Step 1: Add the `prayer` namespace to `ar.json`**

Add this block (after the `"player"` block; mind the trailing comma on the preceding block):

```json
  "prayer": {
    "title": "مواقيت الصلاة",
    "nav": "مواقيت الصلاة",
    "next": "الصلاة القادمة",
    "countdown": "بعد {h} س {m} د",
    "at": "الساعة {time}",
    "now": "الآن {time}",
    "changeCity": "تغيير المدينة",
    "useMyLocation": "استخدم موقعي",
    "searchCity": "ابحث عن مدينة…",
    "locationDenied": "تعذّر تحديد موقعك — نعرض مواقيت {city}.",
    "calculation": "طريقة الحساب",
    "method": "الطريقة",
    "madhab": "العصر (المذهب)",
    "madhabStandard": "الجمهور",
    "madhabHanafi": "الحنفي",
    "fajr": "الفجر",
    "sunrise": "الشروق",
    "dhuhr": "الظهر",
    "asr": "العصر",
    "maghrib": "المغرب",
    "isha": "العشاء",
    "methodMuslimWorldLeague": "رابطة العالم الإسلامي",
    "methodEgyptian": "الهيئة المصرية العامة للمساحة",
    "methodKarachi": "جامعة العلوم الإسلامية، كراتشي",
    "methodUmmAlQura": "أم القرى، مكة",
    "methodDubai": "دبي",
    "methodMoonsightingCommittee": "لجنة رؤية الهلال",
    "methodNorthAmerica": "أمريكا الشمالية (ISNA)",
    "methodKuwait": "الكويت",
    "methodQatar": "قطر",
    "methodSingapore": "سنغافورة",
    "methodTurkey": "تركيا",
    "methodTehran": "طهران"
  }
```

- [ ] **Step 2: Add the matching `prayer` namespace to `en.json`**

Open `apps/web/messages/en.json` and add the parallel block (same keys, English values):

```json
  "prayer": {
    "title": "Prayer Times",
    "nav": "Prayer Times",
    "next": "Next prayer",
    "countdown": "in {h}h {m}m",
    "at": "at {time}",
    "now": "now {time}",
    "changeCity": "Change city",
    "useMyLocation": "Use my location",
    "searchCity": "Search a city…",
    "locationDenied": "Couldn't get your location — showing times for {city}.",
    "calculation": "Calculation method",
    "method": "Method",
    "madhab": "Asr (madhab)",
    "madhabStandard": "Standard",
    "madhabHanafi": "Hanafi",
    "fajr": "Fajr",
    "sunrise": "Sunrise",
    "dhuhr": "Dhuhr",
    "asr": "Asr",
    "maghrib": "Maghrib",
    "isha": "Isha",
    "methodMuslimWorldLeague": "Muslim World League",
    "methodEgyptian": "Egyptian General Authority",
    "methodKarachi": "University of Islamic Sciences, Karachi",
    "methodUmmAlQura": "Umm al-Qura, Makkah",
    "methodDubai": "Dubai",
    "methodMoonsightingCommittee": "Moonsighting Committee",
    "methodNorthAmerica": "North America (ISNA)",
    "methodKuwait": "Kuwait",
    "methodQatar": "Qatar",
    "methodSingapore": "Singapore",
    "methodTurkey": "Turkey",
    "methodTehran": "Tehran"
  }
```

- [ ] **Step 3: Validate JSON**

Run: `pnpm --filter web exec node -e "JSON.parse(require('fs').readFileSync('messages/ar.json','utf8'));JSON.parse(require('fs').readFileSync('messages/en.json','utf8'));console.log('ok')"`
Expected: prints `ok` (no JSON syntax error).

- [ ] **Step 4: Commit**

```bash
git add apps/web/messages/ar.json apps/web/messages/en.json
git commit -m "$(cat <<'EOF'
[AhmedMuhammedElsaid][wip]: prayer-times i18n namespace (ar/en)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Curated city list

**Files:**
- Create: `apps/web/features/prayer-times/data/cities.ts`

- [ ] **Step 1: Write the city data module**

Create `apps/web/features/prayer-times/data/cities.ts`. Keep ~24 well-known, MENA-weighted cities for v1 (extendable later):

```ts
export type City = {
  id: string;
  en: string;
  ar: string;
  country: string;
  lat: number;
  lng: number;
};

// Curated city list (v1). Avoids a geocoding API; "use my location" covers
// anything not listed. Coordinates are city-centre approximations.
export const CITIES: City[] = [
  { id: "cairo", en: "Cairo", ar: "القاهرة", country: "EG", lat: 30.0444, lng: 31.2357 },
  { id: "alexandria", en: "Alexandria", ar: "الإسكندرية", country: "EG", lat: 31.2001, lng: 29.9187 },
  { id: "mecca", en: "Mecca", ar: "مكة المكرمة", country: "SA", lat: 21.3891, lng: 39.8579 },
  { id: "medina", en: "Medina", ar: "المدينة المنورة", country: "SA", lat: 24.5247, lng: 39.5692 },
  { id: "riyadh", en: "Riyadh", ar: "الرياض", country: "SA", lat: 24.7136, lng: 46.6753 },
  { id: "jeddah", en: "Jeddah", ar: "جدة", country: "SA", lat: 21.4858, lng: 39.1925 },
  { id: "dubai", en: "Dubai", ar: "دبي", country: "AE", lat: 25.2048, lng: 55.2708 },
  { id: "abu-dhabi", en: "Abu Dhabi", ar: "أبو ظبي", country: "AE", lat: 24.4539, lng: 54.3773 },
  { id: "doha", en: "Doha", ar: "الدوحة", country: "QA", lat: 25.2854, lng: 51.531 },
  { id: "kuwait-city", en: "Kuwait City", ar: "مدينة الكويت", country: "KW", lat: 29.3759, lng: 47.9774 },
  { id: "manama", en: "Manama", ar: "المنامة", country: "BH", lat: 26.2285, lng: 50.586 },
  { id: "muscat", en: "Muscat", ar: "مسقط", country: "OM", lat: 23.588, lng: 58.3829 },
  { id: "amman", en: "Amman", ar: "عمّان", country: "JO", lat: 31.9454, lng: 35.9284 },
  { id: "jerusalem", en: "Jerusalem", ar: "القدس", country: "PS", lat: 31.7683, lng: 35.2137 },
  { id: "beirut", en: "Beirut", ar: "بيروت", country: "LB", lat: 33.8938, lng: 35.5018 },
  { id: "damascus", en: "Damascus", ar: "دمشق", country: "SY", lat: 33.5138, lng: 36.2765 },
  { id: "baghdad", en: "Baghdad", ar: "بغداد", country: "IQ", lat: 33.3152, lng: 44.3661 },
  { id: "istanbul", en: "Istanbul", ar: "إسطنبول", country: "TR", lat: 41.0082, lng: 28.9784 },
  { id: "casablanca", en: "Casablanca", ar: "الدار البيضاء", country: "MA", lat: 33.5731, lng: -7.5898 },
  { id: "tunis", en: "Tunis", ar: "تونس", country: "TN", lat: 36.8065, lng: 10.1815 },
  { id: "algiers", en: "Algiers", ar: "الجزائر", country: "DZ", lat: 36.7538, lng: 3.0588 },
  { id: "khartoum", en: "Khartoum", ar: "الخرطوم", country: "SD", lat: 15.5007, lng: 32.5599 },
  { id: "london", en: "London", ar: "لندن", country: "GB", lat: 51.5074, lng: -0.1278 },
  { id: "new-york", en: "New York", ar: "نيويورك", country: "US", lat: 40.7128, lng: -74.006 },
];

// Nearest curated city to an arbitrary coordinate (for labelling geolocation).
export function nearestCity(lat: number, lng: number): City {
  let best = CITIES[0]!;
  let bestD = Number.POSITIVE_INFINITY;
  for (const c of CITIES) {
    const d = (c.lat - lat) ** 2 + (c.lng - lng) ** 2;
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  }
  return best;
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter web typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/web/features/prayer-times/data/cities.ts
git commit -m "$(cat <<'EOF'
[AhmedMuhammedElsaid][wip]: curated city list for prayer-times location

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Formatting helpers (TDD)

**Files:**
- Create: `apps/web/features/prayer-times/lib/format.ts`
- Test: `apps/web/features/prayer-times/lib/format.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/web/features/prayer-times/lib/format.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { formatClock, formatCountdown, hijriDate } from "./format";

describe("formatCountdown", () => {
  it("breaks milliseconds into whole hours and minutes", () => {
    expect(formatCountdown(2 * 3600_000 + 14 * 60_000)).toEqual({ h: 2, m: 14 });
  });
  it("never goes negative", () => {
    expect(formatCountdown(-5000)).toEqual({ h: 0, m: 0 });
  });
});

describe("formatClock", () => {
  it("formats a Date to a localized HH:MM string", () => {
    const out = formatClock(new Date("2026-06-05T15:42:00Z"), "en", "UTC");
    expect(out).toMatch(/3:42|15:42/); // 12h or 24h depending on ICU
  });
  it("returns an em dash for a null time", () => {
    expect(formatClock(null, "en", "UTC")).toBe("—");
  });
});

describe("hijriDate", () => {
  it("returns a non-empty Islamic-calendar string", () => {
    expect(hijriDate(new Date("2026-06-05T12:00:00Z"), "en").length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter web test format`
Expected: FAIL — cannot find module `./format`.

- [ ] **Step 3: Write the implementation**

Create `apps/web/features/prayer-times/lib/format.ts`:

```ts
type Locale = "ar" | "en";

// Split a positive ms duration into whole hours + minutes (clamped at 0).
export function formatCountdown(ms: number): { h: number; m: number } {
  const clamped = Math.max(0, ms);
  const totalMinutes = Math.floor(clamped / 60_000);
  return { h: Math.floor(totalMinutes / 60), m: totalMinutes % 60 };
}

// Localized clock; `timeZone` optional (defaults to the viewer's device tz).
export function formatClock(
  time: Date | null,
  locale: Locale,
  timeZone?: string,
): string {
  if (time == null) return "—";
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone,
  }).format(time);
}

export function hijriDate(date: Date, locale: Locale): string {
  const tag = locale === "ar" ? "ar-SA-u-ca-islamic" : "en-US-u-ca-islamic";
  return new Intl.DateTimeFormat(tag, {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

export function gregorianDate(date: Date, locale: Locale): string {
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-US", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm --filter web test format`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/features/prayer-times/lib/format.ts apps/web/features/prayer-times/lib/format.test.ts
git commit -m "$(cat <<'EOF'
[AhmedMuhammedElsaid][wip]: prayer-times formatting helpers (clock/countdown/hijri)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Sun-arc geometry (TDD)

**Files:**
- Create: `apps/web/features/prayer-times/lib/sun-arc.ts`
- Test: `apps/web/features/prayer-times/lib/sun-arc.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/web/features/prayer-times/lib/sun-arc.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { ARC, arcPath, arcPoint, tForFraction } from "./sun-arc";

describe("arcPoint", () => {
  it("returns the left endpoint at t=0 and right endpoint at t=1", () => {
    expect(arcPoint(0)).toEqual({ x: ARC.p0.x, y: ARC.p0.y });
    expect(arcPoint(1)).toEqual({ x: ARC.p2.x, y: ARC.p2.y });
  });
  it("peaks above the baseline near the middle", () => {
    expect(arcPoint(0.5).y).toBeLessThan(ARC.p0.y);
  });
});

describe("tForFraction", () => {
  it("insets the [0,1] day fraction so dots stay off the edges", () => {
    expect(tForFraction(0)).toBeGreaterThan(0);
    expect(tForFraction(1)).toBeLessThan(1);
    expect(tForFraction(0.5)).toBeCloseTo(0.5, 5);
  });
});

describe("arcPath", () => {
  it("is a quadratic Bezier string using the ARC control points", () => {
    expect(arcPath()).toBe(
      `M${ARC.p0.x} ${ARC.p0.y} Q${ARC.p1.x} ${ARC.p1.y} ${ARC.p2.x} ${ARC.p2.y}`,
    );
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter web test sun-arc`
Expected: FAIL — cannot find module `./sun-arc`.

- [ ] **Step 3: Write the implementation**

Create `apps/web/features/prayer-times/lib/sun-arc.ts`:

```ts
// Fixed SVG coordinate space for the arc. The component renders one <svg> with
// this viewBox and preserveAspectRatio="xMidYMid meet" + width:100% height:auto,
// so it scales uniformly to the container width (circles stay round, dots align
// with the path). All geometry below is in this space.
export const ARC = {
  w: 600,
  h: 150,
  p0: { x: 0, y: 126 }, // left horizon
  p1: { x: 300, y: -4 }, // control point (apex pull)
  p2: { x: 600, y: 126 }, // right horizon
} as const;

// Inset so endpoints (Fajr/Isha) don't sit exactly in the corners.
const INSET = 0.06;

export function tForFraction(fraction: number): number {
  const f = Math.min(1, Math.max(0, fraction));
  return INSET + f * (1 - 2 * INSET);
}

export function arcPoint(t: number): { x: number; y: number } {
  const mt = 1 - t;
  const x = mt * mt * ARC.p0.x + 2 * mt * t * ARC.p1.x + t * t * ARC.p2.x;
  const y = mt * mt * ARC.p0.y + 2 * mt * t * ARC.p1.y + t * t * ARC.p2.y;
  return { x, y };
}

export function arcPath(): string {
  return `M${ARC.p0.x} ${ARC.p0.y} Q${ARC.p1.x} ${ARC.p1.y} ${ARC.p2.x} ${ARC.p2.y}`;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm --filter web test sun-arc`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/features/prayer-times/lib/sun-arc.ts apps/web/features/prayer-times/lib/sun-arc.test.ts
git commit -m "$(cat <<'EOF'
[AhmedMuhammedElsaid][wip]: sun-arc geometry helpers + tests

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: `use-prayer-settings` hook

**Files:**
- Create: `apps/web/features/prayer-times/hooks/use-prayer-settings.ts`

- [ ] **Step 1: Write the hook**

Create `apps/web/features/prayer-times/hooks/use-prayer-settings.ts`. Mirrors the SSR-safe localStorage pattern from `theme-toggle.tsx` (default on the server, read after mount):

```ts
"use client";

import { useCallback, useEffect, useState } from "react";

import {
  type CalculationMethodId,
  type MadhabId,
  type PrayerLocation,
  type PrayerPreferences,
  DEFAULT_LOCATION,
  DEFAULT_MADHAB,
  DEFAULT_METHOD,
  calculationMethodSchema,
  madhabSchema,
  prayerLocationSchema,
} from "@repo/api/schemas/prayer-times";

const LOCATION_KEY = "nour.prayer.location";
const PREFS_KEY = "nour.prayer.prefs";

function readLocation(): PrayerLocation {
  try {
    const raw = localStorage.getItem(LOCATION_KEY);
    if (!raw) return DEFAULT_LOCATION;
    const parsed = prayerLocationSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : DEFAULT_LOCATION;
  } catch {
    return DEFAULT_LOCATION;
  }
}

function readPrefs(): PrayerPreferences {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return { method: DEFAULT_METHOD, madhab: DEFAULT_MADHAB };
    const obj = JSON.parse(raw) as Record<string, unknown>;
    const method = calculationMethodSchema.safeParse(obj.method);
    const madhab = madhabSchema.safeParse(obj.madhab);
    return {
      method: method.success ? method.data : DEFAULT_METHOD,
      madhab: madhab.success ? madhab.data : DEFAULT_MADHAB,
    };
  } catch {
    return { method: DEFAULT_METHOD, madhab: DEFAULT_MADHAB };
  }
}

export type PrayerSettings = {
  location: PrayerLocation;
  prefs: PrayerPreferences;
  hydrated: boolean;
  setLocation: (loc: PrayerLocation) => void;
  setMethod: (method: CalculationMethodId) => void;
  setMadhab: (madhab: MadhabId) => void;
};

export function usePrayerSettings(): PrayerSettings {
  // Server + first client render use defaults to avoid hydration mismatch.
  const [location, setLocationState] = useState<PrayerLocation>(DEFAULT_LOCATION);
  const [prefs, setPrefs] = useState<PrayerPreferences>({
    method: DEFAULT_METHOD,
    madhab: DEFAULT_MADHAB,
  });
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setLocationState(readLocation());
    setPrefs(readPrefs());
    setHydrated(true);
  }, []);

  const setLocation = useCallback((loc: PrayerLocation) => {
    setLocationState(loc);
    try {
      localStorage.setItem(LOCATION_KEY, JSON.stringify(loc));
    } catch {
      /* storage unavailable — keep in-memory state */
    }
  }, []);

  const persistPrefs = useCallback((next: PrayerPreferences) => {
    setPrefs(next);
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }, []);

  const setMethod = useCallback(
    (method: CalculationMethodId) => persistPrefs({ ...readPrefs(), method }),
    [persistPrefs],
  );
  const setMadhab = useCallback(
    (madhab: MadhabId) => persistPrefs({ ...readPrefs(), madhab }),
    [persistPrefs],
  );

  return { location, prefs, hydrated, setLocation, setMethod, setMadhab };
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter web typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/web/features/prayer-times/hooks/use-prayer-settings.ts
git commit -m "$(cat <<'EOF'
[AhmedMuhammedElsaid][wip]: use-prayer-settings hook (localStorage, SSR-safe)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: `SunArc` component

**Files:**
- Create: `apps/web/features/prayer-times/components/sun-arc.tsx`

- [ ] **Step 1: Write the component**

Create `apps/web/features/prayer-times/components/sun-arc.tsx`. Renders the path, the prayer dots, the glowing next-prayer marker, and the gold rayed sun at the current progress. Inputs are pre-resolved fractions so the component stays pure/presentational.

```tsx
import { ARC, arcPath, arcPoint, tForFraction } from "@/features/prayer-times/lib/sun-arc";
import type { PrayerKey } from "@repo/api/services/prayer-times";

export type ArcDot = {
  key: PrayerKey;
  fraction: number; // 0..1 position along the Fajr→Isha day
  isNext: boolean;
};

export function SunArc({
  dots,
  sunFraction,
  nextLabel,
}: {
  dots: ArcDot[];
  sunFraction: number; // 0..1 current-time progress
  nextLabel: string;
}) {
  const sun = arcPoint(tForFraction(sunFraction));

  return (
    <svg
      viewBox={`0 0 ${ARC.w} ${ARC.h}`}
      preserveAspectRatio="xMidYMid meet"
      className="block w-full h-auto"
      role="img"
      aria-label={nextLabel}
    >
      <defs>
        <linearGradient id="nour-arc-grad" x1="0" x2="1">
          <stop offset="0" stopColor="var(--color-primary)" stopOpacity="0.15" />
          <stop offset="0.5" stopColor="var(--color-sun)" />
          <stop offset="1" stopColor="var(--color-primary)" stopOpacity="0.15" />
        </linearGradient>
      </defs>

      {/* horizon */}
      <line
        x1="0"
        y1={ARC.p0.y}
        x2={ARC.w}
        y2={ARC.p0.y}
        stroke="var(--color-primary)"
        strokeOpacity="0.14"
      />
      {/* arc */}
      <path
        d={arcPath()}
        fill="none"
        stroke="url(#nour-arc-grad)"
        strokeWidth="2"
        strokeDasharray="2 7"
      />

      {/* prayer dots */}
      {dots.map((d) => {
        const p = arcPoint(tForFraction(d.fraction));
        if (d.isNext) {
          return (
            <g key={d.key}>
              <circle cx={p.x} cy={p.y} r="16" fill="none" stroke="var(--color-sun)" strokeOpacity="0.32" strokeWidth="2" />
              <circle cx={p.x} cy={p.y} r="7" fill="var(--color-sun)" />
            </g>
          );
        }
        return <circle key={d.key} cx={p.x} cy={p.y} r="3.5" fill="var(--color-text-2)" />;
      })}

      {/* current sun — gold disc + rays (matches the glow) */}
      <g transform={`translate(${sun.x}, ${sun.y})`} stroke="var(--color-sun)">
        <g strokeWidth="2" strokeLinecap="round">
          <line x1="0" y1="-13" x2="0" y2="-9" />
          <line x1="0" y1="9" x2="0" y2="13" />
          <line x1="-13" y1="0" x2="-9" y2="0" />
          <line x1="9" y1="0" x2="13" y2="0" />
          <line x1="-9.2" y1="-9.2" x2="-6.4" y2="-6.4" />
          <line x1="6.4" y1="6.4" x2="9.2" y2="9.2" />
          <line x1="9.2" y1="-9.2" x2="6.4" y2="-6.4" />
          <line x1="-6.4" y1="6.4" x2="-9.2" y2="9.2" />
        </g>
        <circle cx="0" cy="0" r="5.5" fill="var(--color-sun)" stroke="none" />
      </g>
    </svg>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter web typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/web/features/prayer-times/components/sun-arc.tsx
git commit -m "$(cat <<'EOF'
[AhmedMuhammedElsaid][wip]: SunArc SVG component (gold rayed sun + glowing next)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: `PrayerCountdown` component (TDD)

**Files:**
- Create: `apps/web/features/prayer-times/components/prayer-countdown.tsx`
- Test: `apps/web/features/prayer-times/components/prayer-countdown.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `apps/web/features/prayer-times/components/prayer-countdown.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, vals?: Record<string, unknown>) =>
    vals ? `${key}:${JSON.stringify(vals)}` : key,
}));

import { vi } from "vitest";
import { PrayerCountdown } from "./prayer-countdown";

describe("PrayerCountdown", () => {
  it("names the next prayer and renders an h/m countdown", () => {
    const target = new Date(Date.now() + (2 * 3600 + 14 * 60) * 1000);
    render(<PrayerCountdown nextKey="asr" target={target} />);
    // prayer name key
    expect(screen.getByText(/asr/)).toBeInTheDocument();
    // countdown key with h/m args (2h 14m, allow ±1m for tick timing)
    expect(screen.getByText(/countdown:.*"h":2/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter web test prayer-countdown`
Expected: FAIL — cannot find module `./prayer-countdown`.

- [ ] **Step 3: Write the implementation**

Create `apps/web/features/prayer-times/components/prayer-countdown.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import { formatCountdown } from "@/features/prayer-times/lib/format";
import type { PrayerKey } from "@repo/api/services/prayer-times";

export function PrayerCountdown({
  nextKey,
  target,
}: {
  nextKey: PrayerKey;
  target: Date;
}) {
  const t = useTranslations("prayer");
  const [now, setNow] = useState<number>(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const { h, m } = formatCountdown(target.getTime() - now);

  return (
    <div className="flex items-baseline justify-center gap-2.5">
      <span className="text-xs uppercase tracking-[0.1em] text-text-2">
        {t("next")}
      </span>
      <span className="font-display text-2xl font-semibold text-text">
        {t(nextKey)}
      </span>
      <span className="font-display text-lg font-semibold text-sun">
        {t("countdown", { h, m })}
      </span>
    </div>
  );
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm --filter web test prayer-countdown`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/features/prayer-times/components/prayer-countdown.tsx apps/web/features/prayer-times/components/prayer-countdown.test.tsx
git commit -m "$(cat <<'EOF'
[AhmedMuhammedElsaid][wip]: PrayerCountdown live ticking component + test

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

## Task 11: `PrayerTimetable` + `DateCard` components

**Files:**
- Create: `apps/web/features/prayer-times/components/prayer-timetable.tsx`
- Create: `apps/web/features/prayer-times/components/date-card.tsx`

- [ ] **Step 1: Write `prayer-timetable.tsx`**

```tsx
"use client";

import { useTranslations } from "next-intl";

import { formatClock } from "@/features/prayer-times/lib/format";
import type { PrayerInstant, PrayerKey } from "@repo/api/services/prayer-times";

const ICON: Record<PrayerKey, string> = {
  fajr: "🌅",
  sunrise: "☀️",
  dhuhr: "🌞",
  asr: "🌇",
  maghrib: "🌆",
  isha: "🌙",
};

export function PrayerTimetable({
  instants,
  nextKey,
  locale,
}: {
  instants: PrayerInstant[];
  nextKey: PrayerKey | null;
  locale: "ar" | "en";
}) {
  const t = useTranslations("prayer");

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-surface">
      {instants.map((inst) => {
        const isNext = inst.key === nextKey;
        return (
          <div
            key={inst.key}
            className={`flex items-center gap-3.5 border-b border-border px-4 py-3 last:border-b-0 ${
              isNext ? "bg-primary/10" : ""
            }`}
          >
            <span
              className={`flex size-8 items-center justify-center rounded-md ${
                isNext ? "bg-primary" : "bg-surface-2"
              }`}
              aria-hidden="true"
            >
              {ICON[inst.key]}
            </span>
            <div className="flex-1">
              <div className={`font-display text-base ${isNext ? "text-sun" : "text-text"}`}>
                {t(inst.key)}
              </div>
            </div>
            <div
              className={`font-display text-lg tabular-nums ${
                isNext ? "font-semibold text-sun" : "text-text"
              }`}
            >
              {formatClock(inst.time, locale)}
            </div>
            {isNext ? (
              <span className="ms-2 text-2xs uppercase tracking-[0.08em] text-primary">
                {t("next")}
              </span>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Write `date-card.tsx`**

```tsx
"use client";

import { gregorianDate, hijriDate } from "@/features/prayer-times/lib/format";

export function DateCard({ date, locale }: { date: Date; locale: "ar" | "en" }) {
  return (
    <div className="rounded-lg border border-border bg-surface px-4 py-5 text-center">
      <div className="font-display text-xl text-text">{gregorianDate(date, locale)}</div>
      <div className="mt-1.5 text-lg text-sun">{hijriDate(date, locale)}</div>
    </div>
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter web typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/web/features/prayer-times/components/prayer-timetable.tsx apps/web/features/prayer-times/components/date-card.tsx
git commit -m "$(cat <<'EOF'
[AhmedMuhammedElsaid][wip]: PrayerTimetable + DateCard components

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

## Task 12: `LocationPicker` component (TDD)

**Files:**
- Create: `apps/web/features/prayer-times/components/location-picker.tsx`
- Test: `apps/web/features/prayer-times/components/location-picker.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `apps/web/features/prayer-times/components/location-picker.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

import { LocationPicker } from "./location-picker";

describe("LocationPicker", () => {
  it("filters cities by query and emits the chosen city", async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(<LocationPicker locale="en" onSelect={onSelect} />);

    await user.type(screen.getByRole("textbox"), "dub");
    const option = await screen.findByRole("button", { name: /Dubai/i });
    await user.click(option);

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect.mock.calls[0]![0]).toMatchObject({ label: "Dubai" });
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter web test location-picker`
Expected: FAIL — cannot find module `./location-picker`.

- [ ] **Step 3: Write the implementation**

Create `apps/web/features/prayer-times/components/location-picker.tsx`:

```tsx
"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";

import { CITIES, nearestCity, type City } from "@/features/prayer-times/data/cities";
import type { PrayerLocation } from "@repo/api/schemas/prayer-times";

function cityToLocation(c: City, locale: "ar" | "en"): PrayerLocation {
  return { lat: c.lat, lng: c.lng, label: c[locale] };
}

export function LocationPicker({
  locale,
  onSelect,
}: {
  locale: "ar" | "en";
  onSelect: (loc: PrayerLocation) => void;
}) {
  const t = useTranslations("prayer");
  const [query, setQuery] = useState("");
  const [geoError, setGeoError] = useState(false);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return CITIES.slice(0, 6);
    return CITIES.filter(
      (c) => c.en.toLowerCase().includes(q) || c.ar.includes(query.trim()),
    ).slice(0, 8);
  }, [query]);

  function useMyLocation(): void {
    setGeoError(false);
    if (!("geolocation" in navigator)) {
      setGeoError(true);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const near = nearestCity(pos.coords.latitude, pos.coords.longitude);
        onSelect({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          label: near[locale],
        });
      },
      () => setGeoError(true),
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("searchCity")}
          className="flex-1 rounded-md border border-border bg-surface-2 px-3 py-2 text-sm text-text placeholder:text-text-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <button
          type="button"
          onClick={useMyLocation}
          className="whitespace-nowrap rounded-md border border-border px-3 py-2 text-sm text-sun hover:bg-surface-2"
        >
          {t("useMyLocation")}
        </button>
      </div>

      {geoError ? (
        <p className="text-xs text-text-2">{t("locationDenied", { city: "Cairo" })}</p>
      ) : null}

      <ul className="divide-y divide-border overflow-hidden rounded-md border border-border">
        {results.map((c) => (
          <li key={c.id}>
            <button
              type="button"
              onClick={() => onSelect(cityToLocation(c, locale))}
              className="flex w-full items-center justify-between px-3 py-2 text-start text-sm text-text hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span>{c[locale]}</span>
              <span className="text-xs text-text-2">{c.country}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm --filter web test location-picker`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/features/prayer-times/components/location-picker.tsx apps/web/features/prayer-times/components/location-picker.test.tsx
git commit -m "$(cat <<'EOF'
[AhmedMuhammedElsaid][wip]: LocationPicker (city search + geolocation) + test

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

## Task 13: `MethodSettings` component

**Files:**
- Create: `apps/web/features/prayer-times/components/method-settings.tsx`

- [ ] **Step 1: Write the component**

Create `apps/web/features/prayer-times/components/method-settings.tsx`. Method labels come from i18n keys `method<Id>` (defined in Task 4):

```tsx
"use client";

import { useTranslations } from "next-intl";

import {
  CALCULATION_METHOD_IDS,
  type CalculationMethodId,
  type MadhabId,
} from "@repo/api/schemas/prayer-times";

export function MethodSettings({
  method,
  madhab,
  onMethodChange,
  onMadhabChange,
}: {
  method: CalculationMethodId;
  madhab: MadhabId;
  onMethodChange: (m: CalculationMethodId) => void;
  onMadhabChange: (m: MadhabId) => void;
}) {
  const t = useTranslations("prayer");

  return (
    <div className="space-y-4">
      <label className="block">
        <span className="mb-1.5 block text-xs uppercase tracking-[0.06em] text-text-2">
          {t("method")}
        </span>
        <select
          value={method}
          onChange={(e) => onMethodChange(e.target.value as CalculationMethodId)}
          className="w-full rounded-md border border-border bg-surface-2 px-3 py-2.5 text-sm text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {CALCULATION_METHOD_IDS.map((id) => (
            <option key={id} value={id}>
              {t(`method${id}`)}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="mb-1.5 block text-xs uppercase tracking-[0.06em] text-text-2">
          {t("madhab")}
        </span>
        <select
          value={madhab}
          onChange={(e) => onMadhabChange(e.target.value as MadhabId)}
          className="w-full rounded-md border border-border bg-surface-2 px-3 py-2.5 text-sm text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="standard">{t("madhabStandard")}</option>
          <option value="hanafi">{t("madhabHanafi")}</option>
        </select>
      </label>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter web typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/web/features/prayer-times/components/method-settings.tsx
git commit -m "$(cat <<'EOF'
[AhmedMuhammedElsaid][wip]: MethodSettings (method + madhab selects)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

## Task 14: `PrayerTimesWidget` (assembling) + mount on homepage

**Files:**
- Create: `apps/web/features/prayer-times/components/prayer-times-widget.tsx`
- Modify: `apps/web/app/[locale]/page.tsx`

- [ ] **Step 1: Write a shared "view-model" builder**

So the widget and the page derive arc dots + next-prayer identically, add a small builder near the top of `prayer-times-widget.tsx` (exported for reuse by the page in Task 15):

```tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import { PrayerCountdown } from "@/features/prayer-times/components/prayer-countdown";
import { SunArc, type ArcDot } from "@/features/prayer-times/components/sun-arc";
import { formatClock, hijriDate } from "@/features/prayer-times/lib/format";
import { usePrayerSettings } from "@/features/prayer-times/hooks/use-prayer-settings";
import {
  computePrayerTimes,
  getDayProgress,
  getNextPrayer,
  type PrayerDay,
  type PrayerKey,
} from "@repo/api/services/prayer-times";

// Day fraction (Fajr→Isha) for each instant — used to place arc dots.
export function buildArcDots(day: PrayerDay, nextKey: PrayerKey | null): ArcDot[] {
  const fajr = day.instants.find((i) => i.key === "fajr")?.time ?? null;
  const isha = day.instants.find((i) => i.key === "isha")?.time ?? null;
  const span =
    fajr && isha && isha.getTime() > fajr.getTime()
      ? isha.getTime() - fajr.getTime()
      : 1;
  return day.instants
    .filter((i) => i.time != null)
    .map((i) => ({
      key: i.key,
      fraction: fajr ? Math.min(1, Math.max(0, (i.time!.getTime() - fajr.getTime()) / span)) : 0.5,
      isNext: i.key === nextKey,
    }));
}

export function PrayerTimesWidget({ locale }: { locale: "ar" | "en" }) {
  const t = useTranslations("prayer");
  const { location, prefs } = usePrayerSettings();
  const [now, setNow] = useState<number>(() => Date.now());

  // Re-tick once a minute so the arc/next refresh as time passes.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  const day = useMemo(
    () =>
      computePrayerTimes({
        lat: location.lat,
        lng: location.lng,
        date: new Date(now),
        method: prefs.method,
        madhab: prefs.madhab,
      }),
    [location.lat, location.lng, prefs.method, prefs.madhab, now],
  );

  const nowDate = new Date(now);
  const next = getNextPrayer(day, nowDate);
  const dots = buildArcDots(day, next?.key ?? null);
  const sunFraction = getDayProgress(day, nowDate);

  const rowKeys: PrayerKey[] = ["fajr", "dhuhr", "asr", "maghrib", "isha"];

  return (
    <section
      aria-labelledby="prayer-widget-heading"
      className="mt-8 overflow-hidden rounded-xl border border-border bg-surface"
    >
      <h2 id="prayer-widget-heading" className="sr-only">
        {t("title")}
      </h2>

      <div className="px-6 pt-5">
        <div className="flex items-center justify-between">
          <Link
            href="/prayer-times"
            className="flex items-center gap-1.5 text-sm text-text hover:text-primary"
          >
            🕌 {location.label}
          </Link>
          <span className="text-xs text-sun">{hijriDate(new Date(now), locale)}</span>
        </div>
      </div>

      {/* full-bleed arc */}
      <div className="mt-1">
        <SunArc dots={dots} sunFraction={sunFraction} nextLabel={t("next")} />
      </div>

      {next ? (
        <div className="mb-3">
          <PrayerCountdown nextKey={next.key} target={next.time} />
        </div>
      ) : null}

      <div className="flex gap-1.5 border-t border-border px-6 py-4">
        {rowKeys.map((key) => {
          const inst = day.instants.find((i) => i.key === key)!;
          const isNext = next?.key === key;
          return (
            <div
              key={key}
              className={`flex-1 rounded-md px-0.5 py-1 text-center ${isNext ? "bg-primary/10" : ""}`}
            >
              <div className={`text-2xs uppercase tracking-[0.05em] ${isNext ? "text-primary" : "text-text-2"}`}>
                {t(key)}
              </div>
              <div className={`mt-1 text-sm tabular-nums ${isNext ? "font-semibold text-sun" : "text-text"}`}>
                {formatClock(inst.time, locale)}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Mount the widget on the homepage**

In `apps/web/app/[locale]/page.tsx`:

(a) Add the import alongside the other feature imports (after the `PlaylistSortSelect` import near line 17):

```ts
import { PrayerTimesWidget } from "@/features/prayer-times/components/prayer-times-widget";
```

(b) Render it between the hero block and the `<hr>` (around line 112–114). Replace:

```tsx
      </div>

      <hr className="border-border my-8" />
```

with:

```tsx
      </div>

      <PrayerTimesWidget locale={locale} />

      <hr className="border-border my-8" />
```

- [ ] **Step 3: Typecheck + run the web suite**

Run: `pnpm --filter web typecheck`
Expected: PASS.
Run: `pnpm --filter web test`
Expected: PASS (existing suite + new prayer tests).

- [ ] **Step 4: Commit**

```bash
git add apps/web/features/prayer-times/components/prayer-times-widget.tsx "apps/web/app/[locale]/page.tsx"
git commit -m "$(cat <<'EOF'
[AhmedMuhammedElsaid][wip]: PrayerTimesWidget + mount on homepage

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

## Task 15: `/prayer-times` page + header link

**Files:**
- Create: `apps/web/app/[locale]/prayer-times/page.tsx`
- Create: `apps/web/features/prayer-times/components/prayer-page.tsx`
- Modify: `apps/web/features/layout/components/site-header.tsx`

> The interactive page body is a client island (`prayer-page.tsx`) because it reads localStorage and runs effects; the route file stays a thin RSC that sets locale + metadata, matching the sibling pages.

- [ ] **Step 1: Write the client page body**

Create `apps/web/features/prayer-times/components/prayer-page.tsx`:

```tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";

import { DateCard } from "@/features/prayer-times/components/date-card";
import { LocationPicker } from "@/features/prayer-times/components/location-picker";
import { MethodSettings } from "@/features/prayer-times/components/method-settings";
import { PrayerCountdown } from "@/features/prayer-times/components/prayer-countdown";
import { PrayerTimetable } from "@/features/prayer-times/components/prayer-timetable";
import { SunArc } from "@/features/prayer-times/components/sun-arc";
import { buildArcDots } from "@/features/prayer-times/components/prayer-times-widget";
import { usePrayerSettings } from "@/features/prayer-times/hooks/use-prayer-settings";
import {
  computePrayerTimes,
  getDayProgress,
  getNextPrayer,
} from "@repo/api/services/prayer-times";

export function PrayerPage({ locale }: { locale: "ar" | "en" }) {
  const t = useTranslations("prayer");
  const { location, prefs, setLocation, setMethod, setMadhab } = usePrayerSettings();
  const [now, setNow] = useState<number>(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  const day = useMemo(
    () =>
      computePrayerTimes({
        lat: location.lat,
        lng: location.lng,
        date: new Date(now),
        method: prefs.method,
        madhab: prefs.madhab,
      }),
    [location.lat, location.lng, prefs.method, prefs.madhab, now],
  );

  const nowDate = new Date(now);
  const next = getNextPrayer(day, nowDate);
  const dots = buildArcDots(day, next?.key ?? null);
  const sunFraction = getDayProgress(day, nowDate);

  return (
    <section className="mx-auto max-w-5xl px-6 py-12">
      <h1 className="font-display text-3xl font-bold text-text">{t("title")}</h1>
      <p className="mt-1 text-sm text-text-2">🕌 {location.label}</p>

      <div className="mt-6 overflow-hidden rounded-xl border border-border bg-surface pt-2">
        <SunArc dots={dots} sunFraction={sunFraction} nextLabel={t("next")} />
        {next ? (
          <div className="pb-6">
            <PrayerCountdown nextKey={next.key} target={next.time} />
          </div>
        ) : null}
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-[1.3fr_0.9fr]">
        <PrayerTimetable instants={day.instants} nextKey={next?.key ?? null} locale={locale} />

        <div className="space-y-4">
          <DateCard date={new Date(now)} locale={locale} />
          <div className="rounded-lg border border-border bg-surface p-4">
            <h2 className="mb-3 font-display text-base text-text">{t("calculation")}</h2>
            <MethodSettings
              method={prefs.method}
              madhab={prefs.madhab}
              onMethodChange={setMethod}
              onMadhabChange={setMadhab}
            />
          </div>
          <div className="rounded-lg border border-border bg-surface p-4">
            <h2 className="mb-3 font-display text-base text-text">{t("changeCity")}</h2>
            <LocationPicker locale={locale} onSelect={setLocation} />
          </div>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Write the RSC route file**

Create `apps/web/app/[locale]/prayer-times/page.tsx` (mirrors the sibling `force-dynamic` + metadata pattern from `app/[locale]/page.tsx`):

```tsx
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { LOCALES, type Locale } from "@repo/api/schemas/locale";
import { localeAlternates, defaultOpenGraph, defaultTwitter } from "@/lib/seo";
import { PrayerPage } from "@/features/prayer-times/components/prayer-page";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "prayer" });
  const pathByLocale = Object.fromEntries(
    LOCALES.map((l) => [l, `/${l}/prayer-times`]),
  ) as Record<Locale, string>;
  const { canonical, languages } = localeAlternates(locale, pathByLocale);
  return {
    title: t("title"),
    alternates: { canonical, languages },
    openGraph: { ...defaultOpenGraph(locale), title: t("title"), url: canonical },
    twitter: defaultTwitter(),
  };
}

export default async function PrayerTimesRoute({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <PrayerPage locale={locale} />;
}
```

- [ ] **Step 3: Add a header nav link**

Open `apps/web/features/layout/components/site-header.tsx`. Add a nav link to `/prayer-times` using the existing i18n `Link` and the `prayer.nav` label. Place it next to the existing header actions (match the surrounding markup; example):

```tsx
import { Link } from "@/i18n/navigation";
// ...
// inside the header nav, alongside the existing actions:
<Link
  href="/prayer-times"
  className="text-sm text-text-2 hover:text-primary"
>
  {tPrayer("nav")}
</Link>
```

Add `const tPrayer = useTranslations("prayer");` near the other `useTranslations` calls in that component. If the header is a server component without translations wired, use `getTranslations`/the established pattern already in that file — match what is there, do not convert it to a client component.

- [ ] **Step 4: Typecheck + full web suite + build**

Run: `pnpm --filter web typecheck`
Expected: PASS.
Run: `pnpm --filter web test`
Expected: PASS.
Run: `pnpm --filter web build`
Expected: build succeeds; `/[locale]/prayer-times` appears in the route list as dynamic.

- [ ] **Step 5: Commit**

```bash
git add "apps/web/app/[locale]/prayer-times/page.tsx" apps/web/features/prayer-times/components/prayer-page.tsx apps/web/features/layout/components/site-header.tsx
git commit -m "$(cat <<'EOF'
[AhmedMuhammedElsaid][wip]: /prayer-times page + header nav link

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

## Task 16: Manual verification + APP_CONTEXT update

**Files:**
- Modify: `APP_CONTEXT.md`

- [ ] **Step 1: Manual smoke (dev server)**

Run: `pnpm --filter web dev`
Then in a browser:
- Visit `http://localhost:3000/ar` → the Sun Arc widget renders under the hero; full-width arc; gold rayed sun; next prayer glows; countdown ticks; five-prayer row shows times; Hijri date shows.
- Visit `http://localhost:3000/en/prayer-times` → arc hero + countdown; timetable incl. Sunrise with the next prayer highlighted; date card; method + madhab selects; city search filters and selecting a city updates the times; "Use my location" prompts and (if allowed) updates the label/times.
- Change the city on the page, return to `/en` → the widget reflects the saved city (shared `nour.prayer.location`).
- Toggle the theme (header) → arc + text stay on-token in light mode.
- Switch `/en/prayer-times` ↔ `/ar/prayer-times` → labels translate; layout mirrors correctly (RTL); no spacing regressions.

Stop the dev server when done.

- [ ] **Step 2: Update `APP_CONTEXT.md`**

(a) Append a row to the completed-waves table (after the "Scholar photos on home cards" row):

```markdown
| Prayer Times ✅ | HEAD (2026-06-05) | New public feature: homepage **Sun Arc widget** + dedicated **/prayer-times** page, sharing one isomorphic compute path. NEW dep `adhan` (ADR `0004-adhan-js.md`). `packages/api`: `schemas/prayer-times.ts` (method/madhab/location/prefs zod + `DEFAULT_LOCATION` Cairo / `DEFAULT_METHOD` Egyptian / `DEFAULT_MADHAB` standard), `services/prayer-times.service.ts` — **pure, no auth/DB** (deliberate departure, documented): `computePrayerTimes` + `getNextPrayer` + `getUpcomingPrayer` (rolls to tomorrow's Fajr) + `getDayProgress`; new export subpaths `./schemas/prayer-times` + `./services/prayer-times`. Hijri via built-in `Intl` (no dep). New token `--color-sun` (bright gold glow) in `tokens.css` both themes + globals bridge. Web `features/prayer-times/`: `data/cities.ts` (~24 curated cities + `nearestCity`), `lib/format.ts` (clock/countdown/hijri/gregorian), `lib/sun-arc.ts` (pure arc geometry: `ARC`/`arcPath`/`arcPoint`/`tForFraction`), `hooks/use-prayer-settings.ts` (localStorage `nour.prayer.location` + `nour.prayer.prefs`, SSR-safe), components `sun-arc` (full-bleed SVG, gold rayed sun = current time, glowing dot = next prayer), `prayer-countdown` (1s tick), `prayer-timetable`, `date-card`, `location-picker` (city search + geolocation), `method-settings`, `prayer-times-widget` (exports `buildArcDots`), `prayer-page`. Route `app/[locale]/prayer-times/page.tsx` (force-dynamic + metadata), widget mounted on `app/[locale]/page.tsx`, header nav link. i18n `prayer` namespace (ar/en). Device-local only (no DB/auth). **Deferred**: adhan audio, notifications, monthly view, verse-of-the-day, per-location timezone (v1 formats in device tz). Tests: api +N · web +N green. |
```

Replace `+N` with the actual counts after running the suites in Step 3.

(b) Add the file-locations under the web `features/` section and the `packages/api` services/schemas lists (mirror the style already used there). At minimum add the `prayer-times.service.ts` line under `services/` and the `schemas/prayer-times.ts` line under `schemas/`.

- [ ] **Step 3: Final full-suite verification**

Run: `pnpm --filter @repo/api test`
Expected: PASS — note the total.
Run: `pnpm --filter web test`
Expected: PASS — note the total.
Run: `pnpm --filter @repo/api typecheck && pnpm --filter web typecheck`
Expected: PASS.
Run: `pnpm --filter web lint`
Expected: PASS (no warnings — `--max-warnings 0`).

Fill the real test totals into the APP_CONTEXT row.

- [ ] **Step 4: Commit**

```bash
git add APP_CONTEXT.md
git commit -m "$(cat <<'EOF'
[AhmedMuhammedElsaid][docs]: APP_CONTEXT — prayer-times wave

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

## Self-Review (completed against the spec)

**Spec coverage:**
- Homepage widget → Task 14. Dedicated page → Task 15. ✅
- Sun Arc visual (full-bleed, gold rayed sun, glowing next) → Tasks 7, 9. ✅
- Isomorphic `adhan` compute, no auth/DB → Task 3 (+ ADR Task 1). ✅
- Default Egyptian/Standard + method/madhab picker (option B) → Tasks 2, 13. ✅
- Curated city list + geolocation, saved to `nour.prayer.*` → Tasks 5, 8, 12. ✅
- Live countdown → Task 10. Hijri via `Intl` → Task 6. ✅
- Bilingual + RTL → Task 4 + token/logical-property usage throughout; verified Task 16. ✅
- Error handling (geo denied, high-latitude null, SSR defaults, bad JSON) → Tasks 3, 6, 8, 12. ✅
- Tests per CLAUDE.md §9: service unit + edge (Task 3), component RTL tests (Tasks 10, 12), lib units (Tasks 6, 7). ✅
- ADR for new dep → Task 1. APP_CONTEXT same-wave update → Task 16. ✅
- Deferred items kept out of scope. ✅

**Placeholder scan:** No TBD/TODO; every code step shows complete code. The only intentional fill-ins are the `+N` test totals in Task 16, which are resolved by running the suites in that same task.

**Type consistency:** `PrayerKey`, `PrayerInstant`, `PrayerDay`, `NextPrayer` defined in Task 3 and imported unchanged by Tasks 9–15. `ArcDot`/`buildArcDots` defined once (Tasks 9/14) and reused by the page (Task 15). `PrayerLocation`/`PrayerPreferences`/`CalculationMethodId`/`MadhabId` from Task 2 used consistently in Tasks 8, 12, 13. `usePrayerSettings` surface matches its consumers.

**Known follow-ups (non-blocking, noted in spec §13):** final method-list breadth and widget grid-column span are cosmetic and adjustable during implementation; per-location timezone is a deferred enhancement (v1 formats in device tz, recorded in the ADR).
