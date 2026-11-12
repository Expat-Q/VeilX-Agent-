// src/lib/encryption.ts
// VeilX Level 1 & Level 2 Privacy Primitives
// AES-256-GCM Client/Server Metadata Encryption & SHA-256 Commitment Hashing

import crypto from "crypto";

/**
 * Computes the deterministic SHA-256 commitment hash for a recipient handle and secret salt.
 * Ensures that on-chain escrows do not expose plaintext Twitter handles.
 * Formula: SHA256(handle.toLowerCase().replace(/^@/, '') + salt)
 */
export function computeCommitmentHash(handle: string, salt: string): string {
  const cleanHandle = handle.toLowerCase().replace(/^@/, "").trim();
  const input = `${cleanHandle}${salt.trim()}`;
  return crypto.createHash("sha256").update(input).digest("hex");
}

/**
 * Generates a cryptographically secure random 32-character hexadecimal salt.
 */
export function generatePrivacySalt(): string {
  return crypto.randomBytes(16).toString("hex");
}

/**
 * Encrypts an invoice memo, note, or financial description using AES-256-GCM.
 * @param plaintext The sensitive text to encrypt
 * @param secretKeyHex 32-byte (64-char) hex secret key or derivation seed
 */
export function encryptMemo(
  plaintext: string,
  secretKeyHex: string
): { ciphertext: string; iv: string; tag: string } {
  // Ensure 32-byte key
  const key = crypto.createHash("sha256").update(secretKeyHex).digest();
  const iv = crypto.randomBytes(12); // 96-bit IV recommended for AES-GCM
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);

  let encrypted = cipher.update(plaintext, "utf8", "base64");
  encrypted += cipher.final("base64");
  const tag = cipher.getAuthTag().toString("base64");

  return {
    ciphertext: encrypted,
    iv: iv.toString("base64"),
    tag,
  };
}

/**
 * Decrypts an AES-256-GCM encrypted memo envelope.
 */
export function decryptMemo(
  ciphertext: string,
  iv: string,
  tag: string,
  secretKeyHex: string
): string | null {
  try {
    const key = crypto.createHash("sha256").update(secretKeyHex).digest();
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64"));
    decipher.setAuthTag(Buffer.from(tag, "base64"));

    let decrypted = decipher.update(ciphertext, "base64", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  } catch (err) {
    console.warn("[Privacy Decryption] Failed to decrypt memo envelope:", err);
    return null;
  }
}
