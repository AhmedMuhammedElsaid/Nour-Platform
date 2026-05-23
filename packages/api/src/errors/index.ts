import type { ZodIssue } from "zod";

/*
 * Kind-tagged error contract for the API → action → UI boundary.
 * Code values mirror API.md §7. Anything thrown inside `packages/api`
 * must be an `AppError` (CLAUDE.md §5); raw `throw new Error(...)` is
 * a lint smell that should be replaced.
 */
export type AppErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "INTERNAL";

export interface SerializedAppError {
  code: AppErrorCode;
  message: string;
  issues?: ZodIssue[];
  retryAfterMs?: number;
}

export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly issues?: ZodIssue[];
  readonly retryAfterMs?: number;

  constructor(
    code: AppErrorCode,
    message: string,
    options?: { issues?: ZodIssue[]; retryAfterMs?: number; cause?: unknown },
  ) {
    super(message, options?.cause ? { cause: options.cause } : undefined);
    this.name = "AppError";
    this.code = code;
    this.issues = options?.issues;
    this.retryAfterMs = options?.retryAfterMs;
  }

  toJSON(): SerializedAppError {
    return {
      code: this.code,
      message: this.message,
      ...(this.issues ? { issues: this.issues } : {}),
      ...(this.retryAfterMs !== undefined
        ? { retryAfterMs: this.retryAfterMs }
        : {}),
    };
  }

  static Unauthorized(message = "Sign in required."): AppError {
    return new AppError("UNAUTHORIZED", message);
  }

  static Forbidden(rolesOrMessage?: string[] | string): AppError {
    const message =
      typeof rolesOrMessage === "string"
        ? rolesOrMessage
        : rolesOrMessage && rolesOrMessage.length > 0
          ? `Requires role: ${rolesOrMessage.join(", ")}.`
          : "Not allowed.";
    return new AppError("FORBIDDEN", message);
  }

  static NotFound(resource = "Resource"): AppError {
    return new AppError("NOT_FOUND", `${resource} not found.`);
  }

  static Validation(issues: ZodIssue[], message = "Invalid input."): AppError {
    return new AppError("VALIDATION", message, { issues });
  }

  static Conflict(message = "Conflict."): AppError {
    return new AppError("CONFLICT", message);
  }

  static RateLimited(retryAfterMs: number, message = "Too many requests."): AppError {
    return new AppError("RATE_LIMITED", message, { retryAfterMs });
  }

  static Internal(message = "Something went wrong.", cause?: unknown): AppError {
    return new AppError("INTERNAL", message, { cause });
  }

  static is(error: unknown): error is AppError {
    return error instanceof AppError;
  }
}
