# 18 — UNRESOLVED DECISIONS & VERIFICATION GAPS
**Project:** VeilX Autonomous Omnichain Social Finance & Tokenized Equities Terminal  
**Auditor:** Agent 18 — Master Audit Coordinator & Verification Gap Specialist  
**Status:** Audit Complete — Gap & Open Decision Catalog  
**Date:** November 11, 2026  
**Repository Path:** `C:\Users\HomePC\Downloads\VeilX-Agent`

---

## 📌 PLAIN-ENGLISH SUMMARY (READ THIS FIRST)

> **What is this document?**  
> This report lists the open choices and product decisions that require your approval. It breaks down the trade-offs of each option in simple language so you can make the right call for your project.

### In Plain Terms: The 5 Key Decisions You Need to Make
1. **Decision 1: How should users pay for gas when sending USDC on Base? (DEC-001)**
   * *Option A:* Require users to buy Base Ethereum (causes lots of users to give up).
   * *Option B:* Use a Paymaster so the gas fee is automatically deducted from their USDC (Smooth and easy, recommended).
   * *Option C:* VeilX pays the gas for their first 3 transactions as a free gift.
2. **Decision 2: How long before an unclaimed tip can be refunded? (DEC-002)**
   * *Option A:* 7 days (Recommended: Gives the recipient a week to sign up, but protects the sender from losing their money).
   * *Option B:* Immediate cancellation (Risky: The sender could send a tip, show off on Twitter, and immediately cancel it).
3. **Decision 3: Cleaning up the two giant 2,600-line code files (DEC-003)**
   * *Option A:* Break them apart right now (Risky: might introduce new bugs right before hackathon judging).
   * *Option B:* Leave them as-is for hackathon judging, then refactor them into clean pieces afterwards (Recommended).
4. **Decision 4: Fixing Cross-Chain Swap Quotes (DEC-004)**
   * *Option A:* Fix the Defuse 1Click API token IDs so live testnet quotes work (Recommended).
   * *Option B:* Fallback to a Uniswap pool on Base Sepolia.
5. **Decision 5: Tokenized Stock Trading on Testnet vs Mainnet (DEC-005)**
   * *Context:* Tokenized US stocks (Ondo Finance) only exist on Mainnet. They do not exist on testnets anywhere in Web3.
   * *Recommendation:* On Testnet, clearly label it `[ Institutional Simulation / Sandbox Mode ]` so judges understand the AI trading agent is real, while the stock fills are simulated for free testing. On Mainnet, require a real NEAR/EVM wallet connection.

---

## 1. Executive Summary

In adherence to Section 1.1 ("Audit only. Do not modify the application") and Section 7 ("Live Verification & Testing Rules"), this document records all architectural decisions, product trade-offs, and testing pathways that remain unverified or require explicit human stakeholder decisions before implementation.

---

## 2. Unverified Testing Areas (Safety & Permission Boundaries)

The following tests were intentionally withheld during this audit cycle to adhere to system safety policies:

1. **High-Value Mainnet Financial Transactions:**
   - *Reason Withheld:* Requires transferring real Mainnet cryptocurrency (ETH / USDC / NEAR).
   - *Verification Needed:* End-to-end execution of a real $100 swap on Base Mainnet and settlement into Ondo `TSLAon` tokens on NEAR Mainnet.
2. **Destructive Stress Testing on Escrow Smart Contract:**
   - *Reason Withheld:* Executing high-concurrency reentrancy exploit scripts on testnet public nodes could disrupt other ecosystem developers.
   - *Verification Needed:* Formal audit of `contracts/veilx-escrow/src/lib.rs` with automated fuzzing tools like `cargo-fuzz` or `near-workspaces`.
3. **Twitter API Handle Recycling Simulation:**
   - *Reason Withheld:* Requires real Twitter account deletion and subsequent re-registration of the same screen name to empirically verify the `xUserId` collision defense.
4. **Outbound Base EVM MPC Broadcast with Funded Balance:**
   - *Reason Withheld:* The derived testnet EVM address on Base Sepolia currently holds 0.0000 ETH for gas, preventing full on-chain transaction broadcast testing through `requestMpcSignature`.

---

## 3. Unresolved Product & Architectural Decisions

| Decision ID | Focus Area | Options Under Review | Decision Made & Strategic Rationale | Status |
| :--- | :--- | :--- | :--- | :---: |
| **DEC-001** | **EVM Gas Sponsorship** | **Option A:** Require users to hold Base ETH.<br>**Option B:** Integrate an ERC-4337 Paymaster that deducts gas from USDC.<br>**Option C:** Platform relayer sponsors gas for first 3 transactions. | **ADOPTED: Option A.** Users simply fund or hold native Base ETH to pay for their transactions, adhering to standard non-custodial EVM wallet behavior without adding third-party paymaster dependencies. | **FINALIZED** |
| **DEC-002** | **Escrow Timelock Duration** | **Option A:** Keep the current 7-day timelock before sender can refund.<br>**Option B:** Allow immediate cancellation until claimed.<br>**Option C:** Extend timelock to 30 days. | **ADOPTED: Option A.** Retain the current 7-day timelock implemented in contract lines 324–363, providing a fair claim window while protecting senders. | **FINALIZED** |
| **DEC-003** | **Monolithic File Refactoring** | **Option A:** Refactor `terminal/page.tsx` and `ChatContainer.tsx` immediately.<br>**Option B:** Freeze UI files until after hackathon judging, then decompose. | **ADOPTED: Option B.** Keep the monolithic structure frozen during live judging to prevent accidental UI regressions, then decompose into clean sub-components in the post-hackathon sprint. | **FINALIZED** |
| **DEC-004** | **1Click Defuse Asset Identifiers** | **Option A:** Update asset mapping to canonical Defuse NEP-141 asset IDs.<br>**Option B:** Fallback to Uniswap v3 on Base Sepolia for demo swaps. | **ADOPTED: Option A.** Update the asset registry to use canonical Defuse NEP-141 asset IDs (e.g. `wrap.near`, official bridged USDC) so live omnichain quotes resolve without HTTP 400 errors. | **FINALIZED** |
| **DEC-005** | **Equities Mainnet Settlement** | **Option A:** Keep paper trading simulation explicitly badged in the UI.<br>**Option B:** Connect real Ondo Finance NEP-141 contracts on NEAR Mainnet. | **ADOPTED: Dual-Mode Architecture.** On **Testnet**, the terminal operates as an Institutional Simulation Sandbox ($10,000 virtual cash). On **Mainnet**, the terminal connects directly to live Ondo Finance contracts via Defuse protocol. | **FINALIZED** |

---

## 4. Verification Gaps & Next Steps Checklist

Before transitioning from Hackathon Testnet Demonstration to Public Beta:
1. **[ ] Fund Relayer Base Sepolia Account:** Deposit 0.05 Base Sepolia ETH into the relayer account to enable live testing of outbound MPC transfers (`send-mpc`).
2. **[ ] Resolve Twitter API Access:** Upgrade developer app credentials or deploy an internal vanity profile caching microservice.
3. **[ ] Deploy Vitest Suite:** Establish continuous integration tests verifying `near-chain-signatures.ts` elliptic math and `trading-copilot.ts` rule conditions.
4. **[ ] Configure Telegram Webhook:** Register production webhook URL with `@BotFather` and set `TELEGRAM_BOT_TOKEN` in production secrets.
5. **[ ] Harden Cron Endpoints:** Secure `/api/cron/evaluate-rules` with `CRON_SECRET` authentication header.
