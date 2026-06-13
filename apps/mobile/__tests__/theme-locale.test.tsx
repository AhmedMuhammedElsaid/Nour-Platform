import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { ThemeToggle } from "@/components/theme-toggle";
import { LocaleSwitcher } from "@/components/locale-switcher";
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
    // Default theme is dark → shows ☀ (press to switch to light).
    await waitFor(() => expect(screen.getByText("☀")).toBeTruthy());

    fireEvent.press(screen.getByRole("button"));

    // After toggle → light theme → shows ☾
    await waitFor(() => expect(screen.getByText("☾")).toBeTruthy());
  });
});

describe("LocaleSwitcher", () => {
  it("renders the target locale label for the current language", async () => {
    renderWith(<LocaleSwitcher />);
    // Default i18n locale in test env is "en" → shows "ع" (press to switch to AR).
    await waitFor(() => expect(screen.getByText("ع")).toBeTruthy());
  });
});
