import { fireEvent, render, screen } from "@testing-library/react-native";
import type { QuranSurah } from "@repo/shared-core/schemas/quran";

import { SurahCard } from "@/features/quran/components/surah-index";

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

describe("SurahCard", () => {
  beforeEach(() => mockPush.mockReset());

  it("renders the surah names and navigates to the autoplay reader on tap", () => {
    render(<SurahCard surah={surah} progressPct={null} />);
    expect(screen.getByText("Al-Baqarah")).toBeTruthy();
    expect(screen.getByText("البقرة")).toBeTruthy();
    fireEvent.press(screen.getByText("Al-Baqarah"));
    expect(mockPush).toHaveBeenCalledWith("/quran/2?autoplay=1");
  });

  it("renders a progress ring when progressPct is provided", () => {
    const { UNSAFE_root } = render(<SurahCard surah={surah} progressPct={50} />);
    const circles = UNSAFE_root.findAllByProps({ strokeLinecap: "round" });
    expect(circles.length).toBeGreaterThan(0);
  });
});
