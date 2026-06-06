import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PlaylistEmbed } from "./playlist-embed";

const SOURCE_URL = "https://soundcloud.com/amgad_samir_abu_mohannad/tracks";
const EMBED_SRC = "https://w.soundcloud.com/player/?url=https%3A%2F%2Fapi.soundcloud.com%2Fusers%2F108832165";

describe("PlaylistEmbed", () => {
  it("renders an iframe with the resolved src and playlist title", () => {
    render(
      <PlaylistEmbed
        embed={{ src: EMBED_SRC, height: 450 }}
        sourceUrl={SOURCE_URL}
        playlistTitle="Test Playlist"
      />,
    );
    const iframe = screen.getByTitle("Test Playlist");
    expect(iframe).toBeInTheDocument();
    expect(iframe).toHaveAttribute("src", EMBED_SRC);
    expect(iframe).toHaveAttribute("height", "450");
  });

  it("renders at the provider-specified height (720 for direct-iframe)", () => {
    const directUrl = "https://www.amgadsamir.com/series/x";
    render(
      <PlaylistEmbed
        embed={{ src: directUrl, height: 720 }}
        sourceUrl={directUrl}
        playlistTitle="Lecture"
      />,
    );
    expect(screen.getByTitle("Lecture")).toHaveAttribute("height", "720");
  });

  it("shows the 'Open on source site' attribution link", () => {
    render(
      <PlaylistEmbed
        embed={{ src: EMBED_SRC, height: 450 }}
        sourceUrl={SOURCE_URL}
        playlistTitle="Test"
      />,
    );
    const links = screen.getAllByRole("link", { name: /open on source site/i });
    expect(links.length).toBeGreaterThanOrEqual(1);
    expect(links[0]).toHaveAttribute("href", SOURCE_URL);
    expect(links[0]).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("falls back to a plain link when embed is null (resolution failed)", () => {
    render(
      <PlaylistEmbed embed={null} sourceUrl={SOURCE_URL} playlistTitle="Test" />,
    );
    expect(screen.queryByTitle("Test")).not.toBeInTheDocument();
    const link = screen.getByRole("link", { name: /open on source site/i });
    expect(link).toHaveAttribute("href", SOURCE_URL);
  });
});
