import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

// next-intl: return English labels for the radio namespace keys the card uses.
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) =>
    ({
      live: "LIVE",
      play: "Play",
      pause: "Pause",
      favorite: "Add to favorites",
      unfavorite: "Remove from favorites",
    })[key] ?? key,
}));

import { StationCard } from "./station-card";
import type { StationView } from "../types";

const station: StationView = {
  id: "1",
  slug: "quran-cairo",
  name: "Holy Quran Radio",
  description: "24/7 live broadcast.",
  country: "EG",
  city: "Cairo",
  streamUrl: "https://stream.radiojar.com/8s5u5tpdtwzuv",
  isFeatured: true,
};

function renderCard(overrides?: Partial<Parameters<typeof StationCard>[0]>) {
  const onPlay = vi.fn();
  const onToggleFavorite = vi.fn();
  render(
    <StationCard
      station={station}
      isCurrent={false}
      isPlaying={false}
      isFavorite={false}
      onPlay={onPlay}
      onToggleFavorite={onToggleFavorite}
      {...overrides}
    />,
  );
  return { onPlay, onToggleFavorite };
}

describe("StationCard", () => {
  it("renders the station name, description and a LIVE badge", () => {
    renderCard();
    expect(screen.getByText("Holy Quran Radio")).toBeInTheDocument();
    expect(screen.getByText("24/7 live broadcast.")).toBeInTheDocument();
    expect(screen.getByText("LIVE")).toBeInTheDocument();
  });

  it("clicking play calls onPlay with the station", async () => {
    const user = userEvent.setup();
    const { onPlay } = renderCard();
    await user.click(screen.getByRole("button", { name: "Play" }));
    expect(onPlay).toHaveBeenCalledWith(station);
  });

  it("shows a Pause label when this station is the current, playing track", () => {
    renderCard({ isCurrent: true, isPlaying: true });
    expect(screen.getByRole("button", { name: "Pause" })).toBeInTheDocument();
  });

  it("toggles favorite by slug and reflects the pressed state", async () => {
    const user = userEvent.setup();
    const { onToggleFavorite } = renderCard({ isFavorite: true });
    const favBtn = screen.getByRole("button", { name: "Remove from favorites" });
    expect(favBtn).toHaveAttribute("aria-pressed", "true");
    await user.click(favBtn);
    expect(onToggleFavorite).toHaveBeenCalledWith("quran-cairo");
  });
});
