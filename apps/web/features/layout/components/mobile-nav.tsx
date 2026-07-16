"use client";

import type { ReactNode } from "react";
import { useState } from "react";

import { Link } from "@/i18n/navigation";

type NavItem = { href: string; label: string; icon: ReactNode };

// Mobile-only nav: on phones the inline tab row would exceed the viewport width
// and give the whole page a horizontal scroll, so the tabs collapse behind a
// hamburger button here. Hidden on ≥sm, where SiteHeader shows the inline nav.
export function MobileNav({
  items,
  menuLabel,
}: {
  items: NavItem[];
  menuLabel: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative sm:hidden">
      <button
        type="button"
        aria-label={menuLabel}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border text-text-2 transition-colors hover:text-primary"
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          aria-hidden="true"
        >
          {open ? (
            <>
              <line x1="6" y1="6" x2="18" y2="18" />
              <line x1="18" y1="6" x2="6" y2="18" />
            </>
          ) : (
            <>
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </>
          )}
        </svg>
      </button>

      {open ? (
        <>
          {/* Invisible backdrop closes the menu on an outside tap. */}
          <button
            type="button"
            aria-hidden="true"
            tabIndex={-1}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 cursor-default"
          />
          <nav
            aria-label={menuLabel}
            className="absolute end-0 top-full z-50 mt-2 min-w-44 rounded-lg border border-border bg-bg py-1 shadow-up-3"
          >
            {items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-text-2 transition-colors hover:bg-surface-2 hover:text-primary"
              >
                {item.icon}
                {item.label}
              </Link>
            ))}
          </nav>
        </>
      ) : null}
    </div>
  );
}
