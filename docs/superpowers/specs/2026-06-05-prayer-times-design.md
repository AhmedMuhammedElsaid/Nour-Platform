# Prayer Times — Design Spec

> Status: **approved design, pending implementation plan**
> Date: 2026-06-05
> Author: brainstorm session (Ahmed + Claude)
> Inspiration: Quran Tab (Chrome new-tab extension) — we take the prayer-times half, in Nour's visual language.

---

## 1. Summary

Add Islamic prayer times to the public `web` app as two surfaces that share one compute path and one saved location:

1. **Homepage widget** — a card in the existing homepage grid showing today's five prayers, a live "next prayer in Xh Ym" countdown, the Hijri date, and a full-width **Sun Arc** (a gold sun riding an arc to show where the current time sits in the day; the next prayer glows).
2. **Dedicated `/prayer-times` page** — a larger Sun Arc hero with the countdown, the full daily timetable (incl. Sunrise), Hijri + Gregorian date, a location picker, and a **calculation method + Asr madhab** settings panel.

Times are computed with `adhan-js` from latitude/longitude. No database, no auth, no external API. Everything works offline (fits the existing PWA).

---

## 2. Goals / Non-goals

**Goals (v1)**
- Accurate daily prayer times for a user-chosen location.
- Passive value on the homepage + a deep page, sharing code.
- Live next-prayer countdown and Hijri date.
- User-selectable calculation method + Asr madhab, persisted locally.
- Bilingual (AR/EN), RTL-correct, on-token visuals (dark-gold palette).

**Non-goals (deferred to a later wave)**
- Adhan audio playback at prayer time (natural tie-in to the existing player — later).
- Browser/push notifications.
- Monthly timetable view.
- Quran "verse of the day" / the full Quran-Tab landing screen.
- Server-persisted per-user preferences (v1 is device-local only, like `nour.player.*`).

---

## 3. Visual design (locked)

Direction: **Sun Arc**, in the existing dark-default palette.

- Palette: gold `--color-primary` `#C8A050` (dark) on warm near-black; brighter gold `#E4C57E` for the sun/next-prayer glow; cream text; muted `#A89A82` for secondary. **Tokens only — no hex literals in code** (add any missing shade to `tokens.css`).
- Headings: Fraunces (`--font-display`). Arabic prayer names: Amiri/IBM Plex Sans Arabic (already loaded for `ar`).
- **Sun Arc**: a quadratic arc spanning full width (horizon line edge-to-edge on the widget). Prayer instants are dots along the arc; the **next prayer** is a glowing gold dot with a ring + label. The **current time** is a **gold sun with rays** (matching the glow) positioned along the arc by progress through the day.
- Widget arc is **full-bleed** (breaks the card's horizontal padding). Page arc is contained in the hero.
- Next prayer is emphasized in the five-prayer row / timetable (gold tint + brighter value).
- Logical properties (`ms-`/`me-`, `text-end`) throughout for RTL safety. Mirrors correctly under `/ar`.

Reference mockups (kept for implementation): `.superpowers/brainstorm/<session>/content/sun-arc-final.html`, `sun-arc-refined.html`.

---

## 4. Architecture

### 4.1 Compute (single source of truth)

`packages/api/src/services/prayer-times.service.ts` exports a **pure, isomorphic** function:

```ts
export function computePrayerTimes(params: {
  lat: number; lng: number;
  date: Date;                 // local civil date of interest
  method: CalculationMethodId;
  madhab: MadhabId;
}): PrayerDay
```

- Wraps `adhan-js` (`Coordinates`, `CalculationMethod`, `PrayerTimes`, `Madhab`, `SunnahTimes` if needed).
- Returns a typed DTO `PrayerDay`:
  ```ts
  type PrayerKey = 'fajr' | 'sunrise' | 'dhuhr' | 'asr' | 'maghrib' | 'isha';
  type PrayerDay = {
    date: string;                       // ISO date
    times: { key: PrayerKey; time: string /* ISO */ }[];
  };
  ```
- **Deliberate departure from the usual service mold:** no `requireSession`, no `revalidateTag`, no repo/DB. It is deterministic math over public inputs, so the auth/data-layer rules in CLAUDE.md §5 don't apply. This is called out here so it doesn't read as a boundary violation in review. It still lives in `packages/api` so both the RSC and the client island import the *same* implementation, and so it's unit-tested with the rest of the API suite.
- Pure ⇒ runs on the server (RSC first paint with default city) **and** in the client island (recompute for the user's saved/geolocated location, plus the per-second countdown). `adhan-js` is small and tree-shakeable; shipping it to the client is acceptable.

**Derived helpers** (can live beside the compute fn or in `lib/`):
- `getNextPrayer(day, now)` → `{ key, time, msUntil }` (skips Sunrise as a "prayer" for the countdown but still shows it in the timetable).
- `getDayProgress(day, now)` → `0..1` for positioning the sun on the arc (anchored Fajr→Isha, clamped).

### 4.2 Schemas

`packages/api/src/schemas/prayer-times.ts`:
- `calculationMethodSchema` — enum of supported method ids (see §6).
- `madhabSchema` — `'standard' | 'hanafi'`.
- `prayerLocationSchema` — `{ lat, lng, label?: string }` (label = display city/country).
- `prayerPreferencesSchema` — `{ method, madhab }` with defaults.
- Exported types consumed by both apps and the compute fn.

### 4.3 Hijri date

Use built-in `Intl.DateTimeFormat` with the Islamic calendar (`...-u-ca-islamic`). **No dependency.** A small `lib/format.ts` helper formats Hijri (AR digits for `ar`) and Gregorian per locale, RTL-safe.

### 4.4 Location data

`apps/web/features/prayer-times/data/cities.ts` — a curated, bundled list (~60 cities, MENA-weighted) of `{ id, en, ar, country, lat, lng }`. Avoids adding a geocoding API. The picker searches this list. "Use my location" uses the browser Geolocation API for exact coordinates (no list needed on that path).

### 4.5 Preference persistence

Device-local via `localStorage`, mirroring the existing `nour.*` convention:
- `nour.prayer.location` → `{ lat, lng, label }`
- `nour.prayer.prefs` → `{ method, madhab }`

A tiny client hook `hooks/use-prayer-settings.ts` reads/writes these and exposes reactive values so the widget and page stay in sync. SSR-safe (defaults until hydrated).

---

## 5. Data flow

1. **RSC first paint** (widget on homepage, and `/prayer-times`) computes with the **default location** (Cairo) + default prefs, so there is real, indexable content with no layout shift and no JS required.
2. **Client island** mounts, reads `nour.prayer.location` + `nour.prayer.prefs`. If they differ from the default, it recomputes with `computePrayerTimes` and swaps the values in. It also runs the **countdown** (re-render ~1/sec, or 1/min + a seconds tick) and animates the sun position.
3. Changing **city** (picker) or **method/madhab** (settings) writes back to `localStorage`; both surfaces react.
4. **Geolocation**: opt-in button → `navigator.geolocation.getCurrentPosition` → exact coords saved as location (label resolved to nearest known city, else "My location").

---

## 6. Calculation method & madhab (option B)

- **Defaults:** method = **Egyptian General Authority of Survey**; Asr madhab = **Standard** (Shāfiʿī/Mālikī/Ḥanbalī). Chosen because the default locale is Arabic and the sample region is Egypt.
- **Picker** on `/prayer-times`: two dropdowns (method, madhab), saved to `nour.prayer.prefs`. The widget has no picker; it reflects the saved prefs.
- Supported methods (v1 — `adhan-js` built-ins): Muslim World League, Egyptian, Umm al-Qurā, Karachi, ISNA, Dubai, Qatar, Kuwait, Singapore, Turkey, Tehran, Moonsighting Committee. (Exact list finalized in the plan; all are `adhan-js` presets so no custom angle math.)
- High-latitude handling: use `adhan-js` `highLatitudeRule` (default `MiddleOfTheNight`); if a time is still undefined, render `—` (no crash).

---

## 7. Components & files

```
apps/web/features/prayer-times/
  data/cities.ts                      curated city → coords list (en/ar/country)
  lib/format.ts                       time / Hijri / Gregorian formatters (locale + RTL)
  lib/sun-arc.ts                      arc geometry: prayer dot positions + sun position from progress
  hooks/use-prayer-settings.ts        localStorage location + prefs (SSR-safe, reactive)
  components/
    sun-arc.tsx                       the SVG arc (dots + glowing next + gold rayed sun)  [client]
    prayer-countdown.tsx              live "next in Xh Ym" + next-prayer name             [client]
    prayer-times-widget.tsx           homepage card shell (RSC) wrapping the islands
    prayer-timetable.tsx              full day list incl. Sunrise, next-row highlight
    location-picker.tsx               city search + "use my location"                     [client]
    method-settings.tsx               method + madhab dropdowns                            [client]
    date-card.tsx                     Hijri + Gregorian

apps/web/app/[locale]/prayer-times/page.tsx     RSC page assembling the above (force-dynamic, like siblings)
apps/web/app/[locale]/page.tsx                  homepage — mount <PrayerTimesWidget/> in the grid
apps/web/messages/{ar,en}.json                  new `prayer` namespace (names, labels, method names)

packages/api/src/
  schemas/prayer-times.ts             method/madhab/location/preferences schemas + types
  services/prayer-times.service.ts    computePrayerTimes + getNextPrayer + getDayProgress
  services/prayer-times.service.test.ts

docs/adr/0004-adhan-js.md             ADR for the new dependency
```

Server components by default; only the arc, countdown, picker, and settings are `"use client"` islands (state/effects/geolocation).

---

## 8. i18n

New `prayer` namespace in `messages/{ar,en}.json`:
- Prayer names (Fajr/Sunrise/Dhuhr/ʿAsr/Maghrib/ʿIshāʾ) in both scripts.
- Labels: "Next prayer", "in {h}h {m}m", "Prayer times", "Use my location", "Change city", "Calculation method", "Asr (madhab)", method display names, "Standard"/"Hanafi".
- Hijri month names come from `Intl`; UI chrome comes from the namespace.

---

## 9. Error handling & edge cases

- **Geolocation denied/unavailable** → keep the saved city, else default (Cairo); show a gentle inline note ("Showing times for Cairo — change city"). Never block render.
- **No saved preference yet** → defaults (Cairo, Egyptian, Standard).
- **High latitude / polar** where Fajr or Isha may not occur → `adhan-js` high-latitude rule; undefined ⇒ `—`.
- **SSR/hydration** → render default-location values server-side; island reconciles after mount (no layout shift — same DOM shape).
- **Offline** → all compute is local; no network dependency. Works in the installed PWA.
- **Invalid stored JSON** in localStorage → catch + fall back to defaults.

---

## 10. Testing (per CLAUDE.md §9)

- **Unit (Vitest, `packages/api`)** on `computePrayerTimes` + `getNextPrayer`:
  - Known city + date + method → expected times (tolerance ±1 min) for at least one well-known case (e.g. Cairo, Egyptian method).
  - Negative/edge: a high-latitude coordinate where a prayer time is undefined → returns `—`/null sentinel rather than throwing.
  - `getNextPrayer` rolls over correctly after ʿIshāʾ (next = tomorrow's Fajr).
- **RTL component tests (`apps/web`)**:
  - `prayer-countdown` formats "in Xh Ym" and names the next prayer.
  - `sun-arc` highlights the correct next prayer; renders without crashing for all-defined and missing-time inputs.
  - `location-picker` filters the city list and emits a selection.
  - RTL render (`dir="rtl"`) — no directional spacing regressions.
- **E2E (Playwright)** — deferred/optional happy path: load `/ar/prayer-times`, see timetable + countdown.

---

## 11. New dependency → ADR

`adhan-js` is the **only** new runtime dependency (small, ISC-licensed, ~zero transitive deps). Per CLAUDE.md §5 it requires an ADR: `docs/adr/0004-adhan-js.md` (next number after 0001 next-intl, 0002 arabic-slugs, 0003 PWA service worker). The ADR records: why client-side computation (offline, no API key, no rate limits, deterministic) over a hosted prayer API, and the isomorphic-pure-function placement.

Hijri dates add **no** dependency (`Intl`).

---

## 12. Definition of Done

- Widget renders on the homepage; `/prayer-times` page renders, both in the Sun Arc style on tokens (no hex literals).
- Times correct for the chosen location/method/madhab; countdown ticks; Hijri date shown.
- City picker + geolocation + method/madhab persist to `nour.prayer.*` and sync across both surfaces.
- AR/EN + RTL correct.
- Unit + component tests green; web prod build ✓; typecheck/lint clean.
- ADR 0004 committed; `APP_CONTEXT.md` updated in the same commit that ships the code.

---

## 13. Open questions (none blocking)

- Final method list (subset of `adhan-js` presets) — settle in the plan.
- Whether the homepage widget spans one or two grid columns — decide during layout implementation.
