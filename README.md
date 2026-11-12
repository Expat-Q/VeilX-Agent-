# VeilX: Autonomous Omnichain Social Finance Copilot
### Conversational Social Tipping, PayLinks, Tokenized Stocks Trading & DCA with Protocol-Level Guardrails

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![NEAR](https://img.shields.io/badge/NEAR-Chain%20Signatures%20MPC-green)](https://near.org)
[![Defuse](https://img.shields.io/badge/Defuse-1Click%20Intents-orange)](https://defuse.org)
[![Base](https://img.shields.io/badge/Base-Universal%20EVM-blue)](https://base.org)
[![Ondo](https://img.shields.io/badge/Tokenized%20Stocks-Ondo%20Finance-purple)](https://ondo.finance)
[![Next.js](https://img.shields.io/badge/Next.js-14.2.15-black)](https://nextjs.org/)

---

## 1. Executive Summary & Pitch

**VeilX** is the world's first **Autonomous Social Finance Copilot** that bridges conversational Web2 social interactions with institutional-grade DeFi and Tokenized Real-World Assets (RWAs). 

Built on **NEAR Protocol**, **NEAR Chain Signatures MPC**, and **Defuse 1Click Cross-Chain Intents**, VeilX empowers users to:
1. **Tip anyone on 𝕏 (Twitter)** instantly in USDC, NEAR, or ETH without asking for their wallet address.
2. **Generate Omnichain PayLinks & Invoices** that settle seamlessly across 38+ blockchains into a single non-custodial account.
3. **Trade Tokenized US Equities (TSLA, NVDA, AAPL, SPY)** and execute automated **Dollar-Cost Averaging (DCA)**, dip-buying, and profit-taking strategies using plain English commands.
4. **Sleep soundly with Protocol-Level Guardrails**: A 3-tier budget system ($150/day limit) with **Human-in-the-Loop Anomaly Quarantine** ($25 per-tx threshold) that guarantees rogue AI or prompt injections can never drain user treasuries.

---

## 2. Core Selling Points & Value Propositions

### 🚀 1. Autonomous Tokenized Stocks Trading & Algorithmic DCA
VeilX brings Wall Street equities on-chain via curated tokenized stocks (powered by Ondo Finance & Defuse 1Click solvers):
* **Trade US Equities via Natural Language**:
  * *"Buy $50 TSLA now"*
  * *"Buy $100 NVDA and take profit at +15%"*
  * *"DCA $25 into SPY every week"*
* **Automated Rule Engine**:
  * **Dip Buying**: Automatically buy tokenized equities when prices drop by $X\%$.
  * **Take Profit & Stop Loss**: Enforce bracket exit rules without leaving funds on centralized exchanges.
  * **Built-in Paper Trading Sandbox**: Includes a $10,000 simulated paper trading vault for risk-free backtesting and automated strategy testing on testnet.

### 💸 2. Frictionless Social Tipping (@handle Payments)
* **Tip Creators on 𝕏 (Twitter) in Seconds**: Send payments by simply mentioning their social handle:
  * *"Tip @expatq3 5 USDC on Base"*
  * *"Send 0.5 NEAR to @alice"*
* **Unregistered Escrow Claims**: If a creator has not signed up yet, tips are held in a trustless non-custodial smart escrow contract. The recipient simply signs in with their 𝕏 account to claim accumulated payouts with zero gas fees.

### 🔗 3. Omnichain PayLinks & Universal Invoicing
* **Create Invoices with Conversational Prompts**:
  * *"Invoice @acme $50 for Website Design"*
  * *"Create a $10 PayLink for my newsletter"*
* **Universal Cross-Chain Settlement**: Payers can fulfill invoices from **any blockchain** (Bitcoin, Solana, Ethereum, Base, Dogecoin). Defuse solvers settle the funds directly into the seller's NEAR account or Universal EVM vault in ~15–25 seconds.
* **Branded PayLink Portal**: Generates dynamic shareable URLs (`/pay/[slug]`) complete with QR codes and multi-token asset selectors.

### 🛡️ 4. Protocol-Level Agent Guardrails & Anomaly Quarantine
* **3-Tier Budget System**: Enforces strict daily caps ($150 default), weekly ceilings ($500), and per-transaction thresholds ($25).
* **Human-in-the-Loop (HitL) Quarantine**: Transactions exceeding the per-transaction limit are held in quarantine rather than failing, displaying an interactive biometric authorization card for human sign-off.
* **Instant On-Chain Revocation**: Single-click session revocation permanently deletes the delegated Ed25519 session key directly from the NEAR blockchain state trie via `/api/near/revoke-key`.

### 🔒 5. Universal EVM via NEAR Chain Signatures & Confidential TEE Intents
* **Single Master Key**: One NEAR account deterministically derives EVM `0x` addresses on Base, Arbitrum, and Optimism using decentralized threshold ECDSA (`v1.signer-prod.testnet`).
* **Zero Gas on Destination**: Gas fees are sponsored or deducted directly in NEAR/USDC.
* **Hardware TEE MEV Shield**: Cross-chain swaps execute via confidential solver enclaves, blinding routes to prevent sandwich attacks and front-running.

---

## 3. The Problem & Market Gap

| The Problem | How Existing Solutions Fail | The VeilX Breakthrough |
|---|---|---|
| **Social Crypto Payments** | Senders must badger recipients for complex `0x` or base58 addresses. If the recipient isn't in Web3, funds cannot be sent. | **Handle-Based Social Pay**: Tip any 𝕏 handle directly. Unregistered recipients claim via trustless non-custodial smart escrow upon login. |
| **Stock Market Access** | Web3 users must off-ramp crypto to fiat bank accounts, wait 3–5 business days, and KYC with traditional brokers to buy US equities. | **Tokenized US Stocks on NEAR**: Buy TSLA, NVDA, AAPL, SPY directly with stablecoins in conversational chat or terminal. |
| **DCA & Automated Trading** | Bot trading requires trusting custodial exchange API keys with full withdrawal permissions. | **Non-Custodial DCA Engine**: Rules execute via scoped NEAR session keys with hard daily outflow ceilings. |
| **AI Agent Security Risks** | Autonomous trading agents hold unrestricted private keys. Prompt injection or model hallucinations can liquidate entire portfolios. | **Protocol-Level Guardrails**: 3-tier budgets and HitL Anomaly Quarantine prevent any transaction > $25 from moving without human approval. |
| **Cross-Chain Bridge Friction** | Users must bridge assets across multiple networks, pay multiple gas tokens, and wait 20+ minutes. | **NEAR Intents (Defuse 1Click)**: Sub-30-second cross-chain swaps without managing destination gas tokens. |

---

## 4. System Architecture

```
                                  USER INTERFACE LAYER
            ┌───────────────────────────────────────────────────────────────┐
            │   Social Finance Chat  ·  Trading Terminal  ·  PayLinks Portal │
            └───────────────────────────────┬───────────────────────────────┘
                                            │
                                            ▼
                                  HYBRID AI INTENT GATEWAY
            ┌───────────────────────────────────────────────────────────────┐
            │  • Sub-millisecond Deterministic FastPath Intent Matcher      │
            │  • NEAR AI Cloud Hardware TEE Enclave (Llama-3.3-70B)         │
            │  • Conversational Stocks, DCA, Tipping & PayLink Parsers      │
            └───────────────────────────────┬───────────────────────────────┘
                                            │
                                            ▼
                             AUTONOMOUS GUARDRAILS & POLICY
            ┌───────────────────────────────────────────────────────────────┐
            │  • Freeze Check: Emergency global killswitch status           │
            │  • Rolling 24-Hour & 7-Day Spend Limits ($150/day, $500/week) │
            │  • Per-Transaction Threshold Evaluation ($25 cap)             │
            └───────────────────────┬───────────────┬───────────────────────┘
                                    │               │
             Within Budget (<= $25) │               │ Anomaly / Cap Exceeded (> $25)
                                    ▼               ▼
            ┌─────────────────────────────┐   ┌─────────────────────────────┐
            │ Autonomous Execution        │   │ Human-in-the-Loop (HitL)    │
            │ (Client Session Key Sign)   │   │ Interactive Quarantine Card │
            └──────────────┬──────────────┘   └─────────────┬───────────────┘
                           │                                │ User Approves
                           └────────────────┬───────────────┘
                                            ▼
                             OMNICHAIN SETTLEMENT LAYER
         ┌──────────────────────────────────┼──────────────────────────────────┐
         ▼                                  ▼                                  ▼
┌─────────────────────────┐    ┌─────────────────────────┐    ┌─────────────────────────┐
│ NEAR Chain Signatures   │    │ Tokenized Equities      │    │ Defuse 1Click Solver    │
│ Contract: v1.signer-prod│    │ (Ondo / Defuse Solvers) │    │ (Confidential TEE Swaps)│
│ • Universal EVM (Base)  │    │ • TSLAon, NVDAon, AAPL  │    │ • PayLink Settlement    │
│ • Zero Destination Gas  │    │ • Automated DCA Engine  │    │ • Shielded Social Tips  │
└─────────────────────────┘    └─────────────────────────┘    └─────────────────────────┘
```

---

## 5. Conversational Command Showcase

VeilX supports rich, natural language financial commands across chat and terminal:

### Social Finance & Tipping
* `"Tip @expatq3 5 USDC on Base"`
* `"Send 0.25 NEAR to @alice"`
* `"What is my balance?"`
* `"Show my pending unclaimed tips"`

### PayLinks & Invoices
* `"Invoice @acme $50 for Website Design"`
* `"Create a $10 paylink for my digital art"`
* `"Cancel invoice inv_173000_abc"`

### Tokenized Stocks & Automated DCA
* `"Buy $50 TSLA now"`
* `"Buy $100 NVDA and take profit at +10%"`
* `"Set up a DCA to buy $25 SPY every Monday"`
* `"Show my stocks portfolio"`
* `"Price of NVDAon"`

### Security & Session Authority
* `"Revoke my session key"`
* `"Freeze my account"`
* `"Set my daily spending limit to $75"`

---

## 6. Live Contracts & Deployment Registry

| Network | Component | Address / Identifier | Verification Link |
|---|---|---|---|
| **NEAR Testnet** | MPC Signer Contract | `v1.signer-prod.testnet` | [NearBlocks Explorer](https://testnet.nearblocks.io/address/v1.signer-prod.testnet) |
| **NEAR Testnet** | Circle NEP-141 USDC | `3e2210e1184b45b64c8a434c0a7e7b23cc04ea7eb7a6c3c32520d03d4afcb8af` | [NearBlocks Explorer](https://testnet.nearblocks.io/address/3e2210e1184b45b64c8a434c0a7e7b23cc04ea7eb7a6c3c32520d03d4afcb8af) |
| **NEAR Testnet** | Relayer Master Account | `veilxapp.veilx-agent.testnet` | [NearBlocks Explorer](https://testnet.nearblocks.io/address/veilxapp.veilx-agent.testnet) |
| **Base Sepolia** | Derived Universal EVM Vault | `0xDed7AdB9Cc7390dE4db8bd8f63d8908a24A03eb0` | [BaseScan Sepolia](https://sepolia.basescan.org/address/0xDed7AdB9Cc7390dE4db8bd8f63d8908a24A03eb0) |
| **NEAR Mainnet** | Production MPC Signer | `v1.signer` | [NearBlocks Mainnet](https://nearblocks.io/address/v1.signer) |
| **NEAR Mainnet** | Production Circle USDC | `17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1` | [NearBlocks Mainnet](https://nearblocks.io/address/17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1) |

---

## 7. Getting Started & Local Reproduction

### Prerequisites
* Node.js v18.17+ or v20.x
* npm / pnpm / yarn

### Installation
```bash
# Clone the repository
git clone https://github.com/Expat-Q/VeilX-Agent-.git
cd VeilX-Agent-

# Install dependencies
npm install
```

### Environment Configuration
```bash
cp .env.example .env.local
```

Configure your environment variables in `.env.local`:
```ini
# Network Mode (testnet | mainnet)
NEXT_PUBLIC_NEAR_NETWORK=testnet

# NEAR RPC & MPC Signer
NEXT_PUBLIC_NEAR_RPC_URL=https://test.rpc.fastnear.com
NEXT_PUBLIC_MPC_CONTRACT_ID=v1.signer-prod.testnet

# Autonomous Spending Limits (USD)
NEXT_PUBLIC_DEFAULT_SPEND_LIMIT_USD=150
NEXT_PUBLIC_PER_TX_QUARANTINE_THRESHOLD_USD=25
NEXT_PUBLIC_WEEKLY_SPEND_CAP_USD=500
```

### Run Locally
```bash
npm run dev
```
Navigate to `http://localhost:3000` to interact with the copilot.

### Build Verification
```bash
npm run build
```
Compiled across all 35+ routes and serverless functions with zero TypeScript errors.

---

## 8. API Reference

| Endpoint | Method | Description |
|---|---|---|
| `/api/near/account` | `GET` | Fetches native balance and concurrent NEP-141 token balances via parallel FastNear RPC (<2s). |
| `/api/evm/balance` | `GET` | Derives 0x MPC address and queries multi-chain EVM holdings across Base, Arbitrum, Optimism. |
| `/api/quotes` | `POST` | Generates Defuse 1Click cross-chain intent quotes with confidential TEE headers and MEV protection. |
| `/api/stocks/tokens` | `GET` | Curated catalog of tokenized US equities (TSLAon, NVDAon, AAPLon, SPYon) with live oracle prices. |
| `/api/cron/evaluate-rules` | `POST` | Automated DCA and dip-buying evaluator that executes pending orders against market prices. |
| `/api/near/revoke-key` | `POST` | Invokes NEAR RPC to permanently delete delegated session access keys on-chain. |
| `/api/prices` | `GET` | In-memory cached oracle feeds for NEAR, ETH, BTC, SOL, and tokenized equities. |

---

## 9. Mainnet Deployment Guide

To deploy VeilX in production on NEAR Mainnet:
1. Set `NEXT_PUBLIC_NEAR_NETWORK=mainnet` in your production environment.
2. Set `NEXT_PUBLIC_NEAR_RPC_URL=https://rpc.mainnet.near.org`.
3. Set `NEXT_PUBLIC_MPC_CONTRACT_ID=v1.signer`.
4. Deploy the Next.js app to **Vercel** or any cloud container.

---

## 10. Team & Hackathon Submission

* **Project**: VeilX-Agent
* **Repository**: [https://github.com/Expat-Q/VeilX-Agent-](https://github.com/Expat-Q/VeilX-Agent-)
* **Tracks**: Autonomous Agents · Chain Abstraction & Intents · Social Pay · RWAs / Tokenized Equities
* **License**: MIT
