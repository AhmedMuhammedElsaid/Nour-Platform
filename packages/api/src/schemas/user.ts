import { z } from "zod";

/*
 * MVP user shape per DATABASE.md §0.3. The single seeded admin is the only
 * user that exists in MVP — `role` is therefore a literal `'admin'` for
 * now and widens to a union in Phase 2.
 */
export const userRoleSchema = z.literal("admin");
export type UserRole = z.infer<typeof userRoleSchema>;

export const userSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  emailVerified: z.date().nullable().optional(),
  name: z.string().min(1).max(80),
  role: userRoleSchema,
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type User = z.infer<typeof userSchema>;

/*
 * Used by the Credentials provider's `authorize` callback. We deliberately
 * bound the password length on both sides — argon2id can handle longer
 * strings but anything over 256 chars at the login form is a paste-bomb.
 */
export const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(256),
});
export type Credentials = z.infer<typeof credentialsSchema>;
