# Web3 Security Audit Report: VeilX Autonomous Agent

**Project:** VeilX Agent  
**Date:** November 12, 2026  
**Auditor:** Senior Web3 Security Auditor  
**Audit Target Files:**
1. `src/lib/near-embedded-wallet.ts`
2. `src/app/api/near/revoke-key/route.ts`
3. `src/lib/ai-gateway.ts`

**Overall Audit Verdict:** **FAIL — Critical & High Vulnerabilities Identified**  
*The requirement of zero critical vulnerabilities was NOT met.* Several critical and high-severity issues were discovered spanning unauthenticated key revocation, relayer admin key destruction, client-side budget tampering, asset mispricing, and prompt injection vulnerabilities.

---

## Vulnerability Severity Matrix

| ID | Vulnerability Title | Severity | Target File | Impact |
| :--- | :--- | :---: | :--- | :--- |
| **SEC-01** | Unauthenticated Key Revocation & Relayer Admin Key Deletion | **CRITICAL** | `src/app/api/near/revoke-key/route.ts` | Complete unauthorized deletion of user subaccount keys and permanent lockout of relayer admin key |
| **SEC-02** | Cross-Chain Intent Asset Mispricing (1 BTC = $1.00 USD) | **HIGH** | `src/components/chat/ChatContainer.tsx` / `ai-gateway.ts` | High-value transfers bypass the $15 quarantine threshold and budget ceilings |
| **SEC-03** | Quarantine Bypass in `execute_cross_chain_intent` | **HIGH** | `src/components/chat/ChatContainer.tsx` | Quarantined transactions proceed without anomaly warnings or quarantine flags |
| **SEC-04** | Client-Side-Only Budget Enforcement & FullAccess Key Provisioning | **HIGH** | `src/lib/near-embedded-wallet.ts` / `near-utils.ts` | On-chain session keys have unrestricted `FullAccess` authority; budget limits in `localStorage` can be modified |
| **SEC-05** | Emergency Freeze Check Missing in Post-Card Execution Handlers | **MEDIUM** | `src/components/chat/ChatContainer.tsx` | Freezing the agent does not prevent execution of already-rendered action cards |
| **SEC-06** | Fail-Open on Missing Session & Missing Negative Amount Validation | **MEDIUM** | `src/lib/near-embedded-wallet.ts` | `validateSpendBudget` returns `allowed: true` when session is null or amounts are negative |
| **SEC-07** | False-Positive Success Responses on On-Chain Revocation Failures | **MEDIUM** | `src/app/api/near/revoke-key/route.ts` | Server returns HTTP 200 `{ success: true, onChainRevoked: false }` when deletion fails |
| **SEC-08** | Indirect Prompt Injection & Multi-Turn Context Smuggling | **MEDIUM** | `src/lib/ai-gateway.ts` | Follow-up prompts harvest unverified addresses/handles from prior conversation history |
| **SEC-09** | Unbounded Prompt Inputs & ReDoS Latency | **LOW** | `src/lib/ai-gateway.ts` | Processing arbitrarily large prompts through complex regexes without length bounds |

---

## Detailed Vulnerability Analysis

### 1. Key Revocation Logic (`src/app/api/near/revoke-key/route.ts`)

#### SEC-01: [CRITICAL] Unauthenticated Key Revocation & Relayer Admin Key Destruction
- **Location:** `src/app/api/near/revoke-key/route.ts:8-44`
- **Description:**  
  The endpoint accepts `POST` requests containing `{ accountId, publicKey }`. It performs **no authentication**, checks no session tokens, and validates no signatures.
  ```typescript
  export async function POST(req: NextRequest) {
    const body = await req.json();
    const { accountId, publicKey } = body;
    ...
    if (RELAYER_PRIVATE_KEY && accountId.endsWith(`.${RELAYER_ACCOUNT_ID}`)) {
      const provider = new nearAPI.JsonRpcProvider({ url: TESTNET_RPC });
      const keyPair = nearAPI.KeyPair.fromString(RELAYER_PRIVATE_KEY as any);
      const signer = new nearAPI.KeyPairSigner(keyPair);
      const account = new nearAPI.Account(accountId, provider, signer);
      await account.deleteKey(publicKey);
  ```
- **Exploitation Vectors:**
  1. **Unauthorized Key Revocation:** Any unauthenticated third party can revoke any user's active session key by sending their `accountId` and `publicKey`.
  2. **Relayer Admin Key Deletion (Permanent DoS):** In `near-utils.ts:119`, during subaccount creation, the relayer adds its own public key as a `FullAccessKey` on every subaccount. If an attacker passes `publicKey: <RELAYER_PUBLIC_KEY>`, the relayer signs a transaction to delete **its own key** from the victim's account. Once deleted, the platform permanently loses administrative access and cannot provision or recover keys for that subaccount.
- **Remediation:**
  - Authenticate callers using the HMAC session cookie (`verifySessionToken`).
  - Verify that the authenticated user owns `accountId`.
  - Strictly disallow deleting the relayer's admin public key.

#### SEC-07: [MEDIUM] False-Positive Success Responses on Revocation Failures
- **Location:** `src/app/api/near/revoke-key/route.ts:38-52`
- **Description:**  
  If `account.deleteKey(publicKey)` throws an error (e.g. network failure, RPC timeout, invalid key format, or nonce conflict), the catch block swallows the exception:
  ```typescript
  } catch (innerErr: any) {
    console.warn("[RevokeKey] Direct account.deleteKey did not succeed, key may already be absent:", innerErr.message);
  }
  ...
  return NextResponse.json({
    success: true,
    onChainRevoked: false,
    accountId,
    publicKey,
    message: "Session key revoked from local authority and backend profile",
  });
  ```
- **Impact:** The caller receives `success: true`. If the on-chain deletion failed due to a transient RPC outage, the user is deceived into believing their delegated session key has been revoked on-chain when it remains fully active.

---

### 2. Budget Enforcement & Key Scoping (`src/lib/near-embedded-wallet.ts`)

#### SEC-04: [HIGH] Client-Side-Only Budget Storage & Protocol-Level FullAccess Key Provisioning
- **Locations:**
  - `src/lib/near-embedded-wallet.ts:36-67`
  - `src/lib/near-embedded-wallet.ts:254-270`
  - `src/lib/near-utils.ts:85-120`
- **Description:**  
  1. `near-embedded-wallet.ts` defines `createFunctionCallKeyAction()` to create protocol-level scoped keys (limiting methods and gas allowance). However, **this function is never invoked anywhere in the codebase**.
  2. Instead, `near-utils.ts:118` provisions the user's session key as `nearAPI.actions.addFullAccessKey(userKey)`.
  3. Budget limits (daily limit, weekly limit, per-tx limit) and the `isFrozen` flag are stored in browser `localStorage`.
- **Impact:** The NEAR blockchain does not enforce the budget. The session key has unrestricted protocol-level authority to transfer raw NEAR, delete keys, and execute arbitrary contracts. If `localStorage` is modified or the client application is compromised via XSS, the session key can drain all funds up to the account's on-chain balance.

#### SEC-06: [MEDIUM] Fail-Open Missing Session & Negative Amount Bypass in `validateSpendBudget`
- **Location:** `src/lib/near-embedded-wallet.ts:99-148`
- **Description:**
  ```typescript
  export function validateSpendBudget(amountUsd: number, handle?: string) {
    const session = getStoredAgentSession(handle);
    if (!session) return { allowed: true }; // VULNERABILITY 1: Fail open
    ...
    if (currentSpent + amountUsd > dailyMax) { ... } // VULNERABILITY 2: Negative amount bypass
  ```
  1. **Fail-Open:** If `session` is missing or `localStorage` fails to read, the function returns `{ allowed: true }` without enforcing any limits.
  2. **Negative Amounts:** If `amountUsd <= 0` or `NaN`, comparisons against `dailyMax`, `weeklyMax`, and `perTxMax` return `false`. The function returns `{ allowed: true }`. When passed to `recordAgentSpend(amountUsd)`, it subtracts from the accumulated spent total.
- **Remediation:** Validate that `typeof amountUsd === "number" && !isNaN(amountUsd) && amountUsd > 0`. If `session` is null, fail closed with `{ allowed: false, error: "Session uninitialized" }`.

#### SEC-05: [MEDIUM] Emergency Freeze Check Missing in Post-Card Execution Handlers
- **Locations:**
  - `src/components/chat/ChatContainer.tsx:481-540` (`handleConfirmTip`)
  - `src/components/chat/ChatContainer.tsx:850-870` (`handleConfirmDirectTransfer`)
  - `src/components/chat/ChatContainer.tsx:1076-1095` (`handleExecuteIntent`)
- **Description:**  
  `session.isFrozen` is only evaluated when a prompt is initially processed to generate the Action Card. When the user clicks the "Confirm" button on the Action Card, the execution handlers do not check `activeSession.isFrozen`. If an emergency freeze is triggered after a card has been generated, the pending transaction can still be confirmed and broadcast on-chain.

---

### 3. Anomaly Quarantine & AI Gateway (`src/lib/ai-gateway.ts` & `ChatContainer.tsx`)

#### SEC-02: [HIGH] Non-NEAR / Non-USD Token Valuation Flaw in Cross-Chain Intents
- **Location:** `src/components/chat/ChatContainer.tsx:2119-2121`
- **Description:**
  ```typescript
  const transferUsdEstimate = targetAsset === "NEAR"
    ? Number((targetAmount * oraclePrices.near).toFixed(2))
    : targetAmount;
  ```
  If a user specifies a cross-chain transfer of a high-value asset (e.g., *"Send 1 BTC to @alice"* or *"Send 2 SOL to @bob"*), `targetAsset !== "NEAR"`, so `transferUsdEstimate` is set directly to `targetAmount` (`1` or `2`).
  **1 BTC is valued as $1.00 USD, and 2 SOL is valued as $2.00 USD.**
- **Impact:** Because $1.00 < $15.00, high-value transfers completely bypass the Per-Transaction Quarantine threshold ($15.00) and the daily spending budget ($50.00).

#### SEC-03: [HIGH] Quarantine Logic Bypass in `execute_cross_chain_intent`
- **Location:** `src/components/chat/ChatContainer.tsx:2123-2223`
- **Description:**
  ```typescript
  const budgetCheck = validateSpendBudget(transferUsdEstimate, user?.xHandle);
  if (!budgetCheck.allowed && !budgetCheck.isQuarantined) {
    appendMessage({ ... content: budgetCheck.error ... });
    return;
  }
  ```
  When `budgetCheck.isQuarantined` is `true`, execution does **not** stop. The subsequent card generation (`intentCardData`) does not set `isQuarantined: true`, does not set `quarantineReason`, and does not display an anomaly warning banner. The quarantined transfer is presented to the user as a normal, unflagged transaction.

#### SEC-08: [MEDIUM] Indirect Prompt Injection via Multi-Turn History Harvesting
- **Location:** `src/lib/ai-gateway.ts:50-80`
- **Description:**  
  The multi-turn context resolution scans the previous 4 to 6 messages in conversation history using unanchored regular expressions:
  ```typescript
  const handleMatch = recent.match(/@([a-zA-Z0-9_.-]+)/i);
  const crossMatch = recent.match(/(0x[a-fA-F0-9]{40})/i);
  const amountMatch = recent.match(/\$?(\d+(?:\.\d+)?)\s*(NEAR|USDC|ETH)?/i);
  ```
  If an untrusted memo, invoice description, or third-party message discussed in the chat contains `@attacker` and an amount, a user typing a short follow-up like *"from base"* or *"using base wallet"* will automatically construct a live transfer command to `@attacker`.

#### SEC-09: [LOW] Unbounded Input Lengths & ReDoS Latency Exposure
- **Location:** `src/lib/ai-gateway.ts:41-46`
- **Description:**  
  `processUserMessage(prompt)` accepts arbitrary input lengths without trimming (e.g. `prompt.slice(0, 1000)`). Unbounded input strings evaluated against multiple complex regular expressions (`crossChainIntentRegexA/B/C`, `dcaMatch`) create potential ReDoS latency and performance degradation.

---

## Actionable Remediation Checklist

### 1. Key Revocation Hardening (`src/app/api/near/revoke-key/route.ts`)
```typescript
// Proposed fix for src/app/api/near/revoke-key/route.ts
import { cookies } from "next/headers";
import { verifySessionToken } from "@/lib/session";

export async function POST(req: NextRequest) {
  try {
    const cookieStore = cookies();
    const sessionCookie = cookieStore.get("veilx_session")?.value;
    const sessionUser = sessionCookie ? verifySessionToken(sessionCookie) : null;
    if (!sessionUser?.xHandle) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { accountId, publicKey } = await req.json();
    if (!accountId || !publicKey) {
      return NextResponse.json({ error: "accountId and publicKey required" }, { status: 400 });
    }

    // Protect relayer admin key from deletion
    const relayerKeyPair = nearAPI.KeyPair.fromString(RELAYER_PRIVATE_KEY as any);
    if (publicKey === relayerKeyPair.getPublicKey().toString()) {
      return NextResponse.json({ error: "Cannot revoke relayer administrative key" }, { status: 403 });
    }

    // Ensure user owns account
    const expectedSubAccount = sanitizeNearAccountId(sessionUser.xHandle);
    if (accountId.toLowerCase() !== expectedSubAccount.toLowerCase()) {
      return NextResponse.json({ error: "Forbidden: Cannot revoke keys on another account" }, { status: 403 });
    }

    // Perform on-chain deletion and return 500 on failure
    const provider = new nearAPI.JsonRpcProvider({ url: TESTNET_RPC });
    const signer = new nearAPI.KeyPairSigner(relayerKeyPair);
    const account = new nearAPI.Account(accountId, provider, signer);
    await account.deleteKey(publicKey);

    return NextResponse.json({ success: true, onChainRevoked: true, accountId, publicKey });
  } catch (err: any) {
    return NextResponse.json({ error: err.message, onChainRevoked: false }, { status: 500 });
  }
}
```

### 2. Cross-Chain Intent Quarantine & Pricing Fix (`ChatContainer.tsx`)
```typescript
// Proposed fix for ChatContainer.tsx
const livePrice = await fetchMarketPrice(targetAsset);
const unitPriceUsd = livePrice?.priceUsd || (targetAsset === "NEAR" ? oraclePrices.near : 1.0);
const transferUsdEstimate = Number((targetAmount * unitPriceUsd).toFixed(2));

const budgetCheck = validateSpendBudget(transferUsdEstimate, user?.xHandle);
if (!budgetCheck.allowed) {
  if (budgetCheck.isQuarantined) {
    // Correctly flag intent as quarantined and display warning
    intentCardData.isQuarantined = true;
    intentCardData.quarantineReason = budgetCheck.error;
    appendMessage({
      id: `agent_${Date.now()}`,
      role: "assistant",
      content: `⚠️ **Anomaly Quarantine: Human Approval Required**\n\nThis cross-chain intent (~$${transferUsdEstimate.toFixed(2)} USD) exceeds your per-transaction limit ($${budgetCheck.perTxMax?.toFixed(2)}).`,
      actionCard: { type: "cross_chain_intent", data: intentCardData }
    });
    setIsProcessing(false);
    return;
  } else {
    appendMessage({ id: `agent_${Date.now()}`, role: "assistant", content: budgetCheck.error });
    setIsProcessing(false);
    return;
  }
}
```

### 3. Execution-Time Freeze & Budget Guard
In `handleConfirmTip`, `handleConfirmTransfer`, `handleConfirmDirectTransfer`, and `handleExecuteIntent`:
```typescript
const activeSession = getStoredAgentSession(user?.xHandle);
if (activeSession?.isFrozen) {
  throw new Error("Emergency Freeze Active: Transactions are currently halted.");
}
```

### 4. Input Bounding & AI Gateway Hardening (`src/lib/ai-gateway.ts`)
1. Bound prompt length at function entry:
   ```typescript
   export async function processUserMessage(prompt: string, ...) {
     const clean = (prompt || "").trim().slice(0, 2000);
     if (!clean) return { tool: "unknown", args: {}, assistantReply: "Please provide a command." };
   ```
2. Validate tool call arguments parsed from `callNearAICloud` using a Zod schema before returning to callers.

---

## Conclusion
While VeilX Agent incorporates a strong Defense-in-Depth Human-In-The-Loop (HITL) card confirmation architecture, critical vulnerabilities exist in on-chain key revocation, asset pricing, quarantine routing, and key scoping that must be patched before production mainnet deployment.
