import * as React from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { vars } from "nativewind";
import { View } from "react-native";

// ---------------------------------------------------------------------------
// Token values (verbatim from packages/ui/src/styles/tokens.css §3.1 of the
// migration plan). The ThemeProvider applies these as CSS custom properties
// at the root View so all NativeWind `bg-*`/`text-*`/`border-*` utilities
// resolve correctly without any change to component files.
// ---------------------------------------------------------------------------

const DARK = vars({
  "--color-bg": "#0f0d0a",
  "--color-surface": "#1c1915",
  "--color-surface-2": "#252018",
  "--color-border": "rgba(200, 160, 80, 0.15)",
  "--color-text": "#f0e6cc",
  "--color-text-2": "#8a7a62",
  "--color-muted": "#5a4a38",
  "--color-primary": "#c8a050",
  "--color-primary-fg": "#0f0d0a",
  "--color-sun": "#e4c57e",
  "--color-secondary": "#0e6e59",
  "--color-accent": "#c6a266",
  "--color-success": "#48b57c",
  "--color-warning": "#e0a14a",
  "--color-danger": "#e26a63",
  "--color-focus": "#c8a050",
});

const LIGHT = vars({
  "--color-bg": "#fdfaf4",
  "--color-surface": "#ffffff",
  "--color-surface-2": "#f4f1e8",
  "--color-border": "#e6e2d7",
  "--color-text": "#13201a",
  "--color-text-2": "#3f4a44",
  "--color-muted": "#6b7670",
  "--color-primary": "#9a7830",
  "--color-primary-fg": "#ffffff",
  "--color-sun": "#c8a050",
  "--color-secondary": "#0e6e59",
  "--color-accent": "#a8884a",
  "--color-success": "#147d4a",
  "--color-warning": "#a66400",
  "--color-danger": "#b3261e",
  "--color-focus": "#9a7830",
});

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const THEME_KEY = "nour.theme";
export type ThemeMode = "dark" | "light";

type ThemeContextValue = {
  theme: ThemeMode;
  toggleTheme: () => void;
};

const ThemeContext = React.createContext<ThemeContextValue>({
  theme: "dark",
  toggleTheme: () => {},
});

export function useTheme(): ThemeContextValue {
  return React.useContext(ThemeContext);
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = React.useState<ThemeMode>("dark");

  // Hydrate from storage.
  React.useEffect(() => {
    void AsyncStorage.getItem(THEME_KEY).then((stored) => {
      if (stored === "light" || stored === "dark") setTheme(stored);
    });
  }, []);

  const toggleTheme = React.useCallback(() => {
    setTheme((prev) => {
      const next: ThemeMode = prev === "dark" ? "light" : "dark";
      void AsyncStorage.setItem(THEME_KEY, next);
      return next;
    });
  }, []);

  const value = React.useMemo<ThemeContextValue>(
    () => ({ theme, toggleTheme }),
    [theme, toggleTheme],
  );

  return (
    <ThemeContext.Provider value={value}>
      <View style={theme === "dark" ? DARK : LIGHT} className="flex-1">
        {children}
      </View>
    </ThemeContext.Provider>
  );
}
