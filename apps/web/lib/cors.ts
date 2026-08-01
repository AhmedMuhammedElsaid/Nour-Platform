// Direct process.env access (not @repo/config/env) is intentional and mirrors
// apps/web/app/api/health/route.ts: importing the validated env barrel runs
// parseEnv() at module load, which crashes `next build` when MONGODB_URI/
// AUTH_SECRET aren't set. /api/v1 routes are evaluated at request time, but
// this module is imported by them, so it must stay build-safe too.
//
// Fail closed in production: a missing MOBILE_APP_ORIGIN there means a
// misconfigured deploy, not "use the dev default" — falling back to
// localhost:8081 would ship `Access-Control-Allow-Origin: http://localhost:8081`
// to real users. The localhost fallback stays for local/dev/CI so the mobile
// client keeps working without extra env setup.
const MOBILE_APP_ORIGIN =
  process.env.MOBILE_APP_ORIGIN ?? (process.env.NODE_ENV === "production" ? undefined : "http://localhost:8081");

export const CORS_HEADERS: Record<string, string> = MOBILE_APP_ORIGIN
  ? {
      "Access-Control-Allow-Origin": MOBILE_APP_ORIGIN,
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400",
    }
  : {};

export function corsPreflight(): Response {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export function withCors(response: Response): Response {
  for (const [key, value] of Object.entries(CORS_HEADERS)) {
    response.headers.set(key, value);
  }
  return response;
}
