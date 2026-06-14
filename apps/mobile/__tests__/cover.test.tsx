import { render, screen } from "@testing-library/react-native";
import { Image } from "react-native";

import { Cover } from "@/features/playlists/components/cover";

describe("Cover", () => {
  it("renders the scholar image when imageUrl is set, resolved to an absolute URL", () => {
    render(<Cover id="abc123" imageUrl="/muhmd-bakr.png" />);
    const image = screen.UNSAFE_getByType(Image);
    expect(image.props.source.uri).toBe("http://localhost:3000/muhmd-bakr.png");
  });

  it("passes through an already-absolute imageUrl unchanged", () => {
    render(<Cover id="abc123" imageUrl="https://cdn.example.com/scholar.jpg" />);
    const image = screen.UNSAFE_getByType(Image);
    expect(image.props.source.uri).toBe("https://cdn.example.com/scholar.jpg");
  });

  it("falls back to the emoji/gradient cover when no imageUrl is set", () => {
    render(<Cover id="abc123" />);
    expect(screen.UNSAFE_queryAllByType(Image)).toHaveLength(0);
    // getCoverEmoji is deterministic for this id.
    expect(screen.toJSON()).toBeTruthy();
  });
});
