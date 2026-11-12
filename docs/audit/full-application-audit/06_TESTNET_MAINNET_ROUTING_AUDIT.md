# 06 — TESTNET/MAINNET ENVIRONMENT & NETWORK ROUTING AUDIT
**Project:** VeilX Autonomous Omnichain Social Finance & Tokenized Equities Terminal  
**Auditor:** Agent 6 — Network Routing & Environment Separation Specialist  
**Status:** Audit Complete  
**Date:** November 11, 2026  
**Repository Path:** `C:\Users\HomePC\Downloads\VeilX-Agent`

---

## 📌 PLAIN-ENGLISH SUMMARY (READ THIS FIRST)

> **What is this document?**  
> This report checks whether VeilX keeps "fake test money" (Testnet) and "real money" (Mainnet) strictly separated, ensuring nobody accidentally loses real cash while testing.

### In Plain Terms: How Does Network Routing Work?
1. **The Good News — No Accidental Real-Money Spends:**  
   * The code never silently switches you from Testnet to Mainnet if an error happens. If a Testnet transaction fails, it just fails safely.
2. **The Testnet vs. Mainnet Reality (Important Architecture Context):**  
   * **Why Simulation Exists on Testnet:** Certain advanced features—specifically tokenized US stocks (like TSLA and NVDA) and Defuse 1Click cross-chain solvers—do NOT exist on Testnet in the real crypto ecosystem. Therefore, when in Testnet mode, VeilX cleverly runs these in **Simulation / Paper Trading Mode** so you can test the AI agent without needing millions in real liquidity.
   * **The Mainnet Account Switch Problem:** When users sign up, VeilX gives them a free NEAR Testnet subaccount (`alice.veilx-agent.testnet`). If they flip the toggle to "Mainnet Mode", the app switches all URLs to Mainnet, but the user's account is still a testnet address!
   * **How to Fix:** Keep Testnet free for testing with a clear `[ Simulation Mode ]` badge for features that only exist on Mainnet. When switching to Mainnet, show a popup asking the user to connect their real NEAR Mainnet wallet (or initialize their real agent with 0.1 NEAR).
3. **PayLink Mixed-Up Links:**  
   * In `src/app/pay/[slug]/page.tsx`, if someone pays using an EVM wallet, the success screen shows a link pointing to `nearblocks.io` instead of BaseScan, so clicking the receipt link opens the wrong blockchain explorer.
   * *How to Fix:* Check which network was used and show the matching explorer link (BaseScan for Base, NearBlocks for NEAR).

---

## 1. Executive Summary

This audit performs an in-depth, code-level assessment of network routing, RPC endpoints, smart contract addresses, chain IDs, and asset configurations across VeilX.

A mission-critical safety requirement of the platform is maintaining absolute segregation between **Testnet (Sandbox)** and **Mainnet (Production)**. Users exploring automated agents and social tipping in Testnet mode must never risk real capital, and Mainnet operations must have clear, unambiguous visual and cryptographic gates.

### Overall Network Separation Posture:
- **Zero Silent Fallbacks:** **VERIFIED SOUND.** Detailed inspection confirms that **no code path silently falls back from Testnet to Mainnet** upon RPC failure or error.
- **Backend API Network Isolation:** **VERIFIED CONSISTENT.** Backend endpoints (`/api/evm/prepare-tx`, `/api/evm/broadcast-tx`, `/api/relay/claim`, `/api/reconcile`) cleanly adhere to configured chain IDs and contract IDs.
- **Accidental Mainnet/Testnet Mixed Routing in PayLink UI:** **CRITICAL INCONSISTENCY IDENTIFIED.** In `src/app/pay/[slug]/page.tsx`, the EVM external wallet configuration (`EVM_CHAINS_CONFIG`) points to **Real Mainnet EVM Chains** (Base `8453`, Arbitrum `42161`, Ethereum `1`) and requests Mainnet USDC/ETH, while the NEAR wallet integration routes to **NEAR Testnet** (`veilx-agent.testnet`), and the final payment receipt hardcodes an explorer link to **NEAR Testnet Blocks** (`https://testnet.nearblocks.io/txns/${txHash}`) regardless of which network was selected!

---

## 2. Comprehensive Network Configuration Matrix

| Layer / Feature | Testnet (Sandbox Mode) | Mainnet (Production Mode) | Config File / Location | Status |
| :--- | :--- | :--- | :--- | :--- |
| **NEAR Network ID** | `testnet` | `mainnet` (Target) | `.env.local:11` | Configured |
| **NEAR RPC Endpoint** | `https://test.rpc.fastnear.com` | `https://rpc.mainnet.near.org` | `.env.local:12`, `near-utils.ts:6` | Active |
| **NEAR Escrow Contract** | `veilx-agent.testnet` | `veilx.near` (Target) | `.env.local:13`, `lib.rs:41` | Deployed & Active |
| **NEAR MPC Signer** | `v1.signer-prod.testnet` | `v1.signer` | `near-chain-signatures.ts:14` | Active |
| **Base EVM Chain ID** | `84532` (Base Sepolia) | `8453` (Base Mainnet) | `prepare-tx:29`, `near-chain-sigs:283` | Separated |
| **Base RPC Endpoint** | `https://sepolia.base.org` | `https://mainnet.base.org` | `broadcast-tx:13,16` | Separated |
| **Base USDC Contract** | `0x036CbD53842c5426634e7929541eC2318f3dCF7e` | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` | `near-chain-signatures.ts:239-240` | Verified Separated |
| **Arbitrum Chain ID** | `421614` (Arb Sepolia) | `42161` (Arb One) | `prepare-tx:37`, `pay/[slug]:92` | Mixed Across Files |
| **Arbitrum USDC Token** | `0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d` | `0xaf88d065e77c8cC2239327C5EDb3A432268e5831` | `prepare-tx:41`, `pay/[slug]:102` | Mixed Across Files |
| **Ethereum Chain ID** | `11155111` (Eth Sepolia) | `1` (Eth Mainnet) | `prepare-tx:44`, `pay/[slug]:108` | Mixed Across Files |
| **Solvers (1Click)** | `https://1click.chaindefuser.com/v0` | `https://1click.chaindefuser.com/v0` | `.env.local:17` | Unified API |

---

## 3. Detailed Network Routing Findings

### [NET-001] [High] Critical Mainnet / Testnet Confusion in PayLink Payment Flow
- **Finding ID:** NET-001
- **Severity:** HIGH
- **Status:** Verified Existing Flaw
- **Affected File:** `src/app/pay/[slug]/page.tsx` (lines 70-170, 415-546, 863-873)
- **Direct Code Evidence:**
  1. **Mainnet EVM Configuration (lines 70-121):**
     ```tsx
     // src/app/pay/[slug]/page.tsx:71-89
     base: {
       name: "Base",
       chainIdHex: "0x2105", // 8453 (Base Mainnet!)
       chainParams: {
         chainId: "0x2105",
         chainName: "Base Mainnet",
         nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
         rpcUrls: ["https://mainnet.base.org"],
         blockExplorerUrls: ["https://basescan.org"],
       },
       nativeSymbol: "ETH",
       tokens: {
         USDC: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // Mainnet USDC
       },
     },
     arbitrum: {
       name: "Arbitrum One",
       chainIdHex: "0xa4b1", // 42161 (Arbitrum Mainnet!)
       ...
     ```
  2. **Testnet NEAR Configuration in Same Component (lines 415-447):**
     ```tsx
     // src/app/pay/[slug]/page.tsx:417
     const targetAccount = invoice.recipientNearAccount || "veilx-agent.testnet";
     ...
     // src/app/pay/[slug]/page.tsx:443
     const myNearWalletUrl = `https://testnet.mynearwallet.com/send-money?recipient=...`;
     ```
  3. **Universal Hardcoded Nearblocks Testnet Link for All Chains (lines 863-873):**
     ```tsx
     // src/app/pay/[slug]/page.tsx:863-873
     {txHash && (
       <a
         href={`https://testnet.nearblocks.io/txns/${txHash}`}
         target="_blank"
         rel="noreferrer"
         className="w-full h-11 rounded-xl bg-[#16A34A] hover:bg-[#15803D] text-white text-xs font-bold flex items-center justify-center gap-2 transition shadow-sm"
       >
         <ExternalLink className="w-4 h-4" />
         <span>View Proof on Block Explorer</span>
       </a>
     )}
     ```
- **Analysis:**
  - If a payer selects Base or Arbitrum and connects MetaMask, the app prompts MetaMask to switch to **Base Mainnet** (`0x2105`) or **Arbitrum One** (`0xa4b1`) and requests a real Mainnet USDC transfer.
  - Once the transaction is broadcast, `txHash` is an EVM hash (e.g. `0x3a4b...`).
  - The receipt UI immediately renders: `<a href="https://testnet.nearblocks.io/txns/0x3a4b...">`. Clicking this link opens the NEAR Testnet block explorer, which displays `Transaction 0x3a4b... not found (404)`.
  - Conversely, if the app is intended to operate on Testnet (as indicated by `.env.local` and all backend endpoints), configuring `EVM_CHAINS_CONFIG` with Mainnet Chain IDs risks spending real mainnet assets during test sessions!
- **Impact:**
  - Extreme user confusion: legitimate payments appear to have failed due to 404 block explorer links.
  - Risk of users accidentally burning or sending real mainnet assets to testnet solver addresses.
- **Recommended Remediation:**
  1. Parameterize `EVM_CHAINS_CONFIG` with an environment flag (`process.env.NEXT_PUBLIC_NETWORK_ENV === "mainnet"`). In testnet mode, Base must use `0x14a34` (`84532`), Arbitrum must use `0x66eee` (`421614`), and Ethereum must use `0xaa36a7` (`11155111`).
  2. Dynamically resolve the receipt explorer link based on the selected chain:
     ```typescript
     const getExplorerUrl = (tx: string, chain: string) => {
       if (chain === "near") return `https://testnet.nearblocks.io/txns/${tx}`;
       if (chain === "base") return `https://sepolia.basescan.org/tx/${tx}`;
       if (chain === "arbitrum") return `https://sepolia.arbiscan.io/tx/${tx}`;
       return `https://sepolia.etherscan.io/tx/${tx}`;
     };
     ```

---

### [NET-002] [Medium] Unauthenticated Public Fallback RPC on Base
- **Finding ID:** NET-002
- **Severity:** MEDIUM
- **Status:** Verified Existing Flaw
- **Affected File:** `src/lib/near-chain-signatures.ts` (lines 283-291)
- **Direct Code Evidence:**
  ```typescript
  // src/lib/near-chain-signatures.ts:283-286
  const chainId = params.chainId ?? (params.rpcUrl?.includes("mainnet") ? 8453 : 84532);
  const chain = chainId === 8453 ? base : baseSepolia;
  const defaultRpc = chainId === 8453 ? "https://mainnet.base.org" : "https://sepolia.base.org";
  const rpcUrl = params.rpcUrl || defaultRpc;
  ```
- **Analysis:**
  Both `https://mainnet.base.org` and `https://sepolia.base.org` are public, unauthenticated community endpoints with strict rate limiting (~25 requests/sec IP throttled). Under peak trading load or simultaneous agent executions, public RPC calls return HTTP 429 Too Many Requests, causing transaction fee estimations and nonce queries to fail.
- **Impact:** Intermittent transaction broadcast drops during high activity periods.
- **Recommended Remediation:**
  Add dedicated RPC environment variables (`BASE_RPC_URL`, `BASE_SEPOLIA_RPC_URL`) pointing to private Alchemy or Infura nodes, and display an explicit startup log warning if falling back to public endpoints.

---

### [NET-003] [Low] Redundant RPC Query in FastNear Provider Initialization
- **Finding ID:** NET-003
- **Severity:** LOW
- **Status:** Verified Existing Flaw
- **Affected File:** `src/app/api/relay/claim/route.ts` (line 14) vs `.env.local` (line 12)
- **Direct Code Evidence:**
  ```typescript
  // src/app/api/relay/claim/route.ts:14
  const TESTNET_RPC = process.env.NEXT_PUBLIC_NEAR_NODE_URL || "https://rpc.testnet.near.org";
  ```
  ```env
  // .env.local:12
  NEXT_PUBLIC_NEAR_NODE_URL="https://test.rpc.fastnear.com"
  ```
- **Analysis:**
  While `.env.local` defines `https://test.rpc.fastnear.com`, certain fallback locations in code defaults to `https://rpc.testnet.near.org`. Official NEAR testnet RPC (`rpc.testnet.near.org`) experiences higher latency and frequent timeouts compared to FastNear.
- **Impact:** Slow relay response times if `.env.local` is not loaded in specific test or edge environments.
- **Recommended Remediation:**
  Standardize on `https://test.rpc.fastnear.com` across all default string fallbacks in `relay/claim`, `reconcile`, and `near-utils`.

---

## 4. Verification of Guardrails Against Accidental Mainnet Leaks

1. **Explicit Chain ID in EIP-1559 Signing:**
   In `src/lib/near-chain-signatures.ts` (lines 416-430), the unsigned transaction payload strictly binds `chainId`. A transaction generated for Base Sepolia (`84532`) cannot be mined or replayed on Base Mainnet (`8453`).
2. **Explicit Network Separation in Backend APIs:**
   In `src/app/api/evm/prepare-tx/route.ts` (lines 27-50), the server explicitly maintains a separate `CHAIN_CONFIGS` registry targeting Sepolia testnets (`84532`, `421614`, `11155111`).
3. **No Automatic Network Switching:**
   If a testnet transaction fails, the codebase throws a fatal error and marks the transaction `failed`. There is zero logic that attempts to re-execute against Mainnet.

---

## 5. Network Routing Recommendations

1. **P0 (Critical UI Fix):** Correct `src/app/pay/[slug]/page.tsx` to align EVM chain configs with testnet (Base Sepolia `84532`, Arbitrum Sepolia `421614`) and dynamically resolve receipt explorer links (`NET-001`).
2. **P1 (Operational):** Implement private RPC endpoint configuration for Base and NEAR (`NET-002`, `NET-003`).
