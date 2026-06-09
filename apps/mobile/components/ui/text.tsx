import { Text as RNText, type TextProps as RNTextProps } from "react-native";

import { cn } from "@/lib/cn";

type Variant = "display" | "title" | "body" | "label" | "muted";

const VARIANTS: Record<Variant, string> = {
  // Fraunces is referenced by the `font-display` token; falls back to system
  // until the font is bundled (Phase 10 polish) — harmless.
  display: "font-display text-2xl text-text",
  title: "font-display text-lg text-text",
  body: "text-base text-text",
  label: "text-xs font-semibold uppercase tracking-[3px] text-primary",
  muted: "text-sm text-text-2",
};

export type TextProps = RNTextProps & {
  variant?: Variant;
  className?: string;
};

export function Text({ variant = "body", className, ...props }: TextProps) {
  return <RNText className={cn(VARIANTS[variant], className)} {...props} />;
}
