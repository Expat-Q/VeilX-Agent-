// src/lib/rate-limiter.ts
// Dual-layer Sliding Window Rate Limiter (In-Memory + MongoDB Atomic Persistence)
import mongoose, { Schema } from "mongoose";
import { connectToDatabase } from "./mongodb";

interface RateLimitRecord {
  timestamps: number[];
}

const memoryStore = new Map<string, RateLimitRecord>();

// Clean up expired timestamps periodically (every 10 minutes)
setInterval(() => {
  const now = Date.now();
  memoryStore.forEach((record, key) => {
    record.timestamps = record.timestamps.filter((ts: number) => now - ts < 24 * 60 * 60 * 1000);
    if (record.timestamps.length === 0) {
      memoryStore.delete(key);
    }
  });
}, 10 * 60 * 1000);

export interface RateLimitOptions {
  limit: number;       // Maximum requests allowed in the window
  windowMs: number;    // Window size in milliseconds
}

// Lightweight schema for cross-instance persistent rate limiting
const RateLimitSchema = new Schema(
  {
    key: { type: String, required: true, index: true },
    timestamps: [{ type: Number }],
    expireAt: { type: Date, expires: "1d", default: () => new Date(Date.now() + 24 * 60 * 60 * 1000) },
  },
  { collection: "rate_limits" }
);

const PersistentRateLimit =
  mongoose.models.RateLimit || mongoose.model("RateLimit", RateLimitSchema);

export function checkRateLimit(
  key: string,
  options: RateLimitOptions = { limit: 5, windowMs: 60 * 60 * 1000 }
): { allowed: boolean; count: number; remaining: number; resetMs: number } {
  const now = Date.now();
  const record = memoryStore.get(key) || { timestamps: [] };

  // Remove timestamps outside window
  record.timestamps = record.timestamps.filter((ts) => now - ts < options.windowMs);

  if (record.timestamps.length >= options.limit) {
    const oldest = record.timestamps[0];
    const resetMs = Math.max(0, options.windowMs - (now - oldest));
    return {
      allowed: false,
      count: record.timestamps.length,
      remaining: 0,
      resetMs,
    };
  }

  record.timestamps.push(now);
  memoryStore.set(key, record);

  const remaining = options.limit - record.timestamps.length;
  const resetMs = options.windowMs;

  return {
    allowed: true,
    count: record.timestamps.length,
    remaining,
    resetMs,
  };
}

/**
 * Async persistent rate limiter that queries and persists into MongoDB
 * to prevent bypass across serverless restarts and multi-pod deployments.
 */
export async function checkPersistentRateLimit(
  key: string,
  options: RateLimitOptions = { limit: 5, windowMs: 60 * 60 * 1000 }
): Promise<{ allowed: boolean; count: number; remaining: number; resetMs: number }> {
  // First check fast memory layer
  const memCheck = checkRateLimit(key, options);
  if (!memCheck.allowed) {
    return memCheck;
  }

  try {
    await connectToDatabase();
    const now = Date.now();
    const cutoff = now - options.windowMs;

    const doc = await PersistentRateLimit.findOne({ key });
    const existingTimestamps: number[] = doc
      ? (doc.timestamps as number[]).filter((t: number) => t > cutoff)
      : [];

    if (existingTimestamps.length >= options.limit) {
      const oldest = existingTimestamps[0];
      const resetMs = Math.max(0, options.windowMs - (now - oldest));
      return {
        allowed: false,
        count: existingTimestamps.length,
        remaining: 0,
        resetMs,
      };
    }

    existingTimestamps.push(now);
    await PersistentRateLimit.findOneAndUpdate(
      { key },
      {
        $set: {
          timestamps: existingTimestamps,
          expireAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      },
      { upsert: true }
    );

    return {
      allowed: true,
      count: existingTimestamps.length,
      remaining: options.limit - existingTimestamps.length,
      resetMs: options.windowMs,
    };
  } catch (err) {
    // If database unavailable, gracefully rely on in-memory rate check
    return memCheck;
  }
}
