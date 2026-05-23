# APP_CONTEXT.md

> Drop-in context for AI sessions. Read this + the relevant PLAN.md ticket. Do NOT read the whole repo.
> Update this file after each wave ticket is committed.

---

## Stack snapshot

- **Monorepo**: Turborepo, pnpm workspaces
- **Apps**: `apps/web` (public, port 3000), `apps/admin` (CMS, port 3001)
- **Shared packages**: `packages/api` (DB, auth, services, schemas), `packages/ui` (tokens + primitives), `packages/config` (env Zod parser), `packages/tsconfig`, `packages/eslint-config`
- **DB**: MongoDB Atlas via Mongoose; repositories return `.lean()` DTOs only
- **Auth**: Auth.js v5 (Credentials + JWT sessions, `@node-rs/argon2`, single admin user)
- **UI**: Tailwind v4, shadcn-style primitives in `packages/ui`, tokens in `packages/ui/src/styles/tokens.css`
- **Forms**: TanStack Form v1 + Zod validators (no separate adapter needed); field layout via `@repo/ui/patterns/form-field`
- **Data fetching**: RSC + service call + Suspense; TanStack Query on client islands
- **CI**: GitHub Actions `.github/workflows/ci.yml` — lint / typecheck / build (turbo affected filter on PRs)

---

## Key boundaries (hard rules from CLAUDE.md)

- Apps import `services` from `@repo/api`, never `@repo/api/db` or `@repo/api/repositories`
- `process.env` only in `packages/config`; everywhere else use `env` from `@repo/config/env`
- No hex colors or arbitrary Tailwind values — tokens only
- Mutations → Server Actions; reading → RSC + service
- Every service method: Zod validate → RBAC check → mutate → revalidate

---

## Completed tickets

| Ticket | Commit | What was built |
|---|---|---|
| 0.1 `repo/init-turborepo` | `6c5202f` | Turborepo init, both apps boot |
| 0.2 `pkg/ui-bootstrap` | `60c8e5c` | `packages/ui`: tokens.css, Tailwind v4, Button/Input/Dialog/Sheet/Progress/Slider/Toaster |
| 0.3 `pkg/api/skeleton` | `97b68b9` | `packages/api`: db/client (Mongoose), AppError, services/, `packages/config` env Zod parser |
| 0.4 `infra/ci-baseline` | `af0683b` | `.github/workflows/ci.yml` lint/typecheck/build |
| 1.1 `api/auth/setup-credentials-only` | `26ea693` | Auth.js v5 config (Node + Edge slices), Credentials provider, argon2id helpers, requireSession, User model + Zod schema |
| 1.2 `admin/login-page` | `f74d8ba` | `app/api/auth/[...nextauth]/route.ts` (handlers), `features/auth/actions/sign-in.action.ts`, `features/auth/components/login-form.tsx` (TanStack Form + Zod), `app/(auth)/login/page.tsx`, `packages/ui/patterns/form-field` |

---

## Next tickets

| # | Ticket | Model | What to build |
|---|---|---|---|
| **1.3** | `admin/middleware-gate` | Sonnet | `apps/admin/middleware.ts` — protect `/admin/*`, redirect unauthenticated → `/login?from=<path>` using Edge auth config |
| 1.4 | `scripts/seed-admin` | Haiku | `scripts/seed-admin.ts` — CLI `pnpm seed:admin --email --password` creates single admin user |
| 2.1 | `pkg/schemas-playlists-tracks` | Sonnet (Opus for schemas) | Zod schemas + Mongoose models for Playlist + Track |
| 2.2 | `pkg/api/playlist-service` | Sonnet | CRUD service methods for playlists |
| 2.3 | `pkg/api/track-service` | Sonnet | CRUD service methods for tracks |
| 2.4 | `infra/r2-client` | Sonnet (Opus) | Cloudflare R2 client, upload helper |
| 2.5 | `admin/playlist-management` | Sonnet | Admin list/create/edit/delete playlists |
| 2.6 | `admin/track-upload` | Sonnet | Admin track upload UX + R2 |
| 3.x | Wave 3 — Web frontend | Sonnet | Public playlist/track pages |
| 4.x | Wave 4 — Audio Player | Sonnet (Opus for 4.4) | AudioPlayer block, queue, persistence |
| 5.x | Wave 5 — Deploy | Sonnet (Opus for 5.2) | Vercel deploy, CSP/headers, Sentry |

---

## Key file locations (quick reference)

```
packages/api/src/
  auth/index.ts          → exports: auth, handlers, signIn, signOut, requireSession
  auth/config.ts         → full Node config (Credentials + Mongo adapter)
  auth/config.edge.ts    → Edge-safe config (JWT callbacks, pages: { signIn: "/login" })
  auth/require-session.ts → requireSession() helper
  auth/password.ts       → hashPassword / verifyPassword (argon2id)
  db/client.ts           → getDb() / disconnectDb()
  db/models/user.model.ts → UserModel
  schemas/user.ts        → User, UserRole, Credentials Zod schemas
  services/auth.service.ts → verifyCredentials()
  errors/index.ts        → AppError + AppErrorCode
  index.ts               → public barrel

packages/ui/src/
  styles/tokens.css      → design tokens (colors, spacing, fonts)
  primitives/button.tsx  → Button (cva variants: default/secondary/outline/ghost/destructive/link)
  primitives/input.tsx   → Input
  primitives/dialog.tsx  → Dialog
  primitives/sheet.tsx   → Sheet
  primitives/toaster.tsx → Toaster (sonner)
  patterns/form-field.tsx → FormField (label + children + error)

apps/admin/
  app/layout.tsx                        → RootLayout (fonts: Inter + Fraunces)
  app/page.tsx                          → placeholder home
  app/(auth)/login/page.tsx             → login page (RSC, reads searchParams.from)
  app/api/auth/[...nextauth]/route.ts   → Auth.js route handler
  features/auth/
    actions/sign-in.action.ts           → signInAction(credentials, redirectTo?)
    components/login-form.tsx           → LoginForm client component (TanStack Form + Zod)
```

---

## Known issues / gotchas

- `next-auth@5.0.0-beta.25` peer warns against Next 16 — expected, works fine
- Auth.js `signIn()` throws a Next.js redirect on success — always re-throw non-AuthError errors
- `searchParams` is a `Promise<{...}>` in Next 15+ — always `await searchParams`
- Mongoose model re-registration: check `mongoose.models.X ?? mongoose.model(...)` pattern
- `@tanstack/react-form` v1: Zod schemas work natively in `validators` — no separate adapter needed
