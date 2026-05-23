import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

/*
 * Mongoose model for the `users` collection. Mirrors the Zod schema in
 * `schemas/user.ts` (DATABASE.md §0.3). `passwordHash` lives only on the
 * Mongoose side — it never leaves the auth service.
 *
 * The unique email index is enforced at the DB level so two parallel
 * inserts can't race a duplicate user past the application layer.
 */
const userSchema = new Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    emailVerified: { type: Date, default: null },
    passwordHash: { type: String, required: true, select: false },
    name: { type: String, required: true, trim: true },
    role: {
      type: String,
      enum: ["admin"],
      required: true,
      default: "admin",
    },
  },
  { timestamps: true, collection: "users" },
);

export type UserDoc = InferSchemaType<typeof userSchema> & { _id: mongoose.Types.ObjectId };

type UserModelType = Model<UserDoc>;

export const UserModel: UserModelType =
  (mongoose.models.User as UserModelType | undefined) ??
  mongoose.model<UserDoc>("User", userSchema);
