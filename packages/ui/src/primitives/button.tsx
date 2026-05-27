import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "../lib/utils";

const buttonVariants = cva(
  cn(
    "inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium",
    "rounded-md transition-colors outline-none",
    "disabled:pointer-events-none disabled:opacity-55",
    "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
    "[&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 [&_svg]:shrink-0",
  ),
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground hover:[background:color-mix(in_oklab,var(--color-primary)_90%,black)] active:scale-[0.98]",
        secondary:
          "bg-surface-2 text-foreground hover:bg-surface-2/80 border border-border",
        outline:
          "border border-border bg-transparent text-foreground hover:bg-surface-2",
        ghost: "bg-transparent text-foreground hover:bg-surface-2",
        destructive:
          "bg-destructive text-destructive-foreground hover:[background:color-mix(in_oklab,var(--color-danger)_90%,black)]",
        link: "bg-transparent text-primary underline-offset-4 hover:underline",
      },
      size: {
        sm: "h-8 px-3 text-sm",
        default: "h-10 px-4 text-sm",
        lg: "h-11 px-6 text-md",
        icon: "size-10",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

type ButtonProps = React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  };

function Button({
  className,
  variant,
  size,
  asChild = false,
  type,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      data-slot="button"
      type={asChild ? undefined : (type ?? "button")}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}

export { Button, buttonVariants };
export type { ButtonProps };
