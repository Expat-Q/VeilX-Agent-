# VEILX AGENT — ARCHITECTURAL AND DATA DECISIONS BLUEPRINT

**Document Version:** 1.0.0  
**Status:** DRAFT — AWAITING USER APPROVAL (PLANNING ONLY)  
**Date:** November 2, 2026

---

## 1. STRATEGIC ARCHITECTURAL DECISIONS REQUIRING USER APPROVAL

Before Phase 1 implementation begins, the lead engineer and product owner must formally decide on the following four core architectural dilemmas:

### Decision 1: Client-Side NEP-366 Signing vs. Relayer Sponsoring
- **Current State:** The client transmits its unencrypted Ed25519 `senderPrivateKey` over HTTP to `/api/near/send-tip`. The server constructs and broadcasts the NEAR transaction.
- **Option A (Architecturally Pure Non-Custodial — Recommended)**:
  - Client constructs and signs the NEAR transaction locally in the browser using `@near-js/transactions`.
  - Client transmits only the signed binary transaction to `/api/near/broadcast` or directly to NEAR RPC.
  - Server never receives or handles private keys.
  - *Trade-off*: Requires client-side transaction serialization; complete zero-knowledge security.
- **Option B (Meta-Transaction Delegated Relayer)**:
  - User signs an off-chain payload authorizing the transfer.
  - Relayer calls an escrow or agent contract using its own key, attaching the user's signature.
  - *Trade-off*: Requires smart contract meta-transaction verification support.
- **Recommendation**: **Adopt Option A**. Move transaction creation into `src/lib/near-embedded-wallet.ts` in the browser, eliminating private key transmission over HTTP.

---

### Decision 2: Telegram Bot Identity Architecture
- **Current State:** All Telegram users share `DEFAULT_NEAR_ACCOUNT` (`veilx-agent.testnet`).
- **Option A (Strict WebApp Linking Mandatory)**:
  - A user cannot tip or check `/evm` until they link their Telegram account by clicking an auth link opening the VeilX WebApp.
  - *Trade-off*: Higher friction on Telegram, but 100% unified identity with Twitter.
- **Option B (Hybrid: Auto-Provisioned Telegram Subaccounts + Optional 𝕏 Linking — Recommended)**:
  - If unlinked, Telegram user `123456` is automatically provisioned a personal subaccount: `tg_123456.veilx-agent.testnet`.
  - They can receive tips, create invoices, and check their own derived Base EVM address immediately.
  - They can type `/link` anytime to merge their Telegram subaccount into their primary 𝕏 handle.
  - *Trade-off*: Zero friction; complete account isolation for every Telegram user.
- **Recommendation**: **Adopt Option B**. Gives Telegram users instant utility while preventing fund collisions.

---

### Decision 3: Cross-Chain 1Click Solvers: Testnet vs. Mainnet Strategy
- **Current State:** App attempts to call `https://1click.chaindefuser.com/v0/quote` with testnet addresses; Defuse Solvers only operate with real capital on Mainnet, causing cross-chain quote rejections on testnet.
- **Option A (Show Direct NEAR Settlement on Testnet + Document 1Click for Mainnet — Recommended)**:
  - On Testnet, direct NEAR native transfers and NEAR Chain Signatures MPC (`v1.signer-prod.testnet`) provide authentic on-chain settlement.
  - The 1Click Solver Intent Card remains on the PayLink page with a prominent *"Mainnet Ready via Defuse Protocol"* judge badge explaining that solver networks operate on mainnet reserves.
- **Option B (Simulated Testnet Solver Mock)**:
  - Build a backend mock simulating a solver fulfilling the testnet deposit.
  - *Trade-off*: Dishonest simulation; risks auditor disapproval.
- **Recommendation**: **Adopt Option A**. Be 100% honest and transparent with judges: direct on-chain execution on NEAR Testnet and Base Sepolia MPC, with 1Click solvers configured for mainnet launch.

---

### Decision 4: Spending Cap Default & Server Enforcement
- **Current State:** Default $50.00 USD/day, evaluated only in client `localStorage`.
- **Decision Required**:
  - Keep $50 default or lower to $20 for public testnet?
  - Enforce server-side check in `/api/near/send-tip` via atomic MongoDB operator:
    `{ $expr: { $lte: [{ $add: ["$spentUsd", amount] }, "$spendingLimitUsd"] } }`.
- **Recommendation**: Set default to **$50.00 USD**, enforce atomically on the backend, and reset daily at 00:00 UTC.

---

## 2. CANONICAL DATA MODELS ACROSS ALL SUBSYSTEMS

To prevent data drift and representation mismatches, all layers must conform to the following canonical structures:

```
+----------------------------------------------------------------------------------------------------+
|                                    CANONICAL USER MODEL                                            |
|                                                                                                    |
|  TypeScript Client Interface                MongoDB Schema (users)                                 |
|  • xHandle: string (lowercase, no @)   <->  • xHandle: { type: String, unique: true, index: true } |
|  • nearAccountId: string               <->  • nearAccountId: { type: String, index: true }        |
|  • spendingLimitUsd: number            <->  • spendingLimitUsd: { type: Number, default: 50.0 }    |
|  • spentUsd: number                    <->  • spentUsd: { type: Number, default: 0.0 }            |
|  • xUserId: string (immutable numeric) <->  • xUserId: { type: String, sparse: true, index: true } |
+----------------------------------------------------------------------------------------------------+
```

```
+----------------------------------------------------------------------------------------------------+
|                                  CANONICAL ESCROW TIP MODEL                                        |
|                                                                                                    |
|  Smart Contract (TipRecord)                 MongoDB Schema (escrowtips)                            |
|  • tip_id: String                      <->  • tipId: { type: String, unique: true, index: true }   |
|  • sender: AccountId                   <->  • senderWallet: { type: String, required: true }      |
|  • recipient_handle: String            <->  • recipientHandle: { type: String, index: true }       |
|  • token_id: AccountId                 <->  • asset: { type: String, default: "NEAR" }             |
|  • amount: U128 (yoctoNEAR)            <->  • amountNear: { type: Number, required: true }         |
|  • claimed: bool                       <->  • status: "pending" | "claiming" | "claimed"          |
+----------------------------------------------------------------------------------------------------+
```

---

## 3. UNIFIED TRANSACTION & SETTLEMENT LIFECYCLE

```
[OUTFLOW SOCIAL TIP LIFECYCLE]
(User Chat Intent) 
       │
       ▼
[Confirm Card] ──(User Clicks)──► [Client Signs Tx] ──► [Broadcast to veilx-agent.testnet]
                                                                  │
       ┌──────────────────────────────────────────────────────────┴──────────────────────────┐
       │ (On-Chain Success)                                                                  │ (RPC Failure)
       ▼                                                                                     ▼
[EscrowTip: "pending"]                                                                 [Action Card: Failed]
       │
       ▼ (Recipient Claims via Relayer)
[EscrowTip: "claiming"] ──(claim_tip on-chain)──► [EscrowTip: "claimed"]
       │                                                 │
       │ (If On-Chain Reverts)                           ▼
       └────────────────────────► [EscrowTip: "pending"] (Auto-Unlocked after 5 min)
```

```
[PAYLINK INVOICE SETTLEMENT LIFECYCLE]
(Invoice Created) ──► [PayLink: "active"]
                             │
       ┌─────────────────────┴─────────────────────┐
       │ (1-Click Agent Settle)                    │ (Direct Wallet Transfer)
       ▼                                           ▼
[Client Signs Transfer]                     [Meteor/MyNearWallet Sends NEAR]
       │                                           │
       ▼                                           ▼
[PATCH /api/paylinks]                       [Reconciliation Poller /api/reconcile]
       │                                           │
       └─────────────────────┬─────────────────────┘
                             │
                             ▼
               [RPC Receipt Status Verified]
                             │
                             ▼
                  [PayLink: "settled"]
                  • Inflow Tx Logged for Creator
                  • Outflow Tx Logged for Payer
                  • Confetti Bursts on Client
```

---

## 4. SHARED STATUS ENUMS SPECIFICATION

All files must import and use these exact string unions:

- **`TipStatus`**:
  `"broadcasting"` | `"pending"` | `"claiming"` | `"claimed"` | `"refunded"` | `"failed"`
- **`PayLinkStatus`**:
  `"active"` | `"settled"` | `"cancelled"`
- **`TransactionStatus`**:
  `"escrow_pending"` | `"claimed"` | `"settled_direct"` | `"completed"` | `"failed"`
- **`TransactionType`**:
  `"tip_sent"` | `"tip_received"` | `"invoice_received"` | `"tip_claimed"` | `"direct_deposit"` | `"withdrawal"` | `"faucet_claim"`
