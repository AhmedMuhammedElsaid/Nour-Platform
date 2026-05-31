import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("next-intl/server", () => ({
  getTranslations: vi.fn().mockResolvedValue((key: string) => key),
  getLocale: vi.fn().mockResolvedValue("en"),
}));

// Use vi.fn() directly inside the factory so it's accessible after hoisting.
vi.mock("@repo/api/services/media", () => ({
  getMediaUrlById: vi.fn().mockResolvedValue(null),
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

import { getMediaUrlById } from "@repo/api/services/media";
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
    order: 0,
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("PlaylistCard", () => {
  beforeEach(() => {
    vi.mocked(getMediaUrlById).mockResolvedValue(null);
  });

  it("shows gradient fallback when there is no coverMediaId", async () => {
    const el = await PlaylistCard({ playlist: makePlaylist() });
    const { container } = render(el);

    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(container.querySelector("[style*='gradient']")).not.toBeNull();
    expect(vi.mocked(getMediaUrlById)).not.toHaveBeenCalled();
  });

  it("calls getMediaUrlById with the coverMediaId when present", async () => {
    const coverMediaId = "aabbccddeeff001122334401";
    vi.mocked(getMediaUrlById).mockResolvedValueOnce(
      "https://r2.example.com/cover.jpg",
    );

    await PlaylistCard({ playlist: makePlaylist({ coverMediaId }) });

    expect(vi.mocked(getMediaUrlById)).toHaveBeenCalledWith(coverMediaId);
  });

  it("falls back to gradient when coverMediaId is set but URL resolves to null", async () => {
    vi.mocked(getMediaUrlById).mockResolvedValueOnce(null);
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
    // Badge renders the count alongside a localized label ("7 track"),
    // so match the count within the badge text rather than an exact "7".
    expect(screen.getByText(/7\s*track/i)).toBeInTheDocument();
  });

  it("hides track count badge when trackCount is zero", async () => {
    const el = await PlaylistCard({ playlist: makePlaylist({ trackCount: 0 }) });
    render(el);
    expect(screen.queryByText("0")).not.toBeInTheDocument();
  });

  it("renders category chip labels when categories prop is provided", async () => {
    const el = await PlaylistCard({
      playlist: makePlaylist(),
      categories: [
        { slug: "quran", name: "Quran" },
        { slug: "hadith", name: "Hadith" },
      ],
    });
    render(el);

    expect(screen.getByText("Quran")).toBeInTheDocument();
    expect(screen.getByText("Hadith")).toBeInTheDocument();
  });

  it("renders no category chips when categories prop is absent", async () => {
    const el = await PlaylistCard({ playlist: makePlaylist() });
    const { container } = render(el);

    expect(container.querySelector('[data-testid="category-chips"]')).toBeNull();
  });
});
