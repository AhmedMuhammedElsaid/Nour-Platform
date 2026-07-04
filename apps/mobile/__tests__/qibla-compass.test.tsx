import { render, screen } from "@testing-library/react-native";

import { QiblaCompass } from "@/features/qibla/components/qibla-compass";

// react-native-webview is mocked (jest.setup) to a host component that surfaces
// its props under testID "qibla-webview".
describe("QiblaCompass (WebView)", () => {
  it("renders the compass WebView with the bearing baked into the HTML", () => {
    render(<QiblaCompass bearing={136} theme="dark" />);
    const wv = screen.getByTestId("qibla-webview");
    expect(wv).toBeTruthy();
    expect(wv.props.source.html).toContain("BEARING=136");
  });

  it("forwards heading/alignment messages to onState", () => {
    const onState = jest.fn();
    render(<QiblaCompass bearing={136} theme="dark" onState={onState} />);
    const wv = screen.getByTestId("qibla-webview");
    wv.props.onMessage({
      nativeEvent: { data: JSON.stringify({ heading: 136, aligned: true, live: true }) },
    });
    expect(onState).toHaveBeenCalledWith({ heading: 136, aligned: true, live: true });
  });

  it("ignores malformed messages", () => {
    const onState = jest.fn();
    render(<QiblaCompass bearing={200} theme="light" onState={onState} />);
    const wv = screen.getByTestId("qibla-webview");
    wv.props.onMessage({ nativeEvent: { data: "not json" } });
    expect(onState).not.toHaveBeenCalled();
  });
});
