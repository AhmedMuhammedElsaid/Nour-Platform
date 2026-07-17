import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, fireEvent } from "@testing-library/react-native";

import AdhkarListScreen from "@/app/adhkar/index";
import AdhkarReaderScreen from "@/app/adhkar/[slug]";
import { getJson } from "@/lib/api";
import { PlayerProvider } from "@/lib/player-context";

jest.mock("@/lib/api", () => ({ getJson: jest.fn() }));
jest.mock("expo-router", () => ({
  useRouter: () => ({ push: jest.fn() }),
  useLocalSearchParams: () => ({ slug: "morning" }),
  usePathname: () => "/adhkar",
  Stack: { Screen: () => null },
}));

const azkarSet = {
  id: "set1",
  kind: "morning",
  status: "published",
  order: 0,
  ar: { title: "أذكار الصباح", slug: "morning-ar" },
  en: { title: "Morning Adhkar", slug: "morning" },
  items: [
    { ar: "سبحان الله", en: "Glory be to Allah", repeat: 3 },
    { ar: "الحمد لله", en: "Praise be to Allah", repeat: 1 },
  ],
  createdAt: "",
  updatedAt: "",
};

function renderWith(node: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <PlayerProvider>{node}</PlayerProvider>
    </QueryClientProvider>,
  );
}

describe("AdhkarListScreen", () => {
  beforeEach(() => jest.mocked(getJson).mockReset());

  it("renders the list of adhkar sets", async () => {
    jest.mocked(getJson).mockResolvedValue([azkarSet]);
    renderWith(<AdhkarListScreen />);
    await waitFor(() => expect(screen.getByText(/Morning Adhkar|أذكار الصباح/)).toBeTruthy());
  });

  it("shows an error state on failure", async () => {
    jest.mocked(getJson).mockRejectedValue(new Error("network"));
    renderWith(<AdhkarListScreen />);
    // Locale-agnostic: app default is Arabic, but accept either language's string.
    await waitFor(() =>
      expect(screen.getByText(/Something went wrong\.|حدث خطأ ما\./)).toBeTruthy(),
    );
  });

  it("renders cached data instead of the error state when a refetch fails (offline-first)", async () => {
    // Seed the query cache exactly as a prior successful fetch would have —
    // same key as adhkarListQuery() (["adhkar"]) — then make the query
    // function reject, simulating an offline refetch against data that's
    // already persisted/cached. The data-first error gate (isError && !data)
    // should keep rendering the cached list instead of the error screen.
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    client.setQueryData(["adhkar"], [azkarSet]);
    jest.mocked(getJson).mockRejectedValue(new Error("network"));

    render(
      <QueryClientProvider client={client}>
        <PlayerProvider>
          <AdhkarListScreen />
        </PlayerProvider>
      </QueryClientProvider>,
    );

    await waitFor(() => expect(screen.getByText(/Morning Adhkar|أذكار الصباح/)).toBeTruthy());
    expect(screen.queryByText(/Something went wrong\.|حدث خطأ ما\./)).toBeNull();
  });
});

describe("AdhkarReaderScreen", () => {
  beforeEach(() => jest.mocked(getJson).mockReset());

  it("renders dhikr items and increments the tap counter", async () => {
    jest.mocked(getJson).mockResolvedValue(azkarSet);
    renderWith(<AdhkarReaderScreen />);

    await waitFor(() => expect(screen.getAllByText(/Glory be to Allah|سبحان الله/).length).toBeGreaterThan(0));

    const counters = screen.getAllByLabelText(/Count this dhikr|عُدّ هذا الذكر/);
    expect(counters.length).toBeGreaterThan(0);
    fireEvent.press(counters[0]!);

    await waitFor(() => expect(screen.getByText("1")).toBeTruthy());
  });
});
