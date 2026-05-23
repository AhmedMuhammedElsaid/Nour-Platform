import Link from "next/link";
import { notFound } from "next/navigation";

import { requireSession } from "@repo/api/auth";
import { getPlaylistById } from "@repo/api/services/playlist";
import { getTracksByPlaylist } from "@repo/api/services/track";

import { PlaylistForm } from "../../../../features/playlists/components/playlist-form";
import {
  TrackList,
  type SerializedTrack,
} from "../../../../features/playlists/components/track-list";
import { TrackUploader } from "../../../../features/playlists/components/track-uploader";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EditPlaylistPage({ params }: Props) {
  const { id } = await params;
  const session = await requireSession(["admin"]);
  const [playlist, tracks] = await Promise.all([
    getPlaylistById(id, session),
    getTracksByPlaylist(id),
  ]);

  if (!playlist) notFound();

  const serializedTracks: SerializedTrack[] = tracks.map((t) => ({
    id: t.id,
    title: t.title,
    order: t.order,
    ...(t.durationSecs != null ? { durationSecs: t.durationSecs } : {}),
  }));

  return (
    <main className="container mx-auto px-4 py-8">
      <div className="mb-6 flex items-center gap-4">
        <Link
          href="/playlists"
          className="text-sm text-muted-foreground hover:underline"
        >
          ← Playlists
        </Link>
        <h1 className="text-2xl font-semibold">Edit playlist</h1>
      </div>
      <PlaylistForm
        mode="edit"
        playlistId={playlist.id}
        defaultValues={{
          title: playlist.title,
          description: playlist.description,
          status: playlist.status,
        }}
      />

      <hr className="my-8 border-border" />

      <section>
        <h2 className="mb-4 text-lg font-semibold">Tracks</h2>
        <TrackList
          playlistId={playlist.id}
          initialTracks={serializedTracks}
        />
        <div className="mt-6">
          <TrackUploader playlistId={playlist.id} />
        </div>
      </section>
    </main>
  );
}
