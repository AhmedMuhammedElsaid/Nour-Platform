import mongoose from "mongoose";

import { env } from "@repo/config/env";

/*
 * Cached Mongoose connection (DATABASE.md §1).
 *
 * Next.js dev mode hot-reloads modules, and Vercel serverless invocations
 * may reuse warm containers — caching the promise on `globalThis` prevents
 * connection storms in both environments. `autoIndex` is on in dev (so
 * model changes pick up indexes immediately) and off in prod (indexes are
 * owned by migration scripts, see Wave 2.3).
 */
type MongooseClient = typeof mongoose;

interface MongoCache {
  conn: MongooseClient | null;
  promise: Promise<MongooseClient> | null;
}

declare global {
  var __mongo: MongoCache | undefined;
}

const cache: MongoCache = (globalThis.__mongo ??= {
  conn: null,
  promise: null,
});

export async function getDb(): Promise<MongooseClient> {
  if (cache.conn) return cache.conn;
  cache.promise ??= mongoose.connect(env.MONGODB_URI, {
    autoIndex: env.NODE_ENV !== "production",
    serverSelectionTimeoutMS: 5_000,
    maxPoolSize: 10,
  });
  cache.conn = await cache.promise;
  return cache.conn;
}

export async function disconnectDb(): Promise<void> {
  if (!cache.conn) return;
  await cache.conn.disconnect();
  cache.conn = null;
  cache.promise = null;
}
