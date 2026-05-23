import { z } from "zod";

/*
 * Centralized env access — the only file in the monorepo allowed to read
 * `process.env` directly. Apps and packages import the validated `env`
 * object from here (CLAUDE.md §5).
 *
 * Optional values stay optional so dev sessions don't crash when an
 * unrelated subsystem (R2, Sentry) is unconfigured. Call sites that
 * actually need the value should throw `AppError` if it's missing.
 */
const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),

  // Database — required everywhere DB code runs.
  MONGODB_URI: z.string().url().min(1),

  // Auth.js (Wave 1) — optional at boot so other waves can dev without it.
  AUTH_SECRET: z.string().min(16).optional(),

  // Cloudflare R2 (Wave 2) — all optional pre-upload setup.
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_BUCKET: z.string().optional(),
  R2_ENDPOINT: z.string().url().optional(),
  R2_PUBLIC_BASE: z.string().url().optional(),

  // Public URLs — Next.js inlines NEXT_PUBLIC_* at build time.
  NEXT_PUBLIC_WEB_URL: z.string().url().default("http://localhost:3000"),
  NEXT_PUBLIC_ADMIN_URL: z.string().url().default("http://localhost:3001"),

  // Observability (Wave 5).
  SENTRY_DSN: z.string().url().optional(),
});

export type Env = z.infer<typeof envSchema>;

function parseEnv(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("\n");
    throw new Error(
      `Invalid environment variables:\n${issues}\n\nCopy .env.example to .env.local and fill in the required values.`,
    );
  }
  return parsed.data;
}

export const env: Env = parseEnv();
