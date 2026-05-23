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
  force?: boolean;
  help?: boolean;
}

async function main(): Promise<void> {
  const options = parseArgs({
    options: {
      email: { type: "string" },
      password: { type: "string" },
      force: { type: "boolean" },
      help: { type: "boolean", short: "h" },
    },
    strict: true,
  });

  // parseArgs returns string|boolean|undefined per arg — SeedOptions narrows to
  // the expected string shape; required args are validated below before use.
  const opts = options.values as SeedOptions;

  if (opts.help) {
    console.log(`
Usage: pnpm seed:admin --email <email> --password <password> [--force]

Options:
  --email <email>         Admin email address (required)
  --password <password>   Admin password (required, min 8 chars)
  --force                 Allow running when NODE_ENV=production
  --help, -h              Show this help message

Example:
  pnpm seed:admin --email admin@example.com --password MySecurePassword123

Production note:
  By default the script refuses to run when NODE_ENV=production to prevent
  accidental admin creation against a live database. Pass --force from a
  trusted shell to override (then disable the script per DEPLOYMENT.md §0.1
  step 3).
    `);
    process.exit(0);
  }

  // Refuse to run against a production environment unless the operator has
  // explicitly opted in. Once the first admin is seeded the script should be
  // disabled (delete the file or remove its package.json entry).
  if (process.env.NODE_ENV === "production" && !opts.force) {
    console.error(
      "Error: refusing to run with NODE_ENV=production without --force.\n",
    );
    console.error(
      "Pass --force only after confirming you are pointed at the intended database.",
    );
    process.exit(1);
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
