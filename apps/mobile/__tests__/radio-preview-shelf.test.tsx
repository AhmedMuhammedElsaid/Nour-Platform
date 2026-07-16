import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import type { RadioStation } from "@repo/shared-core/schemas/radio";

import { RadioPreviewShelf } from "@/features/radio/components/radio-preview-shelf";
import { getJson } from "@/lib/api";
import { PlayerProvider } from "@/lib/player-context";

jest.mock("@/lib/api", () => ({
  getJson: jest.fn(),
  assetUrl: (p: string) => `http://localhost:3000${p}`,
}));
const mockPush = jest.fn();
jest.mock("expo-router", () => ({ useRouter: () => ({ push: mockPush }) }));

const station = (over: Partial<RadioStation> & Pick<RadioStation, "slug">): RadioStation =>
  ({
    id: over.slug,
    ar: { name: `اسم-${over.slug}` },
    en: { name: `Name-${over.slug}` },
    country: "EG",
    streamUrl: `https://stream.test/${over.slug}`,
    streamType: "mp3",
    language: "ar",
    category: "quran",
    isLive: true,
    isFeatured: false,
    order: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...over,
  }) as RadioStation;

function renderShelf() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <PlayerProvider>
        <RadioPreviewShelf />
      </PlayerProvider>
    </QueryClientProvider>,
  );
}

describe("RadioPreviewShelf", () => {
  beforeEach(() => {
    jest.mocked(getJson).mockReset();
    mockPush.mockReset();
  });

  it("renders nothing while there are no stations", async () => {
    jest.mocked(getJson).mockResolvedValue([]);
    const view = renderShelf();
    await waitFor(() => expect(getJson).toHaveBeenCalled());
    expect(view.toJSON()).toBeNull();
  });

  it("shows only the first 4 stations", async () => {
    jest.mocked(getJson).mockResolvedValue(
      Array.from({ length: 6 }, (_, i) => station({ slug: `s${i + 1}` })),
    );
    renderShelf();

    await waitFor(() => expect(screen.getByText("Name-s1")).toBeTruthy());
    expect(screen.getByText("Name-s4")).toBeTruthy();
    expect(screen.queryByText("Name-s5")).toBeNull();
    expect(screen.queryByText("Name-s6")).toBeNull();
  });

  it("navigates to /radio when Explore more is tapped", async () => {
    jest.mocked(getJson).mockResolvedValue([station({ slug: "s1" })]);
    renderShelf();
    await waitFor(() => expect(screen.getByText("Name-s1")).toBeTruthy());

    fireEvent.press(screen.getByText(/Explore more|استكشف المزيد/));
    expect(mockPush).toHaveBeenCalledWith("/radio");
  });
});
