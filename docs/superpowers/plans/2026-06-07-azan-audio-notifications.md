# Azan Audio & Notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Play the Adhan (Azan) at each prayer time — automatically while a Nour tab is open (all browsers), and best-effort in the background via Notification Triggers (Chrome/Android).

**Architecture:** Two layers sharing one settings store and one pure schedule helper. Layer A is a headless client island (`AdhanController`) mounted site-wide in the locale layout: it arms a `setTimeout` to the next *enabled* prayer and plays a bundled `<audio>` element on fire. Layer B schedules the day's prayers as `registration.showNotification({ showTrigger })`; the service worker's `notificationclick` focuses/opens a tab and `postMessage`s the controller to play. Fully device-local — no DB, no auth, no server.

**Tech Stack:** Next.js 16, React 19, next-intl, TypeScript strict, Zod, `adhan` (already a dep), Vitest + RTL, hand-rolled service worker (`public/sw.js`).

**Reference spec:** `docs/superpowers/specs/2026-06-07-azan-audio-notifications-design.md`

---

## File Structure

| File | Responsibility |
|---|---|
| `packages/api/src/schemas/prayer-times.ts` (modify) | `adhanSettingsSchema`, `DEFAULT_ADHAN_SETTINGS`, `AdhanSettings`, `ADHAN_PRAYER_KEYS` |
| `apps/web/features/prayer-times/lib/adhan-schedule.ts` (create) | Pure `nextAdhanEvent()` selector |
| `apps/web/features/prayer-times/hooks/use-adhan-settings.ts` (create) | localStorage `nour.prayer.adhan`, SSR-safe |
| `apps/web/features/prayer-times/components/adhan-player.tsx` (create) | Two `<audio>` els + `play(key)` |
| `apps/web/features/prayer-times/hooks/use-adhan-scheduler.ts` (create) | Foreground timeout engine |
| `apps/web/features/prayer-times/lib/adhan-notifications.ts` (create) | Layer B: permission + `showTrigger` scheduling |
| `apps/web/features/prayer-times/components/adhan-controller.tsx` (create) | Headless island wiring scheduler+player+SW message |
| `apps/web/features/prayer-times/components/adhan-settings.tsx` (create) | Settings UI (toggles, volume, permission) |
| `apps/web/app/[locale]/layout.tsx` (modify) | Mount `<AdhanController/>` |
| `apps/web/features/prayer-times/components/prayer-page.tsx` (modify) | Mount `<AdhanSettings/>` |
| `apps/web/messages/{ar,en}.json` (modify) | `prayer.adhan.*` strings |
| `apps/web/public/sw.js` (modify) | Precache audio, bump version, `notificationclick` |
| `apps/web/public/audio/adhan.mp3`, `adhan-fajr.mp3` (create) | Bundled recordings (maintainer-supplied) |

**Test commands:**
- API package: `pnpm --filter @repo/api test`
- Web app: `pnpm --filter web test`
- Typecheck: `pnpm --filter web exec tsc --noEmit` / `pnpm --filter @repo/api exec tsc --noEmit`

---

## Task 1: Adhan settings schema

**Files:**
- Modify: `packages/api/src/schemas/prayer-times.ts`
- Test: `packages/api/src/schemas/prayer-times.test.ts` (create)

- [ ] **Step 1: Write the failing test**

Create `packages/api/src/schemas/prayer-times.test.ts`:

```typescript
import { describe, expect, it } from "vitest";

import {
  ADHAN_PRAYER_KEYS,
  DEFAULT_ADHAN_SETTINGS,
  adhanSettingsSchema,
} from "./prayer-times";

describe("adhanSettingsSchema", () => {
  it("defaults to opt-out (disabled), all prayers on, volume 0.8", () => {
    const parsed = adhanSettingsSchema.parse({});
    expect(parsed).toEqual(DEFAULT_ADHAN_SETTINGS);
    expect(parsed.enabled).toBe(false);
    expect(parsed.volume).toBe(0.8);
    for (const key of ADHAN_PRAYER_KEYS) {
      expect(parsed.perPrayer[key]).toBe(true);
    }
  });

  it("clamps volume into the 0..1 range via schema rejection", () => {
    expect(adhanSettingsSchema.safeParse({ volume: 2 }).success).toBe(false);
    expect(adhanSettingsSchema.safeParse({ volume: -0.1 }).success).toBe(false);
    expect(adhanSettingsSchema.safeParse({ volume: 0.5 }).success).toBe(true);
  });

  it("rejects an unknown prayer key shape but accepts partial perPrayer", () => {
    const parsed = adhanSettingsSchema.parse({ perPrayer: { fajr: false } });
    expect(parsed.perPrayer.fajr).toBe(false);
    expect(parsed.perPrayer.dhuhr).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @repo/api test -- prayer-times.test.ts`
Expected: FAIL — `adhanSettingsSchema` / `DEFAULT_ADHAN_SETTINGS` / `ADHAN_PRAYER_KEYS` not exported.

- [ ] **Step 3: Add the schema**

Append to `packages/api/src/schemas/prayer-times.ts`:

```typescript
// Prayers that have an adhan (sunrise is a marker, not a prayer).
export const ADHAN_PRAYER_KEYS = [
  "fajr",
  "dhuhr",
  "asr",
  "maghrib",
  "isha",
] as const;
export type AdhanPrayerKey = (typeof ADHAN_PRAYER_KEYS)[number];

const perPrayerSchema = z.object({
  fajr: z.boolean().default(true),
  dhuhr: z.boolean().default(true),
  asr: z.boolean().default(true),
  maghrib: z.boolean().default(true),
  isha: z.boolean().default(true),
});

// User controls for the adhan. Persisted device-local (localStorage), never
// sent to the server — no auth/DB involvement (matches prayer-times v1).
export const adhanSettingsSchema = z.object({
  enabled: z.boolean().default(false),
  perPrayer: perPrayerSchema.default({}),
  volume: z.number().min(0).max(1).default(0.8),
});
export type AdhanSettings = z.infer<typeof adhanSettingsSchema>;

export const DEFAULT_ADHAN_SETTINGS: AdhanSettings = adhanSettingsSchema.parse({});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @repo/api test -- prayer-times.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/api/src/schemas/prayer-times.ts packages/api/src/schemas/prayer-times.test.ts
git commit -m "[AhmedMuhammedElsaid][wip]: adhan settings schema + defaults

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Pure next-adhan-event selector

**Files:**
- Create: `apps/web/features/prayer-times/lib/adhan-schedule.ts`
- Test: `apps/web/features/prayer-times/lib/adhan-schedule.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/web/features/prayer-times/lib/adhan-schedule.test.ts`:

```typescript
import { describe, expect, it } from "vitest";

import { DEFAULT_ADHAN_SETTINGS } from "@repo/api/schemas/prayer-times";
import type { PrayerInstant } from "@repo/api/services/prayer-times";

import { nextAdhanEvent } from "./adhan-schedule";

function instants(): PrayerInstant[] {
  const d = (h: number, m = 0) => new Date(2026, 5, 7, h, m, 0, 0);
  return [
    { key: "fajr", time: d(4) },
    { key: "sunrise", time: d(6) },
    { key: "dhuhr", time: d(12) },
    { key: "asr", time: d(15) },
    { key: "maghrib", time: d(19) },
    { key: "isha", time: d(20, 30) },
  ];
}

describe("nextAdhanEvent", () => {
  it("returns the soonest enabled prayer strictly after now", () => {
    const now = new Date(2026, 5, 7, 13, 0, 0);
    const ev = nextAdhanEvent(instants(), DEFAULT_ADHAN_SETTINGS, now);
    expect(ev?.key).toBe("asr");
  });

  it("never returns sunrise", () => {
    const now = new Date(2026, 5, 7, 5, 0, 0);
    const ev = nextAdhanEvent(instants(), DEFAULT_ADHAN_SETTINGS, now);
    expect(ev?.key).toBe("dhuhr");
  });

  it("skips a disabled prayer", () => {
    const now = new Date(2026, 5, 7, 13, 0, 0);
    const settings = {
      ...DEFAULT_ADHAN_SETTINGS,
      perPrayer: { ...DEFAULT_ADHAN_SETTINGS.perPrayer, asr: false },
    };
    const ev = nextAdhanEvent(instants(), settings, now);
    expect(ev?.key).toBe("maghrib");
  });

  it("returns null when no enabled prayer remains today", () => {
    const now = new Date(2026, 5, 7, 21, 0, 0);
    expect(nextAdhanEvent(instants(), DEFAULT_ADHAN_SETTINGS, now)).toBeNull();
  });

  it("returns null when all prayers disabled", () => {
    const now = new Date(2026, 5, 7, 3, 0, 0);
    const settings = {
      ...DEFAULT_ADHAN_SETTINGS,
      perPrayer: { fajr: false, dhuhr: false, asr: false, maghrib: false, isha: false },
    };
    expect(nextAdhanEvent(instants(), settings, now)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter web test -- adhan-schedule.test.ts`
Expected: FAIL — module `./adhan-schedule` not found.

- [ ] **Step 3: Write the implementation**

Create `apps/web/features/prayer-times/lib/adhan-schedule.ts`:

```typescript
import {
  ADHAN_PRAYER_KEYS,
  type AdhanPrayerKey,
  type AdhanSettings,
} from "@repo/api/schemas/prayer-times";
import type { PrayerInstant } from "@repo/api/services/prayer-times";

export type AdhanEvent = { key: AdhanPrayerKey; time: Date };

const ADHAN_KEY_SET = new Set<string>(ADHAN_PRAYER_KEYS);

function isAdhanKey(key: string): key is AdhanPrayerKey {
  return ADHAN_KEY_SET.has(key);
}

// Soonest *enabled* adhan prayer strictly after `now` within the given day.
// Sunrise is excluded (not in ADHAN_PRAYER_KEYS). Returns null if none remain
// or all are disabled. Pure — no DOM, no Date.now().
export function nextAdhanEvent(
  instants: PrayerInstant[],
  settings: AdhanSettings,
  now: Date,
): AdhanEvent | null {
  if (!settings.enabled) return null;

  let best: AdhanEvent | null = null;
  for (const instant of instants) {
    const { key, time } = instant;
    if (time == null || !isAdhanKey(key)) continue;
    if (!settings.perPrayer[key]) continue;
    if (time.getTime() <= now.getTime()) continue;
    if (best == null || time.getTime() < best.time.getTime()) {
      best = { key, time };
    }
  }
  return best;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter web test -- adhan-schedule.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/features/prayer-times/lib/adhan-schedule.ts apps/web/features/prayer-times/lib/adhan-schedule.test.ts
git commit -m "[AhmedMuhammedElsaid][wip]: pure nextAdhanEvent selector

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: Adhan settings hook (localStorage, SSR-safe)

**Files:**
- Create: `apps/web/features/prayer-times/hooks/use-adhan-settings.ts`
- Test: `apps/web/features/prayer-times/hooks/use-adhan-settings.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `apps/web/features/prayer-times/hooks/use-adhan-settings.test.tsx`:

```typescript
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { DEFAULT_ADHAN_SETTINGS } from "@repo/api/schemas/prayer-times";

import { useAdhanSettings } from "./use-adhan-settings";

describe("useAdhanSettings", () => {
  beforeEach(() => localStorage.clear());

  it("hydrates from defaults then reads localStorage", async () => {
    localStorage.setItem(
      "nour.prayer.adhan",
      JSON.stringify({ ...DEFAULT_ADHAN_SETTINGS, enabled: true, volume: 0.5 }),
    );
    const { result } = renderHook(() => useAdhanSettings());
    await waitFor(() => expect(result.current.hydrated).toBe(true));
    expect(result.current.settings.enabled).toBe(true);
    expect(result.current.settings.volume).toBe(0.5);
  });

  it("persists updates back to localStorage", async () => {
    const { result } = renderHook(() => useAdhanSettings());
    await waitFor(() => expect(result.current.hydrated).toBe(true));
    act(() => result.current.setEnabled(true));
    expect(JSON.parse(localStorage.getItem("nour.prayer.adhan")!).enabled).toBe(true);
    act(() => result.current.setPrayer("fajr", false));
    expect(
      JSON.parse(localStorage.getItem("nour.prayer.adhan")!).perPrayer.fajr,
    ).toBe(false);
  });

  it("falls back to defaults on corrupt storage", async () => {
    localStorage.setItem("nour.prayer.adhan", "{ not json");
    const { result } = renderHook(() => useAdhanSettings());
    await waitFor(() => expect(result.current.hydrated).toBe(true));
    expect(result.current.settings).toEqual(DEFAULT_ADHAN_SETTINGS);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter web test -- use-adhan-settings.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

Create `apps/web/features/prayer-times/hooks/use-adhan-settings.ts`:

```typescript
"use client";

import { useCallback, useEffect, useState } from "react";

import {
  type AdhanPrayerKey,
  type AdhanSettings,
  DEFAULT_ADHAN_SETTINGS,
  adhanSettingsSchema,
} from "@repo/api/schemas/prayer-times";

const ADHAN_KEY = "nour.prayer.adhan";

function readSettings(): AdhanSettings {
  try {
    const raw = localStorage.getItem(ADHAN_KEY);
    if (!raw) return DEFAULT_ADHAN_SETTINGS;
    const parsed = adhanSettingsSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : DEFAULT_ADHAN_SETTINGS;
  } catch {
    return DEFAULT_ADHAN_SETTINGS;
  }
}

export type AdhanSettingsApi = {
  settings: AdhanSettings;
  hydrated: boolean;
  setEnabled: (enabled: boolean) => void;
  setPrayer: (key: AdhanPrayerKey, on: boolean) => void;
  setVolume: (volume: number) => void;
};

export function useAdhanSettings(): AdhanSettingsApi {
  // Server + first client render use defaults to avoid hydration mismatch.
  const [settings, setSettings] = useState<AdhanSettings>(DEFAULT_ADHAN_SETTINGS);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setSettings(readSettings());
    setHydrated(true);
  }, []);

  const persist = useCallback((next: AdhanSettings) => {
    setSettings(next);
    try {
      localStorage.setItem(ADHAN_KEY, JSON.stringify(next));
    } catch {
      /* storage unavailable — keep in-memory state */
    }
  }, []);

  const setEnabled = useCallback(
    (enabled: boolean) => persist({ ...readSettings(), enabled }),
    [persist],
  );
  const setVolume = useCallback(
    (volume: number) => persist({ ...readSettings(), volume }),
    [persist],
  );
  const setPrayer = useCallback(
    (key: AdhanPrayerKey, on: boolean) => {
      const cur = readSettings();
      persist({ ...cur, perPrayer: { ...cur.perPrayer, [key]: on } });
    },
    [persist],
  );

  return { settings, hydrated, setEnabled, setPrayer, setVolume };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter web test -- use-adhan-settings.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/features/prayer-times/hooks/use-adhan-settings.ts apps/web/features/prayer-times/hooks/use-adhan-settings.test.tsx
git commit -m "[AhmedMuhammedElsaid][wip]: useAdhanSettings localStorage hook

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: Adhan audio player component

**Files:**
- Create: `apps/web/features/prayer-times/components/adhan-player.tsx`
- Create (placeholder): `apps/web/public/audio/.gitkeep`

Note: real `adhan.mp3` / `adhan-fajr.mp3` are maintainer-supplied. This task wires the paths; playback is verified in Task 9.

- [ ] **Step 1: Write the component**

Create `apps/web/features/prayer-times/components/adhan-player.tsx`:

```typescript
"use client";

import { forwardRef, useImperativeHandle, useRef } from "react";

import type { AdhanPrayerKey } from "@repo/api/schemas/prayer-times";

const REGULAR_SRC = "/audio/adhan.mp3";
const FAJR_SRC = "/audio/adhan-fajr.mp3";

export type AdhanPlayerHandle = {
  // Play the adhan for `key` at the given volume (0..1). Returns the audio
  // element's play() promise so callers can detect autoplay-block rejection.
  play: (key: AdhanPrayerKey, volume: number) => Promise<void>;
  // Prime both elements during a user gesture so later timed playback is
  // allowed by the browser autoplay policy (load() counts as the gesture).
  unlock: () => void;
};

// Two <audio> elements (regular + Fajr) kept mounted; Fajr has the extra
// "as-salatu khayrun min an-nawm" line so it must be a separate recording.
export const AdhanPlayer = forwardRef<AdhanPlayerHandle>(function AdhanPlayer(
  _props,
  ref,
) {
  const regularRef = useRef<HTMLAudioElement>(null);
  const fajrRef = useRef<HTMLAudioElement>(null);

  useImperativeHandle(ref, () => ({
    play: async (key, volume) => {
      const el = key === "fajr" ? fajrRef.current : regularRef.current;
      if (!el) return;
      el.volume = Math.min(1, Math.max(0, volume));
      el.currentTime = 0;
      await el.play();
    },
    unlock: () => {
      for (const el of [regularRef.current, fajrRef.current]) {
        // load() during a user gesture marks the element as user-activated
        // without making sound, so the scheduled play() later won't be blocked.
        el?.load();
      }
    },
  }));

  return (
    <>
      <audio ref={regularRef} src={REGULAR_SRC} preload="none" hidden />
      <audio ref={fajrRef} src={FAJR_SRC} preload="none" hidden />
    </>
  );
});
```

- [ ] **Step 2: Add the public/audio folder placeholder**

Create `apps/web/public/audio/.gitkeep` (empty file) so the directory exists in git before the recordings are added.

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter web exec tsc --noEmit`
Expected: PASS (no errors).

- [ ] **Step 4: Commit**

```bash
git add apps/web/features/prayer-times/components/adhan-player.tsx apps/web/public/audio/.gitkeep
git commit -m "[AhmedMuhammedElsaid][wip]: AdhanPlayer audio element wrapper

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: Foreground scheduler hook

**Files:**
- Create: `apps/web/features/prayer-times/hooks/use-adhan-scheduler.ts`

This hook is timer/DOM-heavy; it's covered by manual verification (Task 9) plus the pure logic already tested in Task 2. No unit test (timers + audio side effects are integration concerns).

- [ ] **Step 1: Write the implementation**

Create `apps/web/features/prayer-times/hooks/use-adhan-scheduler.ts`:

```typescript
"use client";

import { useEffect, useRef } from "react";

import type { AdhanSettings } from "@repo/api/schemas/prayer-times";
import type { PrayerLocation, PrayerPreferences } from "@repo/api/schemas/prayer-times";
import { computePrayerTimes } from "@repo/api/services/prayer-times";

import { type AdhanEvent, nextAdhanEvent } from "../lib/adhan-schedule";

const MAX_TIMEOUT = 2_147_483_647; // setTimeout 32-bit ceiling (~24.8 days)

// Arms a single setTimeout to the next enabled adhan event. On fire it invokes
// onFire(event), then re-arms. Re-runs whenever settings/location/prefs change.
// Cross-day rollover: when no event remains today, it sleeps to just after
// midnight and recomputes.
export function useAdhanScheduler(input: {
  settings: AdhanSettings;
  location: PrayerLocation;
  prefs: PrayerPreferences;
  enabled: boolean; // gate (e.g. only after hydration)
  onFire: (event: AdhanEvent) => void;
}) {
  const onFireRef = useRef(input.onFire);
  onFireRef.current = input.onFire;

  const { settings, location, prefs, enabled } = input;

  useEffect(() => {
    if (!enabled || !settings.enabled) return;

    let timer: ReturnType<typeof setTimeout> | undefined;

    const arm = () => {
      const now = new Date();
      const day = computePrayerTimes({
        lat: location.lat,
        lng: location.lng,
        date: now,
        method: prefs.method,
        madhab: prefs.madhab,
      });
      const event = nextAdhanEvent(day.instants, settings, now);

      if (!event) {
        // Nothing left today — wake just after midnight and recompute.
        const tomorrow = new Date(now);
        tomorrow.setHours(24, 0, 30, 0);
        const delay = Math.min(MAX_TIMEOUT, tomorrow.getTime() - now.getTime());
        timer = setTimeout(arm, Math.max(1_000, delay));
        return;
      }

      const delay = Math.min(MAX_TIMEOUT, event.time.getTime() - now.getTime());
      timer = setTimeout(() => {
        onFireRef.current(event);
        // Re-arm a second later so we don't refire the same instant.
        timer = setTimeout(arm, 1_000);
      }, Math.max(0, delay));
    };

    arm();
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [
    enabled,
    settings,
    location.lat,
    location.lng,
    prefs.method,
    prefs.madhab,
  ]);
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter web exec tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/web/features/prayer-times/hooks/use-adhan-scheduler.ts
git commit -m "[AhmedMuhammedElsaid][wip]: foreground adhan scheduler hook

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 6: Background notifications (Notification Triggers)

**Files:**
- Create: `apps/web/features/prayer-times/lib/adhan-notifications.ts`

- [ ] **Step 1: Write the implementation**

Create `apps/web/features/prayer-times/lib/adhan-notifications.ts`:

```typescript
import type { AdhanSettings } from "@repo/api/schemas/prayer-times";
import type { PrayerInstant } from "@repo/api/services/prayer-times";

import { nextAdhanEvent } from "./adhan-schedule";

const TAG_PREFIX = "nour-adhan-";

// `showTrigger` / TimestampTrigger are experimental (Chromium-only). Feature-
// detect so iOS/Firefox degrade silently to foreground-only (Layer A).
function triggersSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "Notification" in window &&
    "showTrigger" in Notification.prototype
  );
}

declare global {
  // Minimal ambient decls for the experimental API (not in lib.dom yet).
  interface Window {
    TimestampTrigger?: new (timestamp: number) => unknown;
  }
}

export async function requestAdhanPermission(): Promise<boolean> {
  if (typeof Notification === "undefined") return false;
  if (Notification.permission === "granted") return true;
  const result = await Notification.requestPermission();
  return result === "granted";
}

// Schedule today's remaining enabled adhans as triggered notifications.
// Clears previously scheduled Nour adhan notifications first (idempotent).
// No-op (resolves) where triggers are unsupported or permission missing.
export async function scheduleAdhanNotifications(
  instants: PrayerInstant[],
  settings: AdhanSettings,
  labelFor: (key: string) => string,
): Promise<void> {
  if (!triggersSupported()) return;
  if (typeof Notification === "undefined" || Notification.permission !== "granted") {
    return;
  }
  const reg = await navigator.serviceWorker?.ready;
  if (!reg) return;

  // Clear stale scheduled adhan notifications.
  const existing = await reg.getNotifications({ includeTriggered: true } as never);
  for (const n of existing) {
    if (n.tag?.startsWith(TAG_PREFIX)) n.close();
  }

  // Walk forward through today's enabled events, scheduling each.
  const now = new Date();
  let cursor = now;
  // Cap to remaining prayers in the day (max 5).
  for (let i = 0; i < 5; i++) {
    const event = nextAdhanEvent(instants, settings, cursor);
    if (!event) break;
    const TimestampTrigger = window.TimestampTrigger;
    if (!TimestampTrigger) break;
    await reg.showNotification(labelFor(event.key), {
      tag: `${TAG_PREFIX}${event.key}`,
      body: labelFor("adhanBody"),
      icon: "/android-chrome-192x192.png",
      badge: "/favicon-32x32.png",
      data: { adhanKey: event.key },
      silent: false,
      // @ts-expect-error showTrigger is experimental, not in lib.dom types.
      showTrigger: new TimestampTrigger(event.time.getTime()),
    });
    cursor = new Date(event.time.getTime() + 1_000);
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter web exec tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/web/features/prayer-times/lib/adhan-notifications.ts
git commit -m "[AhmedMuhammedElsaid][wip]: background adhan notification scheduling

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 7: Adhan controller island + mount in layout

**Files:**
- Create: `apps/web/features/prayer-times/components/adhan-controller.tsx`
- Modify: `apps/web/app/[locale]/layout.tsx`

- [ ] **Step 1: Write the controller**

Create `apps/web/features/prayer-times/components/adhan-controller.tsx`:

```typescript
"use client";

import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";

import {
  ADHAN_PRAYER_KEYS,
  type AdhanPrayerKey,
} from "@repo/api/schemas/prayer-times";
import { computePrayerTimes } from "@repo/api/services/prayer-times";

import { usePrayerSettings } from "../hooks/use-prayer-settings";
import { useAdhanSettings } from "../hooks/use-adhan-settings";
import { useAdhanScheduler } from "../hooks/use-adhan-scheduler";
import { scheduleAdhanNotifications } from "../lib/adhan-notifications";
import { AdhanPlayer, type AdhanPlayerHandle } from "./adhan-player";

function isAdhanKey(value: unknown): value is AdhanPrayerKey {
  return typeof value === "string" && (ADHAN_PRAYER_KEYS as readonly string[]).includes(value);
}

// Headless island mounted site-wide: drives Layer A (foreground autoplay) and
// re-schedules Layer B (background notifications) whenever settings change.
export function AdhanController() {
  const t = useTranslations("prayer");
  const player = useRef<AdhanPlayerHandle>(null);
  const { location, prefs, hydrated: prefsHydrated } = usePrayerSettings();
  const { settings, hydrated: adhanHydrated } = useAdhanSettings();
  const ready = prefsHydrated && adhanHydrated;

  // Layer A — foreground autoplay.
  useAdhanScheduler({
    settings,
    location,
    prefs,
    enabled: ready,
    onFire: (event) => {
      player.current?.play(event.key, settings.volume).catch(() => {
        // Autoplay blocked (tab never interacted with) — silent; Layer B
        // notification still fires where supported.
      });
    },
  });

  // Layer B — (re)schedule background notifications on settings/location change.
  useEffect(() => {
    if (!ready || !settings.enabled) return;
    const day = computePrayerTimes({
      lat: location.lat,
      lng: location.lng,
      date: new Date(),
      method: prefs.method,
      madhab: prefs.madhab,
    });
    void scheduleAdhanNotifications(day.instants, settings, (k) => t(k));
  }, [ready, settings, location.lat, location.lng, prefs.method, prefs.madhab, t]);

  // Notification click → SW postMessage → play in-page.
  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.serviceWorker) return;
    const handler = (e: MessageEvent) => {
      const data = e.data as { type?: string; adhanKey?: unknown } | null;
      if (data?.type === "adhan:play" && isAdhanKey(data.adhanKey)) {
        player.current?.play(data.adhanKey, settings.volume).catch(() => {});
      }
    };
    navigator.serviceWorker.addEventListener("message", handler);
    return () => navigator.serviceWorker.removeEventListener("message", handler);
  }, [settings.volume]);

  return <AdhanPlayer ref={player} />;
}
```

- [ ] **Step 2: Mount it in the locale layout**

In `apps/web/app/[locale]/layout.tsx`, add the import near the other feature imports (after line 23):

```typescript
import { AdhanController } from "@/features/prayer-times/components/adhan-controller";
```

Then add the component inside `<LocaleAlternatesProvider>`, right after `<ServiceWorkerRegister />` (line 149):

```tsx
              <ServiceWorkerRegister />
              <AdhanController />
```

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter web exec tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/web/features/prayer-times/components/adhan-controller.tsx apps/web/app/[locale]/layout.tsx
git commit -m "[AhmedMuhammedElsaid][wip]: AdhanController island mounted site-wide

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 8: Settings UI + i18n + mount in prayer page

**Files:**
- Create: `apps/web/features/prayer-times/components/adhan-settings.tsx`
- Test: `apps/web/features/prayer-times/components/adhan-settings.test.tsx`
- Modify: `apps/web/messages/ar.json`, `apps/web/messages/en.json`
- Modify: `apps/web/features/prayer-times/components/prayer-page.tsx`

- [ ] **Step 1: Add i18n strings**

In `apps/web/messages/en.json`, inside the `"prayer"` object, add:

```json
"adhan": {
  "title": "Adhan (call to prayer)",
  "enable": "Play adhan at prayer times",
  "perPrayer": "Which prayers",
  "volume": "Volume",
  "background": "Enable background notifications",
  "backgroundUnsupported": "Background notifications aren't supported in this browser. The adhan still plays while Nour is open.",
  "autoplayHint": "Keep a Nour tab open. The adhan plays automatically once you've interacted with the page.",
  "adhanBody": "It's time for prayer."
}
```

In `apps/web/messages/ar.json`, inside the `"prayer"` object, add:

```json
"adhan": {
  "title": "الأذان",
  "enable": "تشغيل الأذان عند أوقات الصلاة",
  "perPrayer": "الصلوات",
  "volume": "مستوى الصوت",
  "background": "تفعيل الإشعارات في الخلفية",
  "backgroundUnsupported": "الإشعارات في الخلفية غير مدعومة في هذا المتصفح. يعمل الأذان أثناء فتح نور.",
  "autoplayHint": "أبقِ صفحة نور مفتوحة. يعمل الأذان تلقائيًا بعد تفاعلك مع الصفحة.",
  "adhanBody": "حان وقت الصلاة."
}
```

- [ ] **Step 2: Write the failing test**

Create `apps/web/features/prayer-times/components/adhan-settings.test.tsx`:

```typescript
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it } from "vitest";

import en from "../../../messages/en.json";
import { AdhanSettings } from "./adhan-settings";

function renderUI() {
  return render(
    <NextIntlClientProvider locale="en" messages={en}>
      <AdhanSettings />
    </NextIntlClientProvider>,
  );
}

describe("AdhanSettings", () => {
  beforeEach(() => localStorage.clear());

  it("toggles the master switch and persists", async () => {
    const user = userEvent.setup();
    renderUI();
    const toggle = await screen.findByLabelText(en.prayer.adhan.enable);
    expect(toggle).not.toBeChecked();
    await user.click(toggle);
    expect(toggle).toBeChecked();
    expect(JSON.parse(localStorage.getItem("nour.prayer.adhan")!).enabled).toBe(true);
  });

  it("reveals per-prayer toggles once enabled", async () => {
    const user = userEvent.setup();
    renderUI();
    await user.click(await screen.findByLabelText(en.prayer.adhan.enable));
    expect(screen.getByLabelText(en.prayer.fajr)).toBeChecked();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm --filter web test -- adhan-settings.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 4: Write the component**

Create `apps/web/features/prayer-times/components/adhan-settings.tsx`:

```typescript
"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import { ADHAN_PRAYER_KEYS } from "@repo/api/schemas/prayer-times";

import { useAdhanSettings } from "../hooks/use-adhan-settings";
import { requestAdhanPermission } from "../lib/adhan-notifications";

export function AdhanSettings() {
  const t = useTranslations("prayer");
  const { settings, hydrated, setEnabled, setPrayer, setVolume } = useAdhanSettings();
  const [canBackground, setCanBackground] = useState(false);

  useEffect(() => {
    setCanBackground(
      typeof window !== "undefined" &&
        "Notification" in window &&
        "showTrigger" in Notification.prototype,
    );
  }, []);

  if (!hydrated) return null;

  return (
    <div className="space-y-4">
      <label className="flex items-center justify-between gap-3">
        <span className="text-sm text-text">{t("adhan.enable")}</span>
        <input
          type="checkbox"
          checked={settings.enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          aria-label={t("adhan.enable")}
          className="size-4 accent-[var(--color-primary)]"
        />
      </label>

      {settings.enabled ? (
        <>
          <p className="text-xs text-text-2">{t("adhan.autoplayHint")}</p>

          <fieldset className="space-y-2">
            <legend className="mb-1 text-xs uppercase tracking-[0.06em] text-text-2">
              {t("adhan.perPrayer")}
            </legend>
            {ADHAN_PRAYER_KEYS.map((key) => (
              <label key={key} className="flex items-center justify-between gap-3">
                <span className="text-sm text-text">{t(key)}</span>
                <input
                  type="checkbox"
                  checked={settings.perPrayer[key]}
                  onChange={(e) => setPrayer(key, e.target.checked)}
                  aria-label={t(key)}
                  className="size-4 accent-[var(--color-primary)]"
                />
              </label>
            ))}
          </fieldset>

          <label className="block">
            <span className="mb-1.5 block text-xs uppercase tracking-[0.06em] text-text-2">
              {t("adhan.volume")}
            </span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={settings.volume}
              onChange={(e) => setVolume(Number(e.target.value))}
              aria-label={t("adhan.volume")}
              className="w-full accent-[var(--color-primary)]"
            />
          </label>

          {canBackground ? (
            <button
              type="button"
              onClick={() => void requestAdhanPermission()}
              className="w-full rounded-md border border-border bg-surface-2 px-3 py-2.5 text-sm text-text hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {t("adhan.background")}
            </button>
          ) : (
            <p className="text-xs text-text-2">{t("adhan.backgroundUnsupported")}</p>
          )}
        </>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter web test -- adhan-settings.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 6: Mount in the prayer page**

In `apps/web/features/prayer-times/components/prayer-page.tsx`, add the import after line 11:

```typescript
import { AdhanSettings } from "@/features/prayer-times/components/adhan-settings";
```

Then add a new card after the `calculation` card (after line 78, inside the `space-y-4` column, before the `changeCity` card on line 79):

```tsx
          <div className="rounded-lg border border-border bg-surface p-4">
            <h2 className="mb-3 font-display text-base text-text">{t("adhan.title")}</h2>
            <AdhanSettings />
          </div>
```

- [ ] **Step 7: Run the full web suite + typecheck**

Run: `pnpm --filter web test`
Expected: PASS (existing 105 + new tests).
Run: `pnpm --filter web exec tsc --noEmit`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/web/features/prayer-times/components/adhan-settings.tsx apps/web/features/prayer-times/components/adhan-settings.test.tsx apps/web/features/prayer-times/components/prayer-page.tsx apps/web/messages/ar.json apps/web/messages/en.json
git commit -m "[AhmedMuhammedElsaid][wip]: adhan settings UI + i18n on prayer page

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 9: Service worker — precache audio + notification click

**Files:**
- Modify: `apps/web/public/sw.js`

- [ ] **Step 1: Add audio to PRECACHE and bump the version**

In `apps/web/public/sw.js`, change line 23:

```javascript
const VERSION = "v3";
```

And change the `PRECACHE` array (line 31) to include the adhan audio so it plays offline:

```javascript
const PRECACHE = [
  OFFLINE_URL,
  "/icons/icon.svg",
  "/manifest.webmanifest",
  "/audio/adhan.mp3",
  "/audio/adhan-fajr.mp3",
];
```

- [ ] **Step 2: Add the notificationclick handler**

Append to the end of `apps/web/public/sw.js`:

```javascript
/*
 * Adhan notifications (Layer B). When the user clicks a triggered adhan
 * notification, focus an existing Nour tab (or open one) and tell it to play
 * the adhan in-page. The audio itself is precached above so it works offline.
 */
self.addEventListener("notificationclick", (event) => {
  const notification = event.notification;
  if (!notification.tag || !notification.tag.startsWith("nour-adhan-")) return;
  notification.close();
  const adhanKey = notification.data && notification.data.adhanKey;

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        const target = clients.find((c) => "focus" in c);
        if (target) {
          target.postMessage({ type: "adhan:play", adhanKey });
          return target.focus();
        }
        // No open tab — open the prayer-times page; the controller mounted in
        // the layout will not auto-play without a gesture, but the page opens.
        return self.clients.openWindow("/");
      }),
  );
});
```

- [ ] **Step 3: Verify the file parses**

Run: `node --check apps/web/public/sw.js`
Expected: no output (valid JS).

- [ ] **Step 4: Commit**

```bash
git add apps/web/public/sw.js
git commit -m "[AhmedMuhammedElsaid][wip]: sw precache adhan audio + notificationclick

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 10: Build, manual verification, docs

**Files:**
- Modify: `APP_CONTEXT.md` (append wave row)

- [ ] **Step 1: Drop in the audio recordings**

Place the two real recordings at `apps/web/public/audio/adhan.mp3` and `apps/web/public/audio/adhan-fajr.mp3`. If not yet available, note this in the PR — playback will 404 until they're added, but all code paths are wired.

- [ ] **Step 2: Production build**

Run: `pnpm --filter web build`
Expected: build succeeds; no new type errors.

- [ ] **Step 3: Manual verification checklist (record results in the PR)**

  - On `/prayer-times`, the "Adhan" card appears; master toggle off by default.
  - Enabling reveals per-prayer checkboxes (all checked), volume slider.
  - Temporarily set a device prayer time ~1 min ahead (or edit method/location so the next prayer is imminent), keep the tab open, click somewhere first (autoplay gesture) → the adhan plays at the time; Fajr plays the Fajr recording.
  - Disabling a prayer skips its adhan.
  - Chrome desktop/Android: click "Enable background notifications", grant permission → with the tab closed, the notification fires at prayer time; clicking it opens/focuses Nour and plays the adhan.
  - iOS/Firefox: the "background notifications" button is replaced by the unsupported note; foreground adhan still works.
  - RTL (`/ar`): the Adhan card and controls align correctly.

- [ ] **Step 4: Update APP_CONTEXT.md**

Append a row to the "Completed waves" table in `APP_CONTEXT.md`:

```markdown
| Azan Audio + Notifications ✅ | HEAD (2026-06-07) | Plays the adhan at each prayer time. Spec/plan in `docs/superpowers/{specs,plans}/2026-06-07-azan-audio-notifications.*`. Schema `adhanSettingsSchema` + `DEFAULT_ADHAN_SETTINGS` + `ADHAN_PRAYER_KEYS` added to `schemas/prayer-times.ts` (device-local; no DB/auth). **apps/web `features/prayer-times/`**: pure `lib/adhan-schedule.ts` (`nextAdhanEvent`), `hooks/use-adhan-settings.ts` (localStorage `nour.prayer.adhan`), `hooks/use-adhan-scheduler.ts` (foreground setTimeout engine + midnight rollover), `lib/adhan-notifications.ts` (Layer B: Notification Triggers `showTrigger`, feature-detected — Chrome/Android only), `components/adhan-player.tsx` (two bundled `<audio>`: regular + Fajr; `unlock()` for autoplay gesture), `components/adhan-controller.tsx` (headless island, mounted in `[locale]/layout.tsx` after `ServiceWorkerRegister`), `components/adhan-settings.tsx` (master toggle + per-prayer + volume + permission button; mounted on `/prayer-times`). Audio assets `public/audio/adhan.mp3` + `adhan-fajr.mp3` (maintainer-supplied). `sw.js` bumped `v2→v3`, precaches both audio files, `notificationclick` focuses/opens a tab + postMessage `adhan:play`. i18n `prayer.adhan.*` (ar/en). **Two layers**: A=foreground (all browsers, needs page interaction for autoplay), B=background best-effort (degrades silently on iOS/Firefox). **Deferred**: Web Push server, R2-uploaded/multiple muezzin recordings, pre-adhan reminder offsets. Tests: api +3 · web +10.
```

- [ ] **Step 5: Commit**

```bash
git add APP_CONTEXT.md apps/web/public/audio/adhan.mp3 apps/web/public/audio/adhan-fajr.mp3
git commit -m "[AhmedMuhammedElsaid][docs]: record azan audio wave in APP_CONTEXT

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Self-Review Notes

- **Spec coverage:** Layer A (Tasks 4,5,7), Layer B (Tasks 6,7,9), two audio files (Tasks 4,9,10), master + per-prayer + volume settings (Tasks 1,3,8), autoplay-gesture handling (Task 4 `unlock`/Task 7 catch), feature-detection degradation (Tasks 6,8), offline precache (Task 9), tests (Tasks 1,2,3,8), i18n (Task 8) — all covered.
- **Type consistency:** `AdhanSettings`, `AdhanPrayerKey`, `ADHAN_PRAYER_KEYS`, `AdhanEvent`, `nextAdhanEvent`, `AdhanPlayerHandle.play/unlock`, `useAdhanSettings` API (`setEnabled/setPrayer/setVolume`) used identically across tasks.
- **CSP:** `media-src 'self'` (lib/csp.ts:27) already covers same-origin bundled audio — no CSP change needed.
- **Gotcha respected:** `adhanSettingsSchema` ships on the existing `./schemas/prayer-times` export subpath — no new `package.json` `exports` entry required.
