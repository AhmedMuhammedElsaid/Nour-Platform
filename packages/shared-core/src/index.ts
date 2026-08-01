// `@repo/shared-core` — pure, framework-agnostic contract shared by `apps/web`
// (server) and `apps/mobile` (Metro/RN). Forbidden imports: mongoose, next/*,
// react, any DOM API. Allowed: zod, adhan, and the pure @repo/config leaves
// (embed-hosts, radio-hosts) — never @repo/config/env.
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
export * from "./schemas/radio";
export * from "./utils/slug";
export * from "./prayer-times/compute";
export * from "./prayer-times/sun-arc";
export * from "./prayer-times/format";
export * from "./qibla/compute";
export * from "./quran/audio-url";
export * from "./quran/reciter-avatar";
export * from "./developer";
