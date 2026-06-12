import { render, screen } from "@testing-library/react-native";

import { SunArc } from "@/features/prayer-times/components/sun-arc";
import type { PrayerDay } from "@repo/shared-core/prayer-times/compute";

// A fixed day: Fajr 04:00 … Isha 20:30 on 2026-06-09.
function day(): PrayerDay {
  const d = (h: number, m = 0) => new Date(2026, 5, 9, h, m, 0, 0);
  return {
    date: d(0),
    instants: [
      { key: "fajr", time: d(4) },
      { key: "sunrise", time: d(6) },
      { key: "dhuhr", time: d(12) },
      { key: "asr", time: d(15) },
      { key: "maghrib", time: d(19) },
      { key: "isha", time: d(20, 30) },
    ],
  };
}

describe("SunArc day/night marker", () => {
  it("shows the sun during the day (between Fajr and Isha)", () => {
    const noon = new Date(2026, 5, 9, 13, 0, 0); // after Asr, before Maghrib
    render(<SunArc day={day()} now={noon} nextPrayerKey="maghrib" />);
    expect(screen.getByTestId("prayer-sun")).toBeTruthy();
    expect(screen.queryByTestId("prayer-moon")).toBeNull();
  });

  it("shows the moon after Isha", () => {
    const night = new Date(2026, 5, 9, 22, 0, 0); // after Isha 20:30
    render(<SunArc day={day()} now={night} nextPrayerKey={null} />);
    expect(screen.getByTestId("prayer-moon")).toBeTruthy();
    expect(screen.queryByTestId("prayer-sun")).toBeNull();
  });

  it("shows the moon before Fajr", () => {
    const preDawn = new Date(2026, 5, 9, 3, 0, 0); // before Fajr 04:00
    render(<SunArc day={day()} now={preDawn} nextPrayerKey="fajr" />);
    expect(screen.getByTestId("prayer-moon")).toBeTruthy();
    expect(screen.queryByTestId("prayer-sun")).toBeNull();
  });
});
