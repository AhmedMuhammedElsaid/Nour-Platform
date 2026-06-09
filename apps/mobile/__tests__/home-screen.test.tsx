import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react-native";

import HomeScreen from "@/app/index";
import { getJson } from "@/lib/api";

jest.mock("@/lib/api", () => ({ getJson: jest.fn() }));

function renderWithClient(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

describe("HomeScreen smoke", () => {
  it("renders fetched playlist titles", async () => {
    jest.mocked(getJson).mockResolvedValueOnce([
      { id: "1", ar: { title: "أ", slug: "a" }, en: { title: "Alpha", slug: "alpha" } },
    ]);

    renderWithClient(<HomeScreen />);

    await waitFor(() => expect(screen.getByText(/أ|Alpha/)).toBeTruthy());
  });

  it("shows an error state with retry on failure", async () => {
    jest.mocked(getJson).mockRejectedValueOnce(new Error("network"));

    renderWithClient(<HomeScreen />);

    await waitFor(() => expect(screen.getByText("Something went wrong.")).toBeTruthy());
  });
});
