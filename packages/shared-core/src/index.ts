// `@repo/shared-core` — pure, framework-agnostic contract shared by `apps/web`
// (server) and `apps/mobile` (Metro/RN). Forbidden imports: mongoose, next/*,
// react, any DOM API. Allowed: zod, adhan, the pure @repo/config/embed-hosts.
//
// Apps should prefer the scoped subpath exports (see package.json `exports`)
// to keep bundles lean; this barrel exists for convenience in shared tooling.

export * from "./schemas/locale";
export * from "./schemas/playlist";
export * from "./schemas/track";
export * from "./schemas/media";
export * from "./schemas/category";
export * from "./schemas/azkar";
export * from "./schemas/prayer-times";
export * from "./schemas/quran";
export * from "./utils/slug";
export * from "./prayer-times/compute";
export * from "./prayer-times/sun-arc";
export * from "./prayer-times/format";
export * from "./qibla/compute";
export * from "./quran/audio-url";
export * from "./quran/reciter-avatar";
export * from "./developer";
