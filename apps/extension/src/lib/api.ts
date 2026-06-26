// Extension equivalent of apps/mobile/lib/api.ts. Uses __API_BASE_URL__ (Vite
// define) so the extension never reads process.env outside @repo/config.
const API_ORIGIN = __API_BASE_URL__;
const API_BASE = `${API_ORIGIN}/api/v1`;

// Resolve an origin-relative static path (e.g. "/icons/icon-32.png") to an
// absolute URL. Already-absolute URLs pass through unchanged.
export function assetUrl(path: string): string {
  if (/^https?:\/\//.test(path)) return path;
  return `${API_ORIGIN}${path}`;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

type ErrorBody = { error?: string; message?: string };

// Fetches a JSON resource from /api/v1. Never uses `new URL(path, base)` — with
// a leading-slash path and a base whose pathname is "/api/v1" (no trailing slash),
// URL resolution drops the pathname entirely (see mobile api.ts gotcha comment).
export async function getJson<T>(
  path: string,
  params?: Record<string, string | undefined>,
): Promise<T> {
  const url = new URL(`${API_BASE}${path}`);
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value != null) url.searchParams.set(key, value);
  }
  const res = await fetch(url.toString(), { headers: { Accept: "application/json" } });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as ErrorBody;
    throw new ApiError(res.status, body.error ?? "INTERNAL", body.message ?? "Request failed.");
  }
  return (await res.json()) as T;
}
