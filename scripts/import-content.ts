#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { z } from "zod";

import { getDb, disconnectDb } from "@repo/api/db/client";
import { playlistCreateInputSchema } from "@repo/api/schemas/playlist";
import { trackCreateInputSchema } from "@repo/api/schemas/track";
import {
  createPlaylist,
  findAllPlaylists,
} from "@repo/api/repositories/playlist";
import {
  createTrack,
  findTracksByPlaylist,
} from "@repo/api/repositories/track";
import { findBySlug as findCategoryBySlug } from "@repo/api/repositories/category";
import { slugify } from "@repo/api/utils/slug";

/*
 * Operator import path that replaces direct Atlas inserts. Everything passes
 * the same Zod schemas the admin forms use, titles are slugified with the
 * canonical slugify (no more space-slugs), and category slugs resolve to _ids.
 * Imported playlists land as DRAFTS — publish from the admin after review.
 *
 * Usage:
 *   pnpm import:content ./import.json --dry-run   # validate + report only
 *   pnpm import:content ./import.json --apply     # write to Atlas
 */
const localeContent = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
});
const importTrack = z.object({
  ar: localeContent,
  en: localeContent,
  mediaId: z.string().min(1),
});
const importPlaylist = z.object({
  ar: localeContent,
  en: localeContent,
  scholarImage: z.string().optional(),
  categorySlugs: z.array(z.string()).default([]),
  tracks: z.array(importTrack).default([]),
});
const importFile = z.object({ playlists: z.array(importPlaylist).min(1) });

async function main(): Promise<void> {
  const { values, positionals } = parseArgs({
    options: {
      "dry-run": { type: "boolean", default: false },
      apply: { type: "boolean", default: false },
    },
    allowPositionals: true,
    strict: true,
  });
  const file = positionals[0];
  if (!file) {
    throw new Error("usage: pnpm import:content <file.json> [--dry-run|--apply]");
  }
  if (values.apply === values["dry-run"]) {
    throw new Error("pass exactly one of --dry-run or --apply");
  }
  const apply = values.apply === true;

  const data = importFile.parse(JSON.parse(readFileSync(file, "utf8")));
  await getDb();
  try {
    const existingPlaylists = await findAllPlaylists();
    let nextPlaylistOrder = existingPlaylists.length;

    for (const item of data.playlists) {
      // Resolve category slugs (Arabic slugs allowed) → _ids; fail loudly on a miss.
      const categoryIds: string[] = [];
      for (const slug of item.categorySlugs) {
        const cat =
          (await findCategoryBySlug("ar", slug)) ?? (await findCategoryBySlug("en", slug));
        if (!cat) {
          throw new Error(`category slug not found: "${slug}"`);
        }
        categoryIds.push(cat._id.toString());
      }

      const playlistInput = playlistCreateInputSchema.parse({
        ar: { title: item.ar.title, description: item.ar.description },
        en: { title: item.en.title, description: item.en.description },
        scholarImage: item.scholarImage,
        categoryIds,
        status: "draft",
      });

      const arSlug = slugify(playlistInput.ar.slug ?? playlistInput.ar.title);
      const enSlug = slugify(playlistInput.en.slug ?? playlistInput.en.title);

      console.log(
        `[playlist] "${playlistInput.en.title}" -> ar:/${arSlug} en:/${enSlug} ` +
          `(${item.tracks.length} track(s), categories: ${item.categorySlugs.join(", ") || "none"})`,
      );

      if (!apply) continue;

      const playlist = await createPlaylist({
        ...playlistInput,
        ar: { ...playlistInput.ar, slug: arSlug },
        en: { ...playlistInput.en, slug: enSlug },
        order: nextPlaylistOrder++,
      });
      const playlistId = playlist._id.toString();

      const existingTracks = await findTracksByPlaylist(playlistId);
      let nextTrackOrder = existingTracks.length;

      for (const track of item.tracks) {
        const trackInput = trackCreateInputSchema.parse({
          ar: { title: track.ar.title, description: track.ar.description },
          en: { title: track.en.title, description: track.en.description },
          mediaId: track.mediaId,
          playlistId,
        });
        const trackArSlug = slugify(trackInput.ar.slug ?? trackInput.ar.title);
        const trackEnSlug = slugify(trackInput.en.slug ?? trackInput.en.title);

        await createTrack({
          ...trackInput,
          ar: { ...trackInput.ar, slug: trackArSlug },
          en: { ...trackInput.en, slug: trackEnSlug },
          order: nextTrackOrder++,
        });
        console.log(`  [track] "${trackInput.en.title}" -> ar:/${trackArSlug} en:/${trackEnSlug}`);
      }
    }

    console.log(apply ? "Import applied." : "Dry run complete — no changes written.");
  } finally {
    await disconnectDb();
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exitCode = 1;
});
