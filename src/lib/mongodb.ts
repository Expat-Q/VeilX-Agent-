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

  if (cached.conn && cached.conn.connection.readyState === 1) {
    return cached.conn;
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
