import type { Session } from "next-auth";

import { AppError } from "../errors";
import type { UserRole } from "../schemas/user";
import { auth } from "./index";

/*
 * Single chokepoint for "this action requires a user". Throws AppError so
 * callers can rely on the same boundary contract used elsewhere. Pass an
 * empty role array for "any authenticated user"; for MVP that and `admin`
 * are functionally the same.
 */
export async function requireSession(
  roles: UserRole[] = [],
): Promise<Session & { user: NonNullable<Session["user"]> }> {
  const session = await auth();
  if (!session?.user) throw AppError.Unauthorized();
  if (roles.length > 0 && !roles.includes(session.user.role)) {
    throw AppError.Forbidden(roles);
  }
  return session as Session & { user: NonNullable<Session["user"]> };
}
