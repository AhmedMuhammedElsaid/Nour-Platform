import { redirect } from 'next/navigation'

// The playlists list now lives at the dashboard root ("/"). Keep this route as
// a redirect so existing links and bookmarks to /playlists still work.
export default function PlaylistsIndexPage() {
  redirect('/')
}
