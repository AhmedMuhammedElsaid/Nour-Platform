import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

/*
 * Mongoose model for the `media` collection. Mirrors the Zod schema in
 * `schemas/media.ts` (DATABASE.md Audio MVP). A Media row is created in
 * `pending` state by the presigned-URL handshake and transitions to
 * `confirmed` (or `failed`) via the upload confirmation action.
 *
 * `key` is indexed so the R2 webhook can quickly locate the row by object key.
 * `uploadedBy` is indexed for admin audit queries.
 */
const mediaSchema = new Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      maxlength: 512,
      index: true,
    },
    bucket: { type: String, required: true, maxlength: 128 },
    mimeType: {
      type: String,
      enum: ["audio/mpeg", "audio/wav", "audio/mp4", "audio/ogg"],
      required: true,
    },
    sizeBytes: { type: Number, required: true, min: 1 },
    durationSecs: { type: Number, min: 0 },
    status: {
      type: String,
      enum: ["pending", "confirmed", "failed"],
      required: true,
      default: "pending",
    },
    uploadedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
  },
  { timestamps: true, collection: "media" },
);

export type MediaDoc = InferSchemaType<typeof mediaSchema> & {
  _id: mongoose.Types.ObjectId;
};

type MediaModelType = Model<MediaDoc>;

export const MediaModel: MediaModelType =
  (mongoose.models.Media as MediaModelType | undefined) ??
  mongoose.model<MediaDoc>("Media", mediaSchema);
