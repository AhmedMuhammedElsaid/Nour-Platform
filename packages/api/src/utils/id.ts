import { Types } from "mongoose";

/*
 * Mints a new ObjectId as a 24-char hex string. Used by services to allocate a
 * `contentId` when creating the first locale of a logical content item, without
 * importing Mongoose at every call site (keeps the service layer Document-free).
 */
export function newObjectIdString(): string {
  return new Types.ObjectId().toString();
}
