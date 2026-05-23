import NextAuth from "next-auth";

import "../types/next-auth";
import { authConfig } from "./config";

/*
 * Node-runtime Auth.js entry. Apps mount `handlers` at
 * `/api/auth/[...nextauth]/route.ts` and call `auth()` / `signIn()` /
 * `signOut()` from server actions. The Edge slice for middleware lives in
 * `./config.edge` and should be instantiated separately in the consuming
 * app's `middleware.ts` (Wave 1.3).
 */
export const { auth, handlers, signIn, signOut } = NextAuth(authConfig);

export { authConfig } from "./config";
export { authConfigEdge } from "./config.edge";
export { requireSession } from "./require-session";
