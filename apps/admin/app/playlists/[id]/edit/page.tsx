import Link from "next/link";
import { notFound } from "next/navigation";

import { requireSession } from "@repo/api/auth";
import { listCategories } from "@repo/api/services/category";
import { getPlaylistById } from "@repo/api/services/playlist";
import { getTracksWithUrls } from "@repo/api/services/track";

import { PlaylistForm } from "../../../../features/playlists/components/playlist-form";
import { PublishToggle } from "../../../../features/playlists/components/publish-toggle";
import { TrackDurationBackfill } from "../../../../features/playlists/components/track-duration-backfill";
import {
  TrackList,
  type SerializedTrack,
} from "../../../../features/playlists/components/track-list";
import { TrackUploader } from "../../../../features/playlists/components/track-uploader";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EditPlaylistPage({ params }: Props) {
  const { id } = await params;
  const session = await requireSession(["admin"]);
  const playlist = await getPlaylistById(id, session);
  if (!playlist) notFound();

  const [tracks, categories] = await Promise.all([
    getTracksWithUrls(playlist.id),
    listCategories(),
  ]);

  const availableCategories = categories.map((c) => ({
    id: c.id,
    name: c.en.name,
  }));

  const serializedTracks: SerializedTrack[] = tracks.map((t) => ({
    id: t.id,
    title: t.ar.title,
    order: t.order,
    ...(t.durationSecs != null ? { durationSecs: t.durationSecs } : {}),
  }));

  const backfillTracks = tracks.map((t) => ({
    id: t.id,
    srcUrl: t.srcUrl,
    ...(t.durationSecs != null ? { durationSecs: t.durationSecs } : {}),
  }));

  return (
    <main className="container mx-auto px-4 py-8">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/playlists" className="text-sm text-muted-foreground hover:underline">
            ← Playlists
          </Link>
          <h1 className="text-2xl font-semibold">Edit playlist</h1>
        </div>
        <PublishToggle playlistId={playlist.id} initialStatus={playlist.status} />
      </div>
      <PlaylistForm
        mode="edit"
        playlistId={playlist.id}
        availableCategories={availableCategories}
        defaultValues={{
          ar: { title: playlist.ar.title, description: playlist.ar.description ?? "" },
          en: { title: playlist.en.title, description: playlist.en.description ?? "" },
          status: playlist.status,
          categoryIds: playlist.categoryIds ?? [],
        }}
      />

      <hr className="my-8 border-border" />

      <section>
        <h2 className="mb-4 text-lg font-semibold">Tracks</h2>
        <TrackList playlistId={playlist.id} initialTracks={serializedTracks} />
        <TrackDurationBackfill tracks={backfillTracks} />
        <div className="mt-6">
          <TrackUploader playlistId={playlist.id} />
        </div>
      </section>
    </main>
  );
}
