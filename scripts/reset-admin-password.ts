#!/usr/bin/env node

import { parseArgs } from "node:util";
import { disconnectDb, getDb } from "@repo/api/db/client";
import { hashPassword } from "@repo/api/auth/password";
import { resetAdminPassword } from "@repo/api/services/auth";
import { z, ZodError } from "zod";

const argsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(256),
});

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      email: { type: "string" },
      password: { type: "string" },
    },
    strict: true,
  });

  const parsed = argsSchema.safeParse(values);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join(".") || "input"}: ${i.message}`)
      .join("\n");
    console.error(`Validation error:\n${issues}`);
    process.exit(1);
  }

  await getDb();

  const hash = await hashPassword(parsed.data.password);
  const updated = await resetAdminPassword({ email: parsed.data.email, hashedPassword: hash });

  if (!updated) {
    console.error(`No user found with email: ${parsed.data.email}`);
    console.error("Run pnpm seed:admin to create the admin user first.");
    process.exit(1);
  }

  console.log(`Password updated for: ${parsed.data.email}`);
}

main()
  .catch((err) => {
    if (err instanceof ZodError) console.error(err.issues);
    else console.error(err);
    process.exit(1);
  })
  .finally(() => disconnectDb());
