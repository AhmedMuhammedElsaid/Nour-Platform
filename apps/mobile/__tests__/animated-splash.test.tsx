import { render } from "@testing-library/react-native";

import { AnimatedSplash } from "@/components/animated-splash";

jest.useFakeTimers();

describe("AnimatedSplash", () => {
  it("renders the brand mark and wordmark", () => {
    const { getByLabelText, getByText } = render(
      <AnimatedSplash onFinish={jest.fn()} />,
    );
    expect(getByLabelText("Nour")).toBeTruthy();
    expect(getByText("Nour Platform")).toBeTruthy();
  });

  it("calls onFinish exactly once when the sequence completes", () => {
    const onFinish = jest.fn();
    render(<AnimatedSplash onFinish={onFinish} />);

    // Resolve the isReduceMotionEnabled() promise, then run out all timers.
    jest.runOnlyPendingTimers();
    jest.advanceTimersByTime(3000);

    expect(onFinish).toHaveBeenCalledTimes(1);
  });

  it("does not call onFinish before the sequence finishes", () => {
    const onFinish = jest.fn();
    render(<AnimatedSplash onFinish={onFinish} />);

    jest.advanceTimersByTime(200);

    expect(onFinish).not.toHaveBeenCalled();
  });
});
