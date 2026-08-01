import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { CLIENT_MESSAGE_NAMESPACES } from "./client-namespaces";

/*
 * Narrowing the client message catalogue is the one change in this app that
 * can only fail at runtime: next-intl throws on a missing key, and neither
 * typecheck nor the build sees it. This test closes that hole by deriving the
 * truth from the source instead of trusting the constant.
 */

const APP_ROOT = join(__dirname, "..");
const SKIP_DIRS = new Set(["node_modules", ".next", "dist", ".turbo"]);

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(tsx?|jsx?)$/.test(entry) && !/\.test\.[jt]sx?$/.test(entry)) out.push(full);
  }
  return out;
}

/** Namespaces reached from a "use client" module via useTranslations("x"). */
function scanClientNamespaces(): Set<string> {
  const found = new Set<string>();
  for (const file of walk(APP_ROOT)) {
    const src = readFileSync(file, "utf8");
    if (!/^\s*["']use client["']/m.test(src)) continue;
    for (const m of src.matchAll(/useTranslations\(\s*["']([^"']+)["']/g)) {
      const ns = m[1];
      if (ns) found.add(ns.split(".")[0] as string);
    }
  }
  return found;
}

describe("client message namespaces", () => {
  it("covers every namespace a client component reads", () => {
    const used = scanClientNamespaces();
    const declared = new Set<string>(CLIENT_MESSAGE_NAMESPACES);

    // Sanity: if the scan finds nothing the assertion below is vacuous.
    expect(used.size).toBeGreaterThan(5);

    const missing = [...used].filter((ns) => !declared.has(ns)).sort();
    expect(
      missing,
      `client components read namespace(s) not shipped to the browser: ${missing.join(", ")}. ` +
        "next-intl throws on a missing key at runtime — add them to CLIENT_MESSAGE_NAMESPACES.",
    ).toEqual([]);
  });

  it("ships nothing a client component does not read", () => {
    const used = scanClientNamespaces();
    const unused = CLIENT_MESSAGE_NAMESPACES.filter((ns) => !used.has(ns)).sort();

    // Not a correctness failure, but dead weight in every RSC payload — and
    // usually the sign of a component that was deleted or made server-only.
    expect(
      unused,
      `declared but unread namespace(s): ${unused.join(", ")} — drop them or confirm the reader still exists.`,
    ).toEqual([]);
  });

  it("finds no bare useTranslations() in client code, which would need the whole catalogue", () => {
    const offenders: string[] = [];
    for (const file of walk(APP_ROOT)) {
      const src = readFileSync(file, "utf8");
      if (!/^\s*["']use client["']/m.test(src)) continue;
      if (/useTranslations\(\s*\)/.test(src) || /useMessages\(/.test(src)) {
        offenders.push(file.replace(APP_ROOT, ""));
      }
    }
    expect(offenders, `these reach any namespace, defeating the narrowing: ${offenders.join(", ")}`).toEqual([]);
  });
});
