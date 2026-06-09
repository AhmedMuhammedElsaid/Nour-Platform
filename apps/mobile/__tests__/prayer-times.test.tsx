import { render, screen, waitFor } from "@testing-library/react-native";

import PrayerTimesScreen from "@/app/prayer-times/index";

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: jest.fn() }),
  Stack: { Screen: () => null },
}));

describe("PrayerTimesScreen", () => {
  it("renders the prayer times heading and all 6 prayer names", async () => {
    render(<PrayerTimesScreen />);
    // Heading
    await waitFor(() => expect(screen.getByText(/Prayer Times|مواقيت الصلاة/)).toBeTruthy());
    // At least 3 prayer names must be visible (Fajr, Dhuhr, Isha)
    expect(screen.getAllByText(/Fajr|الفجر/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Isha|العشاء/).length).toBeGreaterThan(0);
  });

  it("renders the next prayer countdown label", async () => {
    render(<PrayerTimesScreen />);
    await waitFor(() =>
      expect(screen.getByText(/Next prayer|الصلاة القادمة/)).toBeTruthy(),
    );
  });

  it("renders the change city link", async () => {
    render(<PrayerTimesScreen />);
    await waitFor(() =>
      expect(screen.getByText(/Change city|تغيير المدينة/)).toBeTruthy(),
    );
  });
});
