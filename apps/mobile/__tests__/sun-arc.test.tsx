import { render, screen } from "@testing-library/react-native";

import { SunArc } from "@/features/prayer-times/components/sun-arc";
import type { ArcDot } from "@/features/prayer-times/lib/arc-dots";

// A representative set of day-arc dots (positions are irrelevant to the
// day/night body choice, which the caller passes via `isNight`).
const dots: ArcDot[] = [
  { key: "fajr", fraction: 0, isNext: false },
  { key: "dhuhr", fraction: 0.45, isNext: false },
  { key: "asr", fraction: 0.65, isNext: true },
  { key: "maghrib", fraction: 0.9, isNext: false },
  { key: "isha", fraction: 1, isNext: false },
];

describe("SunArc day/night marker", () => {
  it("shows the rayed sun during the day", () => {
    render(<SunArc dots={dots} fraction={0.5} isNight={false} />);
    expect(screen.getByTestId("prayer-sun")).toBeTruthy();
    expect(screen.queryByTestId("prayer-moon")).toBeNull();
  });

  it("shows the crescent moon at night", () => {
    render(<SunArc dots={dots} fraction={0.3} isNight />);
    expect(screen.getByTestId("prayer-moon")).toBeTruthy();
    expect(screen.queryByTestId("prayer-sun")).toBeNull();
  });

  it("defaults to the sun when isNight is omitted", () => {
    render(<SunArc dots={dots} fraction={0.5} />);
    expect(screen.getByTestId("prayer-sun")).toBeTruthy();
  });

  it("renders the body in light theme as well as dark", () => {
    const { rerender } = render(
      <SunArc dots={dots} fraction={0.3} isNight theme="light" />,
    );
    expect(screen.getByTestId("prayer-moon")).toBeTruthy();

    rerender(<SunArc dots={dots} fraction={0.5} theme="light" />);
    expect(screen.getByTestId("prayer-sun")).toBeTruthy();
  });
});

describe("SunArc dot labels", () => {
  const labelled: ArcDot[] = [
    { key: "fajr", fraction: 0, isNext: false, label: "Fajr" },
    { key: "dhuhr", fraction: 0.45, isNext: true, label: "Dhuhr" },
    { key: "isha", fraction: 1, isNext: false, label: "Isha" },
  ];

  it("draws a label per dot only when showLabels is set", () => {
    const { rerender } = render(<SunArc dots={labelled} fraction={0.5} />);
    // Off by default (the small Home widget arc).
    expect(screen.queryByTestId("arc-label-fajr")).toBeNull();

    rerender(<SunArc dots={labelled} fraction={0.5} showLabels />);
    expect(screen.getByTestId("arc-label-fajr")).toBeTruthy();
    expect(screen.getByTestId("arc-label-dhuhr")).toBeTruthy();
    expect(screen.getByTestId("arc-label-isha")).toBeTruthy();
  });

  it("skips dots that have no label even with showLabels", () => {
    render(<SunArc dots={dots} fraction={0.5} showLabels />);
    // The base `dots` set carries no `label`, so nothing is drawn.
    expect(screen.queryByTestId("arc-label-fajr")).toBeNull();
  });
});
