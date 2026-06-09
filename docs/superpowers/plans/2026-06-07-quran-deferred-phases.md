# Quran Deferred Features (Phase 3 + Phase 4) — parked design + context

> This file captures BOTH deferred Quran phases so either can be resumed cold:
> - **Part A — Phase 3: Search** (design ~80% done, no code)
> - **Part B — Phase 4: Mushaf view · reader pickers · R2 audio mirroring** (context + steps, not yet designed in depth)
>
> The shipped Quran reader (P1 + P2) is production-worthy without these; they are additive.

---

# Part A — Phase 3: Search

**Status:** PARKED mid-brainstorm (no code written). Design Sections 1 & 2 approved by the
owner; Section 3 (web UI) drafted, not yet approved. Resume by finishing Section 3, writing
the spec → plan (writing-plans), then executing.

**Branch:** `feature/quran-reader` (Quran P1 + P2 already shipped & green here).
**Model rule:** plan on Opus; execute Sonnet (feature work) / Haiku (mechanical). See routing below.

---

## Context (where this fits)

The Quran vertical already shipped on `feature/quran-reader`:
- **P1**: reader (Arabic text, translation, word-by-word, per-ayah audio, surah/juz index,
  device-local prefs/bookmarks/last-read). Collections: `quranSurahs`, `quranAyahs`
  (embedded `words[]`), `quranEditions`, `quranTranslations`, `quranReciters`. Service
  `packages/api/src/services/quran.service.ts` (pure public reads). Seed `scripts/seed-quran.ts`.
- **P2**: tafsir (`quranTafsir` collection + `getTafsir` + cached `/api/quran/tafsir` route +
  bottom-sheet), `/quran/bookmarks` page, homepage continue-reading shelf, `numberGlobal`
  deep-links. Migration `0010-quran-tafsir-indexes`.

**Phase 3 = Quran search ONLY** (search was the sole P3 item; pickers/mushaf/R2 are P4).

Existing global search to mirror: `packages/api/src/services/search.service.ts`
(`searchContent(locale, q, limit)` over playlists+tracks via `$text`; migration
`0006-search-indexes`; never throws on blank/invalid query — returns empty). NOTE: a MongoDB
collection may hold only ONE text index.

---

## Decisions (locked)

| Decision | Choice |
|---|---|
| Scope | **Search only** (no pickers/mushaf/R2 this wave) |
| Search target | **Both Arabic text + translations** (Sahih EN + Muyassar AR) |
| Arabic matching | **Diacritic-normalized field + normalize-both-sides** (query typed bare must match Uthmani) |
| UI location | **Dedicated `/[locale]/quran/search`** (scoped, paginatable; NOT folded into global `/search`) |
| Auth | None (public read, like the rest of the Quran service) |

---

## Section 1 — Data, normalization & indexes ✅ approved

- **New util `packages/api/src/utils/arabic.ts` → `normalizeArabic(s: string): string`**:
  strips harakat (U+064B–U+0652), superscript alef (U+0670), tatweel (U+0640), Quranic
  annotation marks (U+06D6–U+06ED); folds alef variants `أ إ آ ٱ → ا`, `ى → ي`, `ة → ه`.
  Applied at BOTH index-build time and query time so they match. Unit-test it.
- **`quranAyahs` gains `textNormalized`** (normalized copy of `textUthmani`) + a `$text` index
  on it with `default_language: "none"` (no Latin stemming). (Ayah collection has no text index today.)
- **`quranTranslations` gains a `$text` index on `text`** (covers all editions in one index).
- **Migration `0011-quran-search-indexes`**: (1) backfill `textNormalized` for the 6,236
  existing ayahs from `textUthmani` (idempotent string transform), (2) create both text
  indexes. Additive; run `pnpm migrate --only 0011-quran-search-indexes`; never full chain.
- **Update `scripts/seed-quran.ts`** to compute `textNormalized` when writing ayahs going forward.
- Add `quranAyahs.textNormalized` to the schema/model; register the migration in `scripts/migrate.ts`
  + add the `package.json` export entry (per the repo's every-new-subpath rule).

---

## Section 2 — Service & repo ✅ approved

- **`schemas/quran.ts`**: add
  - `QuranSearchHit` = `{ surah, ayahInSurah, numberGlobal, surahName: { ar; en }, textUthmani, translation: string | null }`
  - `QuranSearchResult` = `{ hits: QuranSearchHit[]; total: number; query: string }`
- **`repositories/quran.repo.ts`**:
  - `searchAyahsByNormalized(normalizedQuery, limit)` → `$text` over `quranAyahs.textNormalized`, lean docs, sort by `$meta` textScore.
  - `searchTranslations(rawQuery, limit)` → `$text` over `quranTranslations.text` → `{ editionSlug, numberGlobal }[]`.
  - `findAyahsByGlobals(numberGlobals: number[])` → ayah docs for a set of global numbers (hydrate translation-only hits).
- **`services/quran.service.ts` → `searchQuran(locale, rawQuery, limit = 20): Promise<QuranSearchResult>`**:
  1. Guard blank/too-short → `{ hits: [], total: 0, query }` (never throw).
  2. Run both searches in parallel: `normalizeArabic(query)` over ayahs + raw query over translations.
  3. Merge by `numberGlobal` (dedupe); hydrate missing ayahs via `findAyahsByGlobals`; attach the
     **locale-default translation** per hit (reuse `findTranslationsForGlobalRange` on the result set);
     resolve surah names via `listSurahs` lookup.
  4. Arabic textScore hits first; cap at `limit`. Pure read, no auth.
- Add the `./services/quran` export already exists; no new export needed for the method.

---

## Section 3 — Web UI ⏸ drafted, NOT yet approved (finish this on resume)

- **Search box on `/[locale]/quran` index** → navigates to `/[locale]/quran/search?q=<q>`
  (mirror `features/search/components/search-box.tsx`, inline SVG, no lucide in web).
- **Route `app/[locale]/quran/search/page.tsx`** (RSC, `force-dynamic`, `robots: noindex` +
  self-canonical like the global `/search`): reads `?q=`, calls `searchQuran(locale, q)`,
  renders hits grouped by surah — each hit shows the Arabic ayah (`font-quran`) + the
  locale translation snippet, links to `/quran/<surah>#ayah-<numberGlobal>` (reader already
  scrolls to that anchor). Empty state for no query / no results.
- **i18n**: add `quran.searchPlaceholder`, `quran.searchPrompt`, `quran.searchNoResults`,
  `quran.searchResults` (ar/en parity).
- Optional: surface the Quran search box in the header or leave it on the `/quran` index only
  (decide on resume).

**OPEN QUESTION on resume:** confirm dedicated-only UI (current plan) vs. also adding a Quran
section to global `/search`.

---

## Testing (per CLAUDE.md §9)

- **API unit:** `normalizeArabic` (diacritics stripped, alef/ya/ta folding, idempotent);
  `searchQuran` (Arabic bare query matches diacritized ayah, English query matches translation,
  merge/dedupe by numberGlobal, blank query → empty, locale translation attached).
- **Web RTL:** search results page (grouping, deep-link href `#ayah-<numberGlobal>`, empty state);
  search box (submit → navigate).
- **E2E:** extend `tests/e2e/quran.smoke.test.ts` — type a query → result → click → lands on the
  ayah. Requires seed (incl. backfilled `textNormalized` via migration `0011`).

---

## Migration / ops notes

- Run `pnpm migrate --only 0011-quran-search-indexes` against Atlas after deploy (backfills
  `textNormalized` + builds indexes). Re-running the seed (`pnpm seed:quran`) also writes
  `textNormalized` and calls the migration (self-contained), per the P1/P2 pattern.
- Atlas free tier: `textNormalized` ~doubles the ayah text storage (~15–20 MB → still fine).

---

## Model routing (for the eventual plan)

| Task | Model |
|---|---|
| `normalizeArabic` util + tests · `searchQuran` service + repo + tests | **Sonnet** |
| `0011` migration (backfill + indexes) · seed update | **Sonnet** |
| schema additions · package.json export · migrate.ts register | **Haiku** |
| search page + search box (clone of global search) | **Sonnet** |
| i18n strings · APP_CONTEXT update · E2E | **Haiku** (E2E **Sonnet**) |
| Brainstorm/plan refinements | **Opus** |

---

---

# Part B — Phase 4: Mushaf view · reader pickers · R2 audio mirroring

**Status:** PARKED, not yet brainstormed in depth. The notes below are enough to start a
proper brainstorm (Opus) → spec → plan when picked up. All three are independent and could be
separate sub-waves; suggested order: pickers (cheapest) → mushaf (biggest) → R2 (infra).

## B1 — Reader pickers (multi-translation / multi-reciter / selectable tafsir)

**What:** let the user choose among several translations, reciters, and tafsir editions in the
reader settings sheet (today each is a single locale-default).

**Already in place (low lift):**
- `reader-settings-sheet.tsx` already renders translation + reciter `<select>`s wired to
  `?translation=` / `?reciter=` URL params; `getSurahReader` already accepts `translationSlug`/`reciterSlug`.
- `getTafsir` already accepts an `editionSlug`; the tafsir route accepts `?edition=`.
- `listEditions()` / `listReciters()` services already exist to populate the dropdowns.
- `QuranPrefs` already persists `translationSlug` / `reciterSlug` (add `tafsirSlug`).

**Work:**
1. **Seed more editions** in `scripts/seed-quran.ts`: a few more translations (e.g. en.pickthall,
   en.yusufali, ar.jalalayn) + reciters (everyayah.com has many — Husary, Sudais, Minshawi,
   Shuraim; each is just a `{ slug, name, audioBase }` row) + 1–2 more tafsir editions.
   Verify quran.com/Al-Quran-Cloud ids + everyayah folder names live (P1/P2 lesson).
2. Populate the settings-sheet selects from `listEditions()`/`listReciters()` passed into the reader
   (currently only the single resolved edition/reciter is passed — pass the full lists from the page).
3. Add a **tafsir edition picker** (`?tafsir=` param + `tafsirSlug` pref; pass to `TafsirSheet`).
4. i18n + tests (RTL for the new selects; service tests already cover explicit slugs).

**Model:** mostly **Haiku** (seed rows + wiring existing pickers); **Sonnet** for the tafsir-param plumbing.

## B2 — Mushaf-page (604-page) view

**What:** a toggle between the continuous-list reader and a page-by-page mushaf view (swipeable).

**Already in place:** every `quranAyahs` doc has `page` (1–604) + `pageStart`/`pageEnd` on surahs;
`QuranPrefs.layout` is already `"list" | "mushaf"`; `quranAyahs` has a `{ page }` index.

**Work:**
1. Repo `findAyahsByPage(page)` + service `getPageReader(page, opts)` → ayahs for that page
   (reuse the `ayahToReaderDto` mapping; audio/translation as in `getSurahReader`).
2. Route: either `app/[locale]/quran/page/[n]/page.tsx` or an in-reader mode switch. Swipe between
   pages (prev/next page links + touch). Render Arabic with `font-quran`, page number, sajda markers.
3. Settings-sheet `layout` toggle already exists in `QuranPrefs` — wire it to switch modes.
4. **Scope decision for the brainstorm:** v1 = text reflow per page (NOT pixel-perfect mushaf lines).
   True line-accurate layout needs the KFGQPC per-page "QPC" glyph fonts (heavy, ~600 font files) —
   defer that to a later pass; note it as the known limitation.
5. Tests: service (page → ayahs), RTL (page renders, swipe nav), E2E.

**Model:** **Sonnet**, escalate to **Opus** for the pagination/virtualization + swipe state machine.

## B3 — R2 audio mirroring

**What:** mirror per-ayah recitation mp3s from everyayah.com into the project R2 bucket for
resilience + offline replay (today `audioUrl` is computed against everyayah.com directly).

**Already in place:** `packages/api/src/media/r2-client.ts` (`createPresignedUpload`, `headObject`);
PWA service worker caches played audio (needs R2 CORS — see `deploy.md`).

**Work:**
1. A script that, per reciter, downloads each ayah mp3 from `audioBase` and uploads to R2 under a
   stable key (e.g. `quran/<reciterSlug>/<pad3(surah)><pad3(ayah)>.mp3`); idempotent (skip existing
   via `headObject`). ~6236 files/reciter — large; run selectively.
2. Add a `mirrored: boolean` (or an R2 `audioBase`) to `quranReciters`; `audioUrlFor` prefers the
   R2 URL when mirrored, else everyayah.com.
3. **R2 CORS** must allow the web origin (deploy.md step 2.4) for offline/Range playback.
4. Storage: full reciter set is GBs — NOT on the free Mongo tier (audio lives in R2, not Mongo), but
   mind R2 storage/egress cost. Start with one reciter.

**Model:** **Sonnet**; **Opus** if presign/CORS/security details get involved.

---

## Resume checklist (either part)

1. Re-read this file + `APP_CONTEXT.md` Quran P1/P2 rows.
2. For Search (Part A): finish Section 3 UI decision → `superpowers:writing-plans`.
3. For P4 (Part B): `superpowers:brainstorming` the chosen sub-feature → spec → plan.
4. Branch off `main` (Quran P1+P2 should be merged by then) or continue on `feature/quran-reader`.
5. Tag plan tasks with `<!-- model: … -->` per the routing tables above; execute subagent-driven.
