// Thin styled wrapper around a native range input. `onChange` fires live while
// dragging; `onCommit` fires when the interaction ends (pointer up / key up) —
// the seek slider uses this to scrub locally and seek only on release.

type SliderProps = {
  min: number;
  max: number;
  step?: number;
  value: number;
  onChange: (value: number) => void;
  onCommit?: (value: number) => void;
  className?: string;
  "aria-label": string;
  "aria-valuetext"?: string;
};

export function Slider({
  min,
  max,
  step = 1,
  value,
  onChange,
  onCommit,
  className,
  "aria-label": ariaLabel,
  "aria-valuetext": ariaValueText,
}: SliderProps) {
  return (
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      aria-label={ariaLabel}
      aria-valuetext={ariaValueText}
      onChange={(e) => onChange(Number(e.target.value))}
      onPointerUp={(e) => onCommit?.(Number(e.currentTarget.value))}
      onKeyUp={(e) => onCommit?.(Number(e.currentTarget.value))}
      className={`h-1 cursor-pointer accent-[var(--color-primary)] ${className ?? ""}`}
    />
  );
}
