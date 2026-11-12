# 12 — HACKATHON JUDGE EVIDENCE & DEMONSTRATION AUDIT
**Project:** VeilX Autonomous Omnichain Social Finance & Tokenized Equities Terminal  
**Auditor:** Agent 12 — Hackathon Demonstration & Verifiable Evidence Specialist  
**Status:** Audit Complete — Empirical Reality Check  
**Date:** November 11, 2026  
**Repository Path:** `C:\Users\HomePC\Downloads\VeilX-Agent`

---

## 1. Executive Summary

This audit assesses the veracity of the public product claims made by VeilX, provides an unvarnished breakdown of what is **genuinely working on public blockchains vs what is simulated/mocked**, and details a reproducible, step-by-step **Proof & Demonstration Script** for hackathon judges to verify the system on live public infrastructure.

### Product Claim Reality Check:
- **Claim 1: "Non-Custodial Social Tipping on NEAR":** **100% REAL & VERIFIABLE ON-CHAIN.** Uses the deployed `veilx-agent.testnet` contract. Tipping, locking in escrow, and gasless claiming execute on NEAR Testnet and can be verified via NEARBlocks.
- **Claim 2: "Universal EVM Account Derivation via NEAR MPC (Chain Signatures)":** **100% REAL & MATHEMATICALLY VERIFIABLE.** Uses the official NEAR MPC contract `v1.signer-prod.testnet`. Derived Base addresses are standard Secp256k1 EOAs that can receive real funds on Base Sepolia and are verifiable on Basescan.
- **Claim 3: "Tokenized US Equities Terminal with Autonomous DCA":** **PAPER TRADING SANDBOX SIMULATION.** Live quotes are pulled from real market feeds (CoinMarketCap and Yahoo Finance); however, order execution, DCA accumulation, and bracket triggers execute strictly against in-memory/MongoDB portfolio state (`mode: "simulation"`). No actual tokenized stock tokens (`*.omdep.near`) are minted or settled on-chain.
- **Claim 4: "Cross-Chain Swaps across 38+ Blockchains via NEAR Intents":** **SIMULATED MATH / FAILING QUOTES.** The token catalog indexes 250+ tokens; however, quoting for the primary `Base USDC -> wNEAR` route returns HTTP 400 from Defuse solvers, and `createIntentOrder` uses static hardcoded price multipliers rather than live solver pricing.
- **Claim 5: "Zero-Knowledge Private Transactions":** **CRYPTOGRAPHIC HASH COMMITMENT STAGE.** Obfuscates social handles on-chain using SHA-256 commitments with selective hash disclosures; it does not yet utilize full zk-SNARK proving circuits.

---

## 2. Product Claims Veracity Matrix

| Public Feature Claim | Claimed Reality | Actual Codebase Reality | Status for Judges |
| :--- | :--- | :--- | :---: |
| **Social Tipping to X Handles** | On-chain NEAR escrow | Deposits to `veilx-agent.testnet` using `deposit_near_tip` or `ft_on_transfer`. | **100% Real & Live** |
| **Gasless Claiming (NEP-366)** | Zero-gas user claiming | Relayer account (`veilx-agent.testnet`) calls `claim_tip` and sponsors gas. | **100% Real & Live** |
| **Universal EVM Addresses** | Omnichain address without bridge | Derives standard EVM address using Secp256k1 additive tweak on NEAR MPC key. | **100% Real & Live** |
| **Cross-Chain MPC Broadcast** | Outbound EVM send via MPC | Calls `v1.signer-prod.testnet::sign`. (Note: Requires fixing attached deposit). | **Real Architecture** |
| **Tokenized Equities Trading** | Wall Street stock trading on NEAR | Paper trading simulation (`mode: "simulation"`). No on-chain stock minting. | **Sandbox Simulation** |
| **Autonomous DCA Rules** | Automated recurring buys | Client-side React `setInterval` loop modifying portfolio state. | **Client Simulation** |
| **Omnichain PayLinks** | Multichain checkout URL | Generates payment page accepting NEAR and Base tokens. | **100% Real & Live** |
| **Cross-Chain 1Click Intents** | Instant cross-chain swap | Quoting returns HTTP 400 on default pair; math uses static constants. | **Broken / Simulated Math** |
| **Zero-Knowledge Privacy** | zk-SNARK private transfers | SHA-256 hash commitments (`DisclosureProof`). | **Hash Commitment** |

---

## 3. Detailed Product Reality Findings

### [JUDGE-001] [CRITICAL] Tokenized Equities Trading Executes in Simulation Mode
- **Severity:** CRITICAL
- **Status:** Mocked / Simulated
- **Affected Files:**
  - `src/lib/trading-copilot.ts` (lines 334, 464, 822)
  - `src/app/terminal/page.tsx`
- **Actual Code Snippet & Analysis:**
  In `src/lib/trading-copilot.ts`:
  ```typescript
  newOrder = {
    id: `ord_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    symbol: match.symbol,
    type: "recurring_buy",
    side: "buy",
    shares,
    price: currentPrice,
    amountUsd: amount,
    timestamp: new Date().toISOString(),
    mode: "simulation", // HARDCODED SIMULATION!
    status: "filled",
  };
  ```
  In `evaluateTradingRules` (line 822):
  ```typescript
  export function evaluateTradingRules(
    rules: TradingRule[],
    liveAssets: StockAsset[],
    portfolio: { cashUsd: number; positions: PortfolioPosition[]; orderHistory?: OrderHistoryItem[] },
    mode: "simulation" | "mainnet" = "simulation"
  ): EvaluationResult {
  ```
  When a user or judge instructs the AI to "Buy $50 TSLA" or "DCA $10 into NVDA", the system updates `updatedCash` and `updatedPositions` in local memory/MongoDB. No smart contract transaction is broadcast to NEAR Mainnet, and no Ondo tokenized stock NEP-141 tokens (`tsla.omdep.near`) are acquired.
- **Judge Takeaway:** The trading terminal is an advanced **algorithmic paper-trading sandbox**. It demonstrates real-time market data integration, candlestick charting, and autonomous execution logic, but does NOT settle real equities on-chain.

---

### [JUDGE-002] [HIGH] Cross-Chain Intent Quotes Fail and Hardcode Output Amounts
- **Severity:** HIGH
- **Status:** Broken / Simulated Math
- **Affected Files:**
  - `src/lib/1click.ts` (lines 410–475)
  - `scripts/test-1click-quote.mjs`
- **Actual Code Snippet & Analysis:**
  Executing `node scripts/test-1click-quote.mjs` returns:
  ```
  Error: Quote failed (400): {"message":"Quoting for this pair is not available"}
  ```
  In `src/lib/1click.ts` (lines 422–472):
  ```typescript
  let targetAmount = sourceUsdVal;
  if (params.targetAssetSymbol.toUpperCase() === "NEAR") targetAmount = Number((sourceUsdVal / 3.5).toFixed(3));
  ...
  return {
    orderId,
    depositAddress: depositAddr,
    ...
    targetAmount, // STATIC LOCAL CALCULATION!
    estimatedFeeUsd: 0.04, // STATIC HARDCODED!
    timeEstimateSeconds: 25, // STATIC HARDCODED!
  };
  ```
- **Judge Takeaway:** The cross-chain solver flow is not fully operational in live testing. Quotes fail on the testnet pair, and intent order outputs are calculated using local price division rather than actual solver orderbook depth.

---

### [JUDGE-003] [INFORMATIONAL] Verified Real: NEAR Escrow Smart Contract & Social Tipping
- **Severity:** INFORMATIONAL
- **Status:** 100% Real & Verifiable On-Chain
- **Affected Files:**
  - `contracts/veilx-escrow/src/lib.rs`
  - `src/lib/near-utils.ts`
- **Verifiable Evidence:**
  The contract is compiled with `near-sdk v5.5.0` and deployed at `veilx-agent.testnet` on NEAR Testnet.
  - Explorer Contract Link: [https://testnet.nearblocks.io/address/veilx-agent.testnet](https://testnet.nearblocks.io/address/veilx-agent.testnet)
  - Contract methods `deposit_near_tip`, `ft_on_transfer`, and `claim_tip` handle real yoctoNEAR deposits and execute state changes on testnet blocks.

---

### [JUDGE-004] [INFORMATIONAL] Verified Real: Deterministic NEAR MPC Key Derivation
- **Severity:** INFORMATIONAL
- **Status:** 100% Real & Mathematically Provable
- **Affected Files:**
  - `src/lib/near-chain-signatures.ts`
- **Verifiable Evidence:**
  The additive tweak derivation implements the exact NEAR MPC specification:
  ```
  epsilon = SHA3-256("near-mpc-recovery v0.1.0 epsilon derivation:" + accountId + "," + path)
  Derived_PubKey = Root_PubKey + epsilon * G
  Address = Keccak-256(Derived_PubKey)[12..32]
  ```
  - NEAR Testnet MPC Signer: `v1.signer-prod.testnet`
  - Derived addresses are live standard Ethereum EOAs on Base Sepolia. Anyone sending Base Sepolia USDC to a derived address can see the balance reflected live in the VeilX dashboard.

---

## 4. Step-by-Step Hackathon Judge Demonstration Script

Judges can execute the following verifiable demonstration flows:

### Flow 1: Live On-Chain Social Tipping & Relayer Claim (NEAR Testnet)
1. Navigate to `/chat`.
2. Enter prompt: `"Tip 0.05 NEAR to @vitalik"`.
3. The AI Copilot parses the prompt and displays an action card for confirmation.
4. Click `"Confirm & Send Tip"`.
5. **Verification on NEAR Explorer:**
   - A transaction hash is generated.
   - Inspect the transaction at `https://testnet.nearblocks.io/txns/[TX_HASH]`.
   - Receiver: `veilx-agent.testnet`, Method: `deposit_near_tip`, Attached Deposit: `0.05 NEAR`.
6. Navigate to `/dashboard` as recipient `@vitalik` and click `"Claim"`.
7. The relayer sponsors gas and executes `claim_tip`, transferring the NEAR to the recipient's wallet.

---

### Flow 2: Live Omnichain EVM Balance Verification (Base Sepolia via NEAR MPC)
1. Navigate to `/dashboard`.
2. Locate the **Universal EVM Address** card showing your derived `0x...` address.
3. Copy the address.
4. From any Web3 wallet (MetaMask, Coinbase Wallet), send $1.00 of Base Sepolia USDC to the derived address.
   - Base Sepolia USDC Contract: `0x036CbD53842c5426634e7929541eC2318f3dCF7e`
5. Return to the VeilX dashboard and click `"Refresh Balance"`.
6. **Verification on Basescan:**
   - Inspect `https://sepolia.basescan.org/address/[EVM_ADDRESS]`.
   - The balance reflects on-chain without any bridge deposit or custodial interaction.

---

### Flow 3: Autonomous DCA & Trading Terminal (Paper Sandbox)
1. Navigate to `/terminal`.
2. Inspect the real-time Candlestick Chart (powered by lightweight-charts with live CoinMarketCap / Yahoo Finance ticks).
3. In the Copilot prompt input, type: `"DCA $50 into TSLA every minute"`.
4. Observe the initial purchase execution:
   - Cash is deducted by $50.00.
   - TSLA appears under **Holdings** with filled shares.
   - Rule appears under **Active Rules** tab (`Cadence: 1m`).
5. Wait 60 seconds without interaction.
6. A notification fires confirming the second DCA tranche filled, and the **Order History** tab logs the simulated execution.

---

## 5. Summary Verdict for Hackathon Judges

VeilX is a hybrid application featuring **genuinely deployed Web3 infrastructure combined with an advanced simulated trading sandbox**:
- **What is 100% Real & Provable:** Non-custodial NEAR escrow smart contracts, gasless meta-transaction claiming, Twitter OAuth PKCE, deterministic NEAR MPC address derivation, and live CoinMarketCap / Gemini API integrations.
- **What is Paper-Trading / Simulated:** US equities order matching, autonomous DCA execution, and tokenized stock share minting.
- **What Requires Immediate Fixes:** 1Click Defuse quote payload parameters and Twitter API developer credits.
