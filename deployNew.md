# deployNew.md

> Two step-by-step approaches for the Nour Platform:
> **A) Run it locally** (dev on your machine) and **B) Deploy to production** (Vercel).
> Each step ends with a **verify** check before you move on.
>
> For production, [`deploy.md`](./deploy.md) remains the canonical 11-step runbook;
> Approach B here is the condensed path and points back to it for detail.

## Context — why this file exists

Both apps (`apps/web` public :3000, `apps/admin` CMS :3001) are code-complete and
deploy-ready, but a fresh checkout won't run until real environment values are in
place. The config parser ([`packages/config/src/env.ts`](./packages/config/src/env.ts))
validates env **at module load**, so:

- `MONGODB_URI` must be a valid URL (the homepage queries playlists; admin login reads users).
- `AUTH_SECRET` must be ≥ 32 chars (Zod `min(32)`) — the `.env.example` placeholder fails this.
- `R2_*` vars are **optional**; without them dev still boots, but uploads throw
  `AppError.Internal` when invoked. Uploads need all four:
  `R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`.

The browser PUTs files **directly** to R2 from the app origin, so the bucket also
needs a CORS policy allowing that origin.

Prerequisites (both approaches):

```
node --version          # >= 22   (verified locally: v24.6.0)
pnpm --version          # >= 9    (verified locally: 9.15.0)
git --version
```

---

# Approach A — Make it work locally

Goal: both apps booting locally against a real **Atlas** database, with **R2**
uploads working end-to-end, and a seeded admin login.

> This edits only `.env.local` (gitignored). No source changes.

## A1 — Provision MongoDB Atlas (free M0)

1. Create a free **M0** cluster at <https://cloud.mongodb.com>.
2. **Database Access** → add a user (username + password).
3. **Network Access** → add your current IP (or `0.0.0.0/0` for dev only).
4. **Connect → Drivers** → copy the `mongodb+srv://...` string.
5. Insert user/password and add the DB name `nour` before the `?`:
   `mongodb+srv://<user>:<pass>@<cluster>.mongodb.net/nour?retryWrites=true&w=majority`
   - URL-encode special characters in the password (`@` → `%40`, etc.).

**Verify:** `pnpm migrate --dry-run` (after A3) prints planned indexes, no errors.

## A2 — Provision Cloudflare R2

1. Cloudflare dashboard → **R2** → create a bucket named `nour-media`.
2. **R2 → Manage API Tokens** → create an **Object Read & Write** token →
   copy **Access Key ID** + **Secret Access Key**.
3. Endpoint: `https://<account-id>.r2.cloudflarestorage.com`.
4. **Public access**: enable the bucket's `*.r2.dev` dev URL (or a custom domain) →
   this becomes `R2_PUBLIC_BASE` (e.g. `https://pub-<hash>.r2.dev`).
5. **CORS** (required — browser PUTs from the admin origin). Add to the bucket:
   ```json
   [{ "AllowedOrigins": ["http://localhost:3001"],
      "AllowedMethods": ["PUT","GET","HEAD"],
      "AllowedHeaders": ["*"],
      "ExposeHeaders": ["ETag"] }]
   ```

**Verify:** the `nour-media` bucket exists and the API token was created.

## A3 — Fill in `.env.local`

Edit `.env.local` (do **not** touch `.env.example`):

```
NODE_ENV=development
MONGODB_URI=<the Atlas string from A1>
AUTH_SECRET=<32+ char secret — see below>
R2_ACCESS_KEY_ID=<from A2>
R2_SECRET_ACCESS_KEY=<from A2>
R2_BUCKET=nour-media
R2_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
R2_PUBLIC_BASE=<public bucket URL from A2>
NEXT_PUBLIC_WEB_URL=http://localhost:3000
NEXT_PUBLIC_ADMIN_URL=http://localhost:3001
```

Generate `AUTH_SECRET` on Windows (no `openssl` needed):

```
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

> If `R2_PUBLIC_BASE` uses a non-`*.r2.dev` custom domain, that hostname must be
> in `apps/web/next.config.ts` `images.remotePatterns` for `next/image` covers to
> render (and it feeds the web CSP). Only adjust if covers 404 during verify.

**Verify:** no "Invalid environment variables" error on the next command.

## A4 — Create indexes

```
pnpm migrate                 # runs 0001-indexes + 0002-category-indexes (idempotent)
```

**Verify:** command completes; Atlas shows indexes on `users`/`playlists`/`tracks`/`media`.

## A5 — Seed an admin user

```
pnpm seed:admin --email you@example.com --password "<your-password>"
```
(`--force` is only needed when `NODE_ENV=production`.)

**Verify:** Atlas `users` collection has one doc, `role: "admin"`, argon2 `$argon2id$` hash.

## A6 — Boot the apps

```
pnpm dev                     # both apps via turbo (web :3000, admin :3001)
# or one at a time:
pnpm dev --filter=web
pnpm dev --filter=admin
```

## A — Verification (end-to-end)

1. **Web** — <http://localhost:3000> renders (empty grid OK) with the filter bar, no CSP errors.
2. **Admin login** — <http://localhost:3001>, log in with A5 creds → lands on admin home, not `/login`.
3. **Create playlist** — `/playlists/new`, save → appears in `/playlists` table.
4. **Upload track** — edit page, drag an audio file (mp3/wav/m4a/ogg, ≤50 MiB):
   presign → PUT to R2 (200, no CORS error) → confirm → row appears.
   A CORS failure means A2.5 needs fixing.
5. **Publish + play** — publish, reload web homepage, open detail, click a track →
   sticky player plays and survives navigation (space = play/pause, ←/→ = seek ±10s).
6. **Health** — `/api/health` on both ports returns `{ ok: true, ... }`.

Optional gate: `pnpm typecheck && pnpm lint && pnpm test`.

---

# Approach B — Deploy to production (Vercel)

Goal: web + admin live on Vercel, backed by a **production** Atlas cluster and R2
bucket, with a CDN domain for media. Two Vercel projects, each filter-building its
own app via its `vercel.json`.

> Canonical detail + rollback + done-criteria: [`deploy.md`](./deploy.md).
> Search-replace placeholders first: `<domain>`, `<admin-domain>`, `<cdn-domain>`,
> `<account-id>`, `<you@example.com>`, `<strong-password>`.

## B1 — Production Atlas cluster

Same as A1 but a dedicated prod user (e.g. `nour-prod`) and region near your Vercel
region. Network Access `0.0.0.0/0` is acceptable on the free tier.

**Verify:** `MONGODB_URI="<prod-uri>" pnpm migrate --dry-run` prints planned indexes.

## B2 — Production R2 bucket

Same as A2, but for production prefer a **custom CDN domain** (`<cdn-domain>`) over
the `*.r2.dev` URL, and set CORS `AllowedOrigins` to `https://<admin-domain>`
(and `https://<domain>` if the web app uploads). `R2_PUBLIC_BASE = https://<cdn-domain>`.

**Verify:** empty `nour-media` bucket + API token created.

## B3 — Vercel project: `web`

1. <https://vercel.com> → Add New → Project → import the GitHub repo.
2. **Root Directory**: `apps/web` (reads `apps/web/vercel.json`).
3. **Environment Variables** (Production):

   | Key | Value |
   |---|---|
   | `NODE_ENV` | `production` |
   | `MONGODB_URI` | from B1 |
   | `AUTH_SECRET` | 32+ char secret (reuse across both projects) |
   | `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` | from B2 |
   | `R2_BUCKET` | `nour-media` |
   | `R2_ENDPOINT` | `https://<account-id>.r2.cloudflarestorage.com` |
   | `R2_PUBLIC_BASE` | `https://<cdn-domain>` |
   | `NEXT_PUBLIC_WEB_URL` | `https://<domain>` |
   | `NEXT_PUBLIC_ADMIN_URL` | `https://<admin-domain>` |

4. **Deploy** (first build 2–4 min).

**Verify:** deploy succeeds; the `*.vercel.app` URL shows the homepage shell.

## B4 — Vercel project: `admin`

Repeat B3 with **Root Directory** `apps/admin` and project name `nour-admin`;
same env vars.

**Verify:** the `*.vercel.app` URL redirects to `/login` (auth gate working).

## B5 — Cloudflare DNS

1. `CNAME @` → `cname.vercel-dns.com` (or Vercel's shown target), proxy on.
2. `CNAME admin` → same target, proxy on.
3. `CNAME cdn` → R2 public hostname, proxy on.
4. In each Vercel project → Settings → Domains: add `<domain>` to web,
   `<admin-domain>` to admin; wait for Valid Configuration + SSL.
5. Confirm `R2_PUBLIC_BASE`/`NEXT_PUBLIC_*` env values, then redeploy both.

**Verify:**
```
curl -I https://<domain>            # 200, includes Strict-Transport-Security
curl -I https://<admin-domain>      # 307 → /login
curl https://<domain>/api/health    # {"ok":true,"version":"<sha>","time":"…"}
```

## B6 — Migrate production indexes

```
MONGODB_URI="<prod-uri>" pnpm migrate
```

**Verify:** Atlas Collections show the indexes from `0001-indexes.ts` + `0002-category-indexes.ts`.

## B7 — Seed the first admin (prod requires `--force`)

```
MONGODB_URI="<prod-uri>" NODE_ENV=production pnpm seed:admin \
  --email "<you@example.com>" --password "<strong-password>" --force
```
Then disable the script (delete `scripts/seed-admin.ts` or remove the `seed:admin`
line in root `package.json`), commit, push.

**Verify:** Atlas `users` has one `role: "admin"` doc with an argon2 hash.

## B8 — Live smoke test (golden path)

Login at `https://<admin-domain>/login` → create `Smoke Test` playlist → upload a
`.mp3` (≤50 MiB) → publish → confirm the card shows on `https://<domain>/` →
open detail → track plays in the sticky player (space pause, ←/→ seek ±10s) and
survives navigation. Clean up afterward.

**Verify:** all steps pass with no console/network errors.

## B9 — Monitoring (optional)

UptimeRobot HTTP monitors on `https://<domain>/api/health` and
`https://<admin-domain>/api/health`, 5-min interval, keyword `ok`. Sentry is
intentionally deferred (env var stubbed) — see `deploy.md` §11.

## Rollback

Vercel → Deployments → promote the last green deploy to Production (~10s).
DB schema changes are limited to the idempotent index migration; restore from an
Atlas snapshot only if needed. Full criteria + rollback: [`deploy.md`](./deploy.md).
