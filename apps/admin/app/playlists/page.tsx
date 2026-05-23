import Link from 'next/link'

import { requireSession } from '@repo/api/auth'
import { getAllPlaylists } from '@repo/api/services/playlist'

import type { SerializedPlaylist } from '../../features/playlists/components/playlists-table'
import { PlaylistsTable } from '../../features/playlists/components/playlists-table'

export default async function PlaylistsPage() {
  const session = await requireSession(['admin'])
  const playlists = await getAllPlaylists(session)

  // Date objects cannot cross the RSC→client boundary; serialize to ISO strings.
  const rows: SerializedPlaylist[] = playlists.map((p) => ({
    ...p,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  }))

  return (
    <main className="container mx-auto px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Playlists</h1>
        <Link
          href="/playlists/new"
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          New playlist
        </Link>
      </div>
      <PlaylistsTable playlists={rows} />
    </main>
  )
}
