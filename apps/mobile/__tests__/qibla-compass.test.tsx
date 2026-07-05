import { render, screen } from "@testing-library/react-native";
import type { SharedValue } from "react-native-reanimated";

import { QiblaCompass } from "@/features/qibla/components/qibla-compass";

// Rotation is driven by a SharedValue on the UI thread; the tests only need a plain
// stand-in (useAnimatedStyle reads `.value`).
const sv = (v: number | null): SharedValue<number | null> =>
  ({ value: v }) as unknown as SharedValue<number | null>;

// react-native-svg normalizes the `fill` prop to an internal colour payload, so we
// compare fills relationally (aligned vs not) rather than matching a hex.
const markerFill = () =>
  JSON.stringify(screen.getByTestId("qibla-marker").props.fill);

describe("QiblaCompass", () => {
  it("renders the Kaaba marker in static mode", () => {
    render(<QiblaCompass bearing={136} headingSV={sv(null)} aligned={false} theme="dark" />);
    expect(screen.getByTestId("qibla-marker")).toBeTruthy();
  });

  it("uses a distinct highlight colour when the device faces the Qibla", () => {
    const { unmount } = render(
      <QiblaCompass bearing={136} headingSV={sv(135)} aligned={false} theme="dark" />,
    );
    const idle = markerFill();
    unmount();

    render(<QiblaCompass bearing={136} headingSV={sv(135)} aligned theme="dark" />);
    expect(markerFill()).not.toBe(idle);
  });

  it("renders in light theme too", () => {
    render(<QiblaCompass bearing={200} headingSV={sv(null)} aligned={false} theme="light" />);
    expect(screen.getByTestId("qibla-marker")).toBeTruthy();
  });
});
