# VEILX AGENT — BACKEND API & DATABASE REMEDIATION PLAN

**Document Version:** 1.0.0  
**Status:** DRAFT — AWAITING USER APPROVAL (PLANNING ONLY)  
**Date:** November 2, 2026  
**Target:** Next.js Route Handlers (`src/app/api/`), Database Models (`src/models/`), and Middleware

---

## 1. BACKEND API ENDPOINT REMEDIATION PROGRAM

```
+----------------------------------------------------------------------------------------------------+
|                                    BACKEND API SECURITY ARCHITECTURE                              |
|                                                                                                    |
|  [Incoming HTTP Request]                                                                           |
|          │                                                                                         |
|          ▼                                                                                         |
|  [Security Middleware] ──► 1. Rate Limiting (Redis / MongoDB TTL) [TASK-BACK-03]                  |
|          │                 2. HMAC Session Validation (verifySessionToken) [TASK-SEC-01]          |
|          │                 3. Zod Request Body Validation                                          |
|          ▼                                                                                         |
|  [Route Handlers]                                                                                  |
|  ├── POST /api/user ────────► Validates active 𝕏 OAuth PKCE or Key Nonce [TASK-SEC-02]            |
|  ├── POST /api/near/send-tip ► Enforces server-side spending cap & atomic inc [TASK-BACK-01]      |
|  │                           Broadcasts client-signed binary transaction [TASK-SEC-05]            |
|  ├── PATCH /api/paylinks ───► Verifies on-chain NEAR RPC receipt status [TASK-SEC-03]             |
|  ├── POST /api/relay/claim ─► Auto-expires locks older than 5 minutes [TASK-BACK-02]              |
|  └── POST /api/transactions ► Enforces session authentication & RPC hash check [TASK-SEC-06]      |
|          │                                                                                         |
|          ▼                                                                                         |
|  [MongoDB Atlas Collections]                                                                       |
|  • users  • escrowtips  • paylinks  • transactions  • telegram_users [TASK-TG-02]                  |
+----------------------------------------------------------------------------------------------------+
```

---

## 2. DETAILED ENDPOINT FIX SPECIFICATIONS

### 2.1 Fix Specification: `PATCH /api/paylinks` On-Chain Verification (`TASK-SEC-03`)
- **Current Behavior:** Unverified update of `status = "settled"`.
- **Target Implementation:**
  ```ts
  // Verify on-chain execution status before marking settled
  const provider = new nearAPI.JsonRpcProvider({ url: TESTNET_RPC });
  const txOutcome = await provider.txStatus(settledTx, payerWallet || updated.recipientNearAccount);

  const isSuccess = typeof (txOutcome.status as any).SuccessValue === "string";
  if (!isSuccess) {
    return NextResponse.json({ error: "On-chain transaction execution failed or not finalized" }, { status: 400 });
  }

  // Verify recipient account received the transfer
  const receiverMatches = txOutcome.transaction.receiver_id === updated.recipientNearAccount;
  if (!receiverMatches) {
    return NextResponse.json({ error: "On-chain transaction receiver does not match invoice recipient" }, { status: 400 });
  }
  ```

### 2.2 Fix Specification: `POST /api/near/send-tip` Server Spending Cap (`TASK-BACK-01`)
- **Target Implementation:**
  ```ts
  // Atomic server-side spending cap check and increment
  const updatedUser = await User.findOneAndUpdate(
    {
      xHandle: cleanSenderHandle,
      $expr: {
        $lte: [{ $add: ["$spentUsd", usdValue] }, "$spendingLimitUsd"]
      }
    },
    { $inc: { spentUsd: usdValue } },
    { new: true }
  );

  if (!updatedUser) {
    return NextResponse.json(
      { error: `Spending limit exceeded. Available cap: $${Math.max(0, user.spendingLimitUsd - user.spentUsd).toFixed(2)}` },
      { status: 403 }
    );
  }
  ```

---

## 3. DATABASE SCHEMA IMPROVEMENTS & DATA INTEGRITY

### 3.1 Migration Strategy & Safe Execution
1. **Pre-Migration Backup**:
   Execute `mongodump --uri="$MONGODB_URI" --out="./backup_$(date +%Y%m%d)"` to capture complete collection state prior to running schema migrations.
2. **Compound Index Creation**:
   Ensure MongoDB Atlas creates compound indexes in the background (`background: true`):
   - `transactions`: `{ userHandle: 1, createdAt: -1 }`
   - `paylinks`: `{ creatorHandle: 1, status: 1 }`
   - `escrowtips`: `{ recipientHandle: 1, status: 1 }`
   - `telegram_users`: `{ telegramUserId: 1, xHandle: 1 }` (unique)
3. **Rollback Strategy**:
   If index creation causes lock contention, drop created index with `db.collection.dropIndex()`.

---

## 4. FINANCIAL DATA RECONCILIATION ENGINE

Create a lightweight background reconciliation poller (`src/app/api/reconcile/route.ts`):
- **Schedule**: Every 60 seconds (or triggered on dashboard refresh).
- **Tasks**:
  1. **Unlock Stuck Claims**: Set `status = "pending"` for any tip where `status === "claiming"` and `claimLockedAt < Date.now() - 5 minutes`.
  2. **Verify Pending PayLinks**: Inspect active invoices; query NEAR RPC for incoming transfers to `recipientNearAccount` matching the amount; mark `settled` if on-chain proof exists.
  3. **Purge Failed Broadcasts**: Set `status = "failed"` for tips stuck in `"broadcasting"` for $> 10$ minutes.
