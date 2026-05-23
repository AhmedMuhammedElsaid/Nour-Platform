import { NextResponse } from "next/server";
import { z } from "zod";

import { AppError } from "@repo/api/errors";
import { appErrorStatus } from "@/lib/route-helpers";
import { requireSession } from "@repo/api/auth";
import { confirmMedia } from "@repo/api/services/media";

/*
 * POST /api/media/confirm
 * Wave 2.5 — step 3 of the audio-upload handshake.
 *
 * After the browser has PUT the file directly to R2 via the presigned URL,
 * the admin client posts the mediaId here. This endpoint calls headObject
 * to verify the object landed and flips the Media record status to
 * `confirmed`.
 */

const confirmBodySchema = z.object({
  mediaId: z.string().regex(/^[0-9a-f]{24}$/, "mediaId must be a 24-char hex ObjectId"),
});

export async function POST(request: Request): Promise<NextResponse> {
  try {
    await requireSession(["admin"]);

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { code: "VALIDATION", message: "Request body must be valid JSON." },
        { status: 422 },
      );
    }

    const parsed = confirmBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        AppError.Validation(parsed.error.issues).toJSON(),
        { status: 422 },
      );
    }

    const { mediaId } = parsed.data;
    await confirmMedia(mediaId);

    return NextResponse.json(
      { mediaId, status: "confirmed" },
      { status: 200 },
    );
  } catch (error) {
    if (AppError.is(error)) {
      return NextResponse.json(error.toJSON(), { status: appErrorStatus(error) });
    }
    throw error;
  }
}
