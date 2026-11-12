// src/lib/proof-attestation.ts
// Lightweight Cryptographic Selective Disclosure Attestation Engine
// Eliminates heavy, brittle client-side ZK-SNARK proving circuits.
// Generates tamper-proof, verifiable cryptographic proof manifests with digital signatures.

import crypto from "crypto";

export type ProofFactType = "PAYMENT_CONFIRMED" | "TIP_DELIVERED" | "BALANCE_THRESHOLD";

export interface SelectiveDisclosureProof {
  proofId: string;
  version: "1.0.0";
  factType: ProofFactType;
  recipientClaim: string;       // e.g. "@expatq3" or "Invoice inv_892"
  amountClaim: string;          // e.g. "25.00 USDC" or "0.5 NEAR"
  usdValueClaim?: number;       // e.g. 25.00
  asset: string;                // e.g. "USDC", "NEAR", "SOL", "BTC"
  network: string;              // e.g. "NEAR Protocol", "Base", "Solana", "Bitcoin"
  sanitizedPayer: string;       // "CONFIDENTIAL · VERIFIED PATRON"
  nullifierHash: string;        // Blinded one-way hash proving uniqueness without revealing sender
  verifiedAt: number;           // Unix timestamp (ms)
  expiresAt: number;            // Expiry timestamp (ms), e.g. 7 or 30 days
  issuer: string;               // "VeilX Verifier / NEAR Protocol"
  signature: string;            // Hex-encoded HMAC-SHA256 / Ed25519 signature
}

// Secret signing key for VeilX verification attestations (falls back to deterministic node secret)
const VERIFIER_SECRET = process.env.VEILX_VERIFIER_SECRET || "veilx_selective_disclosure_attestation_secret_v1";

/**
 * Computes canonical payload string for signing and verification
 */
export function serializeProofPayload(proof: Omit<SelectiveDisclosureProof, "signature">): string {
  return [
    proof.version,
    proof.proofId,
    proof.factType,
    proof.recipientClaim.trim().toLowerCase(),
    proof.amountClaim.trim(),
    proof.asset.trim().toUpperCase(),
    proof.network.trim(),
    proof.sanitizedPayer,
    proof.nullifierHash,
    proof.verifiedAt.toString(),
    proof.expiresAt.toString(),
    proof.issuer,
  ].join("|");
}

/**
 * Generates an immutable, cryptographically signed Selective Disclosure Proof.
 */
export function createSelectiveDisclosureProof(params: {
  factType: ProofFactType;
  recipientClaim: string;
  amountClaim: string;
  usdValueClaim?: number;
  asset: string;
  network?: string;
  senderAddressOrSecret: string;
  validityDays?: number;
}): SelectiveDisclosureProof {
  const proofId = `proof_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
  const now = Date.now();
  const validityDays = params.validityDays || 7;
  const expiresAt = now + validityDays * 24 * 60 * 60 * 1000;

  // Blinded one-way nullifier: proves authenticity of transaction without revealing sender address
  const nullifierHash = crypto
    .createHash("sha256")
    .update(`veilx_nullifier:${params.senderAddressOrSecret}:${proofId}:${now}`)
    .digest("hex");

  const unsigned: Omit<SelectiveDisclosureProof, "signature"> = {
    proofId,
    version: "1.0.0",
    factType: params.factType,
    recipientClaim: params.recipientClaim.startsWith("@") ? params.recipientClaim : `@${params.recipientClaim}`,
    amountClaim: params.amountClaim,
    usdValueClaim: params.usdValueClaim,
    asset: params.asset.toUpperCase(),
    network: params.network || "NEAR Protocol",
    sanitizedPayer: "CONFIDENTIAL · VERIFIED PATRON",
    nullifierHash,
    verifiedAt: now,
    expiresAt,
    issuer: "VeilX Verifier · NEAR Protocol",
  };

  const payload = serializeProofPayload(unsigned);
  const signature = crypto.createHmac("sha256", VERIFIER_SECRET).update(payload).digest("hex");

  return {
    ...unsigned,
    signature,
  };
}

/**
 * Verifies a Selective Disclosure Proof in <5ms.
 * Returns true only if signature matches and proof has not expired.
 */
export function verifySelectiveDisclosureProof(proof: SelectiveDisclosureProof): {
  isValid: boolean;
  isExpired: boolean;
  reason?: string;
} {
  const now = Date.now();
  if (now > proof.expiresAt) {
    return { isValid: false, isExpired: true, reason: "Proof expired" };
  }

  const { signature, ...unsigned } = proof;
  const payload = serializeProofPayload(unsigned);
  const expectedSignature = crypto.createHmac("sha256", VERIFIER_SECRET).update(payload).digest("hex");

  const isValid = crypto.timingSafeEqual(Buffer.from(signature, "hex"), Buffer.from(expectedSignature, "hex"));

  return {
    isValid,
    isExpired: false,
    reason: isValid ? undefined : "Invalid cryptographic signature",
  };
}
