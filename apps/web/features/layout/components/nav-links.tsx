"use client";

import type { ReactNode } from "react";

import { Link, usePathname } from "@/i18n/navigation";

type NavItem = { href: string; label: string; icon: ReactNode };

const BASE_CLASS =
  "inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-sm font-medium whitespace-nowrap transition-colors";
const ACTIVE_CLASS = "bg-primary/10 text-primary";
const INACTIVE_CLASS = "text-text-2 hover:text-primary";

function isActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

// Client component (mirrors MobileNav) so it can read the current path via
// usePathname and mark the matching tab active — same affordance as the
// extension's SiteHeader (apps/extension/src/components/site-header.tsx),
// which highlights the current view via aria-current.
export function NavLinks({ items, ariaLabel }: { items: NavItem[]; ariaLabel: string }) {
  const pathname = usePathname();

  return (
    <nav aria-label={ariaLabel} className="hidden items-center gap-5 sm:flex">
      {items.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`${BASE_CLASS} ${active ? ACTIVE_CLASS : INACTIVE_CLASS}`}
          >
            {item.icon}
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
