import { useTheme } from "../lib/theme";
import { Moon, Sun } from "./ui/icons";

// Dark/light toggle. The light palette rides CSS tokens, so every token-based
// component recolors instantly — no per-component work needed.
export function ThemeToggle({ label }: { label: (key: string) => string }) {
  const { theme, setTheme } = useTheme();
  const toLight = theme === "dark";
  return (
    <button
      type="button"
      onClick={() => setTheme(toLight ? "light" : "dark")}
      aria-label={label(toLight ? "theme.toggleToLight" : "theme.toggleToDark")}
      className="inline-flex size-9 items-center justify-center rounded text-text-2 hover:bg-surface-2 hover:text-text"
    >
      {toLight ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </button>
  );
}
