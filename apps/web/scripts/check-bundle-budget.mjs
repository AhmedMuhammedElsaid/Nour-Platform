#!/usr/bin/env node
// Phase 4 guardrail (plans/please-review-the-web-async-moore.md §4.1).
//
// Turbopack in Next 16 does not print the classic "First Load JS" route
// table, so there is no built-in number to diff against. The method here —
// established during Phase 2.2 of the same plan — sums the client JS chunks
// Next actually wires up for the home route, read straight from the
// server-side React Server Components manifest it writes at build time:
//
//   .next/server/app/[locale]/page_client-reference-manifest.js
//
// That file assigns `globalThis.__RSC_MANIFEST["/[locale]/page"] = {...}`.
// Its `entryJSFiles["[project]/apps/web/app/[locale]/page"]` array is the
// exact ordered list of chunk files Next attaches to the home route's
// initial HTML — i.e. what a fresh visitor's browser must download before
// the page can hydrate. This is a build-artifact measurement (bytes on
// disk), not a network-transfer measurement (gzip/brotli over the wire) —
// the two are not comparable, and this script commits to the build-artifact
// method throughout.
//
// Run after `next build` (package.json chains it onto `build`), so
// `pnpm turbo run build` fails the moment a change regresses the budget —
// no separate CI job, no extra network round trip, nothing that can flake
// independently of the build itself.

import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const webRoot = join(__dirname, "..");

// Baseline measured fresh 2026-08-02 via this exact method: 381,443 bytes.
//
// Headroom is deliberately small. The home route is `ƒ` (dynamic), so DB
// content never reaches these build artifacts, and repeated clean builds
// produce byte-identical output — the measurement is far more stable than a
// generous budget assumes. An earlier 412,000 was measured to be theatre:
// un-deferring ALL FOUR next/dynamic islands (i.e. reverting the whole
// deferral pass) landed at 404,217 and still passed.
//
// 390,000 is ~2.2% over baseline, so it catches any regression above ~8.5 KB —
// a new always-on dependency, or a dropped code-split of any consequential
// island. It will NOT catch sub-8 KB drift; catching a ~1 KB island would mean
// near-zero headroom and routine false failures on dependency bumps, which is
// the fastest way to get a gate deleted. Re-measure and move this number
// deliberately, never to make a red build go green.
const BUDGET_BYTES = 390_000;

const MANIFEST_PATH = join(
  webRoot,
  ".next/server/app/[locale]/page_client-reference-manifest.js",
);
const MANIFEST_KEY = "[project]/apps/web/app/[locale]/page";
const MANIFEST_GLOBAL_KEY = "/[locale]/page";

// A measured regression is a real failure and blocks the build — that is the
// whole point of the budget.
function fail(message) {
  console.error(`✗ bundle budget: ${message}`);
  process.exit(1);
}

// Being UNABLE to measure is a different thing, and must not block a deploy.
// This runs inside `next build`, so it also runs on Vercel: if a Next upgrade
// renames the manifest or changes its shape, a hard failure here would break
// every production deploy for a reason that has nothing to do with bundle
// size. Warn loudly instead, and let CI keep going. Set
// BUNDLE_BUDGET_STRICT=1 to make these fatal too (useful when deliberately
// verifying the check itself still works after a Next bump).
function cannotMeasure(message) {
  if (process.env.BUNDLE_BUDGET_STRICT === "1") fail(message);
  console.warn(
    `⚠ bundle budget: ${message}\n  Skipping the check rather than failing the build. ` +
      `Re-point the script at Next's current manifest, then re-run with BUNDLE_BUDGET_STRICT=1 to confirm it works.`,
  );
  process.exit(0);
}

if (!existsSync(MANIFEST_PATH)) {
  cannotMeasure(
    `manifest not found at ${MANIFEST_PATH} — run \`next build\` first (this check runs as part of the \`build\` script).`,
  );
}

let source;
try {
  source = readFileSync(MANIFEST_PATH, "utf8");
} catch (err) {
  cannotMeasure(`could not read the manifest: ${err.message}`);
}
const marker = `__RSC_MANIFEST["${MANIFEST_GLOBAL_KEY}"] =`;
const markerIndex = source.indexOf(marker);
if (markerIndex === -1) {
  cannotMeasure(`could not find "${marker}" in the manifest — Next's manifest format may have changed.`);
}

const jsonStart = source.indexOf("{", markerIndex);
const jsonEnd = source.lastIndexOf("}") + 1;
let manifest;
try {
  manifest = JSON.parse(source.slice(jsonStart, jsonEnd));
} catch (err) {
  cannotMeasure(`failed to parse manifest JSON: ${err.message}`);
}

const entryFiles = manifest.entryJSFiles?.[MANIFEST_KEY];
if (!Array.isArray(entryFiles) || entryFiles.length === 0) {
  cannotMeasure(`entryJSFiles["${MANIFEST_KEY}"] missing or empty — Next's manifest shape may have changed.`);
}

let totalBytes = 0;
const missing = [];
for (const file of new Set(entryFiles)) {
  const chunkPath = join(webRoot, ".next", file);
  if (!existsSync(chunkPath)) {
    missing.push(file);
    continue;
  }
  totalBytes += statSync(chunkPath).size;
}

if (missing.length > 0) {
  cannotMeasure(`chunk file(s) referenced by the manifest are missing on disk: ${missing.join(", ")}`);
}

const pct = ((totalBytes / BUDGET_BYTES) * 100).toFixed(1);

if (totalBytes > BUDGET_BYTES) {
  fail(
    `home route client JS is ${totalBytes.toLocaleString()} bytes (${pct}% of the ${BUDGET_BYTES.toLocaleString()}-byte budget) — regression. ` +
      `Check for a newly-static import that should be \`next/dynamic\`'d, a dependency added to the always-on bundle, or a widened re-export.`,
  );
}

// eslint-disable-next-line no-console -- CLI status output, not app code.
console.log(
  `✓ bundle budget: home route client JS is ${totalBytes.toLocaleString()} bytes (${pct}% of the ${BUDGET_BYTES.toLocaleString()}-byte budget).`,
);
