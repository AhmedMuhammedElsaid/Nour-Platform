import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/i18n/routing", () => ({
  routing: { locales: ["ar", "en"], defaultLocale: "ar" },
}));

import {
  LocaleAlternatesProvider,
  SetLocaleAlternates,
  useLocaleAlternates,
} from "./locale-alternates-context";

// Reads the registered alternates and renders them so we can assert the value
// that propagated from SetLocaleAlternates up to a sibling consumer.
function AlternatesProbe() {
  const alternates = useLocaleAlternates();
  return <span data-testid="probe">{JSON.stringify(alternates)}</span>;
}

describe("LocaleAlternatesProvider", () => {
  it("registers a detail page's per-locale slugs without an infinite render loop", () => {
    // Before the useCallback/useMemo fix this throws "Maximum update depth
    // exceeded": the inline setter identity changed every render, re-firing
    // SetLocaleAlternates' effect, which wrote a fresh object each time.
    render(
      <LocaleAlternatesProvider>
        <AlternatesProbe />
        <SetLocaleAlternates
          alternates={{ ar: "/playlists/الفاتحة", en: "/playlists/al-fatiha" }}
        />
      </LocaleAlternatesProvider>,
    );

    expect(screen.getByTestId("probe")).toHaveTextContent(
      JSON.stringify({ ar: "/playlists/الفاتحة", en: "/playlists/al-fatiha" }),
    );
  });

  it("defaults to empty alternates when no detail page registers any", () => {
    render(
      <LocaleAlternatesProvider>
        <AlternatesProbe />
      </LocaleAlternatesProvider>,
    );

    expect(screen.getByTestId("probe")).toHaveTextContent("{}");
  });
});
