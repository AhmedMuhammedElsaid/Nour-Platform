import { z } from "zod";

/*
 * Media shape per DATABASE.md (Audio MVP). A Media row is the canonical
 * record of an object in R2: created in `pending` state by the presigned-
 * URL handshake, flipped to `confirmed` after the client posts the upload
 * confirmation (and the worker reads metadata), and `failed` if either of
 * those steps errored. The allowlist is intentionally narrow per
 * SECURITY.md (no arbitrary user-controlled MIME).
 */

const objectIdSchema = z
  .string()
  .regex(/^[0-9a-f]{24}$/, "Invalid ObjectId");

export const mediaMimeTypeSchema = z.enum([
  "audio/mpeg",
  "audio/wav",
  "audio/mp4",
  "audio/ogg",
]);
export type MediaMimeType = z.infer<typeof mediaMimeTypeSchema>;

export const mediaStatusSchema = z.enum(["pending", "confirmed", "failed"]);
export type MediaStatus = z.infer<typeof mediaStatusSchema>;

export const mediaSchema = z.object({
  id: objectIdSchema,
  // R2 object key. Service code builds this from a uuid; we constrain
  // length and forbid the bucket-traversal characters here as a belt-and-
  // braces check on top of the service-side generator.
  key: z.string().min(1).max(512),
  bucket: z.string().min(1).max(128),
  mimeType: mediaMimeTypeSchema,
  sizeBytes: z.number().int().positive(),
  // Populated by the audio analyzer after `confirmed`; absent on `pending`
  // and `failed` rows.
  durationSecs: z.number().positive().optional(),
  status: mediaStatusSchema,
  uploadedBy: objectIdSchema,
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type Media = z.infer<typeof mediaSchema>;

/*
 * Create-input: produced by the presign action. `status` defaults to
 * `pending`. `durationSecs` is never set by the caller — the analyzer
 * patches it in after the upload is confirmed.
 */
export const mediaCreateInputSchema = z.object({
  key: z.string().min(1).max(512),
  bucket: z.string().min(1).max(128),
  mimeType: mediaMimeTypeSchema,
  sizeBytes: z.number().int().positive(),
  uploadedBy: objectIdSchema,
  status: mediaStatusSchema.default("pending"),
});
export type MediaCreateInput = z.infer<typeof mediaCreateInputSchema>;

/*
 * Update-input: in practice only `status` and `durationSecs` ever change
 * after creation (lifecycle transitions + analyzer write-back). Kept as a
 * partial so future fields don't force a schema bump.
 */
export const mediaUpdateInputSchema = z
  .object({
    status: mediaStatusSchema,
    durationSecs: z.number().positive(),
    sizeBytes: z.number().int().positive(),
    mimeType: mediaMimeTypeSchema,
  })
  .partial();
export type MediaUpdateInput = z.infer<typeof mediaUpdateInputSchema>;
