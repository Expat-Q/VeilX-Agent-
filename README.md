# VeilX-Agent

> **Autonomous Omnichain Social Finance Copilot with Protocol-Level Guardrails & Confidential Intents.**

VeilX is an AI-powered agentic finance engine built on **NEAR Protocol**, **NEAR Chain Signatures MPC**, and **Defuse 1Click Cross-Chain Intents**. It allows users to manage assets across NEAR, Base, Arbitrum, Optimism, and Ethereum through conversational natural language while enforcing protocol-level spending guardrails and zero-knowledge privacy guarantees.

---

## Key Capabilities

### 1. Autonomous Agent Guardrails (Protocol-Level)
* **3-Tier Budget System**: Enforces strict daily caps ($150 default), weekly caps ($500), and per-transaction thresholds ($25).
* **Human-in-the-Loop (HitL) Anomaly Quarantine**: Transactions exceeding the per-transaction cap are held in quarantine rather than hard-failing, prompting human biometric/explicit approval via interactive action cards.
* **Function-Call Scoped Session Keys**: Client session keys hold restricted method-level access (`addFunctionCallAccessKey`), preventing unauthorized full-access execution.
* **Instant On-Chain Revocation**: Single-click session revocation deletes the delegated Ed25519 key directly from NEAR state via `/api/near/revoke-key`.

### 2. Confidential Intents & Shielded Swaps
* **TEE MEV Protection**: Integrated with Defuse 1Click protocol to shield cross-chain swap routes from public mempool frontrunning.
* **Selective Disclosure Attestation**: Cryptographically signs deposit addresses and route attestations without leaking pre-trade intent details.
* **Omnichain Settlement**: Settles transfers and swaps from NEAR to EVM (Base, Arbitrum, Optimism, Ethereum) in ~15–25 seconds.

### 3. Universal EVM via NEAR Chain Signatures MPC
* **Single Master Key**: A single NEAR account derives deterministic EVM `0x` addresses on Base Sepolia, Arbitrum Sepolia, Optimism, and Ethereum Sepolia using decentralized threshold ECDSA (`v1.signer-prod.testnet` / `v1.signer`).
* **Zero Gas on Destination**: Gas fees are sponsored or deducted directly in NEAR/USDC, eliminating the need to bridge destination native gas tokens.

---

## Architecture Overview

```
                      ┌─────────────────────────────────────────┐
                      │          Conversational Client           │
                      │   (Web Dashboard · Terminal · Chat)     │
                      └────────────────────┬────────────────────┘
                                           │
                                           ▼
                      ┌─────────────────────────────────────────┐
                      │         Local AI Intent Gateway         │
                      │   (Intent Parser · Guardrail Policy)    │
                      └──────────────┬──────────────────┬───────┘
                                     │                  │
                Budget OK (<= $25)   │                  │  Exceeds Cap (> $25)
                                     ▼                  ▼
                    ┌─────────────────────────┐   ┌─────────────────────────┐
                    │ Autonomous Execution    │   │ Human-in-the-Loop       │
                    │ (Session Key Signature) │   │ Anomaly Quarantine Card │
                    └───────────┬─────────────┘   └─────────────────────────┘
                                │
         ┌──────────────────────┴──────────────────────┐
         ▼                                             ▼
┌───────────────────────────────┐           ┌───────────────────────────────┐
│  NEAR Chain Signatures MPC    │           │     Defuse 1Click Solver      │
│  (v1.signer-prod.testnet)     │           │   (Confidential TEE Swaps)    │
│  • Base Sepolia / Arbitrum    │           │   • Shielded Settlement       │
│  • Threshold ECDSA Signatures │           │   • Cross-Chain MEV Defense   │
└───────────────────────────────┘           └───────────────────────────────┘
```

---

## Live Contracts & Verification

| Network | Component | Address / Identifier | Explorer Link |
|---|---|---|---|
| **NEAR Testnet** | MPC Signer Contract | `v1.signer-prod.testnet` | [NearBlocks Explorer](https://testnet.nearblocks.io/address/v1.signer-prod.testnet) |
| **NEAR Testnet** | Circle NEP-141 USDC | `3e2210e1184b45b64c8a434c0a7e7b23cc04ea7eb7a6c3c32520d03d4afcb8af` | [NearBlocks Explorer](https://testnet.nearblocks.io/address/3e2210e1184b45b64c8a434c0a7e7b23cc04ea7eb7a6c3c32520d03d4afcb8af) |
| **NEAR Testnet** | Relayer & Account Master | `veilxapp.veilx-agent.testnet` | [NearBlocks Explorer](https://testnet.nearblocks.io/address/veilxapp.veilx-agent.testnet) |
| **Base Sepolia** | Derived Agent Vault (Sample) | `0xDed7AdB9Cc7390dE4db8bd8f63d8908a24A03eb0` | [BaseScan Sepolia](https://sepolia.basescan.org/address/0xDed7AdB9Cc7390dE4db8bd8f63d8908a24A03eb0) |
| **NEAR Mainnet** | MPC Signer Contract | `v1.signer` | [NearBlocks Mainnet](https://nearblocks.io/address/v1.signer) |
| **NEAR Mainnet** | Circle Native USDC | `17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1` | [NearBlocks Mainnet](https://nearblocks.io/address/17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1) |

---

## Quickstart

### Prerequisites
* Node.js v18.17+ or v20+
* npm, yarn, or pnpm

### Installation

```bash
git clone https://github.com/Expat-Q/VeilX-Agent-.git
cd VeilX-Agent-
npm install
```

### Environment Setup

```bash
cp .env.example .env.local
```
Fill in your `NEAR_RELAYER_PRIVATE_KEY` and optional API keys.

### Run Development Server

```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) to interact with the agent copilot.

### Production Build

```bash
npm run build
npm run start
```

---

## API Endpoints

* `GET /api/near/account?accountId=<id>` — Concurrent NEP-141 token balance querying (< 2s latency).
* `GET /api/evm/balance?accountId=<id>` — Multi-chain EVM balances (Base, Arbitrum, Optimism, Ethereum).
* `POST /api/quotes` — Defuse 1Click cross-chain swap quotes with confidential TEE parameter forwarding.
* `POST /api/near/revoke-key` — Protocol-level on-chain deletion of delegated session access keys.
* `GET /api/prices?symbols=NEAR,ETH,BTC` — Cached multi-asset price feed.

---

## Mainnet Deployment Checklist

To switch from Testnet to Production Mainnet:
1. Update `.env.local`:
   ```bash
   NEXT_PUBLIC_NEAR_NETWORK=mainnet
   NEXT_PUBLIC_NEAR_RPC_URL=https://rpc.mainnet.near.org
   NEXT_PUBLIC_MPC_CONTRACT_ID=v1.signer
   ```
2. Fund the production relayer account with mainnet NEAR (`veilx-relayer.near`).
3. Deploy to Vercel or any Node.js container runtime with zero additional build steps.

---

## License
MIT
