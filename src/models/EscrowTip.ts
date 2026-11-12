// src/models/EscrowTip.ts
import mongoose, { Schema, Document, Model } from "mongoose";

export interface IEscrowTip extends Document {
  tipId: string;
  senderHandle: string;
  senderWallet: string;
  recipientHandle: string;
  recipientWallet: string;
  amount: number;
  amountNear: number;
  amountUsd?: number;
  asset: string;
  depositTxHash: string;
  claimTxHash?: string;
  isPrivate?: boolean;
  commitment?: string;
  privacySalt?: string;
  stealthSubaccountId?: string;
  status: "broadcasting" | "pending" | "claiming" | "claimed" | "refunded" | "failed";
  claimLockedAt?: Date;
  createdAt: Date;
  claimedAt?: Date;
}

const EscrowTipSchema = new Schema<IEscrowTip>(
  {
    tipId: { type: String, required: true, unique: true, index: true },
    senderHandle: { type: String, required: true, index: true },
    senderWallet: { type: String, required: true },
    recipientHandle: { type: String, required: true, index: true },
    recipientWallet: { type: String, required: true },
    amount: { type: Number, required: true },
    amountNear: { type: Number, required: true },
    amountUsd: { type: Number },
    asset: { type: String, default: "NEAR" },
    depositTxHash: { type: String, required: true },
    claimTxHash: { type: String },
    isPrivate: { type: Boolean, default: false },
    commitment: { type: String, index: true },
    privacySalt: { type: String },
    stealthSubaccountId: { type: String, index: true },
    status: {
      type: String,
      enum: ["broadcasting", "pending", "claiming", "claimed", "refunded", "failed"],
      default: "pending",
      index: true,
    },
    claimLockedAt: { type: Date },
    claimedAt: { type: Date },
  },
  { timestamps: true }
);

EscrowTipSchema.index({ recipientHandle: 1, status: 1 });
EscrowTipSchema.index({ tipId: 1, recipientHandle: 1, status: 1 });
EscrowTipSchema.index({ status: 1, claimLockedAt: 1 });

if (mongoose.models && (mongoose.models as any).EscrowTip) {
  delete (mongoose.models as any).EscrowTip;
}

export const EscrowTip: Model<IEscrowTip> =
  mongoose.models.EscrowTip || mongoose.model<IEscrowTip>("EscrowTip", EscrowTipSchema);
