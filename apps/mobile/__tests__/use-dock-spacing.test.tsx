import { render, screen } from "@testing-library/react-native";
import { Text } from "react-native";

import { useDockSpacing } from "@/lib/use-dock-spacing";

// jest.setup.js mocks react-native-safe-area-context with zero insets.
// The hook no longer depends on the player or the tab-bar/mini-player
// components — see the hook's own comment for why (the earlier
// real-dock-height formula double-reserved space and was reverted,
// owner-reported 2026-08-02).
function Probe() {
  return <Text testID="spacing">{String(useDockSpacing())}</Text>;
}

describe("useDockSpacing", () => {
  it("returns a small flat gap plus the bottom safe-area inset", () => {
    render(<Probe />);
    expect(screen.getByTestId("spacing").children.join("")).toBe("16");
  });
});
