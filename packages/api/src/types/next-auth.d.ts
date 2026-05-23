/*
 * Module augmentation — extends Auth.js types with the MVP `role` field
 * so server actions can access `session.user.role` without casts.
 */
import type { DefaultSession } from "next-auth";

import type { UserRole } from "../schemas/user";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: UserRole;
    } & DefaultSession["user"];
  }

  interface User {
    id?: string;
    role?: UserRole;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: UserRole;
  }
}
