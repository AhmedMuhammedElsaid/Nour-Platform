# ADR 0001 — Use next-intl for UI chrome localization

- Status: Accepted
- Date: 2026-05-27
- Deciders: Ahmed (solo)
- Wave: i18n-A / i18n-B (see `localization.md`)

## Context

The public app (`apps/web`) must ship Arabic + English UI chrome (navigation, buttons,
empty states, aria-labels, player controls) under sub-path routing (`/ar`, `/en`) with
Arabic as the prefixed default. Today there is no i18n library and ~30 hardcoded English
strings live inline across `apps/web`.

`DATABASE.md §4.12` sketched a `translations` collection `{ key, ar, en, namespace }` for
UI strings. That predates the App Router maturity and conflates **chrome** (a fixed,
version-controlled string set) with **content** (editable per-locale documents — handled
separately, see ADR 0002 and `DATABASE.md §3`).

## Decision

Adopt **`next-intl`** for `apps/web` UI chrome, with **file-based JSON messages**
(`apps/web/messages/ar.json`, `apps/web/messages/en.json`).

- RSC reads via `getTranslations`; client islands via `useTranslations`.
- Locale routing config in `apps/web/i18n/routing.ts` (`locales: ['ar','en']`,
  `defaultLocale: 'ar'`, `localePrefix: 'always'`); request config in `apps/web/i18n/request.ts`.
- `apps/web/next.config.ts` wrapped with `createNextIntlPlugin`.
- next-intl's routing middleware is **composed into** the existing `apps/web/proxy.ts`
  (which generates the per-request CSP nonce) — it does **not** replace it. See `localization.md`
  Phase 4 risk note.
- `apps/admin` is **not** localized (chrome stays English) — next-intl is added to `apps/web` only.

**Do NOT build the DB `translations` collection.** ~30 static strings do not justify a DB
round-trip, a cache layer, or an admin editor. File-based messages are version-controlled,
type-checked, reviewable in PRs, and have zero runtime cost.

## Consequences

- One new runtime dependency (`next-intl`) added to `apps/web` only.
- Chrome strings change requires a code edit + deploy (acceptable; they change rarely).
- The `translations` collection sketch in `DATABASE.md §4.12` is formally retired for chrome;
  if a future need arises for runtime-editable UI copy, revisit with its own ADR.

## Alternatives considered

- **`next-i18next` / `react-i18next`** — heavier, less aligned with App Router RSC; rejected.
- **DB `translations` collection** — over-engineered for a fixed string set; rejected (above).
- **Hand-rolled context + JSON** — reinvents next-intl's routing, formatting, and pluralization; rejected.
