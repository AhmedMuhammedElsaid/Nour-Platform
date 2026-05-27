# Nour Platform

Islamic audio platform — admins curate playlists of audio tracks, visitors browse and listen on a sticky cross-route player. Built as a Turborepo monorepo with strict TypeScript everywhere.

**Status**: Audio MVP is deploy-ready; the **P2-A Categories** vertical has landed (many-to-many on playlists + public filter bar). Next code work is **P2-B Lectures** — tickets not yet written. See [`PLAN.md`](./PLAN.md) §16 for the live status table.

> If you only have 30 seconds: start at [`APP_CONTEXT.md`](./APP_CONTEXT.md) — it is a hand-maintained snapshot of where files live, what's done, and where the gotchas are. Every contributor (human or AI) loads it first.

---

## Architecture at a glance

```
┌─────────────────────────────────────────────────────────────────┐
│  apps/web  (public site :3000)        apps/admin  (CMS :3001)   │
│  ─────────────────────────────        ────────────────────────  │
│  homepage + filter bar                login + dashboard          │
│  playlist detail + sticky player      playlists CRUD + uploader  │
│                                       categories CRUD            │
│         │                                       │                │
│         └──────────────┬────────────────────────┘                │
│                        ▼                                         │
│              @repo/api  (services)                               │
│   playlist · track · media · auth · category                     │
│   each method validates input, checks RBAC, mutates,             │
│   calls revalidateTag, returns plain DTOs                        │
│                        │                                         │
│                        ▼                                         │
│              @repo/api  (repositories)                           │
│   thin .lean() wrappers over Mongoose models                     │
│                        │                                         │
│                        ▼                                         │
│        MongoDB Atlas     ·     Cloudflare R2 (audio)             │
└─────────────────────────────────────────────────────────────────┘

         shared:  @repo/ui    @repo/config    @repo/tsconfig
                  (tokens +    (Zod env       (strict + Next
                   primitives) parser)        + node presets)
```

The hard rule (CLAUDE.md §5): **apps call services only**. Apps never import from `packages/api/db/*` or `packages/api/repositories/*`. Env reads go through `@repo/config/env`. Errors at boundaries are `AppError`, never raw strings.

---

## Stack

| Concern | Choice | Why |
|---|---|---|
| Monorepo | Turborepo + pnpm workspaces | Cached affected-only builds; native workspace protocol |
| Language | TypeScript strict + `noUncheckedIndexedAccess` | No `any` in production code |
| Apps | Next.js 16 (App Router + Turbopack) | RSC by default; per-app `proxy.ts` for nonce CSP |
| UI | Tailwind v4 + shadcn-style primitives | Design tokens in `packages/ui/src/styles/tokens.css` |
| Forms | TanStack Form v1 + Zod native validators | No adapter needed |
| Data | MongoDB Atlas via Mongoose | Repos return `.lean()` plain DTOs |
| Auth | Auth.js v5 + Credentials + JWT sessions | argon2id passwords; split Node/Edge config |
| Media | Cloudflare R2 (S3-compatible) | 2-step presign + confirm handshake |
| Testing | Vitest (unit + RTL) + Playwright (E2E) | One suite per package |
| Hosting | Vercel × 2 + Cloudflare DNS | Each Vercel project filter-builds its own app |

---

## Quickstart

```bash
pnpm install
cp .env.example .env.local       # fill in MONGODB_URI, AUTH_SECRET (>=32 chars), R2_*
pnpm migrate                     # create indexes (runs 0001 + 0002)
pnpm seed:admin --email <you@example.com> --password <your-password>
pnpm dev                         # boots web (:3000) and admin (:3001) in parallel
```

Generate a strong `AUTH_SECRET`:

```bash
openssl rand -base64 32
```

Don't have R2 yet? Leave the `R2_*` vars unset — dev still boots; uploads will throw `AppError.Internal` only when invoked.

---

## Daily commands

```bash
pnpm dev                    # both apps via turbo
pnpm dev --filter=web       # one app
pnpm dev --filter=admin

pnpm typecheck              # tsc --noEmit across all packages
pnpm lint                   # eslint --max-warnings 0
pnpm test                   # vitest run — packages/api + apps/web + apps/admin
pnpm test:e2e               # playwright smoke tests (auto-boots dev servers)
pnpm build                  # next build, both apps

pnpm migrate                # idempotent index migrations (auto-loads .env.local)
pnpm migrate --dry-run      # show planned changes only
pnpm seed:admin --email <x> --password <y> [--force]  # --force required when NODE_ENV=production
```

CI (`.github/workflows/ci.yml`) runs **lint · typecheck · test · build** on every PR and push to `main`, with the turbo affected filter scoped to changes against `origin/main` on PRs.

---

## Repository layout

```
apps/
  web/                  → public site — see apps/web/README.md
  admin/                → CMS — see apps/admin/README.md
packages/
  api/                  → services, repositories, db models, Zod schemas,
                          R2 client, auth, cache tags, vitest suite
  ui/                   → design tokens, primitives, patterns,
                          audio-player block (cross-route persistent player)
  config/               → @repo/config/env — Zod-parsed env, the ONLY
                          file allowed to read process.env at module load
  tsconfig/             → shared TS presets (node + nextjs)
  eslint-config/        → shared ESLint flat configs
scripts/
  migrate.ts            → pnpm migrate (idempotent runner)
  seed-admin.ts         → pnpm seed:admin (refuses prod without --force)
tests/e2e/              → Playwright smoke tests (web + admin)
.github/workflows/
  ci.yml                → lint · typecheck · test · build
```

---

## Documentation map

Read in this order for a new task:

1. [`APP_CONTEXT.md`](./APP_CONTEXT.md) — **load first**. Hand-maintained snapshot: stack, completed waves, file locations, gotchas.
2. [`PLAN.md`](./PLAN.md) — wave-by-wave delivery plan + current status (§16).
3. [`ARCHITECTURE.md`](./ARCHITECTURE.md) — layer boundaries: apps → services → repos → db.
4. [`CONTRIBUTING.md`](./CONTRIBUTING.md) — branching, commits, PR conventions.
5. [`CLAUDE.md`](./CLAUDE.md) — rules for AI coding agents (same rules apply to humans).

Reference docs:

| File | Purpose |
|---|---|
| [`SECURITY.md`](./SECURITY.md) | MVP security profile + threat model |
| [`DESIGN.md`](./DESIGN.md) | Design tokens + UI conventions |
| [`DATABASE.md`](./DATABASE.md) | Mongo collections, indexes, query paths |
| [`API.md`](./API.md) | Server Actions + route handler contracts |
| [`DEPLOYMENT.md`](./DEPLOYMENT.md) | Hosting strategy + monitoring + scaling |
| [`deploy.md`](./deploy.md) | **Step-by-step runbook** for the first production deploy |

App-specific READMEs:

- [`apps/web/README.md`](./apps/web/README.md) — public site (homepage, filter, playlist detail, sticky player)
- [`apps/admin/README.md`](./apps/admin/README.md) — CMS (auth, playlists, tracks, categories, uploader)

---

## Contributing

The repo is open to outside contributions. Before opening a PR:

1. Read [`APP_CONTEXT.md`](./APP_CONTEXT.md) and the relevant app's README.
2. Read the **Hard boundaries** section of [`CLAUDE.md`](./CLAUDE.md) §5 — non-negotiable.
3. Check [`PLAN.md`](./PLAN.md) §16 — your change should align with an open wave or be a clearly-scoped fix.
4. Open an issue first if you're proposing a new dependency or an architectural change (ADR territory).

**Commits** follow Conventional Commits (`feat:`, `fix:`, `docs:`, `chore:`, `refactor:`, `test:`); see [`CONTRIBUTING.md`](./CONTRIBUTING.md) §5. Wave tickets land as `[AhmedMuhammedElsaid][wip]: wave <N>-<N.N> <description>`.

**Tests required per change type** ([`CLAUDE.md`](./CLAUDE.md) §9):

| Change | Required tests |
|---|---|
| New service | Vitest unit (happy + ≥1 negative) |
| New action / route handler | Integration with mocked session + RBAC enforcement |
| New UI component | RTL component test |
| User-facing flow | Playwright E2E happy path |

**Definition of Done** ([`PLAN.md`](./PLAN.md) §0): lint + typecheck + test + build all green; manual smoke pass; docs updated if the contract changed; new env vars in `.env.example`.

---

## Deploying

The first production deploy is documented step-by-step in [`deploy.md`](./deploy.md) (11 steps + rollback). [`DEPLOYMENT.md`](./DEPLOYMENT.md) is the architectural reference.

CI gates: lint, typecheck, test, build. Each Vercel project (`web`, `admin`) carries its own `vercel.json` so it only builds the workspace it owns via `turbo --filter=<app>...`.

---

## License

(See repo root `LICENSE`. Pick a license at the first public release.)
