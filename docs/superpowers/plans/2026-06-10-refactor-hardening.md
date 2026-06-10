# Refactor & Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pay down the highest-risk structural debt found in the 2026-06-10 whole-app review: cache the public read path (biggest perf lever without touching the nonce CSP), make device-local storage shape-safe, close the unvalidated-Atlas-import hole, retire the dangerous transitional migrations, wire error reporting, and land small community-standard housekeeping.

**Architecture:** No layer boundaries change. We add a *data-cache* tier between web RSC pages and `@repo/api` services (`unstable_cache` + the existing cache tags), with a secret-gated webhook so admin mutations invalidate the **web** deployment's cache (`revalidateTag` only reaches the app it runs in — today that's admin, which has no cached readers). Everything else is consolidation: one device-storage helper, one import entry point, one invalidation helper.

**Tech Stack:** Next 16 (`unstable_cache`, `revalidateTag`), Zod, Mongoose/`@repo/api` repos, `@sentry/nextjs`, Vitest + RTL.

**Model routing (CLAUDE.md §15):** Task 1–4 Opus→Sonnet (first instance of the cache tier locks the pattern — do Task 1 and 4 on Opus, 2–3 on Sonnet). Phase 2 Task 6–7 Sonnet, Task 8 Haiku (mechanical clones). Phase 3 Sonnet. Phase 4 Sonnet. Phase 5 Opus (security-adjacent: CSP edit). Phase 6 Haiku.

---

## Ground rules for the executor

- Read `APP_CONTEXT.md` first (repo mandate). CLAUDE.md §5 boundaries are hard rules.
- TDD: every behavioral change lands with its failing test first.
- One commit per task, message format `[AhmedMuhammedElsaid][refactor|feat|chore]: …` with the `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>` trailer. In the Bash tool use repeated `-m` flags, never here-strings.
- Before pushing: full `pnpm turbo run lint typecheck test build` (all packages, not `--filter`).
- `docs/` is gitignored but plan/ADR files are tracked — use `git add -f` for new files under `docs/`.
- Update `APP_CONTEXT.md` in the same commit as the code it describes.

## Deliberately OUT of scope (do not "improve" these)

- **CSP stays nonce-based and pages stay `force-dynamic`.** The perf win comes from caching the *data* layer, not the HTML. Revisiting CSP for ISR is a separate ADR-level decision.
- **No service-worker test harness** this wave; `sw.js` is verified manually in DevTools (documented limitation).
- **No state-management library, no new UI deps.**
- **R2 Quran audio mirroring** — already planned in `docs/superpowers/plans/2026-06-07-quran-deferred-phases.md` (Part B3).
- **Mobile Sentry (sentry-expo)** — follow-up after web Sentry proves out.

---

# Phase 1 — Public data-cache tier + cross-app invalidation

**Why critical:** every public request hits Atlas because pages are `force-dynamic`. Content changes a few times a week; reads should come from Next's data cache and be invalidated by tag. The trap: `revalidateTag` in `packages/api` services runs inside the **admin** deployment — it cannot invalidate the **web** deployment's cache. So invalidation must also cross deployments via webhook. A 5-minute `revalidate` TTL on every cache entry is the self-healing fallback if the webhook ever fails.

### Task 1: `invalidate()` helper (tag revalidation + web webhook, one call site)

**Files:**
- Create: `packages/api/src/cache/invalidate.ts`
- Create: `packages/api/src/cache/invalidate.test.ts`
- Modify: `packages/config/src/env.ts` (two optional vars)
- Modify: `packages/api/package.json` (exports entry `./cache/invalidate` — every new subpath needs one or imports fail with `ERR_PACKAGE_PATH_NOT_EXPORTED`)

- [ ] **Step 1: Add the env vars** in `packages/config/src/env.ts`, inside `envSchema` after `NEXT_PUBLIC_ADMIN_URL`:

```ts
  // Cross-deployment cache invalidation (Phase: refactor-hardening).
  // Admin calls web's /api/revalidate so web's data cache drops mutated tags.
  // Optional: dev sessions and the web app itself work without them.
  WEB_REVALIDATE_URL: z.string().url().optional(),
  REVALIDATE_SECRET: z.string().min(16).optional(),
```

- [ ] **Step 2: Write the failing test** `packages/api/src/cache/invalidate.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const revalidateTag = vi.fn();
vi.mock("next/cache", () => ({ revalidateTag }));

const envState: { WEB_REVALIDATE_URL?: string; REVALIDATE_SECRET?: string } = {};
vi.mock("@repo/config/env", () => ({ env: envState }));

import { invalidate } from "./invalidate";

describe("invalidate", () => {
  beforeEach(() => {
    revalidateTag.mockReset();
    delete envState.WEB_REVALIDATE_URL;
    delete envState.REVALIDATE_SECRET;
    vi.unstubAllGlobals();
  });

  it("revalidates every tag locally", async () => {
    await invalidate(["playlists:home", "playlist:abc"]);
    expect(revalidateTag).toHaveBeenCalledWith("playlists:home", "default");
    expect(revalidateTag).toHaveBeenCalledWith("playlist:abc", "default");
  });

  it("POSTs the tags to the web revalidate webhook when configured", async () => {
    envState.WEB_REVALIDATE_URL = "https://web.example/api/revalidate";
    envState.REVALIDATE_SECRET = "0123456789abcdef";
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    await invalidate(["playlists:home"]);

    expect(fetchMock).toHaveBeenCalledWith(
      "https://web.example/api/revalidate",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "x-revalidate-secret": "0123456789abcdef",
        }),
        body: JSON.stringify({ tags: ["playlists:home"] }),
      }),
    );
  });

  it("swallows webhook failures (cache TTL self-heals)", async () => {
    envState.WEB_REVALIDATE_URL = "https://web.example/api/revalidate";
    envState.REVALIDATE_SECRET = "0123456789abcdef";
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("down")));

    await expect(invalidate(["playlists:home"])).resolves.toBeUndefined();
  });

  it("skips the webhook when env is not configured", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await invalidate(["playlists:home"]);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Run it, confirm it fails** — `pnpm --filter @repo/api test -- invalidate` → FAIL (module not found).

- [ ] **Step 4: Implement** `packages/api/src/cache/invalidate.ts`:

```ts
import { revalidateTag } from "next/cache";

import { env } from "@repo/config/env";

/*
 * One call site for cache invalidation after a public-affecting mutation.
 *
 * revalidateTag only invalidates the deployment it runs in. Mutations run in
 * the ADMIN app, but the cached readers live in the WEB app — so we also POST
 * the tags to web's /api/revalidate webhook. The webhook is best-effort: every
 * web cache entry carries `revalidate: 300`, so a missed ping self-heals in
 * ≤5 minutes.
 */
export async function invalidate(tags: string[]): Promise<void> {
  for (const tag of tags) {
    revalidateTag(tag, "default");
  }

  const url = env.WEB_REVALIDATE_URL;
  const secret = env.REVALIDATE_SECRET;
  if (!url || !secret) return;

  try {
    await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-revalidate-secret": secret,
      },
      body: JSON.stringify({ tags }),
    });
  } catch {
    // Best-effort by design — the TTL fallback covers a missed webhook.
  }
}
```

- [ ] **Step 5: Add the exports entry** in `packages/api/package.json` `exports` (mirror the `./cache/tags` line): `"./cache/invalidate": "./src/cache/invalidate.ts"`.

- [ ] **Step 6: Run** `pnpm --filter @repo/api test` → all green. **Commit** `[AhmedMuhammedElsaid][refactor]: one invalidate() call site - local revalidateTag plus best-effort web webhook`.

### Task 2: Route all service mutations through `invalidate()`

**Files:**
- Modify: `packages/api/src/services/playlist.service.ts` (5 mutation methods, lines ~210–261)
- Modify: `packages/api/src/services/category.service.ts`
- Modify: `packages/api/src/services/track.service.ts`
- Modify: `packages/api/src/services/azkar.service.ts`
- Modify: their `*.test.ts` siblings (the suites mock `next/cache`; they now also mock `../cache/invalidate`)

- [ ] **Step 1: In each service**, replace the `import { revalidateTag } from "next/cache"` + per-line `revalidateTag(X, "default")` pairs with `import { invalidate } from "../cache/invalidate"` and a single awaited call. Pattern (publish example from `playlist.service.ts`):

```ts
// before
revalidateTag(PLAYLISTS_HOME, "default");
revalidateTag(playlistTag(lean._id.toString()), "default");

// after
await invalidate([PLAYLISTS_HOME, playlistTag(lean._id.toString())]);
```

Apply to every mutation that currently calls `revalidateTag` in the four services. Do NOT touch read methods, and keep the "no revalidate on draft create" comment/behavior.

- [ ] **Step 2: Update the service tests.** Each suite currently asserts `revalidateTag` calls. Replace the mock + assertions:

```ts
vi.mock("../cache/invalidate", () => ({ invalidate: vi.fn() }));
// …
expect(invalidate).toHaveBeenCalledWith([PLAYLISTS_HOME, `playlist:${id}`]);
```

- [ ] **Step 3:** `pnpm --filter @repo/api test` → green. **Commit** `[AhmedMuhammedElsaid][refactor]: services invalidate caches through the shared helper`.

### Task 3: Web revalidate webhook route

**Files:**
- Create: `apps/web/app/api/revalidate/route.ts`
- Create: `apps/web/app/api/revalidate/route.test.ts`

- [ ] **Step 1: Failing test** `apps/web/app/api/revalidate/route.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const revalidateTag = vi.fn();
vi.mock("next/cache", () => ({ revalidateTag }));

process.env.REVALIDATE_SECRET = "0123456789abcdef";
const { POST } = await import("./route");

function req(body: unknown, secret?: string) {
  return new Request("http://localhost/api/revalidate", {
    method: "POST",
    headers: secret ? { "x-revalidate-secret": secret } : {},
    body: JSON.stringify(body),
  });
}

describe("POST /api/revalidate", () => {
  beforeEach(() => revalidateTag.mockReset());

  it("rejects a missing/wrong secret with 401", async () => {
    const res = await POST(req({ tags: ["playlists:home"] }, "wrong"));
    expect(res.status).toBe(401);
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it("revalidates each tag and reports them back", async () => {
    const res = await POST(
      req({ tags: ["playlists:home", "categories"] }, "0123456789abcdef"),
    );
    expect(res.status).toBe(200);
    expect(revalidateTag).toHaveBeenCalledWith("playlists:home", "default");
    expect(revalidateTag).toHaveBeenCalledWith("categories", "default");
  });

  it("rejects a malformed body with 400", async () => {
    const res = await POST(req({ tags: "not-an-array" }, "0123456789abcdef"));
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run** `pnpm --filter web test -- revalidate` → FAIL. **Implement** `apps/web/app/api/revalidate/route.ts`:

```ts
import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";

// Secret-gated, called by the admin deployment via invalidate() in
// @repo/api. Reads process.env directly: this route must work during
// `next build`'s collection step where the env barrel would throw.
const bodySchema = z.object({ tags: z.array(z.string().min(1)).max(20) });

export async function POST(request: Request): Promise<NextResponse> {
  const secret = process.env.REVALIDATE_SECRET;
  const given = request.headers.get("x-revalidate-secret");
  if (!secret || given !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  for (const tag of parsed.data.tags) {
    revalidateTag(tag, "default");
  }
  return NextResponse.json({ revalidated: parsed.data.tags });
}
```

- [ ] **Step 3:** Tests green. **Commit** `[AhmedMuhammedElsaid][feat]: secret-gated /api/revalidate webhook so admin can bust web's data cache`.

### Task 4: Cached read wrappers + swap the web call sites

**Files:**
- Create: `apps/web/lib/cached-content.ts`
- Create: `apps/web/lib/cached-content.test.ts`
- Modify: `apps/web/app/[locale]/page.tsx:4-5` (homepage — `getPublishedPlaylists`, `listCategories`)
- Modify: `apps/web/app/[locale]/playlists/[slug]/page.tsx:5,35-37` (detail — `getPlaylistBySlug`, `getTracksWithUrls`, `listCategories`)
- Modify: `apps/web/app/api/v1/playlists/route.ts:1-2` and `apps/web/app/api/v1/categories/route.ts:1` (mobile API reads share the cache)

**Key constraint:** `unstable_cache` JSON-serializes values — `Date` fields come back as strings. The wrappers serialize Dates going in and revive them coming out, so their public signatures stay identical to the services and **no consumer changes beyond the import line**.

- [ ] **Step 1: Failing test** `apps/web/lib/cached-content.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";

// Pass-through: assert the wrapper revives Dates and forwards args.
vi.mock("next/cache", () => ({
  unstable_cache: (fn: (...a: unknown[]) => unknown) => fn,
}));

const playlist = {
  _id: "p1",
  status: "published",
  createdAt: new Date("2026-01-01T00:00:00Z"),
  updatedAt: new Date("2026-01-02T00:00:00Z"),
};
const getPublishedPlaylists = vi.fn().mockResolvedValue([playlist]);
vi.mock("@repo/api/services/playlist", () => ({
  getPublishedPlaylists: (...a: unknown[]) => getPublishedPlaylists(...a),
}));
vi.mock("@repo/api/services/category", () => ({ listCategories: vi.fn().mockResolvedValue([]) }));
vi.mock("@repo/api/services/track", () => ({ getTracksWithUrls: vi.fn().mockResolvedValue([]) }));

const { getCachedPublishedPlaylists } = await import("./cached-content");

describe("cached-content", () => {
  it("forwards the categoryId filter and returns real Date instances", async () => {
    const rows = await getCachedPublishedPlaylists("cat1");
    expect(getPublishedPlaylists).toHaveBeenCalledWith({ categoryId: "cat1" });
    expect(rows[0]!.createdAt).toBeInstanceOf(Date);
    expect(rows[0]!.createdAt.toISOString()).toBe("2026-01-01T00:00:00.000Z");
  });
});
```

- [ ] **Step 2: Implement** `apps/web/lib/cached-content.ts`:

```ts
import { unstable_cache } from "next/cache";

import { PLAYLISTS_HOME, CATEGORIES, playlistTag } from "@repo/api/cache/tags";
import { getPublishedPlaylists, getPlaylistBySlug } from "@repo/api/services/playlist";
import { listCategories } from "@repo/api/services/category";
import { getTracksWithUrls } from "@repo/api/services/track";
import type { Locale } from "@repo/api/schemas/locale";

/*
 * Data-cache tier for the public web app. Pages stay force-dynamic (nonce
 * CSP), but reads resolve from Next's data cache instead of Atlas. Tags match
 * what @repo/api's invalidate() busts; revalidate: 300 is the self-healing
 * fallback for a missed cross-deployment webhook.
 *
 * unstable_cache JSON-serializes entries, so Date fields round-trip as
 * strings. Each wrapper serializes on the way in and revives on the way out —
 * public signatures stay identical to the underlying service.
 */
const TTL = 300;

type Dated<T> = Omit<T, "createdAt" | "updatedAt"> & {
  createdAt: Date;
  updatedAt: Date;
};

function freeze<T extends { createdAt: Date; updatedAt: Date }>(row: T) {
  return {
    ...row,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function revive<T extends { createdAt: string; updatedAt: string }>(
  row: T,
): Dated<T> {
  return {
    ...row,
    createdAt: new Date(row.createdAt),
    updatedAt: new Date(row.updatedAt),
  } as Dated<T>;
}

const cachedPlaylists = unstable_cache(
  async (categoryId?: string) => {
    const rows = await getPublishedPlaylists(
      categoryId ? { categoryId } : undefined,
    );
    return rows.map(freeze);
  },
  ["published-playlists"],
  { tags: [PLAYLISTS_HOME], revalidate: TTL },
);

export async function getCachedPublishedPlaylists(categoryId?: string) {
  return (await cachedPlaylists(categoryId)).map(revive);
}

const cachedCategories = unstable_cache(
  async () => (await listCategories()).map(freeze),
  ["categories"],
  { tags: [CATEGORIES], revalidate: TTL },
);

export async function getCachedCategories() {
  return (await cachedCategories()).map(revive);
}

const cachedPlaylistBySlug = unstable_cache(
  async (locale: Locale, slug: string) => {
    const row = await getPlaylistBySlug(locale, slug).catch(() => null);
    return row ? freeze(row) : null;
  },
  ["playlist-by-slug"],
  { tags: [PLAYLISTS_HOME], revalidate: TTL },
);

export async function getCachedPlaylistBySlug(locale: Locale, slug: string) {
  const row = await cachedPlaylistBySlug(locale, slug);
  return row ? revive(row) : null;
}

const cachedTracks = unstable_cache(
  async (playlistId: string) => {
    const rows = await getTracksWithUrls(playlistId);
    return rows.map(freeze);
  },
  ["tracks-with-urls"],
  { tags: [PLAYLISTS_HOME], revalidate: TTL },
);

export async function getCachedTracksWithUrls(playlistId: string) {
  return (await cachedTracks(playlistId)).map(revive);
}
```

**Note for the executor:** check the actual return types — if `getPlaylistBySlug` throws `AppError.NotFound` (it does), the wrapper converts that to `null` and the page's existing `notFound()` branch must check `null` instead of catching. If `getTracksWithUrls` rows have no `updatedAt`, drop that field from `freeze`/`revive` for tracks (adjust per the `Track` schema in `packages/api/src/schemas/track.ts`). Per-item tags: the detail entries reuse `PLAYLISTS_HOME` because publish/update/delete all bust it; add `playlistTag(id)` keying later only if profiling shows over-invalidation. Run the existing web suite after the swap — the page tests mock the service modules and must now mock `@/lib/cached-content` instead.

- [ ] **Step 3: Swap the call sites.** In each Modify-file, replace the service import with the cached wrapper and rename calls (`getPublishedPlaylists(...)` → `getCachedPublishedPlaylists(categoryId)`, etc.). `app/api/v1/*` routes serve the mobile app — same swap, mobile inherits the cache.

- [ ] **Step 4:** `pnpm --filter web test` green, `pnpm --filter web build` ✓. Manual check in dev: edit a playlist title in admin (running locally with `WEB_REVALIDATE_URL=http://localhost:3000/api/revalidate` and a shared `REVALIDATE_SECRET` in both apps' `.env.local`), reload web home, see the new title.

- [ ] **Step 5:** Add `WEB_REVALIDATE_URL` + `REVALIDATE_SECRET` to `.env.example` with comments; note them in `deploy.md` (admin project gets both, web project gets `REVALIDATE_SECRET`). **Update APP_CONTEXT.md** (new gotcha: "web read path is cached — admin invalidation crosses deployments via /api/revalidate; tags must go through invalidate()"). **Commit** `[AhmedMuhammedElsaid][feat]: cache the public read path with tag invalidation across deployments`.

### Task 5: Extend the cache tier to Adhkar + Quran reads (mechanical clone)

**Files:**
- Modify: `apps/web/lib/cached-content.ts` (add `getCachedPublishedAzkar`, `getCachedSurahList`)
- Modify: `apps/web/app/[locale]/adhkar/page.tsx:4`, `apps/web/app/[locale]/quran/page.tsx:4`

- [ ] **Step 1:** Clone the Task-4 wrapper pattern: `getPublishedAzkar` → tag `ADHKAR`, TTL 300; `listSurahs` → tag `QURAN`, TTL `3600` (immutable data, no webhook needed). Same freeze/revive treatment for any Date fields (check `packages/api/src/schemas/azkar.ts` / `quran.ts`; Quran rows have no Dates — skip revive there).
- [ ] **Step 2:** Swap the two page imports, run web tests + build, **commit** `[AhmedMuhammedElsaid][refactor]: adhkar and quran reads ride the data cache`.

---

# Phase 2 — Shape-safe device storage (web)

**Why:** ~12 `nour.*` localStorage keys are read with hand-rolled `try/JSON.parse/guard` blocks. A future shape change silently breaks returning visitors. One Zod-validated helper, reused everywhere, makes every change safe (invalid/stale data → fallback, never a crash).

### Task 6: `device-store` helper

**Files:**
- Create: `apps/web/lib/device-store.ts`
- Create: `apps/web/lib/device-store.test.ts`

- [ ] **Step 1: Failing test:**

```ts
import { beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";

import { readDeviceStore, writeDeviceStore } from "./device-store";

const schema = z.object({ volume: z.number().min(0).max(1) });
const FALLBACK = { volume: 1 };

describe("device-store", () => {
  beforeEach(() => window.localStorage.clear());

  it("returns the fallback when the key is absent", () => {
    expect(readDeviceStore("nour.test", schema, FALLBACK)).toEqual(FALLBACK);
  });

  it("round-trips a valid value", () => {
    writeDeviceStore("nour.test", { volume: 0.5 });
    expect(readDeviceStore("nour.test", schema, FALLBACK)).toEqual({ volume: 0.5 });
  });

  it("returns the fallback for corrupt JSON and for shape mismatches", () => {
    window.localStorage.setItem("nour.test", "{not json");
    expect(readDeviceStore("nour.test", schema, FALLBACK)).toEqual(FALLBACK);
    window.localStorage.setItem("nour.test", JSON.stringify({ volume: "loud" }));
    expect(readDeviceStore("nour.test", schema, FALLBACK)).toEqual(FALLBACK);
  });

  it("is SSR-safe (no window)", () => {
    // readDeviceStore must not touch localStorage when window is undefined;
    // covered by the typeof window guard — assert it doesn't throw when
    // localStorage access throws (Safari private mode).
    const original = window.localStorage.getItem;
    window.localStorage.getItem = () => {
      throw new Error("denied");
    };
    expect(readDeviceStore("nour.test", schema, FALLBACK)).toEqual(FALLBACK);
    window.localStorage.getItem = original;
  });
});
```

- [ ] **Step 2: Implement** `apps/web/lib/device-store.ts`:

```ts
import type { ZodType } from "zod";

/*
 * The one way to read/write device-local state (nour.* localStorage keys).
 * Zod-validates on read: corrupt JSON, old shapes, and storage failures all
 * degrade to the caller's fallback — a shape change can never crash a
 * returning visitor. SSR-safe: returns the fallback when window is absent.
 */
export function readDeviceStore<T>(
  key: string,
  schema: ZodType<T>,
  fallback: T,
): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = schema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : fallback;
  } catch {
    return fallback;
  }
}

export function writeDeviceStore<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable (private mode/quota) — state stays in-memory */
  }
}
```

- [ ] **Step 3:** Test green. **Commit** `[AhmedMuhammedElsaid][feat]: zod-validated device-store helper for nour.* localStorage keys`.

### Task 7: Migrate the prayer-times hooks to `device-store`

**Files:**
- Modify: `apps/web/features/prayer-times/hooks/use-adhan-settings.ts:14-23`
- Modify: `apps/web/features/prayer-times/hooks/use-azkar-reminder-settings.ts` (same `readSettings` shape)
- Modify: `apps/web/features/prayer-times/hooks/use-prayer-settings.ts` (location + prefs reads)

- [ ] **Step 1:** In `use-adhan-settings.ts`, replace the hand-rolled reader:

```ts
// before (lines 14–23)
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

// after
import { readDeviceStore, writeDeviceStore } from "@/lib/device-store";

function readSettings(): AdhanSettings {
  return readDeviceStore(ADHAN_KEY, adhanSettingsSchema, DEFAULT_ADHAN_SETTINGS);
}
```

and in `persist`, replace the `localStorage.setItem` try/catch with `writeDeviceStore(ADHAN_KEY, next)`.

- [ ] **Step 2:** Apply the identical substitution in `use-azkar-reminder-settings.ts` (schema `azkarReminderSettingsSchema`, default `DEFAULT_AZKAR_REMINDER_SETTINGS`, key `nour.azkar.reminder`) and `use-prayer-settings.ts` (two keys: `nour.prayer.location` with `prayerLocationSchema`/`DEFAULT_LOCATION`, `nour.prayer.prefs` with `prayerPreferencesSchema`/its defaults — all already exported from `@repo/api/schemas/prayer-times`).
- [ ] **Step 3:** `pnpm --filter web test` (the three hooks' existing suites must stay green unchanged — behavior is identical). **Commit** `[AhmedMuhammedElsaid][refactor]: prayer hooks read device state through device-store`.

### Task 8: Migrate the remaining device stores (Haiku-mechanical)

**Files:**
- Modify: `apps/web/features/quran/lib/quran-prefs.ts` (`nour.quran.prefs`)
- Modify: `apps/web/features/quran/lib/quran-progress.ts` (`nour.quran.lastread`, `nour.quran.bookmarks`)
- Modify: `apps/web/features/player/lib/recently-played.ts` (`nour.player.recent`)
- Modify: `apps/web/features/adhkar/lib/adhkar-progress.ts` (`nour.adhkar.progress`)

- [ ] **Step 1:** Each of these files currently hand-validates. For each, declare a local Zod schema matching its existing TypeScript type, then route reads/writes through `readDeviceStore`/`writeDeviceStore`. Example for `quran-prefs.ts` (adjust to the file's actual `QuranPrefs` fields — read the file first):

```ts
import { z } from "zod";
import { readDeviceStore, writeDeviceStore } from "@/lib/device-store";

const quranPrefsSchema = z.object({
  fontScale: z.number().min(0.5).max(3).default(1),
  showTranslation: z.boolean().default(true),
  showWordByWord: z.boolean().default(false),
  translationSlug: z.string().optional(),
  reciterSlug: z.string().optional(),
  layout: z.enum(["list", "mushaf"]).default("list"),
});
export type QuranPrefs = z.infer<typeof quranPrefsSchema>;
const DEFAULT_PREFS: QuranPrefs = quranPrefsSchema.parse({});

export function loadPrefs(): QuranPrefs {
  return readDeviceStore("nour.quran.prefs", quranPrefsSchema, DEFAULT_PREFS);
}
export function savePrefs(prefs: QuranPrefs): void {
  writeDeviceStore("nour.quran.prefs", prefs);
}
```

**Rule:** the Zod schema must accept every shape the current code writes (run the file's existing tests — `quran-progress.test.ts`, `recently-played.test.ts`, `adhkar-progress.test.ts` — they define the contract). Field names/types come from each file's existing exported types; do not invent fields.

- [ ] **Step 2:** Existing tests green, **commit per file** (`[AhmedMuhammedElsaid][refactor]: <store> reads through device-store`).

**Out of this task:** `packages/ui` player-context prefs/positions (would add a Zod dependency to the UI package — leave its already-defensive readers alone) and mobile AsyncStorage (different API).

---

# Phase 3 — Validated content-import pipeline

**Why:** content imported straight into Atlas bypasses Zod and has already produced malformed slugs twice (space-slug 404 + React #418). Imports must go through the same validation as the admin forms.

### Task 9: `scripts/import-content.ts`

**Files:**
- Create: `scripts/import-content.ts`
- Modify: root `package.json` scripts: `"import:content": "tsx --env-file-if-exists=.env.local scripts/import-content.ts"`
- Modify: `packages/api/package.json` exports — confirm `./schemas/playlist`, `./schemas/track`, `./repositories/playlist`, `./repositories/track`, `./utils/slug` entries exist; add any missing one.

**Input format** (`import.json`, one file per batch):

```json
{
  "playlists": [
    {
      "ar": { "title": "مقتطفات للدكتور صابر عادل", "description": "…" },
      "en": { "title": "Shorts Dr Saber Adel", "description": "…" },
      "scholarImage": "/muhmd-bakr.png",
      "categorySlugs": ["lectures"],
      "tracks": [
        { "ar": { "title": "المقطع الأول" }, "en": { "title": "Part one" }, "mediaId": "665f…" }
      ]
    }
  ]
}
```

- [ ] **Step 1: Implement** `scripts/import-content.ts` (no test framework for scripts in this repo — `--dry-run` is the verification path):

```ts
#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { z } from "zod";

import { getDb, disconnectDb } from "@repo/api/db/client";
import { playlistCreateInputSchema } from "@repo/api/schemas/playlist";
import { trackCreateInputSchema } from "@repo/api/schemas/track";
import { createPlaylist as createPlaylistRow } from "@repo/api/repositories/playlist";
import { createTrack as createTrackRow } from "@repo/api/repositories/track";
import { findCategoryBySlug } from "@repo/api/repositories/category";
import { slugify } from "@repo/api/utils/slug";

/*
 * Operator import path that replaces direct Atlas inserts. Everything passes
 * the same Zod schemas the admin forms use, titles are slugified with the
 * canonical slugify (no more space-slugs), and category slugs resolve to _ids.
 * Imported playlists land as DRAFTS — publish from the admin after review.
 *
 * Usage:
 *   pnpm import:content ./import.json --dry-run   # validate + report only
 *   pnpm import:content ./import.json --apply     # write to Atlas
 */
const localeContent = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
});
const importTrack = z.object({ ar: localeContent, en: localeContent, mediaId: z.string().min(1) });
const importPlaylist = z.object({
  ar: localeContent,
  en: localeContent,
  scholarImage: z.string().optional(),
  categorySlugs: z.array(z.string()).default([]),
  tracks: z.array(importTrack).default([]),
});
const importFile = z.object({ playlists: z.array(importPlaylist).min(1) });

async function main(): Promise<void> {
  const { values, positionals } = parseArgs({
    options: {
      "dry-run": { type: "boolean", default: false },
      apply: { type: "boolean", default: false },
    },
    allowPositionals: true,
    strict: true,
  });
  const file = positionals[0];
  if (!file) throw new Error("usage: pnpm import:content <file.json> [--dry-run|--apply]");
  if (values.apply === values["dry-run"]) {
    throw new Error("pass exactly one of --dry-run or --apply");
  }

  const data = importFile.parse(JSON.parse(readFileSync(file, "utf8")));
  await getDb();
  try {
    for (const item of data.playlists) {
      // Resolve category slugs (Arabic slugs allowed) → _ids; fail loudly on a miss.
      const categoryIds: string[] = [];
      for (const slug of item.categorySlugs) {
        const cat =
          (await findCategoryBySlug("ar", slug)) ??
          (await findCategoryBySlug("en", slug));
        if (!cat) throw new Error(`unknown category slug: ${slug}`);
        categoryIds.push(String(cat._id));
      }

      const playlistInput = playlistCreateInputSchema.parse({
        ar: { ...item.ar, slug: slugify(item.ar.title) },
        en: { ...item.en, slug: slugify(item.en.title) },
        status: "draft",
        categoryIds,
        ...(item.scholarImage ? { scholarImage: item.scholarImage } : {}),
      });

      if (values["dry-run"]) {
        console.log(`[dry-run] playlist ok: ${playlistInput.en.slug} (+${item.tracks.length} tracks)`);
        continue;
      }

      const playlist = await createPlaylistRow(playlistInput);
      console.log(`created playlist ${playlist._id} (${playlistInput.en.slug})`);
      for (const [order, t] of item.tracks.entries()) {
        const trackInput = trackCreateInputSchema.parse({
          ar: { ...t.ar, slug: slugify(t.ar.title) },
          en: { ...t.en, slug: slugify(t.en.title) },
          playlistId: String(playlist._id),
          mediaId: t.mediaId,
          order,
        });
        await createTrackRow(trackInput);
      }
    }
    console.log(values["dry-run"] ? "\ndry-run complete — no writes." : "\nimport complete.");
    if (!values["dry-run"]) {
      console.log("Next: run `pnpm heal:malformed-slugs` (dry-run) as a belt-and-braces check, then publish from the admin.");
    }
  } finally {
    await disconnectDb();
  }
}

main().catch((err) => {
  console.error("[import-content] fatal:", err);
  process.exit(1);
});
```

**Executor notes:** (1) check the real exported names/signatures in `repositories/playlist.repo.ts` / `track.repo.ts` and `schemas/playlist.ts` / `track.ts` — the create-input schemas may be named `playlistCreateInput`/`PlaylistCreateInput`; match exactly. (2) Repos are used deliberately (no `requireSession` in a CLI — RBAC is a web concern; the script is operator-only). (3) Slug collisions: `createPlaylist` service auto-appends `-2`; the repo may not — if not, mirror the service's collision loop or call the slug-dedupe util the service uses. Read `playlist.service.ts` create first and copy its collision handling.

- [ ] **Step 2:** Verify with a sample file against a dev DB: `pnpm import:content ./import.sample.json --dry-run` prints validations; `--apply` writes drafts visible in the admin.
- [ ] **Step 3:** Document in `APP_CONTEXT.md` (scripts table) and add one line to the known-gotcha about direct imports ("use `pnpm import:content` — never insert into Atlas directly"). **Commit** `[AhmedMuhammedElsaid][feat]: zod-validated import:content script replaces direct Atlas inserts`.

---

# Phase 4 — Retire the transitional migrations from the default chain

**Why:** 0003/0004/0005 are one-time embedded-locale transforms. 0003 now self-guards, but the default chain still replays them on every full run and the runbook depends on tribal knowledge. New/already-embedded DBs only need the steady-state migrations.

### Task 10: Split legacy migrations out of the default runner

**Files:**
- Modify: `scripts/migrate.ts:49-85`

- [ ] **Step 1:** Replace the single array (lines 49–60) with:

```ts
// Steady-state chain: safe to run in full against any embedded-locale DB
// (fresh or production). Append new migrations here.
const migrations: Migration[] = [
  migration0001,
  migration0002,
  migration0006,
  migration0007,
  migration0008,
  migration0009,
  migration0010,
];

// One-time embedded-locale transforms (2026-05). Excluded from the default
// chain; reachable only via --only for historical/dev-restore scenarios.
// 0003 additionally self-guards against embedded documents.
const legacyMigrations: Migration[] = [
  migration0003,
  migration0004,
  migration0005,
];
```

- [ ] **Step 2:** In `main()`, make `--only` search both lists and warn on legacy:

```ts
  let toRun = migrations;
  if (only !== undefined) {
    const all = [...migrations, ...legacyMigrations];
    toRun = all.filter((m) => m.name === only);
    if (toRun.length === 0) {
      console.error(
        `[migrate] no migration named "${only}". Known names:\n` +
          all.map((m) => `  - ${m.name}`).join("\n"),
      );
      process.exit(1);
    }
    if (legacyMigrations.some((m) => m.name === only)) {
      console.warn(`[migrate] ⚠️ "${only}" is a LEGACY one-time transform.`);
    }
    console.log(`[migrate] --only: running just "${only}".\n`);
  }
```

Also delete the now-stale header warning block (lines 29–31) and the 0003-ordering comment (lines 40–48); replace with two lines explaining the steady-state/legacy split.

- [ ] **Step 3:** `pnpm migrate --dry-run` lists only the 7 steady-state migrations; `pnpm migrate --only 0005-embedded-locale --dry-run` resolves with the legacy warning.
- [ ] **Step 4:** Update `APP_CONTEXT.md` (runner-order gotcha → "default chain is steady-state only; legacy via --only") . **Commit** `[AhmedMuhammedElsaid][refactor]: default migrate chain is steady-state only - legacy embedded-locale transforms gated behind --only`.

---

# Phase 5 — Sentry error reporting (web + admin)

**Why:** the client surface (SW, schedulers, two audio engines) fails silently in production today; the azan-was-silent bug is exactly the class that goes unseen. `SENTRY_DSN` is already in the env schema and turbo's build env list. New dependency ⇒ ADR (CLAUDE.md §5).

### Task 11: ADR + SDK wiring

**Files:**
- Create: `docs/adr/0005-sentry.md` (`git add -f`)
- Modify: `apps/web/package.json`, `apps/admin/package.json` (add `@sentry/nextjs` — the ONLY dependency this plan introduces)
- Create: `apps/web/instrumentation.ts`, `apps/web/instrumentation-client.ts`, and the same pair in `apps/admin`
- Create: `apps/web/app/global-error.tsx`, `apps/admin/app/global-error.tsx`
- Modify: `apps/web/lib/csp.ts`, `apps/admin/lib/csp.ts` (Sentry ingest origin in `connect-src`)
- Modify: `.env.example` (`NEXT_PUBLIC_SENTRY_DSN`), `packages/config/src/env.ts` (add optional `NEXT_PUBLIC_SENTRY_DSN`), `turbo.json` (`NEXT_PUBLIC_SENTRY_DSN` in `tasks.build.env`)

- [ ] **Step 1: Write the ADR** (`docs/adr/0005-sentry.md`): context (zero observability, deferred at Wave 5), decision (`@sentry/nextjs`, error monitoring only — `tracesSampleRate: 0`, no replay, no tunnel), consequences (CSP connect-src grows by the ingest origin; bundle +~30KB client).
- [ ] **Step 2: Install** `pnpm --filter web add @sentry/nextjs && pnpm --filter admin add @sentry/nextjs` (intentional lockfile change — isolated commit).
- [ ] **Step 3: Wire it.** Both apps, identical files (web shown):

`apps/web/instrumentation.ts`:
```ts
import * as Sentry from "@sentry/nextjs";

// Server + edge init. Reads process.env directly: instrumentation loads
// during next build's collection step where the env barrel would throw
// (canonical exception, same as next.config.ts / health routes).
export function register(): void {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return; // observability is optional per environment
  Sentry.init({ dsn, tracesSampleRate: 0, enableLogs: false });
}

export const onRequestError = Sentry.captureRequestError;
```

`apps/web/instrumentation-client.ts`:
```ts
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
if (dsn) {
  Sentry.init({ dsn, tracesSampleRate: 0 });
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
```

`apps/web/app/global-error.tsx`:
```tsx
"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);
  return (
    <html>
      <body>
        <main style={{ padding: "4rem", textAlign: "center" }}>
          <h1>Something went wrong</h1>
        </main>
      </body>
    </html>
  );
}
```

- [ ] **Step 4: CSP.** In both `lib/csp.ts` files, append the Sentry ingest origin to `connect-src` **only when a DSN is configured** — derive it from the DSN at proxy runtime (`new URL(dsn).origin`), passed the same way the R2 hostname already is. Follow the existing `buildWebCsp(nonce, r2Hostname)` parameter pattern: add an optional `sentryOrigin?: string` parameter, and in `proxy.ts` read `process.env.NEXT_PUBLIC_SENTRY_DSN` (proxy cannot import the env barrel — established constraint) to compute it.
- [ ] **Step 5: Verify.** `pnpm turbo run build` green without a DSN set (init no-ops). With a real DSN in `.env.local`, `throw new Error("sentry-test")` in a dev page renders the error in the Sentry dashboard, and the browser console shows no CSP violation for the ingest POST. Remove the test throw.
- [ ] **Step 6: Commit twice:** `[AhmedMuhammedElsaid][build]: add @sentry/nextjs to web+admin (ADR 0005)` (deps + ADR), then `[AhmedMuhammedElsaid][feat]: wire sentry error reporting with CSP-safe ingest`.

---

# Phase 6 — Housekeeping / community standards (Haiku)

### Task 12: Fix the `Category.model.ts` filename outlier

**Files:**
- Rename: `packages/api/src/db/models/Category.model.ts` → `category.model.ts`
- Modify: every importer (`grep -r "Category.model" packages/ apps/ scripts/`) + the `packages/api/package.json` exports entry if one references it

- [ ] **Step 1:** Windows FS is case-insensitive — rename in two hops: `git mv packages/api/src/db/models/Category.model.ts packages/api/src/db/models/_category.model.ts && git mv packages/api/src/db/models/_category.model.ts packages/api/src/db/models/category.model.ts`.
- [ ] **Step 2:** Update all import paths + exports map; `pnpm turbo run typecheck test` green; remove the "PascalCase outlier" notes from `APP_CONTEXT.md` (two places) and CLAUDE-adjacent docs. **Commit** `[AhmedMuhammedElsaid][chore]: category model filename matches the lowercase model convention`.

### Task 13: Dependabot

**Files:**
- Create: `.github/dependabot.yml`

- [ ] **Step 1:**

```yaml
version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "weekly"
    open-pull-requests-limit: 5
    groups:
      minor-and-patch:
        update-types: ["minor", "patch"]
    ignore:
      # Major bumps are deliberate, ADR-gated decisions in this repo.
      - dependency-name: "*"
        update-types: ["version-update:semver-major"]
  - package-ecosystem: "github-actions"
    directory: "/"
    schedule:
      interval: "weekly"
```

- [ ] **Step 2:** **Commit** `[AhmedMuhammedElsaid][chore]: weekly grouped dependabot for npm + actions`. Note in the PR description that dependency PRs will churn `pnpm-lock.yaml` — review them individually (repo rule: lockfile changes are deliberate).

---

## Decisions reserved for the owner (not tasks)

1. **LICENSE** — the repo has none; public GitHub default is "all rights reserved". Add MIT/AGPL/none — owner's call.
2. **CSP→static rendering** — only worth revisiting if Phase 1's data cache doesn't bring Atlas load/latency down enough. Would need its own ADR + plan.
3. **Mobile per-prayer notification sound** — mobile currently fires the system sound for every prayer; bundling the azan recordings as Android notification-channel sounds (regular + fajr channels) is a mobile feature wave, not a refactor.

## Definition of done (whole plan)

1. `pnpm turbo run lint typecheck test build` green across the workspace (CI parity).
2. New env vars (`WEB_REVALIDATE_URL`, `REVALIDATE_SECRET`, `NEXT_PUBLIC_SENTRY_DSN`) documented in `.env.example` and, where build-time, in `turbo.json`.
3. `APP_CONTEXT.md` updated in the same commits as the code (cache tier gotcha, migrate-chain split, import script, device-store rule).
4. `deploy.md` gains: set the revalidate secret pair on both Vercel projects; set Sentry DSNs.
5. Manual verifications recorded: admin edit reflects on web ≤5 min without webhook / instantly with it; Sentry receives a test event; `pnpm migrate --dry-run` shows the steady-state chain only.
