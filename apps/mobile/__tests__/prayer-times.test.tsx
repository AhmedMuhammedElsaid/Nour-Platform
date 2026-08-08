import { useEffect as mockUseEffect } from "react";
import { render, screen, waitFor } from "@testing-library/react-native";

import PrayerTimesScreen from "@/app/prayer-times/index";
import { PlayerProvider } from "@/lib/player-context";

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: jest.fn() }),
  usePathname: () => "/prayer-times",
  Stack: { Screen: () => null },
  // Mirror useFocusEffect with a mount-once effect so its interval cleanup runs.
  useFocusEffect: (cb: () => void | (() => void)) => mockUseEffect(cb, []),
}));

function renderWith(node: React.ReactElement) {
  return render(<PlayerProvider>{node}</PlayerProvider>);
}

describe("PrayerTimesScreen", () => {
  it("renders the prayer times heading and all 6 prayer names", async () => {
    renderWith(<PrayerTimesScreen />);
    // Heading
    await waitFor(() => expect(screen.getByText(/Prayer Times|مواقيت الصلاة/)).toBeTruthy());
    // At least 3 prayer names must be visible (Fajr, Dhuhr, Isha)
    expect(screen.getAllByText(/Fajr|الفجر/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Isha|العشاء/).length).toBeGreaterThan(0);
  });

  it("renders the next prayer countdown label", async () => {
    renderWith(<PrayerTimesScreen />);
    await waitFor(() =>
      expect(screen.getByText(/Next prayer|الصلاة القادمة/)).toBeTruthy(),
    );
  });

  it("renders the change city link", async () => {
    renderWith(<PrayerTimesScreen />);
    await waitFor(() =>
      expect(screen.getByText(/Change city|تغيير المدينة/)).toBeTruthy(),
    );
  });

  it("renders the adhkar reminder toggle", async () => {
    renderWith(<PrayerTimesScreen />);
    await waitFor(() =>
      expect(screen.getByText(/Adhkar reminder|تذكير الأذكار/)).toBeTruthy(),
    );
    expect(
      screen.getByLabelText(
        /Remind me of morning & evening adhkar|تذكيري بأذكار الصباح والمساء/,
      ),
    ).toBeTruthy();
  });

  it("does not render the home-screen pin buttons when the native module is absent", async () => {
    // Under jest, requireOptionalNativeModule("NourShortcuts") resolves null
    // (no native module compiled), so isPinShortcutSupported() stays false and
    // the pin buttons must never render, regardless of toggle/permission state.
    renderWith(<PrayerTimesScreen />);
    await waitFor(() =>
      expect(screen.getByText(/Adhkar reminder|تذكير الأذكار/)).toBeTruthy(),
    );
    expect(screen.queryByText(/Add Sabah icon to Home screen|إضافة أيقونة الصباح/)).toBeNull();
    expect(screen.queryByText(/Add Masaa icon to Home screen|إضافة أيقونة المساء/)).toBeNull();
    expect(
      screen.queryByText(/Add Al-Kahf icon to Home screen|إضافة أيقونة سورة الكهف/),
    ).toBeNull();
  });
});
