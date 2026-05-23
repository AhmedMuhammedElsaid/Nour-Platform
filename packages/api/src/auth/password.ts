import { hash, verify } from "@node-rs/argon2";

/*
 * Argon2id parameters (SECURITY.md profile, OWASP 2024 minimum):
 *   - memoryCost: 19 MiB
 *   - timeCost:    2 iterations
 *   - parallelism: 1
 *
 * Argon2id is the default variant in @node-rs/argon2, so we skip the
 * `algorithm` field — its `Algorithm` enum is `const`, which collides
 * with TypeScript's `isolatedModules`.
 *
 * @node-rs/argon2 is a pure-Rust binding with prebuilt binaries for all
 * common platforms — no node-gyp / native compilation headaches.
 */
const PARAMS = {
  memoryCost: 19_456, // KiB → ~19 MiB
  timeCost: 2,
  parallelism: 1,
} as const;

export async function hashPassword(password: string): Promise<string> {
  return hash(password, PARAMS);
}

export async function verifyPassword(
  password: string,
  passwordHash: string,
): Promise<boolean> {
  try {
    return await verify(passwordHash, password);
  } catch {
    // Malformed hash strings are treated as a non-match rather than a
    // crash; logging that fact would leak hash-format details to logs.
    return false;
  }
}
