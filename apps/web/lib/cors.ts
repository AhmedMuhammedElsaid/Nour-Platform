// Direct process.env access (not @repo/config/env) is intentional and mirrors
// apps/web/app/api/health/route.ts: importing the validated env barrel runs
// parseEnv() at module load, which crashes `next build` when MONGODB_URI/
// AUTH_SECRET aren't set. /api/v1 routes are evaluated at request time, but
// this module is imported by them, so it must stay build-safe too.
const MOBILE_APP_ORIGIN = process.env.MOBILE_APP_ORIGIN ?? "http://localhost:8081";

export const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": MOBILE_APP_ORIGIN,
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
};

export function corsPreflight(): Response {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export function withCors(response: Response): Response {
  for (const [key, value] of Object.entries(CORS_HEADERS)) {
    response.headers.set(key, value);
  }
  return response;
}
