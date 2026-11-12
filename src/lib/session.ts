// src/lib/session.ts
// Cryptographic HMAC Session Signing for VeilX
import crypto from "crypto";

if (process.env.NODE_ENV === "production" && !process.env.SESSION_SECRET) {
  throw new Error("FATAL: SESSION_SECRET environment variable is required in production");
}

const SESSION_SECRET = process.env.SESSION_SECRET || "veilx_secure_session_secret_2026_testnet_key_9831";

export function signSessionPayload(payload: any): string {
  const json = JSON.stringify(payload);
  const hmac = crypto.createHmac("sha256", SESSION_SECRET).update(json).digest("hex");
  const envelope = { payload, sig: hmac };
  return Buffer.from(JSON.stringify(envelope)).toString("base64url");
}

export function verifySessionToken(token: string): any | null {
  try {
    if (!token) return null;
    const raw = Buffer.from(token, "base64url").toString("utf8");
    const envelope = JSON.parse(raw);
    if (!envelope.payload || !envelope.sig) return null;

    const json = JSON.stringify(envelope.payload);
    const expectedSig = crypto.createHmac("sha256", SESSION_SECRET).update(json).digest("hex");

    if (
      envelope.sig.length === expectedSig.length &&
      crypto.timingSafeEqual(Buffer.from(envelope.sig), Buffer.from(expectedSig))
    ) {
      return envelope.payload;
    }
    return null;
  } catch {
    return null;
  }
}
