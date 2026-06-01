import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next-intl/server", () => ({
  getTranslations: vi.fn().mockResolvedValue((key: string) => key),
  getLocale: vi.fn().mockResolvedValue("en"),
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
    order: 0,
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("PlaylistCard", () => {
  it("shows gradient fallback when there is no scholarImage", async () => {
    const el = await PlaylistCard({ playlist: makePlaylist() });
    const { container } = render(el);

    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(container.querySelector("[style*='gradient']")).not.toBeNull();
  });

  it("renders the scholar image directly from its /public path", async () => {
    const el = await PlaylistCard({
      playlist: makePlaylist({ scholarImage: "/muhmd-bakr.png" }),
    });
    const { container } = render(el);

    // alt="" makes the image presentational (no "img" role), so query the node.
    expect(container.querySelector("img")).toHaveAttribute(
      "src",
      "/muhmd-bakr.png",
    );
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
