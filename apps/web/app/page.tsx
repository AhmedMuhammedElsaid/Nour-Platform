import type { Metadata } from "next";

import { getPublishedPlaylists } from "@repo/api/services/playlist";
import { PlaylistCard } from "@/features/playlists/components/playlist-card";
import type { SerializedPlaylist } from "@/features/playlists/types";
import type { Playlist } from "@repo/api/schemas/playlist";

export const metadata: Metadata = {
  title: "Nour — Islamic Audio",
  description: "Browse playlists",
};

// Converts a Playlist DTO to a JSON-serializable shape. createdAt/updatedAt
// may already be ISO strings when the lean Mongo doc serializes them early;
// we guard with a typeof check so both paths are safe.
function serializePlaylist(p: Playlist): SerializedPlaylist {
  return {
    ...p,
    createdAt:
      typeof p.createdAt === "string"
        ? p.createdAt
        : p.createdAt.toISOString(),
    updatedAt:
      typeof p.updatedAt === "string"
        ? p.updatedAt
        : p.updatedAt.toISOString(),
  };
}

export default async function HomePage() {
  const playlists = await getPublishedPlaylists();
  const serialized = playlists.map(serializePlaylist);

  return (
    <section className="mx-auto max-w-6xl px-6 py-16">
      <h1 className="font-display text-3xl tracking-tight">Playlists</h1>

      {serialized.length === 0 ? (
        <p className="text-text-2 mt-6">No playlists yet.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
          {serialized.map((playlist) => (
            <PlaylistCard key={playlist.id} playlist={playlist} />
          ))}
        </div>
      )}
    </section>
  );
}
