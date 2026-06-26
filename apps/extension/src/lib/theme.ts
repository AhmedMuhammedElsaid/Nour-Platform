import { useCallback, useEffect, useState } from "react";

import { get, set, watch } from "./storage";

export type Theme = "dark" | "light";

// Live theme state backed by `nour.theme`. The extension's `:root` tokens are
// dark; `[data-theme="light"]` carries the light overrides — so light = set the
// attribute, dark = remove it. Defaults to dark until storage loads.
export function useTheme(): { theme: Theme; setTheme: (theme: Theme) => void } {
  const [theme, setThemeState] = useState<Theme>("dark");

  useEffect(() => {
    void get("nour.theme").then(setThemeState);
    return watch("nour.theme", setThemeState);
  }, []);

  useEffect(() => {
    if (theme === "light") {
      document.documentElement.dataset.theme = "light";
    } else {
      document.documentElement.removeAttribute("data-theme");
    }
  }, [theme]);

  const setTheme = useCallback((next: Theme) => void set("nour.theme", next), []);

  return { theme, setTheme };
}
