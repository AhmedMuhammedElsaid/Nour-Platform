/// <reference types="vite/client" />

// Injected at build time by Vite `define` (see vite.config.ts).
declare const __API_BASE_URL__: string;
// "chrome" | "firefox" — controls dead-code-eliminated audio strategy branches.
declare const __BROWSER__: "chrome" | "firefox";
