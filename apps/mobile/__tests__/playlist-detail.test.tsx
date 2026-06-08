import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react-native";

import PlaylistDetailScreen from "@/app/playlist/[slug]";
import { getJson } from "@/lib/api";

jest.mock("@/lib/api", () => ({ getJson: jest.fn() }));
jest.mock("expo-router", () => ({
  useRouter: () => ({ push: jest.fn() }),
  useLocalSearchParams: () => ({ slug: "alpha" }),
  Stack: { Screen: () => null },
}));

function renderDetail() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <PlaylistDetailScreen />
    </QueryClientProvider>,
  );
}

describe("PlaylistDetailScreen", () => {
  beforeEach(() => jest.mocked(getJson).mockReset());

  it("renders the playlist title and its tracks", async () => {
    jest.mocked(getJson).mockImplementation((path: string) => {
      if (path.startsWith("/categories")) return Promise.resolve([]);
      return Promise.resolve({
        playlist: {
          id: "1",
          ar: { title: "أ", slug: "a" },
          en: { title: "Alpha", slug: "alpha" },
          status: "published",
          categoryIds: [],
          order: 0,
        },
        tracks: [
          { id: "t1", ar: { title: "م1", slug: "m1" }, en: { title: "Track One", slug: "t1" }, order: 0, srcUrl: null },
        ],
      });
    });

    renderDetail();

    await waitFor(() => expect(screen.getByText(/Alpha|أ/)).toBeTruthy());
    expect(screen.getByText(/Track One|م1/)).toBeTruthy();
    // Play-all button is present (disabled stub until Phase 6).
    expect(screen.getByText(/Play all|تشغيل الكل/)).toBeTruthy();
  });

  it("shows an error state on failure", async () => {
    jest.mocked(getJson).mockRejectedValue(new Error("network"));
    renderDetail();
    await waitFor(() => expect(screen.getByText("Something went wrong.")).toBeTruthy());
  });
});
