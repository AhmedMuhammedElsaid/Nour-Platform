import { fireEvent, render, screen } from "@testing-library/react-native";

import { StationCard } from "@/features/radio/components/station-card";
import type { StationView } from "@/features/radio/types";

const station: StationView = {
  slug: "quran-cairo",
  name: "Holy Quran Radio",
  description: "24/7 live broadcast.",
  city: "Cairo",
  streamUrl: "https://stream.radiojar.com/8s5u5tpdtwzuv",
  isFeatured: true,
};

function renderCard(over?: Partial<Parameters<typeof StationCard>[0]>) {
  const onPlay = jest.fn();
  const onToggleFavorite = jest.fn();
  render(
    <StationCard
      station={station}
      isCurrent={false}
      isPlaying={false}
      isFavorite={false}
      onPlay={onPlay}
      onToggleFavorite={onToggleFavorite}
      {...over}
    />,
  );
  return { onPlay, onToggleFavorite };
}

describe("StationCard", () => {
  it("renders the station name and a LIVE badge", () => {
    renderCard();
    expect(screen.getByText("Holy Quran Radio")).toBeTruthy();
    expect(screen.getByText("LIVE")).toBeTruthy();
  });

  it("calls onPlay with the station when the play button is pressed", () => {
    const { onPlay } = renderCard();
    fireEvent.press(screen.getByLabelText(/^(Play|تشغيل)$/));
    expect(onPlay).toHaveBeenCalledWith(station);
  });

  it("shows a Pause label when this station is the current, playing track", () => {
    renderCard({ isCurrent: true, isPlaying: true });
    expect(screen.getByLabelText(/^(Pause|إيقاف)/)).toBeTruthy();
  });

  it("toggles favorite by slug", () => {
    const { onToggleFavorite } = renderCard({ isFavorite: true });
    fireEvent.press(screen.getByLabelText(/^(Remove from favorites|إزالة)/));
    expect(onToggleFavorite).toHaveBeenCalledWith("quran-cairo");
  });
});
