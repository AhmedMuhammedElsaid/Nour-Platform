# ADR 0004: Use `adhan` (adhan-js) for prayer-time calculation

- Status: Accepted
- Date: 2026-06-05

## Context
We are adding Islamic prayer times (homepage widget + `/prayer-times` page). Times
must be accurate for a user-chosen location and selectable calculation method/madhab,
work offline (we ship a PWA), and not depend on an external runtime service.

## Decision
Add `adhan` (npm package name of the batoulapps/adhan-js library) as a runtime
dependency in `packages/api`. It is small, ISC-licensed, has no transitive runtime
deps, and implements the standard calculation conventions (Muslim World League,
Egyptian, Umm al-Qura, Karachi, ISNA, etc.) plus Asr madhab and high-latitude rules.

The compute function is written as a **pure, isomorphic** function with no DB/auth,
so the SAME code runs in the RSC (server first paint) and in client islands
(recompute for the user's location + the per-second countdown). This avoids an
external prayer-times API (no key, no rate limits, no network in the hot path) and
keeps results deterministic and unit-testable.

Hijri dates use built-in `Intl.DateTimeFormat` (Islamic calendar) — no extra dependency.

## Consequences
- One new dependency in `packages/api`; `adhan` is also bundled to the client (small).
- Calculation correctness is owned by a vetted library rather than hand-rolled angles.
- Display timezone for v1 is the viewer's device timezone (acceptable when users view
  their own city); a per-location timezone is a future enhancement.
