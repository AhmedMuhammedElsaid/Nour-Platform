import Link from "next/link";

const navLinks = [
  // { href: "/", label: "Playlists" },
  { href: "/categories", label: "Categories" },
] as const;

export function AdminNav() {
  return (
    <nav
      aria-label="Admin navigation"
      className="border-b border-border bg-surface"
    >
      <div className="container mx-auto flex items-center gap-6 px-4 py-3">
        <Link
          href="/"
          className="font-display text-lg font-semibold tracking-tight"
        >
          Nour Admin
        </Link>
        <ul className="flex items-center gap-4" role="list">
          {navLinks.map(({ href, label }) => (
            <li key={href}>
              <Link
                href={href}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}
