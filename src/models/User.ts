// src/models/User.ts
import mongoose, { Schema, Document, Model } from "mongoose";

export interface IUser extends Document {
  xUserId?: string; // Permanent immutable Twitter Numeric ID (e.g. "1858188832094519296")
  xHandle: string; // Current screen name (e.g. "expatq3")
  xDisplayName?: string;
  nearAccountId: string;
  sessionPublicKey?: string;
  spendingLimitUsd: number;
  spentUsd: number;
  weeklyLimitUsd?: number;
  weeklySpentUsd?: number;
  lastDailyReset?: Date;
  lastWeeklyReset?: Date;
  avatarUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    xUserId: { type: String, sparse: true, unique: true, index: true },
    xHandle: { type: String, required: true, unique: true, index: true },
    xDisplayName: { type: String },
    nearAccountId: { type: String, required: true, index: true },
    sessionPublicKey: { type: String },
    spendingLimitUsd: { type: Number, default: 50.0 },
    spentUsd: { type: Number, default: 0.0 },
    weeklyLimitUsd: { type: Number, default: 200.0 },
    weeklySpentUsd: { type: Number, default: 0.0 },
    lastDailyReset: { type: Date, default: Date.now },
    lastWeeklyReset: { type: Date, default: Date.now },
    avatarUrl: { type: String },
  },
  { timestamps: true, bufferCommands: false }
);

if (mongoose.models && (mongoose.models as any).User) {
  delete (mongoose.models as any).User;
}

export const User: Model<IUser> =
  mongoose.models.User || mongoose.model<IUser>("User", UserSchema);
