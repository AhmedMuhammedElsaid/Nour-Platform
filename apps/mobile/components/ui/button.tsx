import { Pressable, type PressableProps, Text } from "react-native";

import { cn } from "@/lib/cn";

type Variant = "default" | "secondary" | "outline" | "ghost";
type Size = "default" | "sm" | "lg";

const BASE = "flex-row items-center justify-center rounded-md";

const VARIANTS: Record<Variant, { container: string; label: string }> = {
  default: { container: "bg-primary", label: "text-primary-fg" },
  secondary: { container: "bg-surface-2", label: "text-text" },
  outline: { container: "border border-border bg-transparent", label: "text-text" },
  ghost: { container: "bg-transparent", label: "text-text" },
};

const SIZES: Record<Size, { container: string; label: string }> = {
  sm: { container: "px-3 py-2", label: "text-sm" },
  default: { container: "px-4 py-3", label: "text-base" },
  lg: { container: "px-6 py-4", label: "text-lg" },
};

export type ButtonProps = Omit<PressableProps, "children"> & {
  label: string;
  variant?: Variant;
  size?: Size;
  className?: string;
};

export function Button({
  label,
  variant = "default",
  size = "default",
  className,
  disabled,
  ...props
}: ButtonProps) {
  const v = VARIANTS[variant];
  const s = SIZES[size];
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      className={cn(BASE, v.container, s.container, disabled && "opacity-50", className)}
      {...props}
    >
      <Text className={cn("font-medium", v.label, s.label)}>{label}</Text>
    </Pressable>
  );
}
