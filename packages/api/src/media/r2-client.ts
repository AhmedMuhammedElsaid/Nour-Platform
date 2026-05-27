import {
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
  type HeadObjectCommandOutput,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { env } from "@repo/config/env";

import { AppError } from "../errors";

/*
 * Cloudflare R2 client for the audio-upload handshake (Wave 2.4).
 *
 * R2 is S3-API-compatible, so we use the AWS SDK with a custom endpoint.
 * The flow this module supports is:
 *   1. admin calls `createPresignedUpload(key, mime, size)`,
 *   2. browser PUTs the file directly to R2 with the returned URL,
 *   3. confirm endpoint calls `headObject(key)` to verify the upload landed.
 *
 * Security choices baked in here (see SECURITY.md "MVP profile"):
 *   - The MIME allowlist is a compile-time `const` array — not a runtime
 *     config — so a misconfigured env var can never widen what we accept.
 *   - Size is checked server-side BEFORE we sign, in addition to whatever
 *     the confirm endpoint re-checks via `headObject`. Presigned PUTs
 *     can't enforce a max size on their own without policy conditions
 *     (which `getSignedUrl` doesn't generate for plain `PutObject`).
 *   - Presigned URLs expire in 15 minutes — long enough for a real upload,
 *     short enough that a leaked URL has limited blast radius.
 */

const PRESIGN_EXPIRY_SECONDS = 15 * 60;

/*
 * Allowed audio MIME types. Mirrors `mediaMimeTypeSchema` in
 * `schemas/media.ts`; kept as a separate `const` array here because this
 * file must never trust a runtime-derived value for the security check.
 */
export const ALLOWED_AUDIO_MIME_TYPES = [
  "audio/mpeg",
  "audio/wav",
  "audio/mp4",
  "audio/ogg",
] as const;

export type AllowedAudioMimeType = (typeof ALLOWED_AUDIO_MIME_TYPES)[number];

function isAllowedMime(value: string): value is AllowedAudioMimeType {
  return (ALLOWED_AUDIO_MIME_TYPES as readonly string[]).includes(value);
}

/*
 * R2 connection config, materialized lazily. We don't crash at import
 * time when the env vars are missing — only when a caller actually tries
 * to sign or head — so dev sessions that don't touch uploads still boot.
 */
interface R2Config {
  endpoint: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
}

function getR2Config(): R2Config {
  const { R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET } =
    env;
  if (
    !R2_ENDPOINT ||
    !R2_ACCESS_KEY_ID ||
    !R2_SECRET_ACCESS_KEY ||
    !R2_BUCKET
  ) {
    throw AppError.Internal(
      "R2 is not configured. Set R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, and R2_BUCKET.",
    );
  }
  return {
    endpoint: R2_ENDPOINT,
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
    bucket: R2_BUCKET,
  };
}

/*
 * Module-level singleton — the AWS SDK keeps a persistent HTTP agent, so
 * recreating the client per request would defeat connection reuse and
 * leak sockets under load. We tear it down only on hot-reload (the
 * `let` is re-bound when this module re-evaluates in dev).
 */
let cachedClient: S3Client | null = null;

function getClient(): S3Client {
  if (cachedClient) return cachedClient;
  const config = getR2Config();
  cachedClient = new S3Client({
    region: "auto",
    endpoint: config.endpoint,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
    // R2 expects path-style addressing; virtual-hosted-style buckets
    // aren't supported on the default `*.r2.cloudflarestorage.com` host.
    forcePathStyle: true,
    // SDK v3 defaults to "when_supported" which injects x-amz-sdk-checksum-algorithm
    // into presigned URLs. The browser XHR never sends the matching checksum header,
    // so R2 rejects the PUT with 403. "when_required" skips the checksum for
    // plain PutObject, which R2 does not require it for.
    requestChecksumCalculation: "when_required",
    responseChecksumValidation: "when_required",
  });
  return cachedClient;
}

export interface PresignedUpload {
  url: string;
  key: string;
  bucket: string;
  expiresInSeconds: number;
}

/*
 * Produce a presigned PUT URL for a single object. Throws
 * `AppError.Validation` for any disallowed MIME or oversized request,
 * `AppError.Internal` for unexpected S3 errors.
 */
export async function createPresignedUpload(
  key: string,
  mimeType: string,
  sizeBytes: number,
): Promise<PresignedUpload> {
  if (!isAllowedMime(mimeType)) {
    throw AppError.Validation(
      [
        {
          code: "custom",
          path: ["mimeType"],
          message: `Unsupported MIME type. Allowed: ${ALLOWED_AUDIO_MIME_TYPES.join(", ")}.`,
        },
      ],
      "Unsupported audio format.",
    );
  }

  if (!Number.isInteger(sizeBytes) || sizeBytes <= 0) {
    throw AppError.Validation(
      [
        {
          code: "custom",
          path: ["sizeBytes"],
          message: "sizeBytes must be a positive integer.",
        },
      ],
      "Invalid file size.",
    );
  }

  if (sizeBytes > env.R2_MAX_UPLOAD_BYTES) {
    throw AppError.Validation(
      [
        {
          code: "custom",
          path: ["sizeBytes"],
          message: `File exceeds maximum allowed size of ${env.R2_MAX_UPLOAD_BYTES} bytes.`,
        },
      ],
      "File too large.",
    );
  }

  const config = getR2Config();
  const client = getClient();

  try {
    const command = new PutObjectCommand({
      Bucket: config.bucket,
      Key: key,
      ContentType: mimeType,
      ContentLength: sizeBytes,
    });
    const url = await getSignedUrl(client, command, {
      expiresIn: PRESIGN_EXPIRY_SECONDS,
    });
    return {
      url,
      key,
      bucket: config.bucket,
      expiresInSeconds: PRESIGN_EXPIRY_SECONDS,
    };
  } catch (cause) {
    throw AppError.Internal("Failed to create presigned upload URL.", cause);
  }
}

export interface R2ObjectMetadata {
  key: string;
  bucket: string;
  contentType: string | undefined;
  contentLength: number | undefined;
  etag: string | undefined;
  lastModified: Date | undefined;
}

/*
 * Read object metadata (HEAD). Returns `null` when the object does not
 * exist (any 404 / NoSuchKey / NotFound shape the SDK surfaces). Any
 * other S3 failure becomes `AppError.Internal` so call sites don't have
 * to know about SDK error shapes.
 */
export async function headObject(
  key: string,
): Promise<R2ObjectMetadata | null> {
  const config = getR2Config();
  const client = getClient();

  try {
    const out: HeadObjectCommandOutput = await client.send(
      new HeadObjectCommand({ Bucket: config.bucket, Key: key }),
    );
    return {
      key,
      bucket: config.bucket,
      contentType: out.ContentType,
      contentLength: out.ContentLength,
      etag: out.ETag,
      lastModified: out.LastModified,
    };
  } catch (cause) {
    if (isNotFoundError(cause)) return null;
    throw AppError.Internal("Failed to read object metadata.", cause);
  }
}

/*
 * The S3 SDK surfaces "missing object" as one of several shapes depending
 * on the operation and the server response; we accept any of them.
 */
function isNotFoundError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const e = error as {
    name?: string;
    Code?: string;
    $metadata?: { httpStatusCode?: number };
  };
  if (e.name === "NotFound" || e.name === "NoSuchKey") return true;
  if (e.Code === "NotFound" || e.Code === "NoSuchKey") return true;
  if (e.$metadata?.httpStatusCode === 404) return true;
  return false;
}
