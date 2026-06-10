# ADR 0007: Sentry for client + server error reporting

- Status: Accepted
- Date: 2026-06-10

## Context
The platform ships a substantial client surface — service worker, two audio
engines (HTML5 + the in-route Quran ayah player), prayer-time/azan schedulers
that re-arm on wake — and a Next.js server runtime that talks to MongoDB Atlas
and R2. Today all of these fail silently in production: there is no error
sink, no aggregation, no alerting. The "azan was silent for Fajr" class of bug
is exactly the kind that would never reach us. Sentry was deferred at Wave 5;
`SENTRY_DSN` already exists in the env schema and `turbo.json`'s build env
list, awaiting wiring.

## Decision
Adopt `@sentry/nextjs` in `apps/web` and `apps/admin`. Error monitoring only —
`tracesSampleRate: 0` (no performance tracing), no session replay, no tunnel.
DSN is read directly from `process.env` (instrumentation loads during
`next build`, before the env-barrel side effects can be tolerated — same
canonical exception as `next.config.ts` and the health route).

Public + server DSNs:

- `SENTRY_DSN` (server-side) — server + edge runtimes.
- `NEXT_PUBLIC_SENTRY_DSN` (client-inlined) — browser bundle.

Both are optional per environment: when unset, `Sentry.init` is skipped and
the SDK no-ops. Production sets both; dev sessions and unrelated env-specific
builds (preview, CI) can leave them unset.

CSP `connect-src` grows by the DSN's origin (e.g. `https://o123.ingest.sentry.io`).
The origin is computed at proxy runtime from `process.env.NEXT_PUBLIC_SENTRY_DSN`
and passed into `buildWebCsp` / `buildAdminCsp` the same way the R2 hostname
already is — proxy.ts cannot import the env barrel (established constraint).

## Consequences
- **Bundle size**: roughly +30 KB gzipped on the client per app. Acceptable for
  the observability gain; defer review until we have real usage data.
- **CSP**: `connect-src` directive gains the Sentry ingest origin when a DSN
  is set. Computed dynamically so we never widen CSP for environments that
  don't actually emit to Sentry.
- **One new top-level dep** (`@sentry/nextjs`) in each of web + admin —
  intentional lockfile churn, isolated in its own commit.
- No performance traces, no replay: keeps PII surface small and avoids the
  privacy review that replay would require.
- New env vars documented in `.env.example` and `turbo.json`'s build env.

## Alternatives considered
- **Vercel Observability / Log Drains**: server-side coverage only — the
  client crashes (the actual deferred problem) stay invisible.
- **Roll our own**: a `/api/log` endpoint with structured JSON logs. Cheap to
  build, expensive to operate (alerting, dedup, release tagging, source maps).
  Not a useful exercise relative to Sentry's free tier.
