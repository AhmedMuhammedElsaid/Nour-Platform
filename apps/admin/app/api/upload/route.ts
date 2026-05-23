import { NextResponse } from "next/server";
import { z } from "zod";

import { AppError } from "@repo/api/errors";
import { appErrorStatus } from "@/lib/route-helpers";
import { ALLOWED_AUDIO_MIME_TYPES, createPresignedUpload } from "@repo/api/media/r2-client";
import { requireSession } from "@repo/api/auth";
import { createMedia } from "@repo/api/services/media";

/*
 * POST /api/upload
 * Wave 2.5 — step 1 of the audio-upload handshake.
 *
 * Returns a short-lived presigned PUT URL and creates a `pending` Media
 * record so that the confirm endpoint can find it after the client finishes
 * the direct upload to R2.
 */

const MIME_TO_EXT: Record<string, string> = {
  "audio/mpeg": "mp3",
  "audio/wav": "wav",
  "audio/mp4": "m4a",
  "audio/ogg": "ogg",
};

const uploadBodySchema = z.object({
  filename: z.string().min(1).max(255),
  mimeType: z.enum(ALLOWED_AUDIO_MIME_TYPES),
  sizeBytes: z.number().int().positive(),
});

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const session = await requireSession(["admin"]);

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { code: "VALIDATION", message: "Request body must be valid JSON." },
        { status: 422 },
      );
    }

    const parsed = uploadBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        AppError.Validation(parsed.error.issues).toJSON(),
        { status: 422 },
      );
    }

    const { mimeType, sizeBytes } = parsed.data;
    const ext = MIME_TO_EXT[mimeType] ?? "bin";
    const key = `audio/${crypto.randomUUID()}.${ext}`;

    // createPresignedUpload resolves the bucket from env internally and returns
    // it in the result — we use that value so apps/admin never reads env directly.
    const { url: presignedUrl, bucket } = await createPresignedUpload(key, mimeType, sizeBytes);

    const media = await createMedia({
      key,
      bucket,
      mimeType,
      sizeBytes,
      uploadedBy: session.user.id,
    });

    return NextResponse.json(
      { presignedUrl, key, mediaId: media.id },
      { status: 200 },
    );
  } catch (error) {
    if (AppError.is(error)) {
      return NextResponse.json(error.toJSON(), { status: appErrorStatus(error) });
    }
    throw error;
  }
}
