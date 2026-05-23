# PLAN.md vs Built — Audit & Recommended Actions

## Context

You asked: does the codebase match PLAN.md, are there mandatory fixes/refactors, and is anything from the plan still unimplemented? I cross-checked PLAN.md §4–9 (Waves 0–5) and the DoD in §1 against APP_CONTEXT.md and the actual repo state (single Explore pass to catch drift). Head of `main` = `6e87d31`.

**Headline**: Audio MVP is functionally complete. No mandatory code fixes block deploy. A handful of soft gaps and known TODOs are worth closing **before P2-A** so the pattern propagates clean across new verticals.

> **✅ Status update**: Hardening sprint (Option 1 below) has been **executed** in the current session. All five items from the original gap list shipped, plus one pre-existing Turbopack bug that surfaced during build verification. See the per-row outcomes below.

---

## Comparison: PLAN.md tickets vs reality

| Wave | Tickets | Status | Notes |
|---|---|---|---|
| 0 — Foundations | 0.1–0.4 | ✅ Verified | Turborepo, tokens, api skeleton, CI all real |
| 1 — Auth | 1.1–1.4 | ✅ Verified | Auth.js split (Node + Edge), argon2id, seed script with prod guard |
| 2 — Data + Media | 2.1–2.6 | ✅ Verified | Schemas/models/repos/migrations/R2/upload all real, `requireSession` in services |
| 3 — Admin CMS | 3.1–3.5 | ✅ Verified | List, form, uploader, dnd reorder, publish toggle present and wired |
| 4 — Public Web + Player | 4.1–4.6 | ✅ Verified | Layout, RSC pages, sticky player, keyboard, skip-link + semantic landmarks |
| 5 — Deploy + Smoke | 5.1–5.3 ✅, 5.4 ⚠️ | Matches APP_CONTEXT | Sentry SDK intentionally deferred; UptimeRobot is a manual step |

**No PLAN.md ticket is missing or incomplete that wasn't already flagged.**

---

## Findings (sorted by severity)

### 1. Mandatory fixes (block deploy or user-visible defect)
**None.** Deploy-ready as APP_CONTEXT.md states.

### 2. Soft gaps worth closing before P2-A — ✅ ALL SHIPPED

| # | Item | Status | Outcome |
|---|---|---|---|
| A | **Unit tests for services** | ✅ Done | New vitest suite at `packages/api/vitest.config.ts` + 19 tests across `playlist`/`track`/`media`/`auth` services. Mocks repos, `requireSession`, `next/cache`, R2. ESLint override allows `any` only inside `src/**/*.test.ts` so fixtures stay terse. |
| B | **Nonce-based CSP** | ✅ Done | Per-app `middleware.ts` emits a per-request nonce; `lib/csp.ts` builds `script-src 'self' 'nonce-…' 'strict-dynamic'`. Dropped `'unsafe-inline'` from script-src. Static CSP removed from both `next.config.ts`. Web RSC pages forced `dynamic = "force-dynamic"` (required because a per-request nonce ≠ static cache). |
| C | **Health-endpoint env access** | ✅ Resolved as documented exception | Investigated: importing `@repo/config/env` breaks `next build` because the route is evaluated during page-data collection without `MONGODB_URI`. Kept direct `process.env` access with a comment marking it the canonical exception to CLAUDE.md §5 (same pattern as `next.config.ts`). |
| D | **APP_CONTEXT seek doc drift** | ✅ Done | Updated to ±10s and noted the editable-target guard. |
| E | **Fragile auth side-effect import** | ✅ Done | Replaced with `/// <reference path="../types/next-auth.d.ts" />` in `auth/index.ts` and `auth/config.edge.ts`. ESLint override whitelists the directive on those two files only. IDE "organize imports" actions cannot strip a reference directive. |
| F | *(Surfaced during build verification)* Turbopack `"use server"` re-export bug | ✅ Done | `create-playlist.action.ts` was re-exporting `playlistFormSchema` (Zod) + types from a `"use server"` file; Next 16 + Turbopack treats the whole module as having "no exports at all". Importers now pull the schema directly from `schemas/playlist-form.schema.ts`. Build is green. |

### 3. Intentionally deferred (no action needed)
- Sentry SDK install (Wave 5.4) — env var stubbed; `.env.example` marks optional.
- UptimeRobot wiring — manual, lives in `deploy.md` step 6.
- Nightly orphan-Media cleanup (PLAN.md §12 risk row) — contract in place via `/api/media/confirm`; sweep is Phase 2.

### 4. Not in MVP plan (correctly out of scope)
All of PLAN.md §13 P2-A through P2-J: Scholars+Categories, Lectures, Articles, Books, Search, i18n+RTL, homepage CMS, RBAC v2 + 2FA + audit, comments/bookmarks, public API. **Not gaps** — these are the next phase. Tickets not yet written; APP_CONTEXT.md correctly says "brainstorm + plan before coding."

---

## Recommended next action — ✅ Option 1 executed

The hardening sprint (A + B + C + D + E + the F bug surfaced along the way) is **shipped**. P2-A starts on a clean slate.

Next step: brainstorm + write the **P2-A Scholars + Categories** wave plan (Opus per CLAUDE.md §15.7). No P2 tickets exist yet.

---

## Verification — ✅ all green

- `pnpm turbo run lint typecheck test` → 13/13 successful tasks.
- `pnpm --filter @repo/api test` → 19 tests pass (playlist 6, track 4, media 5, auth 4).
- `cd apps/admin && pnpm build` + `cd apps/web && pnpm build` → both compile end-to-end with `MONGODB_URI` + `AUTH_SECRET` set (CI mirrors this).
- One Explore pass earlier in the session confirmed: Sentry deps absent, skip-link + `<main>` present, Playwright tests contain real `expect()` calls, migration runner real, `revalidateTag` called in publish path, keyboard handlers wired, no `console.log` or boundary import violations.
