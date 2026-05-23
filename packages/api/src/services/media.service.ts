import { requireSession } from "../auth/require-session";
import { headObject } from "../media/r2-client";
import {
  createMedia as repoCreateMedia,
  findMediaById,
  updateMediaById,
} from "../repositories/media.repo";
import type { MediaCreateInput, MediaMimeType } from "../schemas/media";
import { AppError } from "../errors";

/*
 * Media service. Owns the lifecycle transitions for Media records
 * (pending → confirmed) and delegates R2 metadata reads to the r2-client.
 *
 * Both mutations call requireSession(['admin']) before any I/O — the route
 * handlers in apps/admin enforce the same gate, but services must defend
 * their own boundary per CLAUDE.md §5.
 */

export interface MediaDto {
  id: string;
  key: string;
  bucket: string;
  mimeType: MediaMimeType;
  sizeBytes: number;
  status: "pending" | "confirmed" | "failed";
}

function toDto(doc: {
  _id: { toString(): string };
  key: string;
  bucket: string;
  mimeType: string;
  sizeBytes: number;
  status: string;
}): MediaDto {
  return {
    id: doc._id.toString(),
    key: doc.key,
    bucket: doc.bucket,
    // The Mongoose enum enforces the allowed values at the DB layer; the
    // cast here is an adapter boundary where we narrow the inferred `string`
    // back to the union type. The enum constraint makes this safe.
    mimeType: doc.mimeType as MediaMimeType,
    sizeBytes: doc.sizeBytes,
    status: doc.status as "pending" | "confirmed" | "failed",
  };
}

export async function createMedia(input: {
  key: string;
  bucket: string;
  mimeType: MediaMimeType;
  sizeBytes: number;
  uploadedBy: string;
}): Promise<MediaDto> {
  await requireSession(["admin"]);

  const data: MediaCreateInput = {
    key: input.key,
    bucket: input.bucket,
    mimeType: input.mimeType,
    sizeBytes: input.sizeBytes,
    uploadedBy: input.uploadedBy,
    status: "pending",
  };

  const lean = await repoCreateMedia(data);
  return toDto(lean);
}

export async function confirmMedia(mediaId: string): Promise<MediaDto> {
  await requireSession(["admin"]);

  const existing = await findMediaById(mediaId);
  if (!existing) {
    throw AppError.NotFound("Media");
  }
  if (existing.status !== "pending") {
    throw AppError.Validation(
      [
        {
          code: "custom",
          path: ["mediaId"],
          message: `Media status is '${existing.status}'; only 'pending' records can be confirmed.`,
        },
      ],
      "Media is not in pending state.",
    );
  }

  /*
   * Verify the object actually landed in R2 before flipping status.
   * headObject returns null when the object is absent; any other failure
   * propagates as AppError.Internal from the r2-client.
   */
  const meta = await headObject(existing.key);
  if (!meta) {
    throw AppError.Validation(
      [
        {
          code: "custom",
          path: ["mediaId"],
          message: "Object not found in R2; upload may not have completed.",
        },
      ],
      "Upload not found in storage.",
    );
  }

  const updated = await updateMediaById(mediaId, { status: "confirmed" });
  if (!updated) {
    // Race condition: document disappeared between find and update.
    throw AppError.NotFound("Media");
  }

  return toDto(updated);
}
