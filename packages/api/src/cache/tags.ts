export const PLAYLISTS_HOME = "playlists:home";

export function playlistTag(id: string): string {
  return `playlist:${id}`;
}

export const CATEGORIES = "categories";

export const ADHKAR = "adhkar";

export function azkarTag(id: string): string {
  return `azkar:${id}`;
}
