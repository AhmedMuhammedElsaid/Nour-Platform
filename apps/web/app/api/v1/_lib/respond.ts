import { NextResponse } from "next/server";
import { AppError, type AppErrorCode } from "@repo/api/errors";

import { withCors } from "@/lib/cors";
import {
  checkRateLimit,
  rateLimitHeaders,
  retryAfterSeconds,
  type ApiRouteClass,
} from "./rate-limit";

const STATUS_BY_CODE: Record<AppErrorCode, number> = {
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  VALIDATION: 400,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  INTERNAL: 500,
};

const CACHE_HEADERS = { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" };

export function jsonOk(data: unknown): Response {
  return withCors(NextResponse.json(data, { headers: CACHE_HEADERS }));
}

// Maps a thrown error to a CORS-tagged JSON error response. AppError carries
// its own status via `code`; anything else is an unexpected 500 (no leaking
// internals — message is generic, the cause stays server-side in logs).
export function jsonError(error: unknown): Response {
  if (error instanceof AppError) {
    return withCors(
      NextResponse.json({ error: error.code, message: error.message }, { status: STATUS_BY_CODE[error.code] }),
    );
  }
  return withCors(NextResponse.json({ error: "INTERNAL", message: "Internal error." }, { status: 500 }));
}

type ApiHandler<TContext> = (request: Request, context: TContext) => Promise<Response>;

/*
 * Every /api/v1 handler is defined through this wrapper (ADR 0015). It is the
 * single enforcement point for rate limiting, so a route declares only which
 * cost class it belongs to and inherits the limit, the 429 body shape and the
 * Retry-After/X-RateLimit-* headers. Adding a route without a class is not
 * possible — `apiRoute` requires one.
 *
 * The 429 goes through the existing `AppError.RateLimited` →
 * `STATUS_BY_CODE.RATE_LIMITED` path rather than a parallel one, so its body is
 * `{ error: "RATE_LIMITED", message }` exactly like every other API error.
 *
 * `request` and `context` are optional on the returned function purely so the
 * existing route unit tests can keep calling `GET()` with no arguments for
 * handlers that ignore the request; Next always supplies both at runtime.
 */
export function apiRoute<TContext = unknown>(
  routeClass: ApiRouteClass,
  handler: ApiHandler<TContext>,
): (request?: Request, context?: TContext) => Promise<Response> {
  return async (request, context): Promise<Response> => {
    const req = request ?? new Request("http://localhost/");

    const verdict = await checkRateLimit(routeClass, req.headers);
    if (!verdict.allowed) {
      const response = jsonError(
        AppError.RateLimited(
          verdict.retryAfterMs,
          `Too many requests. Retry in ${retryAfterSeconds(verdict.retryAfterMs)}s.`,
        ),
      );
      for (const [key, value] of Object.entries(rateLimitHeaders(verdict))) {
        response.headers.set(key, value);
      }
      return response;
    }

    try {
      // Adapter boundary: `context` is optional on the public signature (see
      // above) but Next always passes it for a route with dynamic params, and
      // handlers that ignore it never read the value.
      return await handler(req, context as TContext);
    } catch (error) {
      // Backstop only — handlers keep their own try/catch so they can attach
      // route-specific context before the error escapes.
      return jsonError(error);
    }
  };
}
