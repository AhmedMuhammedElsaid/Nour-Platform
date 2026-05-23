import { MongoDBAdapter } from "@auth/mongodb-adapter";
import type { MongoClient } from "mongodb";
import type { NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";

import { getDb } from "../db/client";
import { verifyCredentials } from "../services/auth.service";
import { authConfigEdge } from "./config.edge";

/*
 * Full Auth.js config (Node runtime only). Extends the Edge-safe slice
 * with the Mongo adapter and the Credentials `authorize` callback, which
 * needs Mongoose + argon2 — neither is Edge-compatible.
 *
 * The adapter is wired even though Credentials + JWT sessions don't use
 * it; that keeps Phase 2 (OAuth, database sessions) a small swap.
 */
const clientPromise: Promise<MongoClient> = getDb().then((m) =>
  // Mongoose's underlying driver client is compatible with the adapter's
  // expected `MongoClient`; the cast is the adapter-boundary exception
  // CLAUDE.md §4 permits.
  m.connection.getClient() as unknown as MongoClient,
);

export const authConfig: NextAuthConfig = {
  ...authConfigEdge,
  adapter: MongoDBAdapter(clientPromise),
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(rawCredentials) {
        const email =
          typeof rawCredentials?.email === "string"
            ? rawCredentials.email
            : "";
        const password =
          typeof rawCredentials?.password === "string"
            ? rawCredentials.password
            : "";

        const user = await verifyCredentials({ email, password });
        if (!user) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        };
      },
    }),
  ],
};
