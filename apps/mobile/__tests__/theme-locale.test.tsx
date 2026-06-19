import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Updates from "expo-updates";

import { ThemeToggle } from "@/components/theme-toggle";
import { LocaleSwitcher } from "@/components/locale-switcher";
import i18n from "@/lib/i18n";
import { ThemeProvider } from "@/lib/theme-context";

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: jest.fn() }),
  Stack: { Screen: () => null },
}));

function renderWith(node: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ThemeProvider>{node}</ThemeProvider>
    </QueryClientProvider>,
  );
}

describe("ThemeToggle", () => {
  it("renders with a sun/moon icon and toggles on press", async () => {
    renderWith(<ThemeToggle />);

    // Wait for ThemeProvider's AsyncStorage hydration effect to settle.
    // Default theme is dark → shows the sun icon (press to switch to light).
    await waitFor(() => expect(screen.getByTestId("theme-icon-sun")).toBeTruthy());

    fireEvent.press(screen.getByRole("button"));

    // After toggle → light theme → shows the moon icon.
    await waitFor(() => expect(screen.getByTestId("theme-icon-moon")).toBeTruthy());
  });
});

describe("LocaleSwitcher", () => {
  beforeEach(async () => {
    // The app default is now Arabic; pin these switcher tests to "en" so they
    // deterministically exercise the en→ar switch regardless of the app default.
    await i18n.changeLanguage("en");
  });

  afterEach(async () => {
    // Pressing the switch flips i18n.language globally — restore for other suites.
    await i18n.changeLanguage("en");
  });

  it("renders the target locale label for the current language", async () => {
    renderWith(<LocaleSwitcher />);
    // Pinned to "en" above → shows "ع" (press to switch to AR).
    await waitFor(() => expect(screen.getByText("ع")).toBeTruthy());
  });

  it("persists the new locale and attempts a reload on switch", async () => {
    renderWith(<LocaleSwitcher />);
    await waitFor(() => expect(screen.getByText("ع")).toBeTruthy());

    fireEvent.press(screen.getByRole("button"));

    // Choice is persisted under nour.locale and a reload is attempted (which the
    // mock rejects, so the component falls back to a live language swap).
    await waitFor(() =>
      expect(AsyncStorage.setItem).toHaveBeenCalledWith("nour.locale", "ar"),
    );
    expect(Updates.reloadAsync).toHaveBeenCalled();
  });
});
