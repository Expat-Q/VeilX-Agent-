// src/models/DisclosureProof.ts
import mongoose, { Schema, Document } from "mongoose";
import { SelectiveDisclosureProof, ProofFactType } from "@/lib/proof-attestation";

export interface IDisclosureProof extends Document, SelectiveDisclosureProof {
  createdAt: Date;
  updatedAt: Date;
}

const DisclosureProofSchema = new Schema<IDisclosureProof>(
  {
    proofId: { type: String, required: true, unique: true, index: true },
    version: { type: String, default: "1.0.0" },
    factType: {
      type: String,
      required: true,
      enum: ["PAYMENT_CONFIRMED", "TIP_DELIVERED", "BALANCE_THRESHOLD"],
    },
    recipientClaim: { type: String, required: true },
    amountClaim: { type: String, required: true },
    usdValueClaim: { type: Number },
    asset: { type: String, required: true },
    network: { type: String, default: "NEAR Protocol" },
    sanitizedPayer: { type: String, default: "CONFIDENTIAL · VERIFIED PATRON" },
    nullifierHash: { type: String, required: true },
    verifiedAt: { type: Number, required: true },
    expiresAt: { type: Number, required: true },
    issuer: { type: String, default: "VeilX Verifier · NEAR Protocol" },
    signature: { type: String, required: true },
  },
  { timestamps: true }
);

export const DisclosureProof =
  mongoose.models.DisclosureProof ||
  mongoose.model<IDisclosureProof>("DisclosureProof", DisclosureProofSchema);
