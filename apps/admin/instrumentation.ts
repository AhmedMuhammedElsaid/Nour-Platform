import * as Sentry from "@sentry/nextjs";

/*
 * Server + edge Sentry init. Reads process.env directly because instrumentation
 * loads during next build's collection step — the env barrel would throw on a
 * missing MONGODB_URI etc. (canonical exception, same as next.config.ts).
 *
 * SENTRY_DSN is optional per environment: when absent we skip init entirely
 * so the SDK no-ops on dev / CI / unconfigured previews. See ADR 0007.
 */
export function register(): void {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;
  Sentry.init({ dsn, tracesSampleRate: 0, enableLogs: false });
}

export const onRequestError = Sentry.captureRequestError;
