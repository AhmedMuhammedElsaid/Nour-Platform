"use client";

import * as React from "react";
import * as SliderPrimitive from "@radix-ui/react-slider";

import { cn } from "../lib/utils";

function Slider({
  className,
  defaultValue,
  value,
  min = 0,
  max = 100,
  // Radix puts role="slider" on the Thumb, not the Root. Forward the label
  // and value text there so assistive tech announces them (DESIGN.md §17.3).
  "aria-label": ariaLabel,
  "aria-valuetext": ariaValueText,
  ...props
}: React.ComponentProps<typeof SliderPrimitive.Root>) {
  const resolvedValues = React.useMemo<number[]>(() => {
    if (Array.isArray(value)) return value;
    if (Array.isArray(defaultValue)) return defaultValue;
    return [min, max];
  }, [defaultValue, max, min, value]);

  return (
    <SliderPrimitive.Root
      data-slot="slider"
      defaultValue={defaultValue}
      value={value}
      min={min}
      max={max}
      className={cn(
        "relative flex w-full touch-none items-center select-none",
        "data-[orientation=vertical]:h-full data-[orientation=vertical]:min-h-44 data-[orientation=vertical]:w-auto data-[orientation=vertical]:flex-col",
        "data-[disabled]:opacity-55",
        className,
      )}
      {...props}
    >
      <SliderPrimitive.Track
        data-slot="slider-track"
        className={cn(
          "relative grow overflow-hidden rounded-full bg-surface-2",
          "data-[orientation=horizontal]:h-1.5 data-[orientation=horizontal]:w-full",
          "data-[orientation=vertical]:h-full data-[orientation=vertical]:w-1.5",
        )}
      >
        <SliderPrimitive.Range
          data-slot="slider-range"
          className={cn(
            "absolute bg-primary",
            "data-[orientation=horizontal]:h-full",
            "data-[orientation=vertical]:w-full",
          )}
        />
      </SliderPrimitive.Track>
      {resolvedValues.map((_, index) => (
        <SliderPrimitive.Thumb
          key={index}
          data-slot="slider-thumb"
          aria-label={ariaLabel}
          aria-valuetext={ariaValueText}
          className={cn(
            "block size-4 shrink-0 rounded-full border-2 border-primary bg-surface shadow-1 transition-[color,box-shadow]",
            "hover:ring-4 hover:ring-primary/15",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
            "disabled:pointer-events-none disabled:opacity-55",
          )}
        />
      ))}
    </SliderPrimitive.Root>
  );
}

export { Slider };
