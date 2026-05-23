import type { AppError } from "@repo/api/errors";

const ERROR_STATUS: Record<string, number> = {
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  VALIDATION: 422,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  INTERNAL: 500,
};

export function appErrorStatus(e: AppError): number {
  return ERROR_STATUS[e.code] ?? 500;
}
