// src/lib/mongodb.ts
// Cached MongoDB connection handler for Next.js

import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI;

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

declare global {
  // eslint-disable-next-line no-var
  var mongooseCache: MongooseCache | undefined;
}

let cached: MongooseCache = global.mongooseCache || { conn: null, promise: null };

if (!global.mongooseCache) {
  global.mongooseCache = cached;
}

export async function connectToDatabase(): Promise<typeof mongoose | null> {
  if (!MONGODB_URI) {
    return null;
  }

  // If connection is active and ready, return cached connection
  if (cached.conn && cached.conn.connection.readyState === 1) {
    return cached.conn;
  }

  // If cached connection dropped or not ready, reset cache to force reconnect
  if (cached.conn && cached.conn.connection.readyState !== 1) {
    cached.conn = null;
    cached.promise = null;
  }

  // Reset promise if mongoose connection is disconnected (readyState === 0)
  if (mongoose.connection && mongoose.connection.readyState === 0) {
    cached.promise = null;
    cached.conn = null;
  }

  if (!cached.promise) {
    const opts = {
      serverSelectionTimeoutMS: 8000,
      maxPoolSize: 10,
    };

    cached.promise = mongoose.connect(MONGODB_URI, opts).then((m) => {
      console.log("[MongoDB] Connected to database cluster successfully");
      return m;
    });
  }

  try {
    cached.conn = await cached.promise;
    if (cached.conn.connection.readyState !== 1) {
      cached.promise = null;
      cached.conn = null;
      return null;
    }
  } catch (e) {
    cached.promise = null;
    cached.conn = null;
    console.error("[MongoDB Connection Error]", e);
    return null;
  }

  return cached.conn;
}
