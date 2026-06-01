import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SoundCloudEmbed } from "./soundcloud-embed";

const SC_URL = "https://soundcloud.com/amgad_samir_abu_mohannad/tracks";
const EMBED_SRC =
  "https://w.soundcloud.com/player/?visual=false&url=https%3A%2F%2Fapi.soundcloud.com%2Fusers%2F108832165&color=%23C8A050";

describe("SoundCloudEmbed", () => {
  it("renders the resolved player src in an iframe with the playlist title", () => {
    render(
      <SoundCloudEmbed
        embedSrc={EMBED_SRC}
        soundcloudUrl={SC_URL}
        playlistTitle="Test Playlist"
      />,
    );
    const iframe = screen.getByTitle("Test Playlist");
    expect(iframe).toBeInTheDocument();
    expect(iframe).toHaveAttribute("src", EMBED_SRC);
  });

  it("shows the attribution link pointing at the original SoundCloud URL", () => {
    render(
      <SoundCloudEmbed
        embedSrc={EMBED_SRC}
        soundcloudUrl={SC_URL}
        playlistTitle="Test"
      />,
    );
    const link = screen.getByRole("link", { name: /streaming via soundcloud/i });
    expect(link).toHaveAttribute("href", SC_URL);
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("falls back to a plain link (no iframe) when the src could not be resolved", () => {
    render(
      <SoundCloudEmbed
        embedSrc={null}
        soundcloudUrl={SC_URL}
        playlistTitle="Test"
      />,
    );
    expect(screen.queryByTitle("Test")).not.toBeInTheDocument();
    const link = screen.getByRole("link", { name: /open on soundcloud/i });
    expect(link).toHaveAttribute("href", SC_URL);
  });
});
