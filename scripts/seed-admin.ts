#!/usr/bin/env node

import { parseArgs } from "node:util";
import { disconnectDb, getDb } from "@repo/api/db/client";
import { hashPassword } from "@repo/api/auth/password";
import { createAdminUser } from "@repo/api/services/auth";
import { credentialsSchema } from "@repo/api/schemas/user";
import { ZodError } from "zod";

interface SeedOptions {
  email?: string;
  password?: string;
  help?: boolean;
}

async function main(): Promise<void> {
  const options = parseArgs({
    options: {
      email: { type: "string" },
      password: { type: "string" },
      help: { type: "boolean", short: "h" },
    },
    strict: true,
  });

  // parseArgs returns string|boolean|undefined per arg — SeedOptions narrows to
  // the expected string shape; required args are validated below before use.
  const opts = options.values as SeedOptions;

  if (opts.help) {
    console.log(`
Usage: pnpm seed:admin --email <email> --password <password>

Options:
  --email <email>         Admin email address (required)
  --password <password>   Admin password (required, min 8 chars)
  --help, -h              Show this help message

Example:
  pnpm seed:admin --email admin@example.com --password MySecurePassword123
    `);
    process.exit(0);
  }

  if (!opts.email || !opts.password) {
    console.error("Error: --email and --password are required.\n");
    console.error("Run with --help for usage information.");
    process.exit(1);
  }

  try {
    // Validate credentials format
    const credentials = credentialsSchema.parse({
      email: opts.email,
      password: opts.password,
    });

    // Connect to MongoDB (getDb is called inside createAdminUser, but we also
    // call it here so disconnectDb in finally has an active connection handle)
    await getDb();

    // Hash password first, then delegate DB work to the service layer
    const hashedPassword = await hashPassword(credentials.password);
    const result = await createAdminUser({
      email: credentials.email,
      hashedPassword,
    });

    console.log(`Successfully created admin user: ${result.email}`);
    console.log(`Admin ID: ${result.id}`);
  } catch (error) {
    if (error instanceof ZodError) {
      const issues = error.issues
        .map((i) => `  - ${i.path.join(".") || "input"}: ${i.message}`)
        .join("\n");
      console.error(`Validation error:\n${issues}`);
    } else if (error instanceof Error) {
      console.error("Error:", error.message);
    } else {
      console.error("Unknown error:", error);
    }
    process.exit(1);
  } finally {
    await disconnectDb();
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
