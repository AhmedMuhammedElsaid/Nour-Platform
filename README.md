# Nour Platform

Islamic audio platform — admins curate playlists of tracks, visitors browse and listen. Audio MVP scope: playlists, tracks, sticky audio player. Scholars, articles, books, lectures, search, and full i18n are Phase 2 (see [`PLAN.md`](./PLAN.md) §13).

## Stack

- **Monorepo**: Turborepo + pnpm workspaces, TypeScript strict
- **Apps**: `apps/web` (public, :3000), `apps/admin` (CMS, :3001)
- **Packages**: `@repo/api` (services + Mongoose), `@repo/ui` (tokens + shadcn primitives + audio player block), `@repo/config` (env), `@repo/tsconfig`, `@repo/eslint-config`
- **Database**: MongoDB Atlas via Mongoose
- **Auth**: Auth.js v5, Credentials provider, argon2id, JWT sessions
- **Media**: Cloudflare R2 (S3-compatible) — presigned upload + confirm handshake
- **Hosting**: Vercel (2 projects), Cloudflare DNS + CDN

## Quickstart

```bash
pnpm install
cp .env.example .env.local       # fill in MONGODB_URI, AUTH_SECRET (>=32 chars), R2_*
pnpm migrate                     # create indexes
pnpm seed:admin --email <you> --password <pw>
pnpm dev                         # boots web (:3000) and admin (:3001) via turbo
```

Generate `AUTH_SECRET`: `openssl rand -base64 32`.

## Verify

```bash
pnpm typecheck      # tsc --noEmit across all packages
pnpm lint           # eslint --max-warnings 0
pnpm test           # vitest run (admin + web)
pnpm test:e2e       # playwright smoke tests (auto-boots dev servers locally)
pnpm build          # next build, both apps
```

CI (`.github/workflows/ci.yml`) runs lint + typecheck + test + build on every PR and push to `main`.

## Documentation

| File | Purpose |
|---|---|
| [`PLAN.md`](./PLAN.md) | Wave-by-wave delivery plan + current status (§16) |
| [`ARCHITECTURE.md`](./ARCHITECTURE.md) | Layer boundaries (apps → services → repos → db) |
| [`DEPLOYMENT.md`](./DEPLOYMENT.md) | Strategy: hosting, monitoring, backups, scaling path |
| [`deploy.md`](./deploy.md) | Step-by-step runbook for the first production deploy |
| [`CLAUDE.md`](./CLAUDE.md) | Rules for AI coding agents working in this repo |
| [`APP_CONTEXT.md`](./APP_CONTEXT.md) | Token-efficient session summary — load this + a PLAN.md ticket |
| [`SECURITY.md`](./SECURITY.md) | MVP security profile + threat model |
| [`DESIGN.md`](./DESIGN.md) | Design tokens + UI conventions |
| [`DATABASE.md`](./DATABASE.md) | Mongo collections, indexes, query paths |
| [`API.md`](./API.md) | Server Actions + route handler contracts |

## Repository layout

```
apps/
  web/      → public site (homepage, playlist detail, audio player)
  admin/    → CMS (auth, playlist + track CRUD, upload)
packages/
  api/      → services, repositories, db models, Zod schemas, R2 client, auth
  ui/       → design tokens, primitives, patterns, audio-player block
  config/   → env (Zod-parsed; sole reader of process.env)
  tsconfig/ → shared TS configs
  eslint-config/
scripts/
  migrate.ts      → pnpm migrate (idempotent index migration runner)
  seed-admin.ts   → pnpm seed:admin (guarded against NODE_ENV=production)
tests/
  e2e/      → Playwright smoke tests (web + admin)
.github/workflows/
  ci.yml    → lint · typecheck · test · build (turbo affected filter on PRs)
```

## Deploying

The first production deploy is documented step-by-step in [`deploy.md`](./deploy.md). DEPLOYMENT.md is the architectural reference; `deploy.md` is the runbook.
