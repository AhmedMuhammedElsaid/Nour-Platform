import { NextResponse } from "next/server";
import { AppError, type AppErrorCode } from "@repo/api/errors";

import { withCors } from "@/lib/cors";

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
