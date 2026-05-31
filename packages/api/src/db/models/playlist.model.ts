import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const localeContentSchema = new Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    slug: { type: String, required: true, lowercase: true, trim: true, maxlength: 200 },
    description: { type: String, maxlength: 2000 },
    scholarName: { type: String, trim: true, maxlength: 200 },
  },
  { _id: false },
);

const playlistSchema = new Schema(
  {
    ar: { type: localeContentSchema, required: true },
    en: { type: localeContentSchema, required: true },
    coverMediaId: { type: Schema.Types.ObjectId, ref: "Media" },
    scholarImage: { type: String, trim: true, maxlength: 500 },
    status: {
      type: String,
      enum: ["draft", "published"],
      required: true,
      default: "draft",
    },
    categoryIds: [{ type: Schema.Types.ObjectId, default: [] }],
    order: { type: Number, required: true, min: 0 },
  },
  { timestamps: true, collection: "playlists" },
);

playlistSchema.index({ "ar.slug": 1 }, { unique: true });
playlistSchema.index({ "en.slug": 1 }, { unique: true });
playlistSchema.index({ status: 1, updatedAt: -1 });
playlistSchema.index({ status: 1, order: 1 });
playlistSchema.index({ order: 1 });

export type PlaylistDoc = InferSchemaType<typeof playlistSchema> & {
  _id: mongoose.Types.ObjectId;
};

type PlaylistModelType = Model<PlaylistDoc>;

export const PlaylistModel: PlaylistModelType =
  (mongoose.models.Playlist as PlaylistModelType | undefined) ??
  mongoose.model<PlaylistDoc>("Playlist", playlistSchema);
