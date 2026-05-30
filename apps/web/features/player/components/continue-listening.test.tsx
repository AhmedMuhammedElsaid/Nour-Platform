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

// Translations echo the key so we can assert against stable text.
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

// next/image → bare img (drop fill/sizes so React doesn't warn).
vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: string; alt: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} />
  ),
}));

import { ContinueListening } from "./continue-listening";
import { recordRecentlyPlayed } from "@/features/player/lib/recently-played";

const POSITIONS_KEY = "nour.player.positions";

describe("ContinueListening", () => {
  beforeEach(() => window.localStorage.clear());

  it("renders nothing when there is no history", () => {
    const { container } = render(<ContinueListening />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing when entries lack a playlist slug", async () => {
    recordRecentlyPlayed({ trackId: "t1", title: "Orphan" });
    const { container } = render(<ContinueListening />);
    // Effect populates after mount; give React a tick then assert empty.
    await Promise.resolve();
    expect(container).toBeEmptyDOMElement();
  });

  it("shows recent linkable tracks and clears them", async () => {
    recordRecentlyPlayed({
      trackId: "t1",
      title: "Surah Al-Fatiha",
      playlistTitle: "Juz Amma",
      playlistSlug: "juz-amma",
      locale: "en",
    });

    render(<ContinueListening />);

    const link = await screen.findByRole("link", {
      name: /surah al-fatiha/i,
    });
    expect(link).toHaveAttribute("href", "/playlists/juz-amma#t1");
    expect(screen.getByText("continueListening")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "clearHistory" }));
    expect(
      screen.queryByRole("link", { name: /surah al-fatiha/i }),
    ).not.toBeInTheDocument();
  });

  it("renders resume progress bar at the correct width", async () => {
    const trackId = "track-with-progress";
    // 60 seconds played out of 120 → 50%
    window.localStorage.setItem(
      POSITIONS_KEY,
      JSON.stringify({ [trackId]: { t: 60, at: Date.now() } }),
    );
    recordRecentlyPlayed({
      trackId,
      title: "Track With Progress",
      playlistSlug: "test-playlist",
      duration: 120,
    });

    const { container } = render(<ContinueListening />);
    await screen.findByRole("link", { name: /track with progress/i });

    const bar = container.querySelector('[style*="width: 50%"]');
    expect(bar).not.toBeNull();
  });

  it("shows the percent-complete label when progress is known", async () => {
    const trackId = "track-pct-label";
    window.localStorage.setItem(
      POSITIONS_KEY,
      JSON.stringify({ [trackId]: { t: 30, at: Date.now() } }),
    );
    recordRecentlyPlayed({
      trackId,
      title: "Track With Label",
      playlistSlug: "test-playlist",
      duration: 100,
    });

    render(<ContinueListening />);
    await screen.findByRole("link", { name: /track with label/i });

    // The translation mock returns the key "percentComplete" verbatim.
    expect(screen.getByText("percentComplete")).toBeInTheDocument();
  });

  it("hides the progress bar when duration is not stored", async () => {
    const trackId = "track-no-duration";
    window.localStorage.setItem(
      POSITIONS_KEY,
      JSON.stringify({ [trackId]: { t: 30, at: Date.now() } }),
    );
    // No duration in the recently-played entry
    recordRecentlyPlayed({
      trackId,
      title: "Track No Duration",
      playlistSlug: "test-playlist",
    });

    const { container } = render(<ContinueListening />);
    await screen.findByRole("link", { name: /track no duration/i });

    // No progress bar div rendered
    expect(container.querySelector('[style*="width:"]')).toBeNull();
    expect(container.querySelector('[style*="width: "]')).toBeNull();
  });
});
