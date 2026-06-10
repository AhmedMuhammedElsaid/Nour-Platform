import * as Sentry from "@sentry/nextjs";

/*
 * Client-side Sentry init. NEXT_PUBLIC_SENTRY_DSN is inlined at build time;
 * when absent the SDK is left uninitialized so the bundle has zero runtime
 * effect. See ADR 0007.
 */
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
if (dsn) {
  Sentry.init({ dsn, tracesSampleRate: 0 });
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
