# VEILX AGENT — EXTERNAL DEPENDENCIES & PERSONAL ACTION CHECKLIST

**Document Version:** 1.0.0  
**Status:** OWNER ACTION INVENTORY  
**Date:** November 2026  

---

## 1. OWNER ACTION & CREDENTIAL CHECKLIST

This document lists every external service, account registration, credential generation, and formal architectural approval required personally from you as the project owner.

> **CRITICAL SECURITY NOTICE**: Never post private keys, master seed phrases, or production database credentials in chat, Git commits, or public communication channels. Store all generated secrets strictly in your local `.env.local` file.

---

### ACTION ITEM 1: Obtain NEAR AI Cloud API Credentials
* **What you need to do**: Create a developer account on NEAR AI Cloud and generate an API key.
* **Why it is needed**: Required to route sensitive financial tool execution through confidential Intel TDX / NVIDIA H100 hardware TEE enclaves.
* **Where to do it**: Visit `https://cloud.near.ai` or `https://app.near.ai` $\rightarrow$ Sign in with your NEAR wallet or email $\rightarrow$ Navigate to **API Keys** $\rightarrow$ Create Key (`sk-near-ai-...`).
* **Configuration Required**: Add to `.env.local`:
  ```bash
  NEAR_AI_API_KEY="sk-near-ai-..."
  NEAR_AI_MODEL="meta-llama/Llama-3.3-70B-Instruct"
  ```
* **Status**: **Optional for Core Launch (Recommended for Phase 3)**.
* **Blocked Integration**: Confidential AI reasoning tier (`src/lib/ai-gateway.ts`).
* **Verification**: Run `curl -X POST https://api.near.ai/v1/chat/completions -H "Authorization: Bearer $NEAR_AI_API_KEY" -H "Content-Type: application/json" -d '{"model":"meta-llama/Llama-3.3-70B-Instruct","messages":[{"role":"user","content":"ping"}]}'`.

---

### ACTION ITEM 2: Configure 1Click (NEAR Intents) Referral Fee Account
* **What you need to do**: Register or designate a NEAR Testnet/Mainnet account to receive referral revenue from cross-chain solver transactions executed via VeilX.
* **Why it is needed**: The 1Click Swap API allows integrators to collect a developer fee (e.g. 5–15 bps) on cross-chain volume routed through their application.
* **Where to do it**: Add your NEAR account ID to the 1Click configuration parameters in `.env.local`:
  ```bash
  NEXT_PUBLIC_ONECLICK_REFERRAL_ACCOUNT="veilx-agent.testnet"
  ```
* **Status**: **Mandatory for Phase 2 Monetization (Optional for pure testnet testing)**.
* **Blocked Integration**: Referral fee aggregation in `src/lib/1click.ts`.
* **Verification**: Verified automatically when quotes return `referralShare` in JSON payloads.

---

### ACTION ITEM 3: Register OutLayer Enclave Coordinator Account
* **What you need to do**: If you approve decentralized background execution in Phase 5, generate an OutLayer coordinator account and fund it with testnet USDC / NEAR.
* **Why it is needed**: OutLayer TEE workers require micro-payments (USDC payment keys or NEAR gas) to execute WASI verification tasks and call `promise_yield_resume`.
* **Where to do it**: Visit `https://outlayer.ai` $\rightarrow$ Connect NEAR Wallet $\rightarrow$ Generate Enclave Payment Key.
* **Configuration Required**:
  ```bash
  OUTLAYER_PAYMENT_KEY="pk_outlayer_..."
  OUTLAYER_COORDINATOR_URL="https://api.outlayer.ai"
  ```
* **Status**: **Optional (Deferred to Phase 5)**.
* **Blocked Integration**: Decentralized escrow timeout refunds via `yield/resume`.
* **Verification**: Test ping via OutLayer CLI: `outlayer ping --key $OUTLAYER_PAYMENT_KEY`.

---

### ACTION ITEM 4: Fund Primary Testnet Relayer & Gas Pool
* **What you need to do**: Ensure `veilx-agent.testnet` has sufficient testnet NEAR tokens to subsidize gas for user session keys.
* **Why it is needed**: VeilX operates a gasless meta-transaction relayer (NEP-366). When users tip or withdraw, the relayer pays the ~0.0008 NEAR gas fee on their behalf.
* **Where to do it**: Open the official NEAR Testnet Faucet (`https://faucet.testnet.near.org`) or send 20–50 testnet NEAR to `veilx-agent.testnet`.
* **Configuration Required**: Account is already configured in `.env.local` (`NEXT_PUBLIC_ESCROW_CONTRACT_ID="veilx-agent.testnet"`).
* **Status**: **Mandatory for Live User Testing**.
* **Blocked Integration**: Gasless social tipping and claim execution.
* **Verification**: Check balance at `https://testnet.nearblocks.io/address/veilx-agent.testnet`. Target balance: $> 10$ NEAR.

---

### ACTION ITEM 5: Formally Review & Approve Architectural Decisions
* **What you need to do**: Provide your formal sign-off on the architectural choices evaluated in this research report:
  1. **DEC-05 (NEAR Intents)**: Approve 1Click solver auction matrix as the primary cross-chain settlement engine for VeilX.
  2. **DEC-06 (Privacy Commitments)**: Approve updating the smart contract to store recipient commitment hashes (`Hash(handle || salt)`) instead of plaintext Twitter handles.
  3. **DEC-07 (Hybrid AI)**: Approve keeping Gemini for instant conversational UI turns while routing sensitive financial tool calls through NEAR AI Cloud TEEs.
* **Why it is needed**: In accordance with the strict project guidelines, no code changes, smart contract redeployments, or architecture modifications occur without your explicit approval.
* **Where to do it**: Respond in chat with: *"I approve DEC-05, DEC-06, and DEC-07"* (or provide adjustments).
* **Status**: **Mandatory Before Phase 1 Implementation Begins**.
