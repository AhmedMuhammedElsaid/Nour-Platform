import { render, screen } from "@testing-library/react-native";

import { QiblaCompass } from "@/features/qibla/components/qibla-compass";

// react-native-svg normalizes the `fill` prop to an internal colour payload, so
// we compare fills relationally (aligned vs not) rather than matching a hex.
const markerFill = () =>
  JSON.stringify(screen.getByTestId("qibla-marker").props.fill);

describe("QiblaCompass", () => {
  it("renders the Kaaba marker in static mode", () => {
    render(<QiblaCompass bearing={136} heading={null} theme="dark" />);
    expect(screen.getByTestId("qibla-marker")).toBeTruthy();
  });

  it("uses a distinct highlight colour when the device faces the Qibla", () => {
    // Not aligned (no reading) → primary colour.
    const { unmount } = render(
      <QiblaCompass bearing={136} heading={null} theme="dark" />,
    );
    const idle = markerFill();
    unmount();

    // |135 - 136| = 1° ≤ tolerance → aligned → sun highlight, a different fill.
    render(<QiblaCompass bearing={136} heading={135} theme="dark" />);
    expect(markerFill()).not.toBe(idle);
  });

  it("renders in light theme too", () => {
    render(<QiblaCompass bearing={200} heading={null} theme="light" />);
    expect(screen.getByTestId("qibla-marker")).toBeTruthy();
  });
});
