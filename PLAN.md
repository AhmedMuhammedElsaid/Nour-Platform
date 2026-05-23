# PLAN.md

> **Audio MVP first.** Ship a playable audio platform in days; everything else is deferred. Each ticket has a recommended Claude model and the reason. The original 8-wave plan is preserved as **Phase 2 (Appendix)** at the bottom — nothing in this MVP forecloses on it.

---

## 0. North Star for the Audio MVP

A visitor lands on the homepage, sees a grid of playlists, clicks one, plays a track in a sticky player, and can move to the next track. An admin can log in, create a playlist, upload audio tracks (direct to R2), reorder them, and publish. That's it.

Everything else — articles, scholars, lectures-as-a-separate-type, books, search, full i18n, dark mode, comments — is **explicitly deferred** to Phase 2.

---

## 1. Definitions

- **Wave** = 1–3 days of scope.
- **DoD** (Definition of Done) per ticket:
  - [ ] Types pass strict.
  - [ ] Zod schema in `packages/api/schemas` (for resources).
  - [ ] Service in `packages/api/services` with auth check + cache invalidation.
  - [ ] UI uses tokens; no hard-coded colors/sizes.
  - [ ] At least one unit + one integration test (Playwright only on the final web wave).
  - [ ] Manual smoke pass before merge.

---

## 2. Model Selection Rubric (apply per ticket)

| Use **Opus 4.6** when | Use **Sonnet 4.6** when | Use **Haiku 4.5** when |
|---|---|---|
| Setting up a new abstraction the rest of the repo will depend on | Implementing a feature following an existing sibling pattern | Cloning a mature pattern across resources |
| Security-sensitive code (auth, RBAC, uploads, CSP) | Standard CRUD, route handlers, server actions | Mechanical refactors (rename, batch edits) |
| Cross-file architectural changes | UI components from shadcn primitives | Updating tests after a refactor |
| Hard debugging where Sonnet failed twice | Writing tests for completed code | Fixture/seed data generation |
| Audio player core logic (one-shot, fiddly) | Forms with TanStack Form + Zod | Documentation updates that mirror code |
| Reviewing security PRs | Reviewing standard PRs | Translation key extraction (Phase 2) |

**Rule of thumb**: One Opus pass is cheaper than three Sonnet retries. If a Sonnet attempt fails twice on the same ticket, escalate to Opus instead of re-prompting.

---

## 3. Dependency Graph (Audio MVP)

```
Wave 0 ─ Foundations ──────┐
                           ▼
Wave 1 ─ Auth (minimal) ───┤
                           ▼
Wave 2 ─ Data + Media ─────┤
                           ▼
Wave 3 ─ Admin CMS ────────┤
                           ▼
Wave 4 ─ Public Web ───────┤  ◀── MVP shipped here
                           ▼
Wave 5 ─ Deploy + Smoke ───┘
```

Total: **12 tickets, ~3–5 days full-time on Pro.**

---

## 4. Wave 0 — Foundations (Day 1, morning)

Goal: Monorepo boots, both apps render a placeholder, base tokens applied, CI green.

| # | Ticket | Model | Why this model |
|---|---|---|---|
| 0.1 | `repo/init-turborepo` — pnpm + Turborepo, tsconfig/eslint presets, both apps boot, `.env.example` | **Opus** | Foundation; every later ticket inherits these configs. Mistakes are expensive. |
| 0.2 | `pkg/ui-bootstrap` — Tailwind preset, `tokens.css` (subset: colors, fs scale, radii), install shadcn, scaffold Button/Input/Dialog/Sheet/Progress/Slider/Toast | **Opus** | Establishes the design token contract; sibling pattern for all later UI work. |
| 0.3 | `pkg/api/skeleton` — `db/client.ts`, `errors`, env Zod parser in `packages/config`, empty `services/` | **Opus** | Sets the layer boundary CLAUDE.md depends on. |
| 0.4 | `infra/ci-baseline` — `ci.yml` running lint/typecheck/test/build via Turborepo affected filter | **Sonnet** | Standard GitHub Actions; well-known territory. |

Exit: `pnpm dev` runs both apps, CI green on `main`.

**Wave 0 token budget: ~80–120k.** Mostly Opus, but small total because scaffolding is concise.

---

## 5. Wave 1 — Auth (minimal) (Day 1, afternoon)

Goal: Single admin user can log into `/admin`, public site is anonymous.

| # | Ticket | Model | Why this model |
|---|---|---|---|
| 1.1 | `api/auth/setup-credentials-only` — Auth.js v5 + Mongo adapter, Credentials provider only, argon2id password hash, `requireSession` helper | **Opus** | Security-critical. Get the cookie flags, JWT settings, and adapter wiring right once. |
| 1.2 | `admin/login-page` — TanStack Form + Zod, error mapping, redirect to `?from` | **Sonnet** | Standard form flow against the auth setup from 1.1. |
| 1.3 | `admin/middleware-gate` — protect `/admin/*` routes, redirect unauthenticated to `/login` | **Sonnet** | Small, follows Auth.js docs pattern. |
| 1.4 | `scripts/seed-admin` — `pnpm seed:admin --email --password` creates the single admin user | **Haiku** | Tiny Node script, no business logic, mechanical. |

**Deferred to Phase 2**: OAuth (Google/GitHub), 2FA/TOTP, lockout, OAuth account linking, role matrix beyond admin/anon, audit logs, rate limiting on auth.

Exit: One admin user exists, can log in, sees an empty dashboard; anonymous user is redirected from `/admin`.

**Wave 1 token budget: ~50–80k.**

---

## 6. Wave 2 — Data + Media (Day 2)

Goal: Schemas for the four MVP collections exist, R2 upload works end-to-end with audio files.

| # | Ticket | Model | Why this model |
|---|---|---|---|
| 2.1 | `api/schemas/mvp` — Zod schemas for `User`, `Playlist`, `Track`, `Media` (audio-focused). One file per resource. | **Opus** | First instance of the schema pattern; sets the convention for Phase 2. |
| 2.2 | `api/db/models+repos` — Mongoose models mirroring the Zod schemas, repos returning `.lean()` DTOs | **Sonnet** | Direct translation from the schemas; follows ARCHITECTURE §3 layer rules. |
| 2.3 | `api/db/migrations/0001` — index migration (unique slug, playlist→tracks query path) + idempotent runner | **Sonnet** | Standard migration pattern; mistakes are recoverable. |
| 2.4 | `api/media/r2-client` — S3-compatible client to R2, `createPresignedUpload`, `headObject`, allowlist audio mimes (`audio/mpeg`, `audio/wav`, `audio/mp4`, `audio/ogg`) | **Opus** | Upload security is sensitive; this is the boundary that protects R2 from abuse. |
| 2.5 | `admin/api/upload+confirm` — `POST /api/upload`, `POST /api/media/confirm`, both behind `requireSession(['admin'])` | **Sonnet** | Two small route handlers against the client from 2.4. |
| 2.6 | `api/services/playlist+track+media` — Service methods with auth + cache tag invalidation | **Sonnet** | CRUD use cases; pattern is established in 2.1. |

**Deferred to Phase 2**: Image uploads + variants, PDF flow, virus scan, multi-bucket scoping, signed GET URLs for private media.

Exit: A script (or Postman) can presign + upload + confirm a real `.mp3` to R2 via the admin API.

**Wave 2 token budget: ~250–350k.**

---

## 7. Wave 3 — Admin CMS (Days 3–4)

Goal: Admin can create a playlist, upload tracks, reorder them, edit metadata, publish/unpublish, delete.

| # | Ticket | Model | Why this model |
|---|---|---|---|
| 3.1 | `admin/playlists-list` — TanStack Table (no Virtual yet — under 100 rows), filter by status, link to edit | **Sonnet** | Standard list page; pattern reusable in Phase 2. |
| 3.2 | `admin/playlists-create-edit` — Full-page form (TanStack Form + Zod), title/description/cover (optional)/status | **Sonnet** | Form pattern; first instance of the "edit page" template. |
| 3.3 | `admin/tracks-upload-ui` — drag-drop uploader inside playlist edit, progress, retry on PUT failure, metadata after confirm | **Opus** | Upload UX has many failure modes (chunked uploads, retry, cleanup of orphans). Worth one Opus pass. |
| 3.4 | `admin/tracks-reorder` — dnd-kit, persists `order` field via batch action, optimistic update | **Sonnet** | Well-trodden territory; dnd-kit examples are abundant. |
| 3.5 | `admin/playlists-publish` — publish/unpublish toggle, `revalidateTag('playlists:home', 'playlist:'+slug)` | **Sonnet** | Standard mutation + cache invalidation pattern. |

**Deferred to Phase 2**: Categories, scholars, articles, lectures, books, homepage-sections CMS, translations editor, SEO settings UI, users management, dashboard analytics widgets.

Exit: Admin can build a playlist with 5 real tracks, reorder them, publish, and the published version is visible via the API.

**Wave 3 token budget: ~350–450k.**

---

## 8. Wave 4 — Public Web + Player (Day 5)  → **MVP shipped here**

Goal: Visitors can browse and listen.

| # | Ticket | Model | Why this model |
|---|---|---|---|
| 4.1 | `web/layout` — header (logo, theme toggle off in MVP), footer (minimal) | **Sonnet** | Static layout. |
| 4.2 | `web/home` — RSC: fetch published playlists via service, render grid of `PlaylistCard` | **Sonnet** | RSC + service call; no fetching libraries. |
| 4.3 | `web/playlist-detail` — RSC: playlist meta + ordered track list, `generateMetadata` for SEO | **Sonnet** | Standard detail page. |
| 4.4 | `ui/AudioPlayer` block — sticky bottom player: play/pause, seek (Slider), current/duration, prev/next, queue, keyboard shortcuts (space, ←/→), persists across navigation | **Opus** | This is the core product. Fiddly state management (media element + queue + global persistence across route changes) deserves the strong model in one pass. |
| 4.5 | `web/player-integration` — wire `AudioPlayer` to playlist detail; clicking a track loads queue, autoplays next, updates URL hash | **Sonnet** | Integration on top of the well-defined block from 4.4. |
| 4.6 | `web/a11y-sweep` — axe pass, focus rings visible, skip link, semantic landmarks, keyboard nav on player + cards | **Sonnet** | Mechanical fixes guided by axe report. |

**Deferred to Phase 2**: Search, scholar pages, article pages, book reader, RSS, OG image generator, dark mode polish, multilingual + RTL, comments, share, motion polish.

Exit: Public site is fully usable for the audio listening flow. Lighthouse a11y > 95.

**Wave 4 token budget: ~300–400k.**

---

## 9. Wave 5 — Deploy + Smoke (Day 5 evening, or Day 6)

Goal: Live on the real domain.

| # | Ticket | Model | Why this model |
|---|---|---|---|
| 5.1 | `infra/vercel-projects` — two Vercel projects (`web`, `admin`), env vars set per environment, domain wired via Cloudflare | **Sonnet** | Configuration ticket; mostly UI clicks documented in DEPLOYMENT.md. |
| 5.2 | `infra/headers+csp` — CSP, HSTS, X-Content-Type-Options, R2 host in `images.remotePatterns`, media-src allowlist | **Opus** | Security headers are easy to get subtly wrong; CSP nonces + R2 host need care. |
| 5.3 | `tests/smoke-playwright` — three E2E tests: login + create playlist + upload track; homepage loads + plays first track; deep link to playlist | **Sonnet** | Standard Playwright; runs on Vercel preview URL. |
| 5.4 | `monitoring/sentry+uptime` — Sentry DSN wired in both apps, UptimeRobot monitor on `/api/health` | **Haiku** | Pure configuration; no logic. |

Exit: Production URL is live, smoke tests green, monitoring online.

**Wave 5 token budget: ~80–120k.**

---

## 10. Total Budget & Calendar

| Pace | Time on Pro plan |
|---|---|
| Full-time focused (8h/day) | **3–5 days** |
| Part-time (4h/day) | **5–8 days** |
| Evenings only (~2h/day) | **~2 weeks** |

| Resource | MVP Total |
|---|---|
| Tickets | 23 |
| Opus tickets | 7 (foundation + security-sensitive + player) |
| Sonnet tickets | 14 (standard implementation) |
| Haiku tickets | 2 (mechanical) |
| Token budget (lean) | **~1.1M total** |
| Token budget (with normal debugging) | **~1.8M total** |

This fits comfortably inside Pro's weekly cap if you spread it over 5–7 days. The risk window is Day 2–3 (Waves 2–3) when admin upload + R2 work creates the most debugging.

---

## 11. Priorities (P0 only inside MVP)

| Feature | Wave | Status |
|---|---|---|
| Admin login | 1 | P0 |
| Audio upload to R2 | 2 | P0 |
| Playlist CRUD | 3 | P0 |
| Track upload + reorder | 3 | P0 |
| Public homepage with playlists | 4 | P0 |
| Playlist detail + player | 4 | P0 |
| Audio player (core) | 4 | P0 |
| Production deploy | 5 | P0 |
| Smoke tests | 5 | P0 |
| Monitoring | 5 | P0 |

Everything in Phase 2 (§13) is **P1+ and explicitly out of MVP scope**.

---

## 12. Risks & Mitigations (MVP-specific)

| Risk | Mitigation |
|---|---|
| Audio player edge cases (resume on navigation, queue, mobile autoplay restrictions) | Single Opus pass on 4.4 with explicit test list (Safari iOS, Chrome Android, desktop) |
| R2 upload retry/cleanup orphans | `/api/media/confirm` is mandatory; nightly cleanup deferred to Phase 2, but the contract is in place |
| Atlas free-tier latency from a cold connection | Reuse cached connection (see DATABASE.md §1); warm via health endpoint |
| Player not pausing on second click (state desync) | Use a single `HTMLAudioElement` ref in a top-level provider (`PlayerProvider` in `apps/web/app/layout.tsx`) |
| Mobile Safari blocks autoplay | Player only plays on user interaction; autoplay-next requires a previous user gesture in the session — documented in 4.4 |
| Scope creep into Phase 2 mid-MVP | If you find yourself touching scholars/articles/lectures, **stop**. Open a separate ticket in Phase 2 and return to MVP |

---

## 13. Phase 2 — Appendix (deferred from original plan, in priority order)

The original 8-wave plan from the first draft becomes Phase 2. Reordered to start with the highest-leverage additions after Audio MVP ships:

| Phase 2 Wave | Theme | Notes |
|---|---|---|
| **P2-A** | Scholars + Categories | One-vertical-at-a-time. Adds scholar profile pages and category filter on playlists. |
| **P2-B** | Lectures (as distinct content type) | Audio/video/transcript trio. Reuses MVP player. |
| **P2-C** | Articles | TipTap editor, markdown rendering, reading time. |
| **P2-D** | Books / PDFs | PDF.js inline reader. |
| **P2-E** | Search | Atlas Search across all content types. |
| **P2-F** | Full i18n (Arabic + RTL) | Per-locale documents, sub-path routing, RTL CSS audit. |
| **P2-G** | Homepage sections CMS | Editable sections via `homepage-sections` collection. |
| **P2-H** | RBAC v2 + 2FA + audit | Multi-role, TOTP, audit log UI. |
| **P2-I** | Comments + bookmarks + notifications | Engagement layer. |
| **P2-J** | Public API + mobile shell | External consumers. |

Each Phase 2 wave follows the **same model rubric** as Wave 0–5 above. The repository layout, services, and design system from the MVP are reused without refactor.

---

## 14. Daily Workflow (AI-assisted)

```
1. Pick the next ticket from the current wave.
2. Open CLAUDE.md §11 (model rubric) and confirm the model.
3. Run: pnpm gen feature <name>   (scaffolds folder if needed).
4. Prompt template (CLAUDE.md §6.1) — reference paths, not file contents.
5. Review the diff against SKILLS.md §7 checklist.
6. Run lint + typecheck + test locally. Commit on green.
7. Open PR; merge when CI is green.
8. Mark the ticket done. Next.
```

The constraint of "one ticket per prompt" keeps each AI session under 2k tokens of context, so you can finish 3–4 tickets per Pro 5-hour window even on Sonnet.

---

## 15. Done Criteria (MVP)

- Production URL is live on the real domain (web + admin).
- An admin can create a playlist, upload at least 3 audio tracks, reorder them, and publish.
- A visitor lands on the homepage, sees the playlist, opens it, plays a track, and the player works on desktop Chrome/Firefox/Safari and mobile Chrome/Safari.
- Lighthouse: performance ≥ 90 (mobile), a11y ≥ 95, best-practices ≥ 95, SEO ≥ 95 on homepage + playlist detail.
- Sentry receives a test error successfully.
- One smoke test runs nightly against production.

When all checked → ship. Phase 2 starts the next morning.

---

## 16. Implementation Status

> Last updated automatically. On resume: read this section + APP_CONTEXT.md instead of exploring the repo.
> Next ticket to implement: **3.1** `admin/playlists-list`

### Wave 0 — Foundations ✅

| # | Ticket | Commit | Status |
|---|---|---|---|
| 0.1 | `repo/init-turborepo` | `6c5202f` | ✅ Done |
| 0.2 | `pkg/ui-bootstrap` | `60c8e5c` | ✅ Done |
| 0.3 | `pkg/api/skeleton` | `97b68b9` | ✅ Done |
| 0.4 | `infra/ci-baseline` | `af0683b` | ✅ Done |

### Wave 1 — Auth ✅

| # | Ticket | Commit | Status |
|---|---|---|---|
| 1.1 | `api/auth/setup-credentials-only` | `26ea693` | ✅ Done |
| 1.2 | `admin/login-page` | `f74d8ba` | ✅ Done |
| 1.3 | `admin/middleware-gate` | `f8f1d83` | ✅ Done |
| 1.4 | `scripts/seed-admin` | `6dcea3d` | ✅ Done |

### Wave 2 — Data + Media ✅

| # | Ticket | Commit | Status |
|---|---|---|---|
| 2.1 | `api/schemas/mvp` | `1235356` | ✅ Done |
| 2.2 | `api/db/models+repos` | `37a47ad` | ✅ Done |
| 2.3 | `api/db/migrations/0001` | `1140bf0` | ✅ Done |
| 2.4 | `api/media/r2-client` | `70d507a` | ✅ Done |
| 2.5 | `admin/api/upload+confirm` | `abf6a5a` | ✅ Done |
| 2.6 | `api/services/playlist+track+media` | `0ccab79` | ✅ Done |

### Wave 3 — Admin CMS 🔲

| # | Ticket | Model | Status |
|---|---|---|---|
| **3.1** | `admin/playlists-list` — TanStack Table, filter by status | Sonnet | ⬜ Next |
| 3.2 | `admin/playlists-create-edit` — TanStack Form + Zod | Sonnet | ⬜ Pending |
| 3.3 | `admin/tracks-upload-ui` — drag-drop, progress, retry | **Opus** | ⬜ Pending |
| 3.4 | `admin/tracks-reorder` — dnd-kit + optimistic update | Sonnet | ⬜ Pending |
| 3.5 | `admin/playlists-publish` — toggle + revalidateTag | Sonnet | ⬜ Pending |

### Wave 4 — Public Web + Player 🔲

| # | Ticket | Model | Status |
|---|---|---|---|
| 4.1 | `web/layout` — header + footer | Sonnet | ⬜ Pending |
| 4.2 | `web/home` — RSC playlist grid | Sonnet | ⬜ Pending |
| 4.3 | `web/playlist-detail` — RSC + generateMetadata | Sonnet | ⬜ Pending |
| 4.4 | `ui/AudioPlayer` — sticky player, queue, keyboard | **Opus** | ⬜ Pending |
| 4.5 | `web/player-integration` — wire player to playlist | Sonnet | ⬜ Pending |
| 4.6 | `web/a11y-sweep` — axe, skip link, semantics | Sonnet | ⬜ Pending |

### Wave 5 — Deploy + Smoke 🔲

| # | Ticket | Model | Status |
|---|---|---|---|
| 5.1 | `infra/vercel-projects` — DEPLOYMENT.md + next.config | Sonnet | ⬜ Pending |
| 5.2 | `infra/headers+csp` — CSP, HSTS, R2 allowlist | **Opus** | ⬜ Pending |
| 5.3 | `tests/smoke-playwright` — 3 E2E smoke tests | Sonnet | ⬜ Pending |
| 5.4 | `monitoring/sentry+uptime` — health endpoint + Sentry | Haiku | ⬜ Pending |
