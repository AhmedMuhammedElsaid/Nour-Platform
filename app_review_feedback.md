# App Review Feedback

> Generated 2026-05-24 against `main` @ `f3567d1` (P2-A Categories shipped).
> Source: three parallel subagent audits — build/test/lint, code-quality/boundaries, security/deploy.
> **Headline: `main` is not as green as APP_CONTEXT claims; CI is currently red.**

---

## Ship-blockers (fix before next deploy)

ha

`--max-warnings 0` is tripped by two dead bits left from the P2-A wave:

- `packages/api/src/db/migrations/0002-category-indexes.ts:31` — unused `eslint-disable` directive
- `packages/api/src/repositories/category.repo.ts:5` — `Category` imported but never used

### 2. Admin build crashes without live Mongo

`apps/admin/app/playlists/{,new,[id]/edit}/page.tsx` and `app/categories/{,new,[id]/edit}/page.tsx` lack `export const dynamic = "force-dynamic"`.

The hardening sprint added the directive to web pages but not admin; `next build` tries to prerender these RSC pages and gets `MongooseServerSelectionError: ECONNREFUSED 127.0.0.1:27017`. Vercel deploy will succeed (real Atlas URI) but any CI build step without Mongo fails.

### 3. `pnpm turbo run build` doesn't forward env vars

`turbo.json` lacks an `env` / `passThroughEnv` array, so under turbo 2.9's strict-env mode the parent shell's `MONGODB_URI` / `AUTH_SECRET` never reach the child `next build`. The `@repo/config/env` Zod parser then throws "Required" at page-data collection.

This is not a Windows artifact — Linux CI on Ubuntu will fail the same way. The "deploy-ready" claim is no longer fully accurate.

---

## Real bugs / security

### 4. `confirmMedia` doesn't validate the upload

`packages/api/src/services/media.service.ts:97` calls R2 `headObject` but never compares `meta.contentLength` / `meta.contentType` against the pending Media record's `sizeBytes`/`mimeType`.

A client can presign for a 1 MB `audio/mpeg`, then PUT 500 MB of arbitrary bytes, and `confirmMedia` still flips status to `confirmed`. R2's signed PUT enforces the headers at upload time, but defense-in-depth was the whole point of the two-step handshake. Contradicts `SECURITY.md` §5.

**Fix:** before `updateMediaById`, assert `meta.contentLength === existing.sizeBytes && meta.contentType === existing.mimeType`, else `throw AppError.Validation(...)`.

### 5. CSP includes both `'strict-dynamic'` and `'unsafe-inline'`

`apps/web/lib/csp.ts:20` and `apps/admin/lib/csp.ts:13` set script-src with both directives.

Modern CSP3 browsers ignore `'unsafe-inline'` when `'strict-dynamic'` is present, but CSP2-only clients honor `'unsafe-inline'` and silently disable nonce enforcement. `SECURITY.md` §7 spec omits it.

**Fix:** drop `'unsafe-inline'` from script-src. Next 16 nonce propagation is reliable enough not to need the fallback.

### 6. Misleading comment in `category.service.ts:175-185`

Comment claims "PlaylistModel.schema does not currently define `categoryIds`, so this `$pull` is harmless today." It *does* define it — `playlist.model.ts:33`, added in P2-A.4 — and the cascade is now load-bearing.

Risk: a future "cleanup" pass deletes the `$pull` based on the stale comment, silently breaking referential integrity.

---

## Lower priority

### 7. `createPlaylist` skips `revalidateTag`

`playlist.service.ts:131-157` mutates but emits no `revalidateTag`. Fine in practice because new playlists default to `status: "draft"` (invisible publicly), but worth a `// no revalidate — drafts aren't on the homepage` comment so it doesn't look like an oversight.

### 8. Raw cache-tag strings instead of central constant

`playlist.service.ts:182, 197, 207, 219` (and tests at `playlist.service.test.ts:105`, `category.service.test.ts:233`) pass `"playlists:home"` as a string literal. P2-A introduced `PLAYLISTS_HOME` in `packages/api/src/cache/tags.ts`; pre-existing playlist service was never migrated.

### 9. Stale `middleware.ts` references in comments

The hardening sprint renamed `middleware.ts` → `proxy.ts` in both apps for Next 16, but doc-comments still refer to the old name:

- `apps/web/app/page.tsx:6`
- `apps/web/app/playlists/[slug]/page.tsx:6`
- `apps/web/next.config.ts:18`
- `apps/admin/next.config.ts:18`
- `apps/web/lib/csp.ts:2`
- `apps/web/proxy.ts:16, 18, 43`
- `apps/admin/proxy.ts:10`

### 10. `as` cast without explanation

`apps/admin/proxy.ts:49` — `as unknown as NextMiddleware` on the default export. Acceptable adapter boundary but lacks the explaining comment CLAUDE.md §4 requires for `as` casts.

### 11. `as any` in test infra

`apps/web/vitest.setup.ts:46` — `(window as any).Audio = MockAudio`. Allowed in tests per ESLint override, but a `Window & { Audio: typeof MockAudio }` cast is one extra word and self-documenting.

---

## Clean (good news — no findings)

- **Auth/RBAC:** all 11 mutating service methods enforce `requireSession(['admin'])`. `require-session.ts:18` does a real role check, not just session presence. `AUTH_SECRET` sourced from env; argon2id only; no plaintext password path.
- **Boundaries:** zero `apps/*` → `@repo/api/db|repositories` violations. No `process.env.X` outside documented exceptions (health endpoints, `next.config.ts`, `@repo/config`).
- **Code hygiene:** zero `console.log` / TODO / FIXME / HACK in src. No raw `new Error("...")` in services/actions. No Tailwind arbitrary values (`text-[#...]`, `[14px]`). No default exports on utility/service files.
- **Tests:** all 5 services in `packages/api` have sibling `.test.ts`. 82 tests total (34 API + 38 admin + 10 web), all green.
- **Headers:** HSTS (2y, preload, includeSubDomains), X-Frame-Options DENY, Permissions-Policy, X-Content-Type-Options, Referrer-Policy correct in both `next.config.ts`. CSP correctly not duplicated there.
- **CSP nonce:** regenerated per request via `crypto.randomUUID()` in both proxies.
- **Env:** `.env.example` uses placeholders only. `env.ts` Zod-validates with `AUTH_SECRET.min(32)` and `MONGODB_URI.url()`. `.env.example` ↔ `env.ts` schema in sync.
- **R2 client:** lazy singleton, 15-min presigned-URL TTL, server-generated keys (`audio/${randomUUID}.${ext}`) — no path traversal risk.
- **Convention check:** `Category.model.ts` is the only PascalCase model file (matches APP_CONTEXT's documented outlier). No stray `middleware.ts` files remain after the rename.

---

## APP_CONTEXT.md drift

- **"19 vitest unit tests"** in the hardening-sprint row — actual is **34** (P2-A added 15 category tests).
- **"Pre-existing build-blockers fixed: `/` + `/playlists/[slug]` marked `dynamic = force-dynamic`"** — only applied to **web**; admin equivalents still missing it (see blocker #2).
- **`deploy.md:226`** lists "Nonce-based CSP" as post-deploy hardening — already shipped in `40ef84c` (hardening sprint).

---

## Recommended fix order

| # | Task | Model | Est. |
|---|---|---|---|
| 1 | Lint dead code (blockers #1) | Haiku | 2 min |
| 2 | Add `force-dynamic` to 6 admin RSC pages (blocker #2) | Haiku | 10 min |
| 3 | Turbo env pass-through in `turbo.json` (blocker #3) | Sonnet | 15 min |
| 4 | `confirmMedia` size/mime cross-check + test (#4) | Sonnet | 30 min |
| 5 | Drop `'unsafe-inline'` from script-src + Playwright smoke (#5) | Sonnet | 20 min |
| 6 | Fix misleading `category.service.ts` comment (#6) | Haiku | 1 min |
| 7 | Migrate raw tag strings to `PLAYLISTS_HOME` constant (#8) | Haiku | 5 min |
| 8 | Sweep `middleware.ts` → `proxy.ts` comments (#9) | Haiku | 5 min |
| 9 | Add explaining comment to admin `proxy.ts` cast (#10), narrow `vitest.setup.ts` type (#11), add `createPlaylist` no-revalidate comment (#7) | Haiku | 5 min |
| 10 | Refresh APP_CONTEXT.md drift items | Haiku | 5 min |

Total: ~100 minutes of focused work to get back to a genuinely green `main`.
