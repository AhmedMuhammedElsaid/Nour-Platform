import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getPlaylistBySlug } from "@repo/api/services/playlist";

// Opt out of static prerendering. middleware.ts sets a per-request CSP nonce,
// which would mismatch a cached static HTML body; forcing dynamic rendering
// is also what the deploy build (no Atlas connection at build time) requires.
export const dynamic = "force-dynamic";
import { getTracksWithUrls } from "@repo/api/services/track";
import type { Playlist } from "@repo/api/schemas/playlist";
import type { PlayableTrack } from "@repo/api/services/track";
import { TrackListPlayer } from "@/features/playlists/components/track-list-player";
import type {
  SerializedPlaylist,
  SerializedPlayableTrack,
} from "@/features/playlists/types";

// ---------------------------------------------------------------------------
// Serialization helpers
// ---------------------------------------------------------------------------

function serializePlaylist(p: Playlist): SerializedPlaylist {
  return {
    ...p,
    createdAt:
      typeof p.createdAt === "string" ? p.createdAt : p.createdAt.toISOString(),
    updatedAt:
      typeof p.updatedAt === "string" ? p.updatedAt : p.updatedAt.toISOString(),
  };
}

function serializePlayableTrack(t: PlayableTrack): SerializedPlayableTrack {
  return {
    ...t,
    createdAt:
      typeof t.createdAt === "string" ? t.createdAt : t.createdAt.toISOString(),
    updatedAt:
      typeof t.updatedAt === "string" ? t.updatedAt : t.updatedAt.toISOString(),
  };
}

// ---------------------------------------------------------------------------
// generateMetadata
// ---------------------------------------------------------------------------

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const playlist = await getPlaylistBySlug(slug);

  if (!playlist || playlist.status !== "published") {
    return { title: "Not Found — Nour" };
  }

  return {
    title: `${playlist.title} — Nour`,
    description: playlist.description ?? "Listen on Nour Islamic Audio",
  };
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function PlaylistDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const playlist = await getPlaylistBySlug(slug);

  if (!playlist || playlist.status !== "published") {
    notFound();
  }

  const tracks = await getTracksWithUrls(playlist.id);

  const serializedPlaylist = serializePlaylist(playlist);
  const serializedTracks = tracks.map(serializePlayableTrack);

  const publishedDate = new Date(
    serializedPlaylist.createdAt,
  ).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const trackCount = serializedTracks.length;

  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      <header>
        <h1 className="font-display text-4xl tracking-tight">
          {serializedPlaylist.title}
        </h1>
        {serializedPlaylist.description != null && (
          <p className="mt-2 text-text-2">{serializedPlaylist.description}</p>
        )}
        <p className="mt-1 text-sm text-text-2">
          {trackCount} {trackCount === 1 ? "track" : "tracks"} &middot;{" "}
          {publishedDate}
        </p>
      </header>

      <section aria-labelledby="tracks-heading">
        <h2 id="tracks-heading" className="text-lg font-semibold mt-10 mb-4">
          Tracks
        </h2>
        <TrackListPlayer tracks={serializedTracks} />
      </section>
    </div>
  );
}
