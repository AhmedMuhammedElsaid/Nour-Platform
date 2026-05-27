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

// Opt out of static prerendering. proxy.ts sets a per-request CSP nonce that
// would mismatch a cached static body, and the deploy build runs without an
// Atlas connection — both reasons require dynamic rendering.
export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EditPlaylistPage({ params }: Props) {
  const { id } = await params;
  const session = await requireSession(["admin"]);
  const playlist = await getPlaylistById(id, session);
  if (!playlist) notFound();

  // Tracks + categories are locale-scoped — resolve them in the playlist's locale.
  const [tracks, categories] = await Promise.all([
    getTracksWithUrls(playlist.locale, playlist.contentId),
    listCategories(playlist.locale),
  ]);

  // categoryIds reference category contentIds, so the multi-select value is the
  // category's contentId (not its per-locale _id).
  const availableCategories = categories.map((c) => ({
    id: c.contentId,
    name: c.name,
  }));

  const serializedTracks: SerializedTrack[] = tracks.map((t) => ({
    id: t.id,
    title: t.title,
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
          <Link
            href="/playlists"
            className="text-sm text-muted-foreground hover:underline"
          >
            ← Playlists
          </Link>
          <h1 className="text-2xl font-semibold">Edit playlist</h1>
        </div>
        <PublishToggle
          playlistId={playlist.id}
          initialStatus={playlist.status}
        />
      </div>
      <PlaylistForm
        mode="edit"
        playlistId={playlist.id}
        availableCategories={availableCategories}
        defaultValues={{
          locale: playlist.locale,
          contentId: playlist.contentId,
          title: playlist.title,
          description: playlist.description ?? "",
          status: playlist.status,
          categoryIds: playlist.categoryIds ?? [],
        }}
      />

      <hr className="my-8 border-border" />

      <section>
        <h2 className="mb-4 text-lg font-semibold">Tracks</h2>
        <TrackList
          playlistContentId={playlist.contentId}
          locale={playlist.locale}
          initialTracks={serializedTracks}
        />
        <TrackDurationBackfill tracks={backfillTracks} />
        <div className="mt-6">
          <TrackUploader
            playlistContentId={playlist.contentId}
            locale={playlist.locale}
          />
        </div>
      </section>
    </main>
  );
}
