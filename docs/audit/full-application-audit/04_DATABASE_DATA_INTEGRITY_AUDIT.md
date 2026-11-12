# 04 — DATABASE, DATA INTEGRITY & STATE CONSISTENCY AUDIT
**Project:** VeilX Autonomous Omnichain Social Finance & Tokenized Equities Terminal  
**Auditor:** Agent 4 — Database, Data Integrity & State Consistency Specialist  
**Status:** Audit Complete — Deep Line-by-Line Inspection  
**Date:** November 11, 2026  
**Target Repository:** `C:\Users\HomePC\Downloads\VeilX-Agent`  

---

## 📌 PLAIN-ENGLISH SUMMARY (READ THIS FIRST)

> **What is this document?**  
> This report looks at how VeilX saves your data in the database (MongoDB) and whether the numbers on the website match the real numbers on the blockchain.

### In Plain Terms: What are the Database Quirks & Fixes?
1. **The Server Crash After Claiming Tips (CRITICAL):**  
   * *The Problem:* When a user claims an escrow tip via `/api/near/claim-subaccount`, the smart contract transaction on NEAR succeeds! But right after that, the code tries to save a receipt to MongoDB using field names that don't match the database rules. The database rejects it and throws an error 500, making the user think their claim failed when it actually succeeded on-chain!
   * *How to Fix:* Fix the field names in the receipt saver so they match the `Transaction` schema.
2. **Escrow Status Misunderstanding ("locked" vs "pending"):**  
   * *The Problem:* When sending a tip, one file tags it as `status: "locked"`. But the file that looks for tips to claim only searches for `status: "pending"`. Because they use different words for the same thing, the claim screen can't find the tip.
   * *How to Fix:* Standardize the status name to `"pending"` across both files.
3. **Portfolios Overwriting Each Other (Race Conditions):**  
   * *The Problem:* When the background trading bot runs at the exact same second you click "Buy" on the website, both grab your portfolio, change it in computer memory, and save it back. Whoever saves second erases whatever the first one did.
   * *How to Fix:* Instead of saving the entire portfolio document all at once, tell MongoDB to make direct mathematical updates (like `db.collection.updateOne({ $inc: { cash: -10 } })`).

---

## 1. Executive Summary

This audit evaluates the persistence layer, data integrity, concurrency controls, schema definitions, and cross-state consistency between MongoDB, the Next.js API layer, client-side storage, and the NEAR / Base blockchains.

VeilX uses **MongoDB** connected via **Mongoose** (`src/lib/mongodb.ts`), maintaining **9 models** in `src/models/`: `User`, `Portfolio`, `PayLink`, `EscrowTip`, `Transaction`, `IntentOrder`, `ChatMessage`, `DisclosureProof`, and `TelegramChat`.

### Key Audit Findings:
1. **[CRITICAL] Fatal Mongoose Validation Crash in `POST /api/near/claim-subaccount`:** When an ephemeral stealth subaccount is provisioned and claimed, the route calls `Transaction.create()` passing keys (`tipId`, `senderHandle`, `amountNear`, `status: "success"`) that completely violate the `Transaction` schema (`userHandle` missing, `counterparty` missing, `amountUsd` missing, `status` enum violation). This causes an unhandled rejection, aborting the API response with HTTP 500 **after** the on-chain claim occurred ([DB-001](#db-001-critical-mongoose-validation-crash-on-transactioncreate-in-nearclaim-subaccountroutets)).
2. **[CRITICAL] State Machine & Field Mismatch Bricking Escrow Claims:** `src/app/api/near/send-tip/route.ts` creates escrow tips with `status: "locked"`, omitting required schema fields (`depositTxHash`, `amount`). However, `src/models/EscrowTip.ts` allows only `["broadcasting", "pending", "claiming", "claimed", "refunded", "failed"]`, while `/api/relay/claim` and `/api/near/pending-tips` query strictly for `{ status: "pending" }`. As a result, tips created via `send-tip` can never be queried or claimed ([DB-002](#db-002-critical-state-enum--schema-discrepancy-bricking-escrow-claims-escrowtip)).
3. **[HIGH] Non-Atomic Whole-Document Overwrites and Race Conditions on Portfolio State:** Both `/api/cron/evaluate-rules` and `/api/agent/cron-rebalance` fetch `Portfolio` documents, mutate nested arrays in Node.js memory, and call `port.save()`. Concurrent user trades via `POST /api/portfolio` overwrite background DCA/rebalance fills, causing lost orders and desynchronized balances ([DB-003](#db-003-high-non-atomic-whole-document-overwrites-and-race-conditions-on-portfolio-state)).
4. **[HIGH] Signer Identity Mismatch in Chain Signatures MPC Derivation:** In `POST /api/evm/send-mpc`, the target EVM address is derived using the user's subaccount ID (`user.veilx-agent.testnet`), but the MPC sign transaction is executed on-chain by the relayer contract (`veilx-agent.testnet`). In NEAR MPC, keys are derived from `(predecessor_id, path)`. The resulting signature corresponds to the relayer's derived address, NOT the user's subaccount address, causing EVM broadcast failure or funds spent from the wrong account ([DB-004](#db-004-high-additive-key-derivation-signer-mismatch-in-chain-signatures-mpc)).
5. **[MEDIUM] Missing TTL Index on Cryptographic Proofs (`DisclosureProof`):** `DisclosureProof` records lack an `expireAfterSeconds` index, causing dead verification commitments to persist indefinitely ([DB-005](#db-005-medium-missing-ttl-index-on-ephemeral-proof-records-disclosureproof)).

---

## 2. Collection & Schema Architecture Inventory

| Model | Schema File | Primary Key / Unique Indexes | Indexed Fields | Validation Strictness | Authoritative Source |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **User** | `src/models/User.ts` | `xUserId` (sparse, unique), `xHandle` (unique) | `nearAccountId` | Strict (`timestamps: true`, `bufferCommands: false`) | Twitter OAuth + MongoDB |
| **Portfolio** | `src/models/Portfolio.ts` | `handle` (unique) | `handle` | Loose (Arrays: `positions`, `rules`, `orderHistory`) | MongoDB + LocalStorage |
| **PayLink** | `src/models/PayLink.ts` | `slug` (unique) | `creatorHandle`, `status`, `createdAt` | Strict (`enum: ["active", "settled", "cancelled"]`) | NEAR / Base + MongoDB |
| **EscrowTip** | `src/models/EscrowTip.ts` | `tipId` (unique) | `senderHandle`, `recipientHandle`, `commitment`, `stealthSubaccountId`, `status`, `claimLockedAt` | Strict (`enum: ["broadcasting", "pending", "claiming", "claimed", "refunded", "failed"]`) | NEAR Escrow Contract |
| **Transaction** | `src/models/Transaction.ts` | `_id` | `userHandle`, `txHash`, `createdAt` | Strict (`type`, `status` enums, required fields) | Blockchain RPCs |
| **IntentOrder** | `src/models/IntentOrder.ts` | `orderId` (unique) | `depositAddress`, `senderHandle`, `status`, `expiresAt` (TTL: 86400s) | Strict (`enum: ["created", "deposited", "processing", "success", "refunded", "expired"]`) | Defuse 1Click Solver |
| **ChatMessage** | `src/models/ChatMessage.ts` | `_id` | `userHandle`, `channel`, `createdAt` | Moderate (`role: ["user", "assistant"]`) | MongoDB |
| **DisclosureProof** | `src/models/DisclosureProof.ts` | `proofId` (unique) | `proofId` | Moderate (`factType` enum; **No TTL Index**) | Cryptographic Attestation |
| **TelegramChat** | `src/models/TelegramChat.ts` | `chatId` (unique) | `updatedAt` (TTL: 86400s) | Strict (`_id: false` for nested messages) | Telegram Bot API |

---

## 3. Detailed Data Integrity & Concurrency Findings

---

### [DB-001] [CRITICAL] Mongoose Validation Crash on `Transaction.create()` in `near/claim-subaccount/route.ts`
- **Severity:** CRITICAL (CVSS 9.1)
- **Status:** Verified Existing Bug
- **Affected Model:** `Transaction` (`src/models/Transaction.ts`)
- **Affected Route:** `POST /api/near/claim-subaccount`
- **Affected File & Lines:** `src/app/api/near/claim-subaccount/route.ts` (lines 161–172)
- **Vulnerability Mechanics:**  
  In `near/claim-subaccount/route.ts`:
  ```typescript
  // src/app/api/near/claim-subaccount/route.ts:161-172
  await Transaction.create({
    tipId,
    txHash: claimTxHash,
    type: "tip_claim",
    senderHandle: lockedTip.senderHandle,
    recipientHandle: cleanHandle,
    recipientWallet: stealthSubaccountId,
    amount: lockedTip.amount,
    amountNear: lockedTip.amountNear,
    asset: lockedTip.asset,
    status: "success",
  });
  ```
  However, `src/models/Transaction.ts` defines:
  ```typescript
  // src/models/Transaction.ts:18-40
  const TransactionSchema = new Schema<ITransaction>(
    {
      userHandle: { type: String, required: true, index: true },
      txHash: { type: String },
      type: {
        type: String,
        enum: ["tip_sent", "tip_received", "invoice_received", "tip_claimed", "direct_deposit", "withdrawal", "faucet_claim"],
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
  ```
  The payload passed in `claim-subaccount` completely violates the schema:
  1. `userHandle` (required) is **missing**.
  2. `counterparty` (required) is **missing**.
  3. `amountUsd` (required) is **missing**.
  4. `statusLabel` (required) is **missing**.
  5. `isInflow` (required) is **missing**.
  6. `type: "tip_claim"` violates the enum (`"tip_claimed"` is the allowed value).
  7. `status: "success"` violates the enum (`"completed"` is the allowed value).
- **Impact:** Mongoose throws a `ValidationError`. This triggers the route's `catch` block (line 184), returning HTTP 500 `"Failed to provision stealth claim subaccount"` to the user. Because this error occurs **after** the on-chain relayer transaction (lines 131–141) and **after** `EscrowTip` is marked `claimed` in MongoDB (lines 148–159), the on-chain funds are claimed, but the user is presented with a fatal error and never receives the stealth subaccount keys or transaction confirmation.
- **Recommended Remediation:**
  Update `near/claim-subaccount/route.ts` to supply valid fields conforming to `TransactionSchema`:
  ```typescript
  await Transaction.create({
    userHandle: cleanHandle,
    txHash: claimTxHash,
    type: "tip_claimed",
    counterparty: lockedTip.senderHandle || "anonymous",
    amountUsd: Number((lockedTip.amountNear * liveNearPrice).toFixed(2)),
    asset: lockedTip.asset || "NEAR",
    status: "completed",
    statusLabel: "Stealth Tip Claimed",
    memo: `Claimed tip ${tipId} into stealth subaccount ${stealthSubaccountId}`,
    isInflow: true,
  });
  ```

---

### [DB-002] [CRITICAL] State Enum & Schema Discrepancy Bricking Escrow Claims (`EscrowTip`)
- **Severity:** CRITICAL (CVSS 8.9)
- **Status:** Verified Existing Bug
- **Affected Models:** `EscrowTip` (`src/models/EscrowTip.ts`)
- **Affected Routes:** `POST /api/near/send-tip`, `POST /api/relay/claim`, `GET /api/near/pending-tips`
- **Affected Files & Lines:**  
  - `src/app/api/near/send-tip/route.ts` (lines 138–152)  
  - `src/models/EscrowTip.ts` (lines 25–51)  
  - `src/app/api/relay/claim/route.ts` (lines 83–99)  
  - `src/app/api/near/pending-tips/route.ts` (lines 27–30)
- **Vulnerability Mechanics:**  
  In `send-tip/route.ts`:
  ```typescript
  // src/app/api/near/send-tip/route.ts:138-152
  await EscrowTip.create({
    tipId,
    senderHandle: isPrivate ? "shielded_patron" : ...,
    senderWallet: senderWallet || "unknown.testnet",
    recipientHandle: cleanHandle.toLowerCase(),
    recipientWallet: recipientNearAccount,
    amountNear: requestedNum,
    amountUsd: usdValue,
    asset,
    status: "locked",             // <--- Not in Schema enum!
    txHash,                       // <--- Schema expects depositTxHash!
    isPrivate,
    commitmentHash: commitment,   // <--- Schema expects commitment!
    privacySalt: salt,
  });
  ```
  However, in `src/models/EscrowTip.ts`:
  ```typescript
  // src/models/EscrowTip.ts:25-46
  const EscrowTipSchema = new Schema<IEscrowTip>({
    tipId: { type: String, required: true, unique: true, index: true },
    // ...
    amount: { type: Number, required: true },           // <--- Missing in send-tip!
    amountNear: { type: Number, required: true },
    depositTxHash: { type: String, required: true },   // <--- Missing in send-tip!
    commitment: { type: String, index: true },
    status: {
      type: String,
      enum: ["broadcasting", "pending", "claiming", "claimed", "refunded", "failed"],
      default: "pending",
      index: true,
    },
  ```
  Furthermore, the query in `/api/relay/claim` and `/api/near/pending-tips`:
  ```typescript
  // src/app/api/near/pending-tips/route.ts:27-30
  const pendingTips = await EscrowTip.find({
    recipientHandle: { $in: possibleHandles },
    status: "pending", // <--- Tips are saved as "locked"
  });
  ```
- **Impact:**
  1. `EscrowTip.create()` fails schema validation if strict validation is triggered.
  2. Even if persisted, the record has `status: "locked"`. It will never be returned by `/api/near/pending-tips` and will be rejected by `/api/relay/claim` with HTTP 404 "Tip not found or not eligible for claim". Escrow tips become unclaimable.
- **Recommended Remediation:**
  1. Align `send-tip/route.ts` with `EscrowTipSchema`:
  ```typescript
  await EscrowTip.create({
    tipId,
    senderHandle: ...,
    senderWallet: ...,
    recipientHandle: cleanHandle.toLowerCase(),
    recipientWallet: recipientNearAccount,
    amount: requestedNum,
    amountNear: requestedNum,
    asset,
    depositTxHash: txHash,
    status: "pending",
    isPrivate,
    commitment,
    privacySalt: salt,
  });
  ```

---

### [DB-003] [HIGH] Non-Atomic Whole-Document Overwrites and Race Conditions on Portfolio State
- **Severity:** HIGH (CVSS 7.8)
- **Status:** Verified Existing Vulnerability
- **Affected Model:** `Portfolio` (`src/models/Portfolio.ts`)
- **Affected Routes:** `GET /api/cron/evaluate-rules`, `GET /api/agent/cron-rebalance`, `POST /api/portfolio`
- **Affected Files & Lines:**  
  - `src/app/api/cron/evaluate-rules/route.ts` (lines 60–73)  
  - `src/app/api/agent/cron-rebalance/route.ts` (lines 54–59)  
  - `src/app/api/portfolio/route.ts` (lines 86–90)
- **Vulnerability Mechanics:**  
  In `cron/evaluate-rules`:
  ```typescript
  // src/app/api/cron/evaluate-rules/route.ts:60-72
  port.rules = result.updatedRules as any;
  port.positions = result.updatedPositions as any;
  port.paperCashUsd = result.updatedCash;
  const existingHistory = Array.isArray(port.orderHistory) ? port.orderHistory : [];
  port.orderHistory = [...result.executedOrders, ...existingHistory] as any;
  await port.save();
  ```
  Simultaneously, when a user executes a trade on the terminal UI, `POST /api/portfolio` performs:
  ```typescript
  // src/app/api/portfolio/route.ts:86-90
  const portfolio = await Portfolio.findOneAndUpdate(
    { handle },
    { $set: updateData },
    { new: true, upsert: true }
  );
  ```
  Where `updateData` contains the client's snapshot of `positions`, `rules`, and `paperCashUsd`.
- **Impact:** Read-modify-write race condition. If an automated DCA order executes in the background while the user submits an order from the UI, the UI's `$set` update clobbers the DCA fill from `orderHistory` and reverts the cash balance.
- **Recommended Remediation:** Use atomic MongoDB operations (`$inc` for cash, `$push` for `orderHistory`, and array filters for positions) rather than replacing entire arrays.

---

### [DB-004] [HIGH] Additive Key Derivation Signer Mismatch in Chain Signatures MPC
- **Severity:** HIGH (CVSS 7.5)
- **Status:** Verified Existing Flaw
- **Affected Route:** `POST /api/evm/send-mpc`
- **Affected Files & Lines:**  
  - `src/app/api/evm/send-mpc/route.ts` (lines 77–100)  
  - `src/lib/near-chain-signatures.ts` (lines 279, 434–436)
- **Vulnerability Mechanics:**  
  In `evm/send-mpc/route.ts`:
  ```typescript
  // src/app/api/evm/send-mpc/route.ts:77, 93-100
  const userSenderId = senderNearAccountId || userDoc?.nearAccountId || CONTRACT_ID;
  // ...
  const result = await createAndSignBaseTransaction({
    nearAccount, // Initialized with CONTRACT_ID ("veilx-agent.testnet")
    senderNearAccountId: userSenderId, // E.g. "user.veilx-agent.testnet"
    // ...
  ```
  In `src/lib/near-chain-signatures.ts`:
  ```typescript
  // src/lib/near-chain-signatures.ts:279
  const { checksumAddress } = deriveEvmAddress(params.senderNearAccountId, derivationPath);
  // ...
  // src/lib/near-chain-signatures.ts:436
  signature = await requestMpcSignature(params.nearAccount, derivationPath, txHashBytes);
  ```
  In NEAR Chain Signatures MPC (`v1.signer-prod.testnet`), the `sign` method derives the private key using:
  $$\text{Signer} = \text{predecessor\_id (caller of sign)} + \text{path}$$
  Because `params.nearAccount` is `CONTRACT_ID` (`veilx-agent.testnet`), the signature generated by MPC is for:
  $$\text{EVM Address}(\text{"veilx-agent.testnet"}, \text{path})$$
  However, the transaction was constructed with:
  $$\text{from} = \text{EVM Address}(\text{userSenderId}, \text{path})$$
  When serialized and broadcast to Base RPC, the transaction's ECDSA recovery ($r, s, v$) resolves to the relayer's EVM address, causing an on-chain nonce error or signing from the relayer's account.
- **Impact:** Omnichain EVM transactions executed via MPC fail on-chain or recover the wrong sender address.
- **Recommended Remediation:** Either the user must sign the NEAR `sign` call from their own account using their access key, or the system must explicitly document that MPC accounts belong to `CONTRACT_ID` with sub-paths (e.g. `ethereum,user_id`).

---

### [DB-005] [MEDIUM] Missing TTL Index on Ephemeral Proof Records (`DisclosureProof`)
- **Severity:** MEDIUM (CVSS 5.3)
- **Status:** Verified Existing Deficiency
- **Affected Model:** `DisclosureProof` (`src/models/DisclosureProof.ts`)
- **Affected File & Lines:** `src/models/DisclosureProof.ts` (lines 10–32)
- **Description:**  
  Selective disclosure proofs have an `expiresAt` field, but it is stored as a numeric Unix timestamp:
  ```typescript
  // src/models/DisclosureProof.ts:27
  expiresAt: { type: Number, required: true },
  ```
  MongoDB TTL indexes require BSON Date types. There is no TTL index on either `expiresAt` or `createdAt`.
- **Impact:** Expired zero-knowledge viewing commitments remain permanently in the database, resulting in unnecessary storage accumulation.
- **Recommended Remediation:** Add a Date field `expireAt: { type: Date, expires: 0 }` or add an index on `createdAt`:
  ```typescript
  DisclosureProofSchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 86400 });
  ```

---

### [DB-006] [MEDIUM] Unbounded Document Growth on In-Document History Arrays
- **Severity:** MEDIUM (CVSS 5.3)
- **Status:** Verified Existing Risk
- **Affected Models:** `Portfolio` (`src/models/Portfolio.ts`), `TelegramChat` (`src/models/TelegramChat.ts`)
- **Affected Files & Lines:**  
  - `src/models/Portfolio.ts` (lines 97–138)  
  - `src/models/TelegramChat.ts` (lines 26–32)
- **Description:**  
  `Portfolio.orderHistory` and `TelegramChat.history` embed full transaction orders and messages directly inside the parent document. While `Portfolio.decisionHistory` is capped at 40 items in `agent/cron-rebalance` (`.slice(0, 40)`), `orderHistory` has no cap and continues to grow with every DCA order.
- **Impact:** Over thousands of automated 1-minute DCA executions, the document size risks approaching MongoDB's 16MB BSON limit, degrading read/write latency.
- **Recommended Remediation:** Cap `orderHistory` in the document (e.g. `$slice: -100`) and store historical orders in the standalone `Transaction` collection.

---

### [DB-007] [LOW] Inconsistent Network Preference Synchronization
- **Severity:** LOW (CVSS 3.1)
- **Status:** Verified Existing Inconsistency
- **Affected Feature:** Testnet vs Mainnet Mode Persistence
- **Affected Files:** `src/models/User.ts`, `src/context/AuthContext.tsx`
- **Description:**  
  When a user toggles between Testnet and Mainnet in the top navigation, the preference is saved solely in browser `localStorage ("veilx_network_mode")`. It is never persisted in `src/models/User.ts`.
- **Impact:** Inconsistent user experience when accessing the application across different devices or browsers.
- **Recommended Remediation:** Add `preferredNetwork: { type: String, enum: ["testnet", "mainnet"], default: "testnet" }` to `User.ts`.

---

## 4. Cross-System Reconciliation Matrix

| Workflow | Local Cache | MongoDB Collection | On-Chain State | Reconciler / Recovery Path |
| :--- | :--- | :--- | :--- | :--- |
| **Social Tip Deposit** | Optimistic toast | `EscrowTip` (`status: "pending"`) | Contract `deposit_tip` | `/api/reconcile` polls `get_tip` on-chain |
| **Stealth Tip Claim** | Keypair in memory | `EscrowTip` (`status: "claimed"`) | Contract `claim_tip` | Gasless relayer tx + on-chain receipt |
| **Universal PayLink** | Form cache | `PayLink` (`status: "active"`) | Deterministic address | Settlement webhook / `/api/paylinks` PATCH |
| **DCA Rule Execution** | UI state reload | `Portfolio.rules` + `orderHistory` | Virtual paper / 1Click | `/api/cron/evaluate-rules` heartbeat |
| **Autonomous Rebalance** | Portfolio sync | `Portfolio.decisionHistory` | Virtual paper / 1Click | `/api/agent/cron-rebalance` cron runner |
