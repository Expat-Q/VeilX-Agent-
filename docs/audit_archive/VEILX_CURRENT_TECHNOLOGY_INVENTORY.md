# VEILX AGENT — CURRENT TECHNOLOGY INVENTORY & IMPLEMENTATION AUDIT

**Document Version:** 1.0.0  
**Status:** COMPLETE CODEBASE INVENTORY  
**Date:** November 2026  
**Repository Working Directory:** `C:\Users\HomePC\Downloads\VeilX-Agent`  

---

## 1. INVENTORY METHODOLOGY

This inventory was generated through direct static code inspection, runtime test verification, and network tracing of the VeilX Agent codebase. No functionality has been assumed based on package names or environment variables alone; each subsystem was traced from user trigger through smart contract execution.

---

## 2. BLOCKCHAIN INFRASTRUCTURE

### 2.1 NEAR Protocol Integration
* **SDK / Library**: `near-api-js` version `^7.2.0` in `package.json`.
* **Network**: NEAR Testnet (`NEXT_PUBLIC_NEAR_NETWORK_ID="testnet"`).
* **Primary RPC Provider**: Configured with fallback rotation across:
  1. `https://rpc.testnet.near.org`
  2. `https://rpc.testnet.pagoda.co`
  * *Implementation Note*: Browser-side CORS restrictions on direct RPC calls are proxied through the internal Next.js API route `GET /api/near/account` ([`src/app/api/near/account/route.ts`](file:///C:/Users/HomePC/Downloads/VeilX-Agent/src/app/api/near/account/route.ts)).
* **Escrow Smart Contract**:
  * **Language & Framework**: Rust 2021 edition using `near-sdk` version `5.30.0` with `borsh` serialization ([`contracts/veilx-escrow/Cargo.toml`](file:///C:/Users/HomePC/Downloads/VeilX-Agent/contracts/veilx-escrow/Cargo.toml)).
  * **Deployed Contract Account**: `veilx-agent.testnet` on NEAR Testnet.
  * **Methods Implemented**:
    * `deposit_near(recipient_handle: String)`: Native NEAR deposit creating an escrow tip record.
    * `claim_tip(tip_id: u64, recipient_account: AccountId)`: Release of locked escrow funds to the verified claimant.
    * `near_resolve_claim(...)`: Atomic callback ensuring escrow state is reverted if native transfer fails.
    * `ft_on_transfer(...)`: Interface for receiving NEP-141 fungible tokens (USDC, USDT).
    * `prune_claimed_tip(tip_id: u64)`: Garbage collection to reclaim contract storage staking costs.
    * `get_tip(...)`, `get_tips_for_recipient(...)`, `get_escrow_stats(...)`: View methods.

### 2.2 Account Architecture & Session Keys
* **NEAR Account Model**:
  * Root Relayer & Escrow Account: `veilx-agent.testnet`.
  * User Accounts: Subaccount model derived from social handle (e.g. `expatq3.veilx-agent.testnet`) or user's connected external NEAR wallet (e.g. `user.testnet`).
* **Session Keys & Delegated Authority (NEP-366)**:
  * **Key Generation**: Client-side ephemeral Ed25519 keypair generated in browser memory/localStorage via [`src/lib/near-embedded-wallet.ts`](file:///C:/Users/HomePC/Downloads/VeilX-Agent/src/lib/near-embedded-wallet.ts).
  * **Signing**: Users sign a `DelegateAction` client-side covering `FunctionCall` actions to `deposit_near` or `withdraw`.
  * **Relayer Execution**: Relayer backend ([`src/app/api/near/send-tip/route.ts`](file:///C:/Users/HomePC/Downloads/VeilX-Agent/src/app/api/near/send-tip/route.ts)) submits the `SignedDelegateAction` to the network, sponsoring the gas fees.
  * **Spending Allowance**: Enforced client-side and atomically checked server-side with daily MongoDB `$inc` spending tracking (default: $50.00/day).
* **Cross-Chain MPC (Chain Signatures)**:
  * **Contract**: `v1.signer-prod.testnet`.
  * **Derivation Path**: `veilx-agent,${nearAccountId}`.
  * **Client-Side Derivation**: Implemented in [`src/lib/near-chain-signatures.ts`](file:///C:/Users/HomePC/Downloads/VeilX-Agent/src/lib/near-chain-signatures.ts) using `elliptic` (secp256k1) and Keccak-256 to compute the deterministic Base/Ethereum `0x` address without needing private key access.

---

## 3. CROSS-CHAIN & PAYMENT INFRASTRUCTURE

### 3.1 NEAR Intents / Defuse / 1Click
* **Configured Endpoint**: `NEXT_PUBLIC_ONECLICK_BASE="https://1click.chaindefuser.com"`.
* **Implementation Module**: [`src/lib/1click.ts`](file:///C:/Users/HomePC/Downloads/VeilX-Agent/src/lib/1click.ts) and [`src/app/api/quotes/route.ts`](file:///C:/Users/HomePC/Downloads/VeilX-Agent/src/app/api/quotes/route.ts).
* **Capabilities Implemented**:
  * `get1ClickQuote(...)`: Queries 1Click API for market-maker quotes (e.g. converting between NEAR and Base USDC/ETH).
  * `get1ClickExecutionStatus(depositAddress)`: Polls solver progress (`PENDING` $\rightarrow$ `PROCESSING` $\rightarrow$ `SUCCESS`).
* **Current Limitation**: 1Click is currently utilized for quote previewing and PayLink checkout suggestions. Direct automated intent creation with signed solver fulfillment inside the AI agent chat is partially connected.

### 3.2 PayLinks & Invoicing
* **Model**: [`src/models/PayLink.ts`](file:///C:/Users/HomePC/Downloads/VeilX-Agent/src/models/PayLink.ts).
* **Settlement Verification**: [`src/app/api/paylinks/route.ts`](file:///C:/Users/HomePC/Downloads/VeilX-Agent/src/app/api/paylinks/route.ts) validates real on-chain transaction hashes via NEAR RPC receipt inspection (`FINAL` execution status) before marking invoices paid.
* **Background Reconciliation**: Poller in [`src/app/api/reconcile/route.ts`](file:///C:/Users/HomePC/Downloads/VeilX-Agent/src/app/api/reconcile/route.ts) scans for unconfirmed pending payments.

---

## 4. AI INFRASTRUCTURE

### 4.1 Orchestration & Models
* **Core Model**: Google Gemini 2.5 Flash (`GEMINI_API_KEY` in `.env.local`).
* **Gateway Implementation**: [`src/lib/ai-gateway.ts`](file:///C:/Users/HomePC/Downloads/VeilX-Agent/src/lib/ai-gateway.ts).
* **Architecture**: Two-tier hybrid architecture:
  1. **Deterministic Regex Pattern Parser**: Pre-evaluates common commands (`/tip`, `/invoice`, `/pay`, `send X near to Y`) for instantaneous zero-latency execution.
  2. **LLM Function-Calling Fallback**: Calls Gemini with structured JSON schemas for multi-turn intent extraction and conversational reasoning.
* **Registered AI Tools**:
  * `create_invoice(amount, asset, memo, recipient)`
  * `direct_transfer(recipientAddress, amount, asset)`
  * `tip_handle(recipientHandle, amount, asset)`
  * `check_balance(nearAccount)`
  * `cancel_invoice(invoiceSlug)`
  * `query_history(limit, filter)`

---

## 5. BACKEND, DATABASE & BOT INFRASTRUCTURE

### 5.1 Next.js Full-Stack Application
* **Framework**: Next.js 14.2.15 (App Router).
* **Language**: TypeScript 5.6.3 with strict type-checking.
* **API Endpoints**: 22 serverless routes handling authentication, session tokens, transaction broadcasts, quotes, and bots.

### 5.2 MongoDB Atlas Database
* **Connection**: Mongoose 8.7.1 with connection pooling and singleton cache ([`src/lib/mongodb.ts`](file:///C:/Users/HomePC/Downloads/VeilX-Agent/src/lib/mongodb.ts)).
* **Active Collections**:
  1. `users`: Stores user profile, `xHandle`, `nearAccountId`, session public keys, and spending cap tracking.
  2. `transactions`: Persistent history of tips, transfers, claims, and settlements.
  3. `escrow_tips`: Off-chain indexing of on-chain escrow tips with state tracking (`pending`, `claiming`, `claimed`, `refunded`).
  4. `pay_links`: Invoices and checkout links.
  5. `telegram_chats`: Multi-turn conversational memory with 24-hour TTL indexes.

### 5.3 Telegram Copilot Bot
* **Module**: [`src/lib/telegram-bot.ts`](file:///C:/Users/HomePC/Downloads/VeilX-Agent/src/lib/telegram-bot.ts).
* **Webhook Security**: Verified via `X-Telegram-Bot-Api-Secret-Token` header.
* **Privacy Shield**: Suppresses sensitive wallet balances and financial keys in public group chats, prompting users to interact via private direct message.
* **Account Linking**: `/link` deep-link protocol issuing 15-minute time-locked tokens to bind Telegram identity to WebApp accounts.

---

## 6. PRIVACY & SECURITY INFRASTRUCTURE

### 6.1 Authentication & Session Security
* **Session Verification**: Ironclad HMAC-SHA256 session cookies in [`src/lib/session.ts`](file:///C:/Users/HomePC/Downloads/VeilX-Agent/src/lib/session.ts). All legacy bypasses have been eradicated.
* **Key Isolation**: User private keys never leave the browser client. Relayer holds only the gas subsidy key for `veilx-agent.testnet`.

### 6.2 Privacy Level Today
* **Application Data**: PayLink memos and transaction metadata are stored in MongoDB.
* **On-Chain Data**: Fully transparent public ledger. Every tip, recipient handle string, amount, and timestamp is visible to all observers on NEAR testnet explorer.

---

## 7. COMPLETE TECHNOLOGY MATRIX

| Technology / Component | Currently Used? | Actual Implementation Status | Verification Status | Primary Limitations Today |
|---|---|---|---|---|
| **NEAR Protocol L1** | Yes | Full native RPC & contract calls | **Verified** | Public transaction visibility; testnet only |
| **`near-api-js` (v7.2)** | Yes | Core key management & serialization | **Verified** | Large bundle size; legacy Node.js dependencies |
| **NEAR Escrow Contract** | Yes | Rust `near-sdk` 5.30 with atomic callbacks | **Verified** | Public recipient handles; manual storage management |
| **NEAR Chain Signatures** | Yes | Deterministic Secp256k1 EVM derivation | **Verified** | Read/derivation only; outbound MPC signing not executed |
| **NEP-366 Meta Txs** | Yes | Client `DelegateAction` signing & Relayer | **Verified** | Relayer pays gas; requires relayer uptime |
| **NEAR Intents (Defuse)** | Partially | 1Click REST quote fetching & status check | **Partially Integrated** | No automated solver submission inside chat |
| **NEAR AI Cloud** | No | Uses Google Gemini 2.5 Flash | **Not Implemented** | Dependent on Google API; prompt data logged externally |
| **OutLayer (FastNEAR)** | No | Background Next.js API reconciliation | **Not Implemented** | Polling architecture rather than decentralized TEE |
| **zk-SNARK Privacy** | No | Plaintext escrow contract | **Not Implemented** | Zero transaction or amount privacy |
| **Stealth Addresses** | No | Direct social handle mapping | **Not Implemented** | Social identity permanently linked to on-chain address |
| **Telegram Bot** | Yes | Webhook with secret token & MongoDB memory | **Verified** | Webhook polling requires publicly routable URL |
| **MongoDB Atlas** | Yes | Mongoose schemas with compound indexes & TTL | **Verified** | Centralized database dependency |
| **Next.js 14 App Router** | Yes | 22 routes, hybrid SSR & Client components | **Verified** | Serverless function cold starts on free hosting |
| **𝕏 (Twitter) OAuth 2.0** | Yes | PKCE flow with Bearer token identity check | **Verified** | Dependent on Twitter API tier limits |
