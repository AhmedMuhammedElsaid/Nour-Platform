import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SoundCloudEmbed } from "./soundcloud-embed";

const SC_URL = "https://soundcloud.com/user/sets/lectures";

describe("SoundCloudEmbed", () => {
  it("renders an iframe targeting w.soundcloud.com regardless of the stored URL", () => {
    render(<SoundCloudEmbed soundcloudUrl={SC_URL} playlistTitle="Test Playlist" />);
    const iframe = screen.getByTitle("Test Playlist");
    expect(iframe).toBeInTheDocument();
    const src = iframe.getAttribute("src") ?? "";
    expect(src.startsWith("https://w.soundcloud.com/player/")).toBe(true);
  });

  it("includes the encoded soundcloudUrl as the url query param", () => {
    render(<SoundCloudEmbed soundcloudUrl={SC_URL} playlistTitle="Test" />);
    const src = screen.getByTitle("Test").getAttribute("src") ?? "";
    expect(src).toContain(encodeURIComponent(SC_URL));
  });

  it("includes the gold primary colour token", () => {
    render(<SoundCloudEmbed soundcloudUrl={SC_URL} playlistTitle="Test" />);
    const src = screen.getByTitle("Test").getAttribute("src") ?? "";
    // colour is passed as %23C8A050 inside the url param
    expect(src).toContain("C8A050");
  });

  it("attribution link points at the original soundcloudUrl", () => {
    render(<SoundCloudEmbed soundcloudUrl={SC_URL} playlistTitle="Test" />);
    const link = screen.getByRole("link", { name: /soundcloud/i });
    expect(link).toHaveAttribute("href", SC_URL);
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });
});
