import Link from "next/link";
import { notFound } from "next/navigation";

import { requireSession } from "@repo/api/auth";
import { getPlaylistById } from "@repo/api/services/playlist";

import { PlaylistForm } from "../../../../features/playlists/components/playlist-form";
import { TrackUploader } from "../../../../features/playlists/components/track-uploader";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EditPlaylistPage({ params }: Props) {
  const { id } = await params;
  const session = await requireSession(["admin"]);
  const playlist = await getPlaylistById(id, session);

  if (!playlist) notFound();

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
        <TrackUploader playlistId={playlist.id} />
      </section>
    </main>
  );
}
