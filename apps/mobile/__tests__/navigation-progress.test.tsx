import { act, render, screen } from "@testing-library/react-native";
import { useIsFetching } from "@tanstack/react-query";

import { NavigationProgress } from "@/components/navigation-progress";

jest.mock("@tanstack/react-query", () => ({
  useIsFetching: jest.fn(),
}));

jest.useFakeTimers();

// Timer callbacks (the show-delay setTimeout, the trickle setInterval) call
// setState outside a React event handler, so advancing fake timers must be
// wrapped in act() or the resulting re-render never flushes to the tree.
const advance = (ms: number) => act(() => jest.advanceTimersByTime(ms));

// The bar is intentionally hidden from assistive tech
// (accessibilityElementsHidden / importantForAccessibility) — RNTL v13
// excludes such nodes from queries by default, so presence checks need
// includeHiddenElements to see it at all.
const findBar = () =>
  screen.queryByTestId("navigation-progress", { includeHiddenElements: true });

describe("NavigationProgress", () => {
  beforeEach(() => {
    jest.mocked(useIsFetching).mockReset();
  });

  it("stays hidden while there is no in-flight query", () => {
    jest.mocked(useIsFetching).mockReturnValue(0);
    render(<NavigationProgress />);
    advance(500);
    expect(findBar()).toBeNull();
  });

  it("shows the bar once an in-flight query survives the show-delay debounce", () => {
    jest.mocked(useIsFetching).mockReturnValue(1);
    render(<NavigationProgress />);

    // Under the 150ms debounce — a cache-hit fetch shouldn't flicker it in.
    advance(100);
    expect(findBar()).toBeNull();

    advance(100);
    expect(findBar()).toBeTruthy();
  });

  it("does not render for a fetch that resolves inside the debounce window", () => {
    jest.mocked(useIsFetching).mockReturnValue(1);
    const { rerender } = render(<NavigationProgress />);

    advance(50);
    jest.mocked(useIsFetching).mockReturnValue(0);
    rerender(<NavigationProgress />);
    advance(500);

    expect(findBar()).toBeNull();
  });

  it("fades out and hides once the last in-flight query settles", () => {
    jest.mocked(useIsFetching).mockReturnValue(1);
    const { rerender } = render(<NavigationProgress />);
    advance(150);
    expect(findBar()).toBeTruthy();

    jest.mocked(useIsFetching).mockReturnValue(0);
    rerender(<NavigationProgress />);
    advance(1000);

    expect(findBar()).toBeNull();
  });
});
