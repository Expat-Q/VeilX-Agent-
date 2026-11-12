# 07 — SECURITY, THREAT MODEL & USER SAFETY AUDIT
**Project:** VeilX Autonomous Omnichain Social Finance & Tokenized Equities Terminal  
**Auditor:** Agent 7 — Security, Threat Modeling & User Safety Specialist  
**Status:** Audit Complete  
**Date:** November 11, 2026  
**Repository Path:** `C:\Users\HomePC\Downloads\VeilX-Agent`

---

## 📌 PLAIN-ENGLISH SUMMARY (READ THIS FIRST)

> **What is this document?**  
> This report looks at security: can someone steal money, bypass spending limits, hack an account, or empty a wallet?

### In Plain Terms: Where is VeilX Secure, and Where is it Exposed?
1. **The Daily Spending Cap ($50 Limit):**  
   * *Good News:* On `/api/evm/send-mpc`, the server-side spending cap is **actively working**. If an automated trade tries to spend more than your remaining daily limit, the server firmly blocks it with an error 403.
   * *The Gap:* If a user uses the manual browser-signing route instead of the agent route, that route forgot to check the spending limit.
2. **Account Login Security (The Cookie Hole):**  
   * The user registration endpoint (`POST /api/user`) gives out a login cookie even if the user didn't prove they own that Twitter account through Twitter OAuth.
   * *How to Fix:* Only issue login cookies through the verified Twitter OAuth callback (`/api/auth/callback/twitter`).
3. **Session Keys Stored in the Browser:**  
   * Your NEAR account keys are currently saved in standard browser storage (`localStorage`). While convenient, if a user has a malicious Chrome extension installed, that extension could potentially read the key.
   * *How to Fix:* Encrypt the key with Web Crypto or require a quick biometric/PIN confirmation before signing.

---

## 1. Executive Summary

This audit delivers an exhaustive security vulnerability assessment, threat model, and user safety inspection of the VeilX platform. The analysis covers the entire identity lifecycle, cryptographic key management, financial safety guardrails (spending caps and freeze controls), relayer exploit resilience, and API attack surfaces.

VeilX operates on a **hybrid non-custodial and gas-sponsored architecture**:
- User accounts hold cryptographic Ed25519 session keys inside the client browser.
- Multi-chain transactions (Base, Arbitrum, Ethereum) use NEAR Chain Signatures MPC (`v1.signer-prod.testnet`).
- Social tipping and claims use a server-sponsored meta-transaction relayer (`contracts/veilx-escrow/src/lib.rs`).

### Overall Security Audit Findings:
1. **CRITICAL Vulnerability Identified (SEC-001):** `POST /api/user` allows unauthenticated callers to register or overwrite any Twitter handle and automatically mint a valid, signed `veilx_session` authentication cookie for that user without OAuth or password verification!
2. **HIGH Vulnerability Identified (SEC-002):** Spending cap validation is enforced in `POST /api/evm/send-mpc`, but completely absent in the primary non-custodial browser MPC signing pipeline (`POST /api/evm/prepare-tx` and `POST /api/evm/broadcast-tx`), allowing users to bypass spending limits entirely.
3. **MEDIUM Vulnerability Identified (SEC-003):** Session tokens generated in `src/lib/session.ts` do not contain or enforce an expiration timestamp (`exp`), rendering issued tokens immortal unless revoked or secret rotated.
4. **MEDIUM Vulnerability Identified (SEC-004):** Delegated Ed25519 session private keys are stored in plaintext JSON in browser `localStorage` (`src/lib/near-embedded-wallet.ts`), exposing them to extraction via XSS or malicious extensions.
5. **MEDIUM Vulnerability Identified (SEC-005):** The background escrow reconciliation endpoint (`/api/reconcile`) can be triggered by anyone on the public internet without an API key or cron secret.

---

## 2. Threat Model & Adversary Attack Matrix

| Adversary Profile | Attack Vector | Target Component | Defense in Code | Vulnerability Status |
| :--- | :--- | :--- | :--- | :--- |
| **Unauthenticated Attacker** | Account Takeover / Session Forgery | `POST /api/user` | Checks `sessionUser` only if cookie is present | **CRITICAL: Bypassed when no cookie sent (SEC-001)** |
| **Malicious Authenticated User** | Spending Cap Evasion | `/api/evm/prepare-tx` & `/broadcast-tx` | None | **HIGH: Cap enforced only in deprecated send-mpc (SEC-002)** |
| **Token Interceptor** | Indefinite Session Replay | `src/lib/session.ts` | HMAC-SHA256 signature check | **MEDIUM: Missing expiration timestamp validation (SEC-003)** |
| **XSS / Malicious Extension** | Session Key Theft | `localStorage` | Browser origin isolation | **MEDIUM: Plaintext Ed25519 key storage (SEC-004)** |
| **Denial of Service (DoS)** | RPC Exhaustion & DB Spam | `GET /api/reconcile` | None | **MEDIUM: Publicly callable without CRON_SECRET (SEC-005)** |
| **Double-Claim Attacker** | Concurrent Race Condition | `POST /api/relay/claim` | Atomic MongoDB mutex with 5-min TTL & on-chain reentrancy guard | **PASS: Verified Protected** |
| **EVM Replay Attacker** | Cross-Chain Signature Replay | `near-chain-signatures.ts` | EIP-1559 payload strictly includes `chainId` | **PASS: Verified Protected** |

---

## 3. Detailed Security Findings

### [SEC-001] [Critical] Unauthenticated Account Hijacking & Session Cookie Forgery in `/api/user`
- **Finding ID:** SEC-001
- **Severity:** CRITICAL
- **Status:** Verified Existing Flaw
- **Affected Route:** `POST /api/user`
- **Affected File:** `src/app/api/user/route.ts` (lines 62-123)
- **Direct Code Evidence:**
  ```typescript
  // src/app/api/user/route.ts:62-72
  // Validate session identity if an active session exists
  const cookieStore = cookies();
  const sessionCookie = cookieStore.get("veilx_session")?.value;
  const sessionUser = sessionCookie ? verifySessionToken(sessionCookie) : null;

  if (sessionUser && sessionUser.xHandle?.toLowerCase() !== cleanHandle.toLowerCase()) {
    return NextResponse.json(
      { error: "Unauthorized: Active authenticated session does not match this handle" },
      { status: 403 }
    );
  }

  ...
  // src/app/api/user/route.ts:93-101
  const user = await User.findOneAndUpdate(
    { xHandle: cleanHandle },
    {
      xHandle: cleanHandle,
      nearAccountId: effectiveAccountId,
      spendingLimitUsd: validatedLimit,
    },
    { upsert: true, new: true }
  );

  // Issue signed HTTP-only session cookie
  try {
    const cookieStore = cookies();
    const signedToken = signSessionPayload({
      xUserId: user.xUserId || `local_${cleanHandle.toLowerCase()}`,
      xHandle: cleanHandle.toLowerCase(),
      nearAccountId: user.nearAccountId,
      avatarUrl: user.avatarUrl,
    });

    cookieStore.set("veilx_session", signedToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30, // 30 days
    });
  } catch (cookieErr) { ... }
  ```
- **Vulnerability Mechanics & Exploit Scenario:**
  1. An attacker sends a `POST` request to `/api/user` with:
     ```json
     {
       "xHandle": "target_victim",
       "nearAccountId": "attacker_wallet.veilx-agent.testnet",
       "spendingLimitUsd": 1000
     }
     ```
  2. Because the attacker sends **no `veilx_session` cookie**, `sessionUser` evaluates to `null`.
  3. The conditional guard `if (sessionUser && ...)` evaluates to `false` and is bypassed!
  4. The database updates the target victim's record, changing their `nearAccountId` to the attacker's wallet.
  5. The API generates a signed HMAC `veilx_session` token for `@target_victim` and sets it in the response cookie!
  6. The attacker now possesses a fully authentic session cookie for `@target_victim` and can immediately call `/api/relay/claim`, `/api/evm/send-mpc`, `/api/near/withdraw`, or access private portfolio records as the victim.
- **Impact:** Complete account takeover, unauthorized claim of escrowed funds, and full identity impersonation across all VeilX services.
- **Recommended Remediation:**
  1. Disallow session cookie issuance in `/api/user`. Only the official OAuth callback (`/api/auth/callback/twitter`) should issue `veilx_session` cookies upon validated Twitter PKCE exchange.
  2. Require valid session authentication on `POST /api/user`:
     ```typescript
     if (!sessionUser) {
       return NextResponse.json({ error: "Unauthorized: Active session required" }, { status: 401 });
     }
     if (sessionUser.xHandle.toLowerCase() !== cleanHandle.toLowerCase()) {
       return NextResponse.json({ error: "Forbidden: Cannot modify other user accounts" }, { status: 403 });
     }
     ```

---

### [SEC-002] [High] Spending Cap Bypass in Primary Non-Custodial EVM Signing Pipeline
- **Finding ID:** SEC-002
- **Severity:** HIGH
- **Status:** Verified Existing Flaw
- **Affected Files:**
  - `src/app/api/evm/prepare-tx/route.ts` (lines 52-242)
  - `src/app/api/evm/broadcast-tx/route.ts` (lines 19-94)
  - `src/lib/near-client-signer.ts` (lines 98-202)
- **Direct Code Evidence:**
  In `src/app/api/evm/prepare-tx/route.ts`:
  ```typescript
  // lines 52-89: Verifies session cookie and checks 0x recipientAddress,
  // but NEVER queries MongoDB User model for spendingLimitUsd or spentUsd!
  ```
  In `src/app/api/evm/broadcast-tx/route.ts`:
  ```typescript
  // lines 20-35: Verifies session cookie, serializes signed transaction, broadcasts to Base RPC,
  // but NEVER updates userDoc.spentUsd or verifies spendingLimitUsd!
  ```
- **Analysis:**
  While `src/app/api/evm/send-mpc/route.ts` contains spending cap validation (lines 64-75), the primary non-custodial signing architecture implemented in `src/lib/near-client-signer.ts` bypasses `send-mpc` completely. It delegates transaction preparation to `/api/evm/prepare-tx` and broadcasting to `/api/evm/broadcast-tx`. Neither endpoint validates the spending cap or increments accumulated spend in the database.
- **Impact:** Users and automated agent scripts can execute unlimited outbound EVM transfers beyond their configured spending limit ($50.00 default).
- **Recommended Remediation:**
  1. In `src/app/api/evm/prepare-tx/route.ts`: Fetch `userDoc` from MongoDB and verify `transferAmountUsd <= (userDoc.spendingLimitUsd - userDoc.spentUsd)`. Reject with HTTP 403 if cap exceeded.
  2. In `src/app/api/evm/broadcast-tx/route.ts`: Upon successful RPC broadcast, atomically increment `userDoc.spentUsd` by the transferred USD amount.

---

### [SEC-003] [Medium] HMAC Session Tokens Lack Expiration Timestamp Validation
- **Finding ID:** SEC-003
- **Severity:** MEDIUM
- **Status:** Verified Existing Flaw
- **Affected File:** `src/lib/session.ts` (lines 18-38)
- **Direct Code Evidence:**
  ```typescript
  // src/lib/session.ts:18-37
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
        return envelope.payload; // No check for payload.exp or timestamp!
      }
      return null;
    } catch {
      return null;
    }
  }
  ```
- **Analysis:**
  The `verifySessionToken` function verifies the cryptographic signature of the JSON envelope, but never checks for an expiration field (`exp`). Although the cookie has a `maxAge` directive in the browser, an attacker who intercepts a session token (via logs, network proxy, or memory dump) can use the raw header `Cookie: veilx_session=<token>` indefinitely.
- **Impact:** Stolen session tokens never expire on the backend and cannot be invalidated without rotating the global `SESSION_SECRET`.
- **Recommended Remediation:**
  Include an `exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60)` timestamp in `signSessionPayload` and enforce `if (payload.exp && Date.now() / 1000 > payload.exp) return null;` in `verifySessionToken`.

---

### [SEC-004] [Medium] Plaintext Ed25519 Session Private Key Storage in `localStorage`
- **Finding ID:** SEC-004
- **Severity:** MEDIUM
- **Status:** Verified Existing Flaw
- **Affected File:** `src/lib/near-embedded-wallet.ts` (lines 54-63)
- **Direct Code Evidence:**
  ```typescript
  // src/lib/near-embedded-wallet.ts:59-61
  const key = getHandleStorageKey(handle);
  localStorage.setItem(key, JSON.stringify(session));
  localStorage.setItem(GLOBAL_STORAGE_KEY, JSON.stringify(session));
  ```
- **Analysis:**
  The embedded wallet generates a live cryptographic keypair (`nearAPI.KeyPair.fromRandom("ed25519")`) and writes the full secret key (`ed25519:...`) directly into browser `localStorage`. Any Cross-Site Scripting (XSS) vulnerability or browser extension with `cookies` or `tabs` access can read `localStorage` and exfiltrate the user's private key.
- **Impact:** Private key compromise in the event of an XSS vulnerability in any frontend dependency.
- **Recommended Remediation:**
  Wrap session private keys using the WebCrypto API (`window.crypto.subtle`) with AES-GCM encryption, using a derivation key tied to user interaction, or store keys in non-extractable IndexedDB crypto storage.

---

### [SEC-005] [Medium] Unauthenticated Public Invocation of Reconciliation Worker
- **Finding ID:** SEC-005
- **Severity:** MEDIUM
- **Status:** Verified Existing Flaw
- **Affected File:** `src/app/api/reconcile/route.ts` (lines 12-20)
- **Direct Code Evidence:**
  ```typescript
  // src/app/api/reconcile/route.ts:12-18
  export async function GET(req: Request) {
    return handleReconciliation(req);
  }

  export async function POST(req: Request) {
    return handleReconciliation(req);
  }
  ```
- **Analysis:**
  The reconciliation route performs heavy database writes and issues up to 25 synchronous external HTTP calls to `TESTNET_RPC` in a sequential loop. It contains zero authentication, rate limiting, or secret header requirements. Anyone can trigger this endpoint in an infinite loop from an external script.
- **Impact:** Server CPU exhaustion, database connection pool exhaustion, and FastNear RPC rate-limiting/blacklisting.
- **Recommended Remediation:**
  Enforce a bearer token check: `if (req.headers.get("Authorization") !== `Bearer ${process.env.CRON_SECRET}`) return new Response("Unauthorized", { status: 401 });`.

---

## 4. User Safety & Financial Guardrail Analysis

### 4.1 3-Tier Budget System & Emergency Freeze
In `src/lib/near-embedded-wallet.ts` (lines 94-135, 153-167):
- **Per-Transaction Ceiling:** Enforces `perTxLimitUsd` (default $15.00).
- **Daily Outflow Budget:** Enforces `dailyLimitUsd` (default $50.00).
- **Weekly Trading Ceiling:** Enforces `weeklyLimitUsd` (default $200.00).
- **Emergency Freeze Switch:** `freezeAgentSession()` sets `isFrozen = true`, blocking all agent actions.
- **Verdict:** **Well-engineered client-side guardrails.** Needs matching server-side synchronization (as highlighted in `SEC-002`).

### 4.2 Reversibility Warnings & Confirmation Cards
- All on-chain transfers and trade executions in the Terminal require an explicit interactive co-signature card before execution.
- Prominent UI badges clearly notify users that blockchain transactions are irreversible.

---

## 5. Security Recommendations Summary

| Priority | ID | Component | Remediation Action |
| :---: | :---: | :--- | :--- |
| **P0** | **SEC-001** | `src/app/api/user/route.ts` | Remove session issuance from `POST /api/user`; require existing authenticated session to update user account data. |
| **P0** | **SEC-002** | `src/app/api/evm/prepare-tx` & `broadcast-tx` | Add server-side spending cap checks and spent USD recording to non-custodial EVM signing endpoints. |
| **P1** | **SEC-003** | `src/lib/session.ts` | Add expiration timestamp (`exp`) validation in HMAC session tokens. |
| **P1** | **SEC-004** | `src/lib/near-embedded-wallet.ts` | Encrypt Ed25519 private keys using WebCrypto AES-GCM before writing to storage. |
| **P1** | **SEC-005** | `src/app/api/reconcile/route.ts` | Restrict background worker endpoint with `CRON_SECRET` authentication header. |
