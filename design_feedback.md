# DESIGN.md ↔ MVP Implementation Audit — Design Spec

> Date: 2026-05-27 · Scope: bring the shipped Audio MVP UI into compliance with `DESIGN.md`, fix defects found during the audit, and correct the one stale section of the doc itself. **No new product features beyond what DESIGN.md already specifies.**

---

## 1. Goal & context

`DESIGN.md` is the design-system contract for `packages/ui`. Its MVP subset (§0) shipped in Waves 0–5. This effort audits the *as-built* UI against the contract, fixes divergences, and updates the one doc section that no longer matches reality (Tailwind v4).

Token discipline in the apps is already clean: a repo-wide scan found **zero** hardcoded hex values or arbitrary Tailwind color/size classes in `apps/*`. Skip-link, semantic landmarks, font loading (§3, §12) all conform. The divergences are concentrated in the **AudioPlayer (§17)** — the doc's designated "source of truth" centerpiece — plus one token defect.

User decision (brainstorming): fix **all tiers + the doc**.

---

## 2. Findings (as-built vs DESIGN.md)

### 2.1 Tier 1 — spec-compliance gaps & a11y (player)

| # | DESIGN.md ref | Spec | As-built (`packages/ui/src/blocks/audio-player/audio-player.tsx`) |
|---|---|---|---|
| T1-1 | §17.3 | Slider `aria-valuetext` in `mm:ss` | only `aria-label="Seek"`; SR announces raw seconds |
| T1-2 | §17.3 | `aria-live="polite"` announces `"Now playing: <title>"` | no live region |
| T1-3 | §17.2 | `n` / `p` = next / previous | only Space + ←/→ wired |
| T1-4 | §17.2 | drag slider seeks **on release** | `onValueChange` seeks on every tick (scrub latency) |
| T1-5 | §17.1 | upward `shadow-2` (`0 -4px 12px rgb(0 0 0 / 6%)`) + 1px top border | uses `shadow-3` (downward `0 16px 40px`) |
| T1-6 | §17.1, §17.5 | idle = `translate-y-full` + `opacity-0` + `pointer-events-none` (CSS slide-in) | unmounts via `return null` (no transition) |

### 2.2 Tier 1 — token defect (newly found)

| # | Where | Problem |
|---|---|---|
| T1-7 | `apps/web/features/playlists/components/playlist-card.tsx` | "Published" badge uses `bg-success/10`, `text-success`, `bg-success`, but `--color-success` is **not defined** in `tokens.css` and **not mapped** in `globals.css @theme inline` (§0.1 deferred it). The utilities therefore produce no color — the badge renders uncolored. |

### 2.3 Tier — cosmetic

| # | DESIGN.md ref | Spec | As-built |
|---|---|---|---|
| C-1 | §0.3 | player `z-40` | `z-50` |
| C-2 | §17.1 | fixed height `64px` desktop / `72px` mobile | variable `py-3` |
| C-3 | §14 | `:hover` = `color-mix(in oklab, var(--color-primary) 90%, black)` | `hover:bg-primary/90` (opacity) |

### 2.4 Tier 2 — needs new data / states

| # | DESIGN.md ref | Spec | As-built |
|---|---|---|---|
| T2-1 | §17.1 | now-playing region: 40×40 cover thumbnail (`radius-sm`) + track title + **playlist title** | shows `"Track X / N"`, no cover, no playlist title |
| T2-2 | §17.1 | buffering spinner replaces play/pause; error chip + retry | not implemented |
| T2-3 | §17.1 | queue button opens a Sheet of upcoming tracks | not implemented (volume is explicitly optional → omit) |

### 2.5 Tier 3 — stale doc

| # | DESIGN.md ref | Problem |
|---|---|---|
| D-1 | §15 | Describes a Tailwind **v3** `packages/tailwind-config/preset.ts`. The repo is Tailwind **v4**: tokens map via `@theme inline` in `packages/ui/src/styles/globals.css`; there is no `preset.ts` and no `tailwind-config` package. |

---

## 3. Out of scope

- Volume control (§17.1 marks it optional; YAGNI for MVP).
- Sleep timer, playback speed, resume-from-position, chapters, cast (§17.6 — explicitly Phase 2).
- Dark-mode toggle UI (§0.2 — token values stay; no toggle).
- RTL/Arabic font stack, motion polish beyond focus/hover/press (§0.2).
- Any change to `apps/admin` UI (audit found no divergences there in scope).

---

## 4. Design of the fixes

Work is grouped into independent commits (one concern each, per repo commit convention).

### 4.1 Tokens — add `success` + `warning`, add upward player shadow

`packages/ui/src/styles/tokens.css` — add to `:root` and `[data-theme="dark"]` using the exact §2.1 hexes:

| Token | light | dark |
|---|---|---|
| `--color-success` | `#147d4a` | `#48b57c` |
| `--color-warning` | `#a66400` | `#e0a14a` |

Add a shared upward elevation token (theme-independent), so the player avoids an arbitrary `shadow-[...]` class (which would violate the token rule):

```css
--shadow-up-2: 0 -4px 12px rgb(0 0 0 / 6%);
```

`packages/ui/src/styles/globals.css` `@theme inline` — map the three new tokens so utilities generate:

```css
--color-success: var(--color-success);
--color-warning: var(--color-warning);
--shadow-up-2: var(--shadow-up-2);
```

This both fixes **T1-7** (badge color) and supplies the **T1-5** player shadow as `shadow-up-2`.

### 4.2 AudioPlayer — `audio-player.tsx`

- **T1-5 / C-1 / C-2:** container classes → `bg-surface border-t border-border shadow-up-2 z-40`, fixed height `h-16 md:h-[72px]` (replace `shadow-3 z-50` + `py-3`). Keep `max-w-5xl mx-auto px-6`.
- **T1-6 / §17.5:** stop returning `null`. Always render the `<section>`; drive visibility off `hasQueue` with classes `translate-y-full opacity-0 pointer-events-none` (idle) → `translate-y-0 opacity-100` (active), with `transition-transform transition-opacity duration-[var(--motion-base)] ease-[var(--ease-standard)]`. Inner content still guards on `currentTrack` to avoid rendering empty fields. (Reduced-motion already handled globally in `globals.css`, satisfying §17.3's "slide becomes fade".)
- **T1-1:** pass `aria-valuetext={`${formatTime(sliderValue)} of ${formatTime(sliderMax)}`}` to `<Slider>`. (Slider already spreads `...props` to the Radix root, so no Slider change needed.)
- **T1-4:** local slider state for the dragged value; `onValueChange` updates local visual only, `onValueCommit` calls `seek(...)`. While dragging, the displayed elapsed time follows the local value; on commit it syncs back to `currentTime`.
- **T1-2:** add a visually-hidden `<p className="sr-only" aria-live="polite">Now playing: {currentTrack.title}</p>` inside the region.
- **T1-3:** extend the keydown handler with `n` → `next()`, `p` → `prev()` (same editable-target guard).
- **T2-1:** render a 40×40 `rounded-sm` cover (plain `<img>`; `next/image` is unavailable inside `packages/ui` and §17.5 only requires `sizes="40px"`/no-priority, which a sized `<img loading="lazy" width={40} height={40}>` satisfies) when `currentTrack.coverUrl` is set, plus the playlist title line `text-xs text-muted` from `currentTrack.playlistTitle` (fallback to the existing `Track X / N` when absent).
- **T2-2:** buffering + error states. Add `isBuffering` and `errorMessage` to the player context (see 4.4). When buffering, replace the play/pause glyph with a spinner (CSS `animate-spin` on a `Loader2` lucide icon) while leaving the button enabled. On error, show an inline chip with a retry icon (`RotateCw`) that re-loads the current src, and surface a one-line `toast` (toaster primitive already exists).

### 4.3 Button — §14 hover (C-3)

`packages/ui/src/primitives/button.tsx`, `default` variant: replace `hover:bg-primary/90` with the spec's `color-mix`. Tailwind v4 arbitrary value referencing tokens is allowed (it *is* the token, not a literal):
`hover:[background:color-mix(in_oklab,var(--color-primary)_90%,black)]`. `destructive` variant gets the analogous treatment for consistency.

### 4.4 Player context — `player-context.tsx`

- Extend `QueueTrack`:
  ```ts
  export type QueueTrack = {
    id: string;
    title: string;
    mediaUrl: string;
    durationSecs?: number;
    coverUrl?: string;
    playlistTitle?: string;
  };
  ```
- Add `isBuffering: boolean` and `errorMessage: string | null` to `PlayerContextValue`, plus a `retry()` callback. Wire the audio element's `waiting`/`playing`/`canplay` events to `isBuffering`, and `error` to `errorMessage`. `retry()` re-assigns the current `src` and calls `load()` + `play()`.

### 4.5 Data plumbing for cover + playlist title (T2-1)

- **Service:** add `getMediaUrlById(mediaId: string): Promise<string | null>` to `packages/api/src/services/media.service.ts`, mirroring the `getTracksWithUrls` resolution: `const base = env.R2_PUBLIC_BASE; if (!base) return null; const media = await findMediaById(mediaId); return media?.key ? `${base}/${media.key}` : null;`. It is a public, read-only resolution with **no `requireSession`** — `getTracksWithUrls` (also public, no session) is the precedent the detail page already relies on; adding a session check here would break the public detail page. Export via the `@repo/api` barrel + `services/media` subpath if not already exported.
- **Page:** `apps/web/app/playlists/[slug]/page.tsx` resolves the cover URL when `playlist.coverMediaId` is set, and passes `playlistTitle={playlist.title}` and `coverUrl={coverUrl ?? undefined}` to `TrackListPlayer`.
- **TrackListPlayer:** accept `playlistTitle?: string` and `coverUrl?: string` props; `toQueueTrack` attaches them to every `QueueTrack`.

### 4.6 Queue Sheet (T2-3)

In `audio-player.tsx`, add a queue button (lucide `ListMusic`, `aria-label="Queue"`) in a right-aligned meta region that opens the existing `Sheet` primitive from the right. The sheet lists `queue` entries; clicking one calls a new context helper `goTo(index)` (thin wrapper over `setCurrentIndex`). Tab order per §17.2: prev → play/pause → next → slider → queue.

### 4.7 Doc fix — DESIGN.md §15 (D-1)

Replace the §15 `preset.ts` code block and "Both apps extend this preset" line with the actual v4 mechanism: tokens declared in `tokens.css`, bridged to utilities via `@theme inline` in `packages/ui/src/styles/globals.css`, imported once per app. Keep the section's intent (CSS-var → utility mapping) but show the real `@theme inline` snippet. Add a one-line note that `tailwind-config`/`preset.ts` from the original plan was superseded by Tailwind v4.

---

## 5. Testing (per CLAUDE.md §9)

- **`apps/web/features/player/components/audio-player.test.tsx`** (RTL, exists): add cases for
  - slider exposes `aria-valuetext` in `mm:ss`;
  - live region text updates to `Now playing: <title>` on track change;
  - `n`/`p` keydown calls `next`/`prev`; editable-target guard still suppresses;
  - idle state has `pointer-events-none` (rendered, not unmounted);
  - buffering shows spinner, error shows retry chip;
  - cover `<img>` + playlist title render when provided.
- **`packages/api` (vitest):** unit test for `getMediaUrlById` — returns `null` when `R2_PUBLIC_BASE` unset, builds `base/key` when set, `null` for missing media. Mocks `findMediaById` + `env` per existing service-test pattern.
- Run `pnpm lint`, `pnpm typecheck`, `pnpm test` green before each commit. No Lighthouse regression on `/playlists/[slug]`.

---

## 6. Commit plan (one concern each)

1. `[fix]` tokens: add `success`/`warning` + `shadow-up-2`, map in `@theme inline`; fixes uncolored badge.
2. `[fix]` audio-player: a11y (`aria-valuetext`, live region), `n`/`p` keys, seek-on-commit.
3. `[fix]` audio-player: spec visuals — upward shadow, fixed height, `z-40`, slide-in transition; Button §14 hover.
4. `[feat]` player cover + playlist title: `getMediaUrlById` service + test, page plumbing, `QueueTrack` fields, render thumbnail.
5. `[feat]` player buffering/error states + queue Sheet.
6. `[docs]` DESIGN.md §15 → Tailwind v4 reality; refresh APP_CONTEXT.md player/token notes in the same commit as the code that changes them.

---

## 7. Risks / notes

- The slide-in (T1-6) means the player `<section>` is always in the DOM. Confirm `PlayerProvider`'s audio element and listeners are unaffected (they already mount unconditionally — only the *visual* changes).
- Forcing fixed `h-16` must not clip the two stacked mobile rows (§17.1 mobile is 2 rows in `72px`); verify with the mobile layout. If the existing single-row layout doesn't match §17.1's mobile spec, that is a separate gap — flag, do not silently expand scope.
- `getMediaUrlById` is a public read with no session — matches the `getTracksWithUrls` precedent; do **not** add `requireSession` (would break the public detail page).
