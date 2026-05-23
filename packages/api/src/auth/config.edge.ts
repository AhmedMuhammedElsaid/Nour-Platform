import type { NextAuthConfig } from "next-auth";

import { env } from "@repo/config/env";

import type { UserRole } from "../schemas/user";

/*
 * Edge-safe Auth.js config — the slice that runs in the Next.js
 * middleware. Anything imported here must be Edge-runtime compatible
 * (no Mongoose, no @node-rs/argon2). The adapter and the Credentials
 * `authorize` callback live in the full Node config in `config.ts`.
 */
export const authConfigEdge: NextAuthConfig = {
  secret: env.AUTH_SECRET,
  session: { strategy: "jwt" },
  trustHost: true,
  pages: {
    signIn: "/login",
    error: "/login",
  },
  providers: [],
  callbacks: {
    async jwt({ token, user }) {
      // Auth.js's `User` is a structural superset of OAuth profiles and
      // our credentials authorize() result; the cast is the boundary
      // exception CLAUDE.md §4 permits for typing the MVP `role` field.
      if (user) {
        const u = user as { id?: string; role?: UserRole };
        if (u.id) token.id = u.id;
        if (u.role) token.role = u.role;
      }
      return token;
    },
    async session({ session, token }) {
      const t = token as { id?: string; role?: UserRole };
      if (t.id) session.user.id = t.id;
      if (t.role) session.user.role = t.role;
      return session;
    },
  },
};
