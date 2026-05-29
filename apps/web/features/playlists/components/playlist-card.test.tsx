import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("next-intl/server", () => ({
  getTranslations: vi.fn().mockResolvedValue((key: string) => key),
  getLocale: vi.fn().mockResolvedValue("en"),
}));

const mockGetMediaUrlById = vi.fn();
vi.mock("@repo/api/services/media", () => ({
  getMediaUrlById: (...args: unknown[]) => mockGetMediaUrlById(...args),
}));

vi.mock("@/i18n/navigation", () => ({
  Link: ({
    href,
    children,
    className,
  }: {
    href: string;
    children: ReactNode;
    className?: string;
  }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: string; alt: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} />
  ),
}));

import { PlaylistCard } from "./playlist-card";
import type { SerializedPlaylist } from "@/features/playlists/types";

function makePlaylist(
  overrides: Partial<SerializedPlaylist> = {},
): SerializedPlaylist {
  return {
    id: "aabbccddeeff001122334455",
    ar: { title: "قائمة", slug: "قائمة" },
    en: { title: "My Playlist", slug: "my-playlist" },
    status: "published",
    categoryIds: [],
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("PlaylistCard", () => {
  beforeEach(() => {
    mockGetMediaUrlById.mockReset();
    mockGetMediaUrlById.mockResolvedValue(null);
  });

  it("shows gradient fallback when there is no coverMediaId", async () => {
    const el = await PlaylistCard({ playlist: makePlaylist() });
    const { container } = render(el);

    // No cover <img> should be rendered
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    // Gradient is applied via inline style on the fallback div
    expect(container.querySelector("[style*='gradient']")).not.toBeNull();
    // getMediaUrlById should not be called when there is no coverMediaId
    expect(mockGetMediaUrlById).not.toHaveBeenCalled();
  });

  it("renders a cover image when a URL is resolved for coverMediaId", async () => {
    mockGetMediaUrlById.mockResolvedValue("https://r2.example.com/cover.jpg");
    const el = await PlaylistCard({
      playlist: makePlaylist({ coverMediaId: "aabbccddeeff001122334401" }),
    });
    render(el);

    const img = screen.getByRole("img");
    expect(img).toHaveAttribute("src", "https://r2.example.com/cover.jpg");
  });

  it("falls back to gradient when coverMediaId is set but URL resolves to null", async () => {
    mockGetMediaUrlById.mockResolvedValue(null);
    const el = await PlaylistCard({
      playlist: makePlaylist({ coverMediaId: "aabbccddeeff001122334401" }),
    });
    const { container } = render(el);

    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(container.querySelector("[style*='gradient']")).not.toBeNull();
  });

  it("shows track count badge when trackCount is greater than zero", async () => {
    const el = await PlaylistCard({ playlist: makePlaylist({ trackCount: 7 }) });
    render(el);
    expect(screen.getByText("7")).toBeInTheDocument();
  });

  it("hides track count badge when trackCount is zero", async () => {
    const el = await PlaylistCard({ playlist: makePlaylist({ trackCount: 0 }) });
    render(el);
    expect(screen.queryByText("0")).not.toBeInTheDocument();
  });
});
