// src/models/IntentOrder.ts
// MongoDB Mongoose Model for Tracking NEAR Intents & 1Click Cross-Chain Swaps

import mongoose, { Schema, Document, Model } from "mongoose";

export interface IIntentOrder extends Document {
  orderId: string;
  depositAddress: string;
  senderHandle?: string;
  senderWallet?: string;
  recipient: string;
  sourceChain: string;
  sourceAsset: string;
  sourceAmount: number;
  targetChain: string;
  targetAsset: string;
  targetAmount: number;
  estimatedFeeUsd: number;
  status: "created" | "deposited" | "processing" | "success" | "refunded" | "expired";
  depositTxHash?: string;
  destinationTxHash?: string;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const IntentOrderSchema = new Schema<IIntentOrder>(
  {
    orderId: { type: String, required: true, unique: true, index: true },
    depositAddress: { type: String, required: true, index: true },
    senderHandle: { type: String, index: true },
    senderWallet: { type: String },
    recipient: { type: String, required: true },
    sourceChain: { type: String, default: "NEAR" },
    sourceAsset: { type: String, required: true },
    sourceAmount: { type: Number, required: true },
    targetChain: { type: String, required: true },
    targetAsset: { type: String, required: true },
    targetAmount: { type: Number, required: true },
    estimatedFeeUsd: { type: Number, default: 0.04 },
    status: {
      type: String,
      enum: ["created", "deposited", "processing", "success", "refunded", "expired"],
      default: "created",
      index: true,
    },
    depositTxHash: { type: String },
    destinationTxHash: { type: String },
    expiresAt: { type: Date, required: true, index: { expires: 86400 } }, // Auto-expire after 24h
  },
  { timestamps: true }
);

IntentOrderSchema.index({ senderHandle: 1, status: 1 });
IntentOrderSchema.index({ depositAddress: 1, status: 1 });

export const IntentOrder: Model<IIntentOrder> =
  mongoose.models.IntentOrder ||
  mongoose.model<IIntentOrder>("IntentOrder", IntentOrderSchema);
