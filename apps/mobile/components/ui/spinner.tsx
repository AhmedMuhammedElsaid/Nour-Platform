import { ActivityIndicator } from "react-native";

// Loading spinner. Wraps React Native's native ActivityIndicator — the OS draws
// it on the native thread, so there's no JS animation loop, no SVG, and no extra
// dependency: the lightest, most performant spinner available. Centralizes the
// brand gold + accessibility label so every loading state matches (mirrors the
// gold ActivityIndicator already used by DownloadButton).
const GOLD = "#c8a050"; // --color-primary (dark palette, tokens.css)

export type SpinnerProps = {
  size?: "small" | "large";
  // Screen-reader announcement (pass the localized "loading" string) so the
  // spinner keeps the affordance the old visible "Loading…" text provided.
  label?: string;
};

export function Spinner({ size = "large", label }: SpinnerProps) {
  return (
    <ActivityIndicator
      size={size}
      color={GOLD}
      accessibilityRole="progressbar"
      accessibilityLabel={label}
    />
  );
}
