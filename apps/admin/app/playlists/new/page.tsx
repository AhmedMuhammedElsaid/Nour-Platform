import Link from "next/link";

import { PlaylistForm } from "../../../features/playlists/components/playlist-form";

export default function NewPlaylistPage() {
  return (
    <main className="container mx-auto px-4 py-8">
      <div className="mb-6 flex items-center gap-4">
        <Link
          href="/playlists"
          className="text-sm text-muted-foreground hover:underline"
        >
          ← Playlists
        </Link>
        <h1 className="text-2xl font-semibold">New playlist</h1>
      </div>
      <PlaylistForm mode="create" />
    </main>
  );
}
