// Services barrel — MVP populates this in Waves 1–2 (auth, playlist, track,
// media). Apps must import services from here, never from db/* or
// repositories/* (CLAUDE.md §5).
export * from "./auth.service";
export * from "./media.service";
export * from "./playlist.service";
export * from "./track.service";
