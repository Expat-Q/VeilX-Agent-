// src/models/Transaction.ts
import mongoose, { Schema, Document, Model } from "mongoose";

export interface ITransaction extends Document {
  userHandle: string;
  txHash?: string;
  type: "tip_sent" | "tip_received" | "invoice_received" | "tip_claimed" | "direct_deposit" | "withdrawal" | "faucet_claim" | "escrow_deposit";
  counterparty: string;
  amountUsd: number;
  asset: string;
  status: "escrow_pending" | "claimed" | "settled_direct" | "completed";
  statusLabel: string;
  memo?: string;
  isInflow: boolean;
  createdAt: Date;
}

const TransactionSchema = new Schema<ITransaction>(
  {
    userHandle: { type: String, required: true, index: true },
    txHash: { type: String },
    type: {
      type: String,
      enum: ["tip_sent", "tip_received", "invoice_received", "tip_claimed", "direct_deposit", "withdrawal", "faucet_claim", "escrow_deposit"],
      required: true,
    },
    counterparty: { type: String, required: true },
    amountUsd: { type: Number, required: true },
    asset: { type: String, default: "USDC" },
    status: {
      type: String,
      enum: ["escrow_pending", "claimed", "settled_direct", "completed"],
      required: true,
    },
    statusLabel: { type: String, required: true },
    memo: { type: String },
    isInflow: { type: Boolean, required: true },
  },
  { timestamps: true }
);

TransactionSchema.index({ userHandle: 1, createdAt: -1 });
TransactionSchema.index({ txHash: 1, userHandle: 1 });

if (mongoose.models && (mongoose.models as any).Transaction) {
  delete (mongoose.models as any).Transaction;
}

export const Transaction: Model<ITransaction> =
  mongoose.models.Transaction ||
  mongoose.model<ITransaction>("Transaction", TransactionSchema);
