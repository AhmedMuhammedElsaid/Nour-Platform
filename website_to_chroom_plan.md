# Website → Chrome Extension: Full Mirror Plan & Spec

> **Self-contained roadmap + spec.** Goal: make `apps/extension` (MV3, Chrome+Firefox) a
> real, gap-free mirror of the entire web app — **full parity incl. bilingual AR/EN +
> light/dark theme + the complete Quran reader**. This document embeds every spec detail
> (web markup/classes, data shapes, API/schema refs, design tokens) needed to execute any
> phase WITHOUT re-exploring. Read the relevant phase + the reference appendices.
>
> Status: **Phase 0 (prayer widget) shipped (`781d56e`).** All other phases pending.
> Each phase tags a recommended model (CLAUDE.md §15): **Opus** = foundations / first-of-kind /
> complex state machines; **Sonnet** = sibling patterns + standard UI/tests; **Haiku** =
> mechanical ports / clones / strings / docs.

---

## 0. Architectural constraints (apply to every phase)

1. **Offscreen audio.** Extension audio plays in an **offscreen document (Chrome)** / **player
   tab (Firefox)**. The UI drives it via `browser.runtime.sendMessage` + a
   `chrome.storage.session` broadcast (`PLAYER_LIVE_KEY = "nour.player.live"`). We **extend**
   the existing reducer (`src/lib/player-state.ts`) + engine (`src/lib/audio-engine.ts`) — we
   **cannot** reuse the web's in-DOM `PlayerProvider`.
2. **No cross-app imports.** The extension cannot import from `apps/web`. It reuses pure logic
   via `@repo/shared-core` and talks only to the web `/api/v1/*` endpoints. Web feature
   components are **ported** (presentational copies), never imported.
3. **SPA shell.** The new-tab becomes a small SPA via an in-page **hash router** (replaces
   Next.js routing). Views: `home | playlist | search | adhkar | adhkar-read | quran |
   quran-read | bookmarks | prayer-times`.
4. **Identical device-local contracts.** Reuse the `nour.*` keys verbatim so behavior matches
   web/mobile (see §3).
5. **Tailwind v4** via `@tailwindcss/vite`; tokens live in `src/styles/tailwind.css` (`@theme
   inline` bridge). No Radix, no lucide, no component lib — hand-rolled primitives + inline SVG.
6. **CI rule.** Before any push run the FULL `pnpm turbo run lint typecheck test build` (not
   per-filter) + `build:chrome` + `build:firefox`. Commit format `[AhmedMuhammedElsaid][<verb>]:`
   + `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.

---

## 1. Reused infrastructure (do NOT rebuild)

**shared-core** — `@repo/shared-core/prayer-times/{compute,format,sun-arc}`,
`schemas/{playlist,track,prayer-times,locale}`, `recentlyMissed` (azan catch-up).

**Extension libs already present:**
- `src/lib/api.ts` — `getJson<T>(path, params?)`, `assetUrl(path)`, `__API_BASE_URL__` (Vite
  define) → base `${origin}/api/v1`. ⚠️ Never `new URL(path, base)` (drops `/api/v1`); uses
  `new URL(\`${API_BASE}${path}\`)`.
- `src/lib/storage.ts` — Zod-validated `get<K>()/set<K>()/watch(key,cb)` over
  `browser.storage.local`. Keys enumerated in §3.
- `src/lib/use-player.ts` — `usePlayer()` → `{ state, send }`; seeds from session snapshot,
  subscribes to `player-state` messages, `send` posts `player-command` to background.
- `src/lib/audio-engine.ts` — owns the `HTMLAudioElement`, applies commands via `reducePlayer`,
  persists positions, Media Session, adhan priority, broadcasts state.
- `src/lib/content.ts` — `fetchPlaylists()`, `buildPlaylistQueue(slug)`, `recordRecent(item)`.
- `src/lib/use-prayer-times.ts` — `usePrayerTimes()` → `{ today, upcoming, arcPos{isNight,
  onNightBand,fraction}, now }`.
- `src/components/sun-arc.tsx` — rich SunArc (shipped P0).
- `src/options/use-settings.ts` — `useLocation/usePrefs/useAdhanSettings/useAzkarSettings`.
- `src/offscreen/protocol.ts` — message types (§5).

**API endpoints available:** `/playlists`, `/playlists/{slug}`, `/categories`, `/adhkar`,
`/adhkar/{slug}`, `/quran/{surahs,surah/[n],editions,reciters,tafsir}`.
**Gap:** no `/search` route — add in P6.

---

## 2. API reference (response shapes)

All under `${API_ORIGIN}/api/v1`. All dates ISO via `withIsoDates`. CORS enabled.

- `GET /playlists?category=<slug>&sort=az|tracks` → `Playlist[]` (full docs; default sort `az`;
  **no "newest"** — for newest, fetch unsorted + sort client-side by service order).
- `GET /playlists/{slug}?locale=ar|en` → `{ playlist: Playlist, tracks: (Track & {srcUrl:string|null})[] }`.
  404 if missing/unpublished.
- `GET /categories` → `Category[]`.
- `GET /adhkar?locale=` → adhkar set summaries; `GET /adhkar/{slug}?locale=` → set with
  `items: { ar, en?, repeat, ... }[]` (Arabic slugs must be `encodeURIComponent`'d).
- `GET /quran/surahs` → 114 surah metas; `GET /quran/surah/[n]?...` → `SurahReader`
  (ayahs with embedded `words[]`, translation); `GET /quran/editions`, `GET /quran/reciters`,
  `GET /quran/tafsir?ayah=<numberGlobal>&locale=` → tafsir html (script-stripped).

**Quran audio is COMPUTED, never stored:** everyayah.com → `<base><pad3(surah)><pad3(ayah)>.mp3`.
**Quran defaults by locale:** translation ar→`ar.muyassar`, en→`en.sahih`; tafsir ar→`ar.saadi`,
en→`en.ibnkathir` (all caller-overridable).

---

## 3. Device-local key contracts (`nour.*`, identical web/mobile/extension)

| Key | Shape | Used by |
|---|---|---|
| `nour.prayer.location` | `{ lat,lng,label, cityId? }` (default Cairo) | prayer widget/page, azan |
| `nour.prayer.prefs` | `{ method, madhab }` (Egyptian / standard) | prayer compute |
| `nour.prayer.adhan` | `{ enabled, perPrayer{...}, volume, ... }` | azan engine |
| `nour.azkar.reminder` | `{ enabled, offsetMinutes, ... }` | azkar reminders |
| `nour.player.prefs` | `{ shuffle, repeat, playbackRate, volume }` | **NEW in P1** (web parity) |
| `nour.player.positions` | `Record<trackId,{t:number}>` (web also `at`; cap 100) | resume |
| `nour.player.recent` | MRU ≤20; **enrich** `{slug,title,type, trackId?,cover?,playlistTitle?,durationSecs?}` | continue-listening |
| `nour.quran.prefs` / `.lastread` / `.bookmarks` | reader settings / `AyahRef{surah,ayah,numberGlobal?,surahName?}` / refs | **NEW P8** |
| `nour.adhkar.progress` | per-set tap counts + daily-reset date | **NEW P7** |
| `nour.theme` | `"dark"|"light"` | **NEW P10** (default dark) |
| `nour.locale` | `"ar"|"en"` | **NEW P2/P11** (default ar) |
| `nour.player.live` | session broadcast of `PlayerState` | player UI |

---

## 4. Schema field reference

- **Playlist** (`schemas/playlist.ts`): `id`, `status`, `order`, `scholarImage?` (top-level
  `/public` path or URL), `categoryIds: string[]`, `trackCount?`, and per-locale `ar`/`en`
  `{ title, slug, description?, scholarName? }`.
- **Track** (`schemas/track.ts`): `id`, `durationSecs?` (top-level), per-locale `ar`/`en`
  `{ title, slug }`. API adds `srcUrl: string|null` (via `getTracksWithUrls`).
- **Category**: `id`, per-locale `ar`/`en` `{ name, slug }`.

---

## 5. Extension player internals (current)

- `player-state.ts`: `PlayerCore = { status:"playing"|"paused"|"stopped", queue:QueueItem[],
  index:number }`. `PlayerState = PlayerCore & { positionSec, durationSec }`.
  `QueueItem = { id, url, title, artist?, artwork? }`.
  `PlayerCommand = load | toggle | next | prev | seek | stop`. `reducePlayer(core,cmd)` pure.
- `audio-engine.ts`: applies commands, `loadedmetadata`→resume seek, `ended`→`next`,
  `timeupdate`→throttled persist (5s) + broadcast; Media Session handlers; adhan priority
  (separate element, pauses/resumes player). Broadcast throttle 250ms.
- `protocol.ts`: `ToBackground {player-command}`; `ToOffscreen {adhan-play|adhan-stop|player}`;
  `FromOffscreen {adhan-ended|player-state}`.

---

## 6. Design tokens (values to mirror)

**Dark (default):** bg `#0f0d0a` · surface `#1c1915` · surface-2 `#252018` · border
`rgb(200 160 80 /15%)` · text `#f0e6cc` · text-2 `#8a7a62` · muted `#5a4a38` · primary
`#c8a050` · primary-fg `#0f0d0a` · sun `#e4c57e` · moon `#d6e3ff`.
**Light (P10):** bg `#fdfaf4` · surface `#ffffff` · surface-2 `#f4f1e8` · border `#e6e2d7` ·
text `#13201a` · text-2 `#3f4a44` · muted `#6b7670` · primary `#9a7830` · primary-fg `#ffffff`
· sun `#c8a050` · moon `#4a6fb8`. (Apply via `[data-theme="light"]`.)
**Fonts:** `--font-display` Fraunces (bundled, P0) · `--font-sans` Inter / IBM Plex Sans Arabic
(ar) · `--font-quran` Amiri Quran (bundle in P8). **Sizes:** 2xs .6875 · xs .8125 · sm .875 ·
md 1 · lg 1.125 · xl 1.25 · 2xl 1.5 rem. Extension currently defines: colors above (dark only)
+ `--font-display` + `--text-2xs` + `--color-moon` (added P0).

---

## PHASES

### Phase 1 — Player engine + state parity · **Opus**
Complex state machine; foundation for all audio. Files: `player-state.ts`, `audio-engine.ts`,
`storage.ts`.
- `PlayerCore` += `shuffle:boolean`, `repeat:"off"|"all"|"one"`, `order:number[]`. Shuffle =
  Fisher–Yates with **current index pinned to front** (toggling never restarts current — mirror
  web). `next/prev` walk `order`; `repeat:all` wraps, `repeat:one` stays.
- New commands: `toggleShuffle`, `cycleRepeat`, `goTo(index)`, `setRate(rate)`, `setVolume(v)`,
  `setSleepTimer(option)`, `retry`. `QueueItem` += `durationSecs?`, `slug?`.
- Engine: apply `playbackRate`+`volume` on load + command (**adhan element stays independent —
  player volume must NOT touch adhan**, which uses `nour.prayer.adhan` volume). `ended`+repeat-one
  → seek 0 + play. Sleep timer = `setTimeout` (3s fade-out → pause, restore vol) + end-of-track
  flag → broadcast `sleepTimerEndsAt`/`sleepAtTrackEnd`. `waiting/canplay/error` →
  `isBuffering`/`errorMessage`; `retry` reloads src. On track change write enriched
  `nour.player.recent` (trackId/slug/title/cover/durationSecs).
- `storage.ts`: Zod `nour.player.prefs {shuffle,repeat,playbackRate,volume}` defaults
  off/off/1/1; hydrate engine on init, persist on change. Enrich `RecentItem` (new fields
  optional, back-compat).
- Mirror web persistence semantics: resume **skips first 5s + last 10s**; save throttle 5s.

### Phase 2 — App shell + foundations · **Opus**
First-of-kind primitives + contracts every later view consumes.
- **Primitives** `src/components/ui/{slider,sheet,icons}.tsx`: `slider` = styled `<input
  type="range">` (token accent + track), supports value+commit; `sheet` = fixed overlay +
  slide-in panel (RTL → from `left`), esc/backdrop close; `icons` = inline SVGs (shuffle,
  skip-back, play, pause, skip-forward, repeat, repeat-1, gauge, list-music, volume-2, volume-x,
  loader, rotate-cw, search, moon, sun, chevron-left, book, beads).
- **Hash router** `src/lib/router.ts` + `app-shell.tsx`: view enum (see §0.3); `back/forward`,
  deep links (`#/playlist/<slug>`, `#/quran/<n>`, …).
- **Site header** `components/site-header.tsx` mirroring web: logo (font-display, primary) + nav
  (Quran/Adhkar/Prayer-times) + search box + theme toggle + locale switch.
- **i18n** `src/lib/i18n.ts`: `t(key, vars?)` + locale store `nour.locale` (default ar), `dir`
  from locale; **port web `apps/web/messages/{ar,en}.json` namespaces** (common/nav/home/playlist/
  player/prayer/quran/adhkar/metadata) as the catalog. All later views use `t()` (EN fill P11).
- **Theme** extend `styles/tailwind.css` with the §6 light token set under `[data-theme="light"]`
  + `nour.theme` store applied to `<html data-theme>` (SSR-safe inline like web theme-toggle).

### Phase 3 — Home page parity · **Sonnet** (cover-art port: **Haiku**)
Web ref: `apps/web/app/[locale]/page.tsx`, `features/playlists/components/playlist-card.tsx`,
`features/player/components/continue-listening.tsx`, `features/categories/...`.
- **Port `lib/cover-art.ts`** (Haiku) verbatim:
  - `GRADIENTS = [["#2d4a1e","#1a2a10"],["#3d2a0e","#2a1a06"],["#1e2a3d","#0e1825"],["#2a1e3d","#180e28"],["#3d1e2a","#280e18"],["#1e3d2a","#0e2818"]]`
  - `EMOJIS = ["📿","🕌","📖","🌕","🕋","🌙","🌒","🌓","🌔","🌕","🌟","✨","📿","🕌","☪️","🎙️","🕊️","❤️","⭐"]`
  - `coverIndex(id)=parseInt(id.slice(-2),16)%GRADIENTS.length`; `getCoverGradient`/`getCoverEmoji`
    index into these (fallback `[0]`).
- **`playlist-card.tsx`** — circular cover `w-[78%] aspect-square rounded-full overflow-hidden`
  (scholarImage via `assetUrl` `object-cover group-hover:scale-105`, else gradient
  `linear-gradient(to bottom,from,to)` + `text-5xl` emoji); container
  `group relative rounded-2xl border border-border bg-surface hover:-translate-y-1 hover:z-10
  hover:border-primary/30 transition-all flex flex-col items-center text-center gap-2 p-3`;
  title `font-display text-base font-semibold`; scholar `text-sm text-text-2 line-clamp-1`;
  trackCount badge `rounded-full bg-primary/15 border border-primary/30 text-primary text-xs
  font-semibold px-2.5 py-0.5`; category chips `border border-border text-text-2 text-xs
  rounded-full px-2 py-0.5` (≤2). **onClick(slug) → open detail view** (button, not Link).
- **`category-filter.tsx`** — pills active `bg-primary text-primary-foreground`, inactive
  `bg-primary/10 text-text-2 border border-primary/20 hover:bg-primary/15`, label `arName · enName`;
  sort `<select>` newest|az|tracks (`bg-surface border border-border`). Filter/sort **client-side**.
- **Continue-listening** rewrite — horizontal `flex gap-4 overflow-x-auto`; card `shrink-0 w-40`
  circular cover + hover scrim `bg-black/40 opacity-0 group-hover:opacity-100` + gold play circle
  `size-8 rounded-full bg-primary/90`; resume bar `h-0.75 rounded-full bg-primary/20` inner
  `bg-primary` width `savedPos/durationSecs`; title + `%`/playlist subtitle; "clear history".
- **`content.ts`** — enrich `PlaylistSummary` (`id, categoryIds, scholarName?, description?`) +
  `fetchCategories()` → `{id,arName,enName,slug}[]`.
- **`newtab-page.tsx`** restructure to web order: brand header → **hero (h1 font-display
  text-4xl + subtitle)** → prayer widget (P0) → category pills+sort → library grid
  `grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4` → continue-listening → Quran shelf
  (P8) → existing DhikrWidget (extension extra, keep at bottom). Player bar stays mounted.

### Phase 4 — Playlist detail + per-track play · **Sonnet**
Web ref: `playlists/[slug]/page.tsx` + `features/playlists/components/track-list-player.tsx`.
- **`playlist-detail.tsx`** — back button; hero `relative w-full h-48 md:h-72 rounded-xl`
  (cover or gradient+`text-7xl` emoji + bottom scrim `to-bg/80`); header (`font-display text-4xl`
  title; scholar avatar `size-10 rounded-full` + name; description `text-text-2`; category chips
  as filter links; `trackCount · publishedDate`); track list `<ol>` rows
  `flex items-center gap-4 py-3 border-b border-border` (button `▶`/`⏸`, current `text-primary`,
  `durationSecs` formatted `text-text-2`); "play all".
- **Play wiring** (mirror web): build `QueueItem[]` from playable tracks (`srcUrl!=null`);
  click row → if current `toggle`, else `send({type:"load", queue, index})`. `content.ts` +=
  `fetchPlaylistDetail(slug)` → `{ meta, tracks: DisplayTrack[] }` (`{id,title,durationSecs?,srcUrl}`).
- **Deep-link**: continue-listening cards open detail with `initialTrackId` (mirrors web
  `#trackId`) → auto-load queue at that index, strip the hash.

### Phase 5 — Categories · folded into P3/P4 (no separate work).

### Phase 6 — Search · **Sonnet**
- **Web (additive)**: `apps/web/app/api/v1/search/route.ts` wrapping the existing
  `searchContent(locale,q,limit)` service (mirror `/categories` route shape; text indexes from
  migration `0006` already shipped; returns playlist + track hits, track hits link to parent
  playlist). This is the ONLY web change in the whole program.
- **Extension**: header `search-box.tsx` → `search` view; `components/search-results.tsx`
  (playlist hits → open detail; track hits → play). Empty/blank query handled.

### Phase 7 — Adhkar reader · **Opus** (first reader vertical — sets the reader pattern Quran reuses)
Web ref: `features/adhkar/` (`AdhkarReader` island). Data: `/adhkar`, `/adhkar/{slug}`.
- **`adhkar-landing.tsx`** — list of adhkar sets (cards). **`adhkar-reader.tsx`** — reading view:
  per-item Arabic text, **tap-counter** (decrement remaining `repeat`), **auto-advance** on
  completion, per-item audio (resolve via API/assetUrl), **daily-reset device-local progress** at
  `nour.adhkar.progress` (reset when stored date != today). Arabic slug `encodeURIComponent`.
- Replaces the new-tab's single daily-dhikr teaser with the full vertical (keep a teaser linking
  into it if desired). Morning/evening default slugs: `أذكار-الصباح`/`morning-adhkar`,
  `أذكار-المساء`/`evening-adhkar`.

### Phase 8 — Quran reader · **Opus** (largest vertical; split 8a/8b)
Web ref: `features/quran/` (`reader`, `ayah-row`, `word-by-word`, `translation-block`,
`reader-settings-sheet`, `surah-index`, `surah-juz-tabs`, `tafsir-sheet`, `bookmarks-list`,
`continue-reading-shelf`, `lib/{audio-url,quran-prefs,quran-progress}`, `hooks/use-ayah-audio`).
- **8a Reader core**: `content.ts` quran fetchers (`/quran/surahs`, `/surah/[n]`, `/reciters`,
  `/editions`). `surah-index` + `juz-tabs`. `reader` (ayah rows + **word-by-word** + translation
  block). **Reader-scoped ayah-audio hook** = a SINGLE `HTMLAudioElement` OWNED BY THE READER
  (independent of the global offscreen player): auto-advance, repeat-ayah, `currentGlobal`
  highlight. Audio URL **computed**: everyayah base + `pad3(surah)+pad3(ayah)+".mp3"`. Reader
  settings sheet (font size, translation on/off, reciter). Device-local `nour.quran.{prefs,
  lastread,bookmarks}`; `AyahRef` carries `numberGlobal` + `surahName` for deep-links
  (`#ayah-<numberGlobal>`). **Bundle Amiri Quran woff2** → `--font-quran` (same pattern as
  Fraunces in P0). Translation defaults: ar→`ar.muyassar`, en→`en.sahih`.
- **8b Tafsir + bookmarks + continue-reading**: tafsir sheet lazy-fetch `/quran/tafsir?ayah=
  &locale=` (script-stripped html, dir per edition; defaults ar→`ar.saadi`, en→`en.ibnkathir`);
  bookmarks view (grouped by surah); home **continue-reading shelf now real** (reads
  `nour.quran.lastread`, opens the in-extension reader at that ayah — replaces the dormant
  web-bridge idea from the earlier home-only plan).

### Phase 9 — Prayer-times full view · **Sonnet**
Web ref: `features/prayer-times/components/{prayer-page,prayer-timetable,date-card,location-picker,
method-settings,adhan-settings,azkar-reminder-settings}`. Most logic already exists in the
extension options + shared-core — this is mostly **composition**.
- `components/prayer-page.tsx` (a `prayer-times` view): SunArc (reuse P0) + full timetable +
  date-card (gregorian+hijri) + countdown; location-picker (city search over the ~24-city list +
  geolocation, `cityLabel(location,locale)`, `nearestCity`); method/madhab settings; adhan
  settings (master + per-prayer + volume + permission); azkar-reminder settings. All read/write
  the existing `nour.prayer.*` + `nour.azkar.reminder` via options `use-settings.ts`.
  Defaults: Cairo / Egyptian / standard.

### Phase 10 — Theme toggle + locale switcher (UI) · **Haiku**
Stores/tokens exist from P2. Add `theme-toggle.tsx` (inline SVG moon/sun, writes `nour.theme`,
sets `<html data-theme>`) + `locale-switch.tsx` (ar/en, writes `nour.locale`, sets `<html
lang dir>`) in the header. Mechanical.

### Phase 11 — i18n EN sweep + tests + CI + builds + docs · **Sonnet** (sweep+tests) / **Haiku** (docs)
- Fill the EN catalog; replace remaining hardcoded Arabic strings with `t()` across all views.
- Tests: extend `player-state.test.ts` (shuffle order + pin-current, repeat all-wrap/one-stay,
  `goTo`, next/prev across `order`); storage-prefs round-trip; adhkar daily-reset progress; quran
  lastread/bookmarks. Keep the existing 21 + new green. (vitest, polyfill mock setup already present.)
- `pnpm turbo run lint typecheck test build`; `build:chrome` + `build:firefox` (font assets land
  in `dist/*/assets`, CSS `src:` rewritten). Load-unpacked parity pass vs web `/ar` **and** `/en`
  across every view + both themes.
- Update `APP_CONTEXT.md` + the memory index.

---

## Reference Appendix A — Web AudioPlayer (mirror target for P1+P2 UI)

`packages/ui/src/blocks/audio-player/{player-context,audio-player}.tsx`.

**`PlayerContextValue` (every field to reach parity):** state — `queue`, `currentIndex`,
`isPlaying`, `isBuffering`, `errorMessage`, `currentTime`, `duration`, `hasQueue`, `currentTrack`,
`repeatMode("off"|"all"|"one")`, `isShuffled`, `playbackRate`, `volume`, `sleepTimerEndsAt`,
`sleepAtTrackEnd`; methods — `loadQueue(tracks,startIndex?)`, `play`, `pause`, `toggle`,
`seek(s)`, `next`, `prev`, `goTo(i)`, `retry`, `cycleRepeat`, `toggleShuffle`,
`setPlaybackRate(r)`, `setVolume(v)`, `setSleepTimer(min|"end-of-track"|null)`.
`QueueTrack = {id,title,mediaUrl,durationSecs?,coverUrl?,playlistTitle?,playlistSlug?,locale?}`.

**Constants:** `PLAYBACK_RATES = [0.75,1,1.25,1.5,2]`; sleep options `15/30/45/60 / end-of-track /
off`. **Keyboard:** space=toggle, ←/→ = ±10s, n/p = next/prev, s = shuffle, r = repeat (bail on
input/textarea/contenteditable). **Resume:** skip first 5s + last 10s; positions cap 100; save
throttle 5s. **Media Session:** metadata + play/pause/prev/next/seekbackward/seekforward/seekto +
`setPositionState`.

**Bar UI (classes to mirror):** container `fixed bottom-0 inset-x-0 z-40 bg-surface border-t
border-border shadow-up-3` (slide/fade on `hasQueue`); cover `size-10 rounded-sm object-cover`;
title `truncate text-sm font-medium`, subtitle `truncate text-xs text-muted` (`playlistTitle ??
Track i/n`); center play `variant=default size=icon rounded-full` (spinner when buffering);
shuffle/repeat gold (`text-primary`) when active; skip icons `rtl:scale-x-[-1]`; seek row =
time `text-2xs text-text-2 tabular-nums w-10` + slider (commit-on-release) + duration; volume
`hidden md:flex` mute toggle + slider (`step 0.02`); settings sheet (speed buttons `variant=
default|outline`, sleep buttons + "End of track" + "Off"); queue sheet (numbered list, click →
`goTo`, current `text-primary`). Sheets open `side=left` in RTL.

## Reference Appendix B — Web home (mirror target for P3)

`page.tsx`: container `mx-auto max-w-6xl px-6 py-16`; hero `font-display text-4xl font-bold` +
`text-sm text-text-2`; library header label `text-xs font-semibold uppercase tracking-[3px]
text-primary` + sort select; grid `grid grid-cols-2 gap-3 lg:grid-cols-4`. Order: hero → prayer
widget → category pills → library grid → continue-reading (quran) → continue-listening. Data:
`getPublishedPlaylists({categoryId?})`; sort `az` = `localeCompare`, `tracks` = `trackCount` desc,
default = service order (newest).

---

## Cross-cutting parity checklist (the "no gaps" guarantee)
- [ ] Player: shuffle · repeat(off/all/one) · volume+mute · speed(0.75–2×) · sleep timer · queue
      · seek · Media Session · keyboard.
- [ ] Home: hero · prayer widget · category pills+sort · library grid · continue-listening · continue-reading.
- [ ] Playlist detail: hero · scholar · description · category chips · track list · play-all · per-track.
- [ ] Search: playlists + tracks.
- [ ] Adhkar: landing + reading (tap counter · auto-advance · per-item audio · daily progress).
- [ ] Quran: surah index · juz tabs · word-by-word · translation · tafsir · bookmarks ·
      continue-reading · reader-scoped ayah audio (auto-advance/repeat/highlight).
- [ ] Prayer-times full view: timetable · date card · location/method/madhab/adhan/azkar settings.
- [ ] i18n AR/EN switch (every view) · light/dark theme toggle.
- [ ] RTL correctness · offline behavior · adhan still interrupts + resumes the player · both
      Chrome & Firefox builds green.

## Out of scope
SEO/sitemap/JSON-LD (N/A to an extension); admin CMS; Web Push server; PWA service-worker (the
extension is inherently offline). Web code change limited to the single additive
`/api/v1/search` route (P6).

## Execution notes
One phase per session (token rules), matching the model tag. **Order:** P1 → P2 first
(foundations: engine + shell/primitives/router/i18n/theme). P3–P9 are mostly independent verticals
once the shell exists; P10–P11 close out. Every phase ends green (`turbo lint typecheck test build`
+ `build:chrome` + `build:firefox`) before the next. After each phase, append a row to
`apps/extension`'s context + the memory index so progress survives session boundaries.
