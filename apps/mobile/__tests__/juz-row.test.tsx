import { fireEvent, render, screen } from "@testing-library/react-native";
import type { QuranSurah } from "@repo/shared-core/schemas/quran";

import { JuzRow } from "@/features/quran/components/juz-shelf";

const mockPush = jest.fn();
jest.mock("expo-router", () => ({ useRouter: () => ({ push: mockPush }) }));

const surah: QuranSurah = {
  number: 2,
  name: { ar: "البقرة", en: "Al-Baqarah" },
  meaning: "The Cow",
  revelationPlace: "medinan",
  ayahCount: 286,
  pageStart: 2,
  pageEnd: 49,
  bismillahPre: true,
};

describe("JuzRow", () => {
  beforeEach(() => mockPush.mockReset());

  it("shows the full ayah count when the entry covers the whole surah", () => {
    render(<JuzRow entry={{ number: 2, ayahStart: 1, ayahEnd: 286 }} surah={surah} />);
    expect(screen.getByText("286 ayahs")).toBeTruthy();
  });

  it("shows the partial ayah range when the entry is a slice of the surah", () => {
    render(<JuzRow entry={{ number: 2, ayahStart: 142, ayahEnd: 252 }} surah={surah} />);
    expect(screen.getByText("ayahs 142-252")).toBeTruthy();
  });

  it("navigates to the autoplay reader on tap", () => {
    render(<JuzRow entry={{ number: 2, ayahStart: 1, ayahEnd: 141 }} surah={surah} />);
    fireEvent.press(screen.getByText("Al-Baqarah"));
    expect(mockPush).toHaveBeenCalledWith("/quran/2?autoplay=1");
  });
});
