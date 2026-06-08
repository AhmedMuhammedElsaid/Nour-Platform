// Tiny className joiner for NativeWind. We don't pull in clsx/tailwind-merge —
// the app only needs truthy-filtering and a join; conflicting Tailwind classes
// are avoided by convention (later classes in a template win in NativeWind v4).
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
