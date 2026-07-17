import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import type { Azkar } from "@repo/shared-core/schemas/azkar";

import { DhikrOfTheDayCard } from "@/features/home/components/dhikr-of-the-day-card";
import { getJson } from "@/lib/api";

jest.mock("@/lib/api", () => ({
  getJson: jest.fn(),
  assetUrl: (p: string) => `http://localhost:3000${p}`,
}));
const mockPush = jest.fn();
jest.mock("expo-router", () => ({ useRouter: () => ({ push: mockPush }) }));

const oneItemSet: Azkar = {
  id: "set1",
  kind: "morning",
  status: "published",
  order: 0,
  ar: { title: "أذكار الصباح", slug: "morning-ar" },
  en: { title: "Morning Adhkar", slug: "morning-en" },
  items: [{ ar: "سبحان الله", en: "Glory be to Allah", repeat: 3 }],
} as Azkar;

function renderCard() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <DhikrOfTheDayCard />
    </QueryClientProvider>,
  );
}

describe("DhikrOfTheDayCard", () => {
  beforeEach(() => {
    jest.mocked(getJson).mockReset();
    mockPush.mockReset();
  });

  it("renders nothing while there are no adhkar items", async () => {
    jest.mocked(getJson).mockResolvedValue([]);
    const view = renderCard();
    await waitFor(() => expect(getJson).toHaveBeenCalled());
    expect(view.toJSON()).toBeNull();
  });

  it("renders the picked item's Arabic and translated text", async () => {
    jest.mocked(getJson).mockResolvedValue([oneItemSet]);
    renderCard();
    await waitFor(() => expect(screen.getByText("سبحان الله")).toBeTruthy());
    expect(screen.getByText("Glory be to Allah")).toBeTruthy();
  });

  it("navigates to the parent set's reader when the text is tapped", async () => {
    jest.mocked(getJson).mockResolvedValue([oneItemSet]);
    renderCard();
    await waitFor(() => expect(screen.getByText("سبحان الله")).toBeTruthy());

    fireEvent.press(screen.getByText("سبحان الله"));
    expect(mockPush).toHaveBeenCalledWith("/adhkar/morning-en");
  });

  it("increments the counter on tap", async () => {
    jest.mocked(getJson).mockResolvedValue([oneItemSet]);
    renderCard();
    const counter = await screen.findByLabelText(/Count this dhikr|عُدّ هذا الذكر/);

    fireEvent.press(counter);
    await waitFor(() => expect(screen.getByText("1")).toBeTruthy());
  });

  it("clamps at the item's repeat count and shows the completed mark", async () => {
    jest.mocked(getJson).mockResolvedValue([oneItemSet]);
    renderCard();
    const counter = await screen.findByLabelText(/Count this dhikr|عُدّ هذا الذكر/);

    fireEvent.press(counter);
    fireEvent.press(counter);
    fireEvent.press(counter);
    fireEvent.press(counter); // ignored — already at repeat=3

    await waitFor(() => expect(screen.getByLabelText(/Done|تم/)).toBeTruthy());
  });
});
