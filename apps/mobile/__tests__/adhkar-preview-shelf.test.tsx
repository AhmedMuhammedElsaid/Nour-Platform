import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import type { Azkar } from "@repo/shared-core/schemas/azkar";
import { ADHKAR_WAKE_EN_SLUG } from "@repo/shared-core/adhkar/preview";

import { AdhkarPreviewShelf } from "@/features/home/components/adhkar-preview-shelf";
import { getJson } from "@/lib/api";

jest.mock("@/lib/api", () => ({
  getJson: jest.fn(),
  assetUrl: (p: string) => `http://localhost:3000${p}`,
}));
const mockPush = jest.fn();
jest.mock("expo-router", () => ({ useRouter: () => ({ push: mockPush }) }));

const set = (id: string, title: string, enSlug = `${id}-en`): Azkar =>
  ({
    id,
    kind: "other",
    status: "published",
    order: 0,
    ar: { title: `ar-${title}`, slug: `${id}-ar` },
    en: { title, slug: enSlug },
    items: [{ ar: "ذكر", repeat: 3 }],
  }) as Azkar;

function renderShelf() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <AdhkarPreviewShelf />
    </QueryClientProvider>,
  );
}

describe("AdhkarPreviewShelf", () => {
  beforeEach(() => {
    jest.mocked(getJson).mockReset();
    mockPush.mockReset();
  });

  it("renders nothing while there are no adhkar sets", async () => {
    jest.mocked(getJson).mockResolvedValue([]);
    const view = renderShelf();
    await waitFor(() => expect(getJson).toHaveBeenCalled());
    expect(view.toJSON()).toBeNull();
  });

  it("shows only the first 5 sets", async () => {
    jest.mocked(getJson).mockResolvedValue(
      Array.from({ length: 6 }, (_, i) => set(`s${i + 1}`, `Set ${i + 1}`)),
    );
    renderShelf();

    await waitFor(() => expect(screen.getByText("Set 1")).toBeTruthy());
    expect(screen.getByText("Set 5")).toBeTruthy();
    expect(screen.queryByText("Set 6")).toBeNull();
  });

  it("hides Wake-up when it's among the first 5 (owner request 2026-07-17)", async () => {
    jest.mocked(getJson).mockResolvedValue([
      set("s1", "Set 1"),
      set("s2", "Set 2"),
      set("s3", "Set 3"),
      set("s4", "Waking Adhkar", ADHKAR_WAKE_EN_SLUG),
      set("s5", "Set 5"),
      set("s6", "Set 6"),
    ]);
    renderShelf();

    await waitFor(() => expect(screen.getByText("Set 1")).toBeTruthy());
    expect(screen.getByText("Set 5")).toBeTruthy();
    expect(screen.queryByText("Waking Adhkar")).toBeNull();
    expect(screen.queryByText("Set 6")).toBeNull();
  });

  it("navigates to the set's reader when a card is tapped", async () => {
    jest.mocked(getJson).mockResolvedValue([set("s1", "Set 1")]);
    renderShelf();
    await waitFor(() => expect(screen.getByText("Set 1")).toBeTruthy());

    fireEvent.press(screen.getByText("Set 1"));
    expect(mockPush).toHaveBeenCalledWith("/adhkar/s1-en");
  });

  it("navigates to /adhkar when Explore more is tapped", async () => {
    jest.mocked(getJson).mockResolvedValue([set("s1", "Set 1")]);
    renderShelf();
    await waitFor(() => expect(screen.getByText("Set 1")).toBeTruthy());

    fireEvent.press(screen.getByText(/Explore more|استكشف المزيد/));
    expect(mockPush).toHaveBeenCalledWith("/adhkar");
  });
});
