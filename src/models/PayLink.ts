// src/models/PayLink.ts
import mongoose, { Schema, Document, Model } from "mongoose";

export interface IPayLink extends Document {
  slug: string;
  creatorHandle: string;
  recipientNearAccount: string;
  amountUsd: number;
  memo: string;
  isPrivate?: boolean;
  memoCiphertext?: string;
  memoIv?: string;
  memoTag?: string;
  recipientCommitment?: string;
  status: "active" | "settled" | "cancelled";
  supportedChains: string[];
  settledTx?: string;
  createdAt: Date;
  updatedAt: Date;
}

const PayLinkSchema = new Schema<IPayLink>(
  {
    slug: { type: String, required: true, unique: true, index: true },
    creatorHandle: { type: String, required: true, index: true },
    recipientNearAccount: { type: String, required: true },
    amountUsd: { type: Number, required: true },
    memo: { type: String, default: "Payment Request" },
    isPrivate: { type: Boolean, default: false },
    memoCiphertext: { type: String },
    memoIv: { type: String },
    memoTag: { type: String },
    recipientCommitment: { type: String },
    status: {
      type: String,
      enum: ["active", "settled", "cancelled"],
      default: "active",
    },
    supportedChains: {
      type: [String],
      default: ["Base (USDC)", "Solana (SOL)", "NEAR (USDC)"],
    },
    settledTx: { type: String },
  },
  { timestamps: true, bufferCommands: true }
);

PayLinkSchema.index({ creatorHandle: 1, status: 1, createdAt: -1 });

export const PayLink: Model<IPayLink> =
  mongoose.models.PayLink || mongoose.model<IPayLink>("PayLink", PayLinkSchema);
