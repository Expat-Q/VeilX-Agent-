# VEILX AGENT — NEAR INTEGRATION ROADMAP & IMPLEMENTATION BLUEPRINT

**Document Version:** 1.0.0  
**Status:** COMPLETE INTEGRATION BLUEPRINT  
**Author:** Senior Technical Project Manager & Protocol Architect  
**Date:** November 2026  
**Implementation Plan:** See [**`VEILX_NEAR_INTEGRATION_IMPLEMENTATION_PLAN.md`**](./VEILX_NEAR_INTEGRATION_IMPLEMENTATION_PLAN.md) for task-by-task engineering specs, Rust signatures, and test matrices.

---

## 1. TECHNOLOGY CLASSIFICATION MATRIX

Every evaluated NEAR ecosystem technology has been classified based on immediate business value, technical maturity, and architectural risk:

### Category A: Integrate Immediately (High Value, Production Ready)
1. **NEAR Intents (1Click Swap API)**: Enables real declarative cross-chain social tipping and multi-asset PayLink checkouts without manual bridging.
2. **Payment Metadata Privacy (Commitment Hashing)**: Eliminates plaintext Twitter handles from the NEAR escrow smart contract (`veilx-escrow`).
3. **Application Metadata Privacy (AES-256-GCM)**: Encrypts invoice notes, memos, and counterparty communications before storage in MongoDB.

### Category B: Integrate After Core Functionality Is Stable (P1 / Post-Testnet)
1. **NEAR AI Cloud (`api.near.ai`)**: Confidential TEE inference for sensitive financial tool execution and private transaction reasoning.
2. **Outbound NEAR Chain Signatures MPC**: Calling `sign` on `v1.signer` to broadcast signed transactions to Base, Ethereum, and Solana directly from a NEAR session.
3. **Ephemeral Stealth Subaccounts**: Dynamic provisioning of single-use claim subaccounts to completely break the public link between Twitter handles and long-term crypto wallets.
4. **OutLayer (`outlayer.ai`)**: Hardware-attested decentralized background automation via smart contract `yield/resume` to replace centralized server pollers.

### Category C: Research & Prototype (Proof-of-Concept Stage)
1. **Zero-Knowledge Shielded Pool (HideYour.cash / Circom)**: True mathematical UTXO anonymity on NEAR. Evaluate mobile browser proof generation latency and compliance trade-offs.
2. **FastAuth / Passkeys WebAuthn**: Hardware biometric authentication to anchor session keys to iCloud Keychain / Android passkeys.

### Category D: Do Not Integrate at This Stage
1. **Fully Homomorphic Encryption (FHE)**: Too slow and computationally expensive for interactive real-time social finance applications in 2026.
2. **Direct Cross-Chain Liquidity Bridges (Rainbow Bridge manual calls)**: Obsolete for end-user social UX; replaced by superior solver-based NEAR Intents.

---

## 2. PHASED IMPLEMENTATION ROADMAP

```
+─────────────────────────────────────────────────────────────────────────────+
| PHASE 0: Architectural Alignment & Owner Approvals (DEC-01 to DEC-06)       |
+─────────────────────────────────────────────────────────────────────────────+
                                       │
                                       ▼
+─────────────────────────────────────────────────────────────────────────────+
| PHASE 1: Existing Infrastructure Hardening & Immediate Privacy (Level 1 & 2)|
+─────────────────────────────────────────────────────────────────────────────+
                                       │
                                       ▼
+─────────────────────────────────────────────────────────────────────────────+
| PHASE 2: NEAR Intents & 1Click Cross-Chain Execution Integration            |
+─────────────────────────────────────────────────────────────────────────────+
                                       │
                                       ▼
+─────────────────────────────────────────────────────────────────────────────+
| PHASE 3: Confidential AI Reasoning with NEAR AI Cloud (Hybrid Router)       |
+─────────────────────────────────────────────────────────────────────────────+
                                       │
                                       ▼
+─────────────────────────────────────────────────────────────────────────────+
| PHASE 4: Stealth Disbursement Subaccounts & Chain Signatures Outbound Signing|
+─────────────────────────────────────────────────────────────────────────────+
                                       │
                                       ▼
+─────────────────────────────────────────────────────────────────────────────+
| PHASE 5: Decentralized Automation with OutLayer TEE Enclaves                |
+─────────────────────────────────────────────────────────────────────────────+
                                       │
                                       ▼
+─────────────────────────────────────────────────────────────────────────────+
| PHASE 6: Full-System Integration Verification & Public Testnet Release      |
+─────────────────────────────────────────────────────────────────────────────+
```

---

### PHASE 0: ARCHITECTURAL ALIGNMENT & OWNER APPROVALS
* **Objective**: Review research findings, validate trade-offs, and formally approve architectural decisions.
* **Owner Decisions Required**:
  * [ ] **DEC-05**: Approve NEAR Intents (1Click) as the primary cross-chain settlement engine.
  * [ ] **DEC-06**: Approve smart contract commitment hashing (`Hash(handle || salt)`) to hide Twitter handles from NEARBlocks.
  * [ ] **DEC-07**: Approve Hybrid AI routing strategy (Gemini for speed + NEAR AI Cloud for confidential financial execution).
* **Estimated Effort**: 1 Day.
* **Complexity**: Low.

---

### PHASE 1: EXISTING INFRASTRUCTURE HARDENING & IMMEDIATE PRIVACY
* **Objective**: Remove plaintext privacy leaks and deploy client-side metadata encryption without disrupting existing functionality.
* **Technologies Involved**: Rust `near-sdk` 5.30, Web Crypto API (SubtleCrypto: AES-256-GCM), SHA-256.
* **Required Changes**:
  1. Upgrade [`contracts/veilx-escrow/src/lib.rs`](file:///C:/Users/HomePC/Downloads/VeilX-Agent/contracts/veilx-escrow/src/lib.rs): Update `deposit_near` to accept 32-byte commitment hash instead of plaintext handle.
  2. Implement client-side AES-256-GCM encryption in `src/lib/session.ts` for all PayLink and transaction memos.
* **Expected Benefits**: Eliminates public surveillance of recipient handles on NEAR testnet explorer.
* **Testing Strategy**: Unit tests in Rust for commitment verification; automated E2E test for encrypted memo decryption.
* **Complexity**: Moderate.

---

### PHASE 2: NEAR INTENTS & 1CLICK CROSS-CHAIN EXECUTION
* **Objective**: Enable conversational cross-chain tipping (*"Pay Bob 10 USDC on Base"*) and multi-asset PayLink settlement.
* **Technologies Involved**: 1Click Swap API (`https://1click.chaindefuser.com`), `@defuse-protocol/intents-sdk`.
* **Required Changes**:
  1. Expand `src/lib/1click.ts` with full lifecycle management (`createIntentOrder`, `pollExecutionStatus`).
  2. Register `execute_cross_chain_intent` in `src/lib/ai-gateway.ts`.
  3. Build 1-Click Intent Confirmation Card component with 60-second expiration countdown in `ChatContainer.tsx`.
* **Expected Benefits**: Users can pay or receive funds across Base, Arbitrum, Solana, and NEAR with zero manual bridging.
* **Testing Strategy**: Testnet execution suite simulating solver fulfillment and timeout refunds.
* **Complexity**: High.

---

### PHASE 3: CONFIDENTIAL AI REASONING WITH NEAR AI CLOUD
* **Objective**: Route sensitive financial instructions through hardware-isolated TEE enclaves to prevent prompt data leakage.
* **Technologies Involved**: NEAR AI Cloud (`https://api.near.ai/v1`), Intel TDX / NVIDIA H100 Confidential Computing.
* **Required Changes**:
  1. Implement Hybrid Classifier Router in `src/lib/ai-gateway.ts`.
  2. Wire OpenAI-compatible client targeting `api.near.ai` for financial tool declarations.
  3. Configure circuit-breaker fallback to Gemini if TEE latency exceeds 2.5 seconds.
* **Expected Benefits**: Hardware-guaranteed zero prompt retention for corporate invoices and high-value tips.
* **Testing Strategy**: Mock and live latency benchmarking suite (`scripts/test-near-ai-latency.mjs`).
* **Complexity**: Moderate.

---

### PHASE 4: STEALTH SUBACCOUNTS & OUTBOUND CHAIN SIGNATURES
* **Objective**: Provide complete omnichain account control and break the social-to-wallet graph link.
* **Technologies Involved**: NEAR Account Factory, NEAR Chain Signatures MPC (`v1.signer-prod.testnet`).
* **Required Changes**:
  1. Implement Ephemeral Subaccount Factory provisioning `claim-*.veilx-agent.testnet` during payouts.
  2. Implement outbound MPC sign request in `src/lib/near-chain-signatures.ts` to broadcast signed raw transactions to Base Sepolia RPC.
* **Expected Benefits**: True omnichain terminal experience where a single NEAR account directly controls external EVM balances.
* **Complexity**: High.

---

### PHASE 5: DECENTRALIZED AUTOMATION WITH OUTLAYER
* **Objective**: Replace centralized Next.js background reconciliation with unstoppable TEE workers.
* **Technologies Involved**: OutLayer (`outlayer.ai`), Intel TDX WASI, NEAR smart contract `yield/resume`.
* **Required Changes**:
  1. Author and compile WASI verification binary for OutLayer.
  2. Integrate `env::promise_yield_create` in `veilx-escrow` for 30-day automated escrow refund timers.
* **Expected Benefits**: 100% decentralized, serverless operation with zero backend single points of failure.
* **Complexity**: High.

---

### PHASE 6: FULL-SYSTEM INTEGRATION VERIFICATION & PUBLIC RELEASE
* **Objective**: Comprehensive end-to-end regression testing, attack simulation, and public testnet release.
* **Success Criteria**:
  * All 19 Next.js routes operational.
  * All 6 sequence workflows pass automated test execution.
  * Zero plaintext Twitter handles or private memos exposed on-chain or in unencrypted DB storage.
  * Sub-second UI chat responsiveness preserved.
