import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Locale-aware Link → plain anchor for assertions.
vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

// Translations echo the key so assertions target stable text regardless of namespace.
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

const usePlayerMock = vi.fn();
vi.mock("@repo/ui/blocks/player-context", () => ({
  usePlayer: () => usePlayerMock(),
}));

import { RadioPreviewShelf } from "./radio-preview-shelf";
import type { StationView } from "../types";

function station(slug: string, name: string): StationView {
  return {
    id: slug,
    slug,
    name,
    country: "EG",
    streamUrl: `https://stream.test/${slug}`,
    isFeatured: false,
  };
}

const sixStations: StationView[] = [
  station("s1", "Station One"),
  station("s2", "Station Two"),
  station("s3", "Station Three"),
  station("s4", "Station Four"),
  station("s5", "Station Five"),
  station("s6", "Station Six"),
];

describe("RadioPreviewShelf", () => {
  beforeEach(() => {
    window.localStorage.clear();
    usePlayerMock.mockReturnValue({
      loadQueue: vi.fn(),
      currentTrack: null,
      isPlaying: false,
      toggle: vi.fn(),
    });
  });

  it("renders nothing when there are no stations", () => {
    const { container } = render(<RadioPreviewShelf stations={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows only the first 4 stations and an Explore link to /radio", () => {
    render(<RadioPreviewShelf stations={sixStations} />);

    expect(screen.getByText("Station One")).toBeInTheDocument();
    expect(screen.getByText("Station Four")).toBeInTheDocument();
    expect(screen.queryByText("Station Five")).not.toBeInTheDocument();
    expect(screen.queryByText("Station Six")).not.toBeInTheDocument();

    const exploreLink = screen.getByRole("link", { name: /radioExplore/ });
    expect(exploreLink).toHaveAttribute("href", "/radio");
  });

  it("tapping a station loads it as a one-item live queue", async () => {
    const loadQueue = vi.fn();
    usePlayerMock.mockReturnValue({
      loadQueue,
      currentTrack: null,
      isPlaying: false,
      toggle: vi.fn(),
    });
    const user = userEvent.setup();

    render(<RadioPreviewShelf stations={sixStations} />);
    const [firstPlayButton] = screen.getAllByRole("button", { name: "play" });
    if (!firstPlayButton) throw new Error("expected a play button");
    await user.click(firstPlayButton);

    expect(loadQueue).toHaveBeenCalledWith(
      [expect.objectContaining({ id: "radio:s1", isLive: true })],
      0,
    );
  });

  it("toggles playback when tapping the already-current, playing station", async () => {
    const toggle = vi.fn();
    usePlayerMock.mockReturnValue({
      loadQueue: vi.fn(),
      currentTrack: { id: "radio:s1" },
      isPlaying: true,
      toggle,
    });
    const user = userEvent.setup();

    render(<RadioPreviewShelf stations={sixStations} />);
    await user.click(screen.getByRole("button", { name: "pause" }));

    expect(toggle).toHaveBeenCalledTimes(1);
  });
});
