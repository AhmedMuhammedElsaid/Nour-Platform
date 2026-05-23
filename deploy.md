# deploy.md

> Step-by-step runbook for the first production deploy of the Nour Platform Audio MVP. Follow top to bottom — each step ends with a **verify** check before you proceed. [`DEPLOYMENT.md`](./DEPLOYMENT.md) is the architectural reference; this file is the imperative checklist.
>
> Expected wall-clock: **30–60 min** if accounts already exist, **90 min** from scratch.
>
> Search-replace placeholders before you start:
> - `<domain>` → your apex domain (e.g. `nour.example.com`)
> - `<admin-domain>` → your admin subdomain (e.g. `admin.nour.example.com`)
> - `<cdn-domain>` → your media CDN domain (e.g. `cdn.nour.example.com`)
> - `<account-id>` → Cloudflare R2 account id
> - `<you@example.com>` and `<strong-password>` → first admin credentials

---

## 0. Prerequisites

Accounts required (all have free tiers):

- **Vercel** — hosting (Hobby tier; 2 projects)
- **MongoDB Atlas** — database (M0 free)
- **Cloudflare** — DNS + R2 object storage
- **GitHub** — repo lives at `github.com/AhmedMuhammedElsaid/Nour-Platform`
- **UptimeRobot** (optional) — health monitoring

On your local machine:

```bash
node --version          # >= 22
pnpm --version          # >= 9
git --version
openssl version         # for generating AUTH_SECRET
```

Generate the auth secret you'll need in steps 4 and 5:

```bash
openssl rand -base64 32
```

Save the output — you'll paste it into both Vercel projects.

**Verify:** all four commands print a version; `openssl rand` prints a 44-char base64 string.

---

## 1. MongoDB Atlas — create the production cluster

1. Sign in at https://cloud.mongodb.com, create an Organization + Project if you don't have one.
2. **Build a Database** → free **M0** tier → pick a region close to your audience (e.g. `eu-central-1` if you chose `fra1` for Vercel).
3. **Database Access** → Add New Database User → username `nour-prod`, generate a strong password. Save it.
4. **Network Access** → Add IP Address → `0.0.0.0/0` (acceptable on free tier per [`DEPLOYMENT.md`](./DEPLOYMENT.md) §1; tighten on M10+).
5. **Database** → Connect → Drivers → Node.js → copy the connection string. Replace `<password>` with the user password you just generated. Append the database name: `mongodb+srv://nour-prod:<pw>@<cluster>.mongodb.net/nour?retryWrites=true&w=majority`.

Save this as `MONGODB_URI`.

**Verify:** locally run `MONGODB_URI="<that string>" pnpm migrate --dry-run`. Should print the planned indexes without errors.

---

## 2. Cloudflare R2 — create the audio bucket

1. Sign in at https://dash.cloudflare.com → **R2** → Create bucket → name `nour-media`. Region: Automatic.
2. Bucket settings → **Settings** → **Public Access** → enable a custom domain (you'll point `<cdn-domain>` here in step 6). Disable the auto-generated `*.r2.dev` URL — we want CDN-cached delivery only.
3. **Manage R2 API Tokens** → Create API Token → permissions: **Object Read & Write** scoped to the `nour-media` bucket. Copy:
   - Access Key ID → `R2_ACCESS_KEY_ID`
   - Secret Access Key → `R2_SECRET_ACCESS_KEY`
   - Account ID → use to build `R2_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com`

`R2_PUBLIC_BASE` will be `https://<cdn-domain>` — set it in step 6 after DNS is wired.

**Verify:** in the R2 dashboard you see the empty `nour-media` bucket and a green "API token created" message.

---

## 3. Vercel project: `web`

1. https://vercel.com → Add New → Project → Import the GitHub repo.
2. **Root Directory**: `apps/web` (Vercel reads `apps/web/vercel.json` for build/install/framework).
3. **Environment Variables** — add for **Production** (and copy to Preview later if you want isolated test data):

   | Key | Value |
   |---|---|
   | `NODE_ENV` | `production` |
   | `MONGODB_URI` | from step 1 |
   | `AUTH_SECRET` | from step 0 |
   | `R2_ACCESS_KEY_ID` | from step 2 |
   | `R2_SECRET_ACCESS_KEY` | from step 2 |
   | `R2_BUCKET` | `nour-media` |
   | `R2_ENDPOINT` | from step 2 |
   | `R2_PUBLIC_BASE` | `https://<cdn-domain>` (will resolve in step 6) |
   | `NEXT_PUBLIC_WEB_URL` | `https://<domain>` |
   | `NEXT_PUBLIC_ADMIN_URL` | `https://<admin-domain>` |

   (Reference: [`.env.example`](./.env.example) is the source of truth for the full list. `SENTRY_DSN` and `R2_MAX_UPLOAD_BYTES` are optional.)

4. **Deploy**. The first build will take 2–4 minutes.

**Verify:** the deploy succeeds. Visit the `*.vercel.app` preview URL — you should see the homepage shell (empty playlist grid is fine; no published content yet).

---

## 4. Vercel project: `admin`

Repeat step 3 with these changes:

- **Project name**: `nour-admin`
- **Root Directory**: `apps/admin`
- Same env vars as web. `NEXT_PUBLIC_ADMIN_URL` still points at `https://<admin-domain>` and `NEXT_PUBLIC_WEB_URL` still points at `https://<domain>`.

**Verify:** visiting the `*.vercel.app` URL redirects you to `/login` (middleware gate working).

---

## 5. Cloudflare DNS — wire the domains

Assuming the apex is managed at Cloudflare:

1. **DNS** → Add record → `CNAME` `@` → `cname.vercel-dns.com` (or the value Vercel shows you under Project → Settings → Domains). Proxy: **on** (orange cloud).
2. Add record → `CNAME` `admin` → same Vercel target. Proxy: on.
3. Add record → `CNAME` `cdn` → the R2 public hostname (Vercel shows it when you connected the custom domain in step 2). Proxy: on.
4. In each Vercel project → Settings → Domains → add `<domain>` to web, `<admin-domain>` to admin. Wait for "Valid Configuration" + auto-provisioned SSL (usually < 5 min).
5. Back in Vercel env vars: confirm `R2_PUBLIC_BASE` is `https://<cdn-domain>`, `NEXT_PUBLIC_WEB_URL` is `https://<domain>`, `NEXT_PUBLIC_ADMIN_URL` is `https://<admin-domain>`. Redeploy both projects so they pick up any changes.

**Verify:**

```bash
curl -I https://<domain>            # 200 OK, includes Strict-Transport-Security
curl -I https://<admin-domain>      # 307 to /login (middleware) — still good
curl https://<domain>/api/health    # {"ok":true,"version":"<7-char-sha>","time":"…"}
```

If `version` shows `dev`, double-check `NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA` is being injected (Vercel does this automatically).

---

## 6. Run the index migration against production

From your local machine — this is a one-shot, idempotent:

```bash
MONGODB_URI="<prod-uri>" pnpm migrate
```

**Verify:** in Atlas → Database → Collections, each collection (`users`, `playlists`, `tracks`, `media`) has the indexes listed in [`packages/api/src/db/migrations/0001-indexes.ts`](./packages/api/src/db/migrations/0001-indexes.ts).

---

## 7. Seed the first admin user

The seed script refuses to run with `NODE_ENV=production` unless you pass `--force` — by design, see [`scripts/seed-admin.ts`](./scripts/seed-admin.ts).

```bash
MONGODB_URI="<prod-uri>" NODE_ENV=production pnpm seed:admin \
  --email "<you@example.com>" \
  --password "<strong-password>" \
  --force
```

**Then disable the script** so it can't be re-run accidentally. Either:

- Delete `scripts/seed-admin.ts`, or
- Remove the `"seed:admin"` line from the root [`package.json`](./package.json).

Commit and push that change.

**Verify:** in Atlas → `users` collection has exactly one document with `role: "admin"` and a hashed `password` (argon2 prefix `$argon2id$`).

---

## 8. Smoke test the live app — end-to-end golden path

Open a browser:

1. Go to `https://<admin-domain>/login` → sign in with the credentials from step 7. You should land on `/playlists`.
2. **New Playlist** → fill title `Smoke Test`, description `delete me`, leave status `draft`, submit. You land on `/playlists/<id>/edit`.
3. **Add Track** → drag-drop a real `.mp3` (under 50 MiB). Wait for the progress bar to reach 100% and the row to appear in the list.
4. **Publish** the playlist (toggle in the edit page header).
5. Open `https://<domain>/` in a different browser/profile (anonymous). The `Smoke Test` playlist card should appear.
6. Click the card → opens `/playlists/smoke-test`. Click the first track row → the sticky audio player at the bottom starts playing. Press **space** to pause, **→** to seek +5s. The player should persist if you navigate back to `/`.
7. Sign back into `/admin` → delete the smoke playlist (or unpublish + leave for visual QA — your call).

**Verify:** all six steps succeed without console errors (open DevTools → Console + Network on each surface).

---

## 9. Wire monitoring

### 9a. UptimeRobot

1. https://uptimerobot.com → New Monitor → HTTP(s) → `https://<domain>/api/health` → 5-min interval → keyword "ok" (matches the JSON body).
2. Repeat for `https://<admin-domain>/api/health`.
3. Add an email or Slack alert channel.

**Verify:** monitor goes green within one interval.

### 9b. Sentry (optional, deferred)

The MVP intentionally ships without Sentry SDK wired — only the `SENTRY_DSN` env var is stubbed (see [`.env.example`](./.env.example)). Wire it post-MVP per the "Post-deploy hardening" note below.

---

## 10. (Optional) Run Playwright against production

Sanity check the smoke suite against the live env:

```bash
PLAYWRIGHT_WEB_URL=https://<domain> \
PLAYWRIGHT_ADMIN_URL=https://<admin-domain> \
ADMIN_EMAIL="<you@example.com>" \
ADMIN_PASSWORD="<strong-password>" \
pnpm test:e2e
```

The web suite tolerates an empty homepage. The admin suite creates a `Smoke Test Playlist` — clean it up afterwards.

**Verify:** all three tests pass (or the second `web` test skips cleanly if no published playlists).

---

## 11. Post-deploy hardening (deferred from MVP)

Track these in [`PLAN.md`](./PLAN.md) §13 (Phase 2) or open separate tickets:

- **Sentry** — `pnpm add @sentry/nextjs` in both apps, create `instrumentation.ts` + `instrumentation-client.ts`, wrap each `next.config.ts` with `withSentryConfig`, extend CSP `connect-src` to allow `*.ingest.sentry.io`.
- **Nonce-based CSP** — replace the `'unsafe-inline'` script-src with per-request nonces (Next 15+ middleware pattern). The current CSP comment in `next.config.ts` flags this as a known follow-up.
- **Nightly E2E** — add `.github/workflows/e2e.yml` running Playwright against `<domain>` on a cron schedule.
- **Backups** — `mongodump` to an R2 backups bucket per [`DEPLOYMENT.md`](./DEPLOYMENT.md) §9.
- **Performance budgets in CI** — Lighthouse CI + bundlemon per [`DEPLOYMENT.md`](./DEPLOYMENT.md) §10.

---

## Rollback

If a deploy regresses production:

1. Vercel → Project → Deployments → find the last green deploy → **Promote to Production**. Takes ~10 seconds.
2. If the database changed in the bad deploy (unlikely in MVP — only the index migration writes to schema), restore from the most recent Atlas snapshot.

---

## Done criteria (matches PLAN.md §15)

- [ ] `https://<domain>/` returns 200 and renders the playlist grid
- [ ] `https://<admin-domain>/login` works; admin can publish a playlist with at least 3 tracks
- [ ] Player plays on desktop Chrome + Safari + Firefox, mobile Chrome + Safari
- [ ] `/api/health` returns `{ ok: true, version, time }` on both domains
- [ ] UptimeRobot monitoring is live
- [ ] CI is green on `main`

When all checked, MVP is **shipped**.
