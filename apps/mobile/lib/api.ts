// Never import @repo/config/env here — that barrel validates MONGODB_URI/
// AUTH_SECRET at module load and isn't meant for RN bundles. Expo inlines
// EXPO_PUBLIC_* at build time; this is the mobile equivalent of NEXT_PUBLIC_*.
const API_BASE_URL = `${process.env.EXPO_PUBLIC_API_BASE_URL ?? "http://localhost:3000"}/api/v1`;

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

export async function getJson<T>(path: string, params?: Record<string, string | undefined>): Promise<T> {
  const url = new URL(path, API_BASE_URL);
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
