/*
 * The git commit this deployment was built from — the single source of truth
 * for "which build am I". Consumed by:
 *   - app/api/health/route.ts (reports the DEPLOYED build)
 *   - app/[locale]/layout.tsx (stamps <html data-build> = the build that
 *     rendered THIS page)
 *   - features/pwa/components/service-worker-register.tsx (client compares the
 *     page's stamped build against a live /api/health poll; a mismatch means a
 *     newer build is live while this tab kept running old JS → hard reload).
 *
 * Read straight from process.env (NOT the @repo/config/env barrel) for the same
 * documented reason as the health route and lib/seo.ts: this module is imported
 * by files evaluated during `next build` (the layout), where the barrel's
 * required secrets (MONGODB_URI/AUTH_SECRET) aren't present and parseEnv() would
 * crash. The git SHA is build metadata, not a runtime secret — the canonical
 * CLAUDE.md §5 exception. `NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA` is set by Vercel;
 * "dev" locally (the reload check no-ops on "dev", so local/dev never reloads).
 */
export const BUILD_VERSION =
  process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "dev";
