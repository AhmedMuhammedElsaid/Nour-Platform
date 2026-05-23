import NextAuth from "next-auth";

// Side-effect import — registers the module augmentation that adds `role` to
// Session/User/JWT. DO NOT REMOVE: IDE "organize imports" or "remove unused
// imports" actions tend to delete this because it has no named binding; the
// session object loses its typed `role` field if it goes.
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
