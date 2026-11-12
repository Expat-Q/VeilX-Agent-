# VEILX AGENT — NEAR INTENTS & DEFUSE PROTOCOL RESEARCH REPORT

**Document Version:** 1.0.0  
**Status:** COMPLETE RESEARCH SPECIFICATION  
**Subject:** NEAR Intents, Defuse Protocol & 1Click Swap API Integration  
**Date:** November 2026  

---

## 1. UNDERSTANDING NEAR INTENTS & THE DEFUSE PROTOCOL

### 1.1 What Are NEAR Intents?
NEAR Intents is a declarative, cross-chain execution framework developed within the NEAR ecosystem (spearheaded by the Defuse Protocol and Proximity Labs). 

In conventional blockchain finance, transactions are **imperative**: the user must specify every discrete step:
1. Approve token allowance on Chain A.
2. Call bridge smart contract on Chain A.
3. Pay gas in native Chain A token.
4. Wait for bridge validator confirmations.
5. Claim wrapped asset on Chain B.
6. Swap wrapped asset on a Decentralized Exchange on Chain B.
7. Pay gas in native Chain B token.

In contrast, an **Intent-Based Architecture** is **declarative**: the user signs a cryptographically verifiable commitment specifying only the desired *end state*:
> *"I commit 5 NEAR on NEAR Testnet; I require 10 USDC to be credited to 0xAlice on Base."*

### 1.2 Architectural Components

```
+-----------------------------------------------------------------------------------------+
|                                    USER / CLIENT (VeilX)                                |
|  - Declares desired outcome (Asset In, Amount, Asset Out, Recipient)                     |
|  - Calls 1Click REST API or signs NEP-413 / ERC-7683 Intent Payload                     |
+-----------------------------------------------------------------------------------------+
                                             │
                       1. Request Quote      │      4. Deposit Source Asset
                                             ▼
+-----------------------------------------------------------------------------------------+
|                                 1CLICK INTENT GATEWAY                                   |
|  - Aggregates competing Market Makers (Solvers)                                         |
|  - Issues single-use, quote-specific deposit address                                    |
|  - Monitors lifecycle (PENDING -> PROCESSING -> SUCCESS / REFUNDED)                     |
+-----------------------------------------------------------------------------------------+
                       │                                             ▲
    2. Broadcast Intent│                                             │ 5. Fulfillment Proof
                       ▼                                             │
+---------------------------------------------+               +---------------------------+
|               SOLVER NETWORK                |               |   CROSS-CHAIN SETTLEMENT  |
|  - Independent market makers compete        |──────────────▶|  - Solver transfers asset |
|  - Provide immediate liquidity on dest chain|               |    to recipient on Base   |
|  - Underwrite execution speed & price risk  |               +---------------------------+
+---------------------------------------------+
```

1. **The User / Application (VeilX)**: Formulates the intent and submits it via REST or client SDK.
2. **The 1Click Gateway (`https://1click.chaindefuser.com`)**: Coordinates the intent auction among solvers and generates a **deterministic, single-use deposit address** for the user.
3. **The Solvers (Market Makers)**: Highly specialized off-chain actors with liquidity pools on multiple chains (Ethereum, Base, Arbitrum, Solana, Bitcoin, NEAR). They compete on execution speed, slippage, and fees.
4. **The Settlement & Verifier Contracts**: On-chain smart contracts (anchored on NEAR Protocol) that verify solver execution proofs and release deposited collateral to the solver.

---

## 2. VEILX AGENT USE CASES & USER JOURNEYS

### 2.1 Use Case 1: Cross-Chain Social Tipping ("Pay @alice 10 USDC")
**The Scenario**: A user chats with VeilX: *"Send 10 USDC to @alice on Base"*. The sender only has native NEAR in their VeilX balance.

#### Detailed Execution Path:
```
[User Chat] "Send 10 USDC to @alice on Base"
     │
     ▼
[AI Gateway] Extracts: { amount: 10, assetOut: "USDC", chainOut: "BASE", recipient: "@alice" }
     │
     ▼
[1Click API] POST /v0/quote:
     - assetIn: "nep141:wrap.testnet" (or native NEAR)
     - assetOut: "base:0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" (USDC on Base)
     - recipientAddress: Derived EVM address of @alice
     │
     ▼
[1Click Response] Returns:
     - depositAddress: "deposit_9831a...testnet"
     - amountIn: 2.331 NEAR
     - expiresAt: 1730621400 (60s validity)
     │
     ▼
[VeilX Agent] Prompts user with 1-Click Approval Card:
     "Send 2.331 NEAR to deliver 10.00 USDC to @alice on Base? (Fee: $0.04)"
     │
     ▼
[User Approves] Signs NEP-366 Transfer of 2.331 NEAR to depositAddress
     │
     ▼
[Solver Fulfills] Solver detects deposit on NEAR -> Instantly transfers 10.00 USDC to @alice on Base
     │
     ▼
[Status Radar] VeilX polls status -> Detects SUCCESS -> Displays BaseScan tx hash in chat
```

### 2.2 Use Case 2: Multi-Asset Invoice Settlement
* **Current Problem**: An invoice created by `@bob` requesting 50 USDC can only be paid by someone holding 50 USDC on Base.
* **With NEAR Intents**: The pay link (`/pay/[slug]`) accepts ANY asset:
  * Payer can deposit Solana SOL, Arbitrum ETH, Bitcoin, or NEAR.
  * 1Click routes the payer's asset to a solver who delivers the exact 50 USDC into Bob's recipient address.
  * Neither Bob nor the payer manages bridges or cross-chain gas.

### 2.3 Use Case 3: Autonomous AI Treasury Rebalancing
* VeilX Agent detects that the user's spending limit is exhausted on NEAR but has idle USDC on Base. The agent asks: *"You have $45 USDC on Base. Would you like me to move $20 to your NEAR gas account?"* A single confirmation triggers an intent that automatically funds their NEAR account.

---

## 3. INTEGRATION ARCHITECTURE FOR VEILX

### 3.1 Developer Interfaces & Tooling

1. **High-Level REST API (1Click Swap API)**:
   * **Base URL**: `https://1click.chaindefuser.com/v0`
   * **Endpoints**:
     * `POST /v0/quote`: Request multi-chain quote with input/output token definitions.
     * `GET /v0/status/{depositAddress}`: Real-time lifecycle status polling.
     * `GET /v0/tokens`: Comprehensive token registry with CAIP-19 chain and asset identifiers.
2. **TypeScript SDK (`@defuse-protocol/intents-sdk`)**:
   * Programmatic client for constructing, cryptographically signing, and broadcasting intents directly to the Defuse contract matrix.
3. **Machine Payments Protocol (MPP)**:
   * `@defuse-protocol/nearintents-mpp-sdk`: Enables micro-payment gating via intents.

### 3.2 Required Codebase Modifications

#### 1. Backend Service Expansion (`src/lib/1click.ts`)
Upgrade `1click.ts` from read-only quotes to an active transaction lifecycle orchestrator:
```typescript
export interface IntentOrderRequest {
  defuseAssetIn: string;   // e.g. "nep141:wrap.testnet"
  defuseAssetOut: string;  // e.g. "base:0x8335..."
  amountIn: string;        // Atomic units
  recipient: string;       // Destination 0x or NEAR address
  refundAddress: string;   // Sender address if intent fails
  referral?: string;       // VeilX referral fee account
}
```

#### 2. AI Tool Binding (`src/lib/ai-gateway.ts`)
Add `execute_cross_chain_intent` tool declaration to Gemini and deterministic regex parsers:
```typescript
{
  name: "execute_cross_chain_intent",
  description: "Execute a cross-chain swap or tip across NEAR, Base, Arbitrum, or Solana using NEAR Intents solvers",
  parameters: {
    type: "OBJECT",
    properties: {
      sourceAsset: { type: "STRING" },
      targetAsset: { type: "STRING" },
      amount: { type: "NUMBER" },
      destinationChain: { type: "STRING", enum: ["NEAR", "BASE", "ARBITRUM", "SOLANA", "ETHEREUM"] },
      recipientIdentifier: { type: "STRING" }
    },
    required: ["sourceAsset", "targetAsset", "amount", "destinationChain", "recipientIdentifier"]
  }
}
```

#### 3. Database Schema (`src/models/Transaction.ts` & `IntentOrder.ts`)
Create a specialized collection for intent lifecycle tracking:
* `intentId`, `depositAddress`, `sourceChain`, `destChain`, `sourceAmount`, `expectedOutputAmount`, `solverTxHash`, `status` (`pending` | `submitted` | `settled` | `refunded` | `expired`).

---

## 4. LIMITATIONS, RISKS & PROTOCOL TRADE-OFFS

| Risk Vector | Description | Severity | Mitigation in VeilX |
|---|---|---|---|
| **Quote Expiration** | Quotes typically expire in 30–60 seconds due to cross-chain market volatility. | Medium | Client-side countdown timer in chat bubble; auto-refresh quote if user delays clicking confirm. |
| **Solver Liquidity Shortage** | For rare token pairs or very large orders ($10k+), solvers may offer poor rates or fail to quote. | Low (for social tips) | Restrict default social tipping assets to blue-chips: NEAR, USDC, USDT, ETH, SOL. |
| **Deposit Underpayment** | User accidentally transfers fewer tokens than the exact quoted amount to the deposit address. | High | Enforce automated transaction building so the user never manually inputs the transfer amount. |
| **Settlement Delays** | Origin chain congestion (e.g. Ethereum gas spikes or Solana congestion) can delay solver confirmation. | Medium | StatusRadar visual polling component with real-time websocket/polling updates and clear timeout warnings. |
| **Solver Censorship / Non-Fulfillment** | Solver fails to deliver assets after receiving user deposit. | Critical | Built-in smart contract time-lock: if solver does not provide fulfillment proof within expiration window, user can claim automatic refund from the deposit address. |

---

## 5. STRATEGIC RECOMMENDATION

### Verdict: CATEGORY A (Integrate into Core Architecture)
NEAR Intents should become the **central cross-chain engine** of VeilX Agent.

### Why:
1. **Solves the Multi-Chain UX Bottleneck**: Eliminates the need for users to bridge funds or maintain native gas tokens across multiple blockchains.
2. **Superior to Conventional Bridges**: Faster settlement (solvers front capital), lower user risk (no long-term lockup in vulnerable bridge smart contracts), and programmatic fallback refunds.
3. **Perfect Synergy with AI Agents**: AI assistants naturally express declarative commands (*"Swap X for Y and send to Z"*). Intents match the exact cognitive model of an autonomous agent.
