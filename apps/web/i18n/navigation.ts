import { createNavigation } from "next-intl/navigation";

import { routing } from "./routing";

/*
 * Locale-aware navigation helpers. Use these instead of next/link and
 * next/navigation in client/server components so links stay within the active
 * locale prefix (e.g. <Link href="/"> resolves to /ar or /en automatically).
 */
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
