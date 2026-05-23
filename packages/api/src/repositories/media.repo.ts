import type mongoose from "mongoose";

import { getDb } from "../db/client";
import { MediaModel, type MediaDoc } from "../db/models/media.model";
import type { MediaCreateInput, MediaUpdateInput } from "../schemas/media";

/*
 * Lean repository for the `media` collection. All methods return plain
 * JS objects (`.lean()`) — never Mongoose Documents. Services own the
 * `_id → id` DTO mapping and lifecycle-transition validation.
 */

export type MediaLean = MediaDoc & { _id: mongoose.Types.ObjectId };

export async function findMediaById(id: string): Promise<MediaLean | null> {
  await getDb();
  return MediaModel.findById(id).lean<MediaLean>();
}

export async function createMedia(data: MediaCreateInput): Promise<MediaLean> {
  await getDb();
  const doc = await MediaModel.create(data);
  // Fetch lean immediately after create — Document must not escape (CLAUDE.md §4.2).
  const lean = await MediaModel.findById(doc._id).lean<MediaLean>();
  return lean!;
}

export async function updateMediaById(
  id: string,
  update: MediaUpdateInput,
): Promise<MediaLean | null> {
  await getDb();
  return MediaModel.findByIdAndUpdate(id, { $set: update }, { new: true }).lean<MediaLean>();
}
