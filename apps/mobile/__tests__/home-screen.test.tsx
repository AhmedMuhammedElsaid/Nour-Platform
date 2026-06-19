import { useEffect as mockUseEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import type { Playlist } from "@repo/shared-core/schemas/playlist";

import HomeScreen from "@/app/index";
import { getJson } from "@/lib/api";
import { PlayerProvider } from "@/lib/player-context";

jest.mock("@/lib/api", () => ({ getJson: jest.fn() }));
jest.mock("expo-router", () => ({
  useRouter: () => ({ push: jest.fn() }),
  usePathname: () => "/",
  // Mirror useFocusEffect with a mount-once effect so its interval cleanup runs.
  useFocusEffect: (cb: () => void | (() => void)) => mockUseEffect(cb, []),
}));

const playlist = (over: Partial<Playlist> & Pick<Playlist, "id">): Playlist =>
  ({
    ar: { title: "أ", slug: "a" },
    en: { title: "Alpha", slug: "alpha" },
    status: "published",
    categoryIds: [],
    order: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...over,
  }) as Playlist;

function mockApi(playlists: unknown, categories: unknown = []) {
  jest.mocked(getJson).mockImplementation((path: string) => {
    if (path.startsWith("/categories")) return Promise.resolve(categories);
    return Promise.resolve(playlists);
  });
}

function renderHome() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <PlayerProvider>
        <HomeScreen />
      </PlayerProvider>
    </QueryClientProvider>,
  );
}

describe("HomeScreen", () => {
  beforeEach(() => jest.mocked(getJson).mockReset());

  it("renders fetched playlist titles", async () => {
    mockApi([playlist({ id: "1", trackCount: 3 })]);
    renderHome();
    await waitFor(() => expect(screen.getByText(/أ|Alpha/)).toBeTruthy());
  });

  it("re-sorts A–Z when the sort chip is tapped", async () => {
    mockApi([
      playlist({ id: "1", en: { title: "Banana", slug: "b" }, ar: { title: "ب", slug: "b" } }),
      playlist({ id: "2", en: { title: "Apple", slug: "ap" }, ar: { title: "أب", slug: "ap" } }),
    ]);
    renderHome();
    await waitFor(() => expect(screen.getByText(/Banana|ب/)).toBeTruthy());

    // Tapping the A–Z sort chip should not throw and keeps both items rendered.
    fireEvent.press(screen.getByText(/A–Z|أ–ي/));
    expect(screen.getByText(/Apple|أب/)).toBeTruthy();
  });

  it("keeps the A–Z grid rendered when a row is missing the active locale", async () => {
    // A row whose active-locale object is absent (embedded-locale data can lack
    // one side) used to make the A–Z comparator throw and blank the whole grid.
    mockApi([
      playlist({
        id: "1",
        en: undefined as unknown as Playlist["en"],
        ar: { title: "ز", slug: "z" },
      }),
      playlist({ id: "2", en: { title: "Apple", slug: "ap" }, ar: { title: "أب", slug: "ap" } }),
    ]);
    renderHome();
    await waitFor(() => expect(screen.getByText(/Apple|أب/)).toBeTruthy());

    fireEvent.press(screen.getByText(/A–Z|أ–ي/));
    // The valid row still renders — the bad row no longer crashes the grid.
    expect(screen.getByText(/Apple|أب/)).toBeTruthy();
  });

  it("shows an error state with retry on failure", async () => {
    jest.mocked(getJson).mockRejectedValue(new Error("network"));
    renderHome();
    await waitFor(() => expect(screen.getByText("Something went wrong.")).toBeTruthy());
    expect(screen.getByText("Retry")).toBeTruthy();
  });
});
